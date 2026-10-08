"""Structured application logs (ADR-007).

Every request gets a request id (a valid incoming `X-Request-ID`, else a
fresh one), echoed back in the response header and attached — together with
the signed-in user's id — to every `reservations.*` log line written while
that request is handled, and to the audit log rows it causes (`audit.py`).

`configure_logging()` is only called by the running server (`main.py`'s
lifespan); under pytest the stdlib defaults stay in place so `caplog` sees
records as usual."""

import contextvars
import json
import logging
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

access_logger = logging.getLogger("reservations.access")


@dataclass
class RequestContext:
    request_id: str
    # Filled in by deps.get_current_user once the bearer token is decoded.
    # A mutable field rather than a second ContextVar: the dependency runs in
    # a worker thread with a *copy* of the context, so only a change to this
    # shared object is visible back in the middleware's access log line.
    user_id: str | None = None


_current: contextvars.ContextVar[RequestContext | None] = contextvars.ContextVar(
    "request_context", default=None
)


def current_context() -> RequestContext | None:
    return _current.get()


def bind_user(user_id: uuid.UUID) -> None:
    context = _current.get()
    if context is not None:
        context.user_id = str(user_id)


class RequestContextMiddleware:
    """Pure ASGI (not BaseHTTPMiddleware) so the context is set in the same
    task the route runs in, and the status code is read off the response as
    it's sent."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = (
            dict(scope["headers"])
            .get(REQUEST_ID_HEADER.lower().encode(), b"")
            .decode("latin-1")
        )
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        context = RequestContext(request_id=request_id)
        # Not reset afterwards on purpose: each ASGI request runs in its own
        # task with its own copy of the context, and the catch-all 500
        # handler (outside this middleware) still logs with this request id.
        _current.set(context)

        status_code = 500
        started = time.perf_counter()

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append(
                    (REQUEST_ID_HEADER.lower().encode(), request_id.encode())
                )
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            # The route template, not the raw path or query string: the
            # calendar feed carries its token in the query, and ids in a path
            # would make every line unique.
            route = scope.get("route")
            path = getattr(route, "path", None) or scope["path"]
            access_logger.info(
                "%s %s %s",
                scope["method"],
                path,
                status_code,
                extra={
                    "request_id": context.request_id,
                    "user_id": context.user_id,
                    "method": scope["method"],
                    "path": path,
                    "status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )


# Attributes every LogRecord has; anything else on a record came from `extra=`.
_STANDARD_ATTRS = set(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {
    "message",
    "asctime",
    "request_id",
    "user_id",
    "taskName",
}


class ContextFilter(logging.Filter):
    """Stamps the current request's id and user on a record, unless the
    caller already passed them (the access log line does)."""

    def filter(self, record: logging.LogRecord) -> bool:
        context = _current.get()
        if not hasattr(record, "request_id"):
            record.request_id = context.request_id if context else None
        if not hasattr(record, "user_id"):
            record.user_id = context.user_id if context else None
        return True


def _fields(record: logging.LogRecord) -> dict[str, object]:
    fields: dict[str, object] = {
        "request_id": getattr(record, "request_id", None),
        "user_id": getattr(record, "user_id", None),
    }
    fields.update(
        {
            k: v
            for k, v in vars(record).items()
            if k not in _STANDARD_ATTRS and not k.startswith("_")
        }
    )
    return {k: v for k, v in fields.items() if v is not None}


def _timestamp(record: logging.LogRecord) -> str:
    return datetime.fromtimestamp(record.created, timezone.utc).isoformat(
        timespec="milliseconds"
    )


class JsonFormatter(logging.Formatter):
    """One JSON object per line — for anything that ships logs somewhere."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": _timestamp(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            **_fields(record),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class KeyValueFormatter(logging.Formatter):
    """Readable in a terminal, still greppable: `... message key=value`."""

    def format(self, record: logging.LogRecord) -> str:
        line = f"{_timestamp(record)} {record.levelname:<7} {record.name} {record.getMessage()}"
        fields = " ".join(f"{k}={v}" for k, v in _fields(record).items())
        if fields:
            line = f"{line} {fields}"
        if record.exc_info:
            line = f"{line}\n{self.formatException(record.exc_info)}"
        return line


def configure_logging(log_format: str, level: str) -> None:
    handler = logging.StreamHandler()
    handler.addFilter(ContextFilter())
    handler.setFormatter(
        JsonFormatter() if log_format == "json" else KeyValueFormatter()
    )
    app_logger = logging.getLogger("reservations")
    app_logger.handlers = [handler]
    app_logger.setLevel(level.upper())
    app_logger.propagate = False
    # reservations.access already logs every request, with the request id,
    # user and duration — uvicorn's own access line would just duplicate it.
    logging.getLogger("uvicorn.access").disabled = True
