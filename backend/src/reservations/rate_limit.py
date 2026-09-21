"""In-memory, per-process rate limiting for abuse-prone endpoints.

Single-process only — this app has no server-side session store either
(ADR-003), and runs as one in-process worker (`worker.py`), so an
in-memory limiter matches the current deployment model rather than adding
a Redis/DB dependency for a scale this project doesn't operate at. If the
app is ever run as multiple processes/instances, this stops being
effective and needs a shared store instead — treat that as a signal this
has outgrown "no infra," not something to silently work around.
"""

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, status

_lock = threading.Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def enforce_rate_limit(key: str, *, max_attempts: int, window_seconds: float) -> None:
    """Raise 429 if `key` has hit `max_attempts` within the trailing `window_seconds`.

    Counts this call as an attempt. Callers that want a success to not
    count against the window should call `reset(key)` afterward.
    """
    now = time.monotonic()
    cutoff = now - window_seconds
    with _lock:
        attempts = _attempts[key]
        while attempts and attempts[0] < cutoff:
            attempts.pop(0)
        if len(attempts) >= max_attempts:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many attempts. Try again later.",
            )
        attempts.append(now)


def reset(key: str) -> None:
    with _lock:
        _attempts.pop(key, None)


def reset_all() -> None:
    """Test-only: clear all rate-limit state between tests."""
    with _lock:
        _attempts.clear()
