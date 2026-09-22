import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from reservations.api import (
    admin,
    auth,
    challenges,
    chat,
    courts,
    facility_blocks,
    favorites,
    notifications,
    push,
    ratings,
    reservations,
    reviews,
    social,
    stats,
    teams,
    waitlist,
)
from reservations.config import settings
from reservations.deps import session_factory
from reservations.worker import run_forever

logger = logging.getLogger("reservations.api")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Skipped under pytest (TestClient(app) without `with` never triggers
    # lifespan anyway, but `uv run pytest` also sets this so a `with`-style
    # test client wouldn't accidentally spin up a second worker loop either).
    worker_task = None
    if os.environ.get("PYTEST_CURRENT_TEST") is None:
        worker_task = asyncio.create_task(run_forever(session_factory))
    try:
        yield
    finally:
        if worker_task is not None:
            worker_task.cancel()


app = FastAPI(title="Sports Court Reservations", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    # Vite auto-increments the port when 5173 is taken, so also allow any
    # localhost port in dev instead of forcing FRONTEND_ORIGIN to be updated.
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class _CachedStaticFiles(StaticFiles):
    """images.py always writes a fresh UUID filename (never overwrites an
    existing one), so a URL under /static never changes its content — safe
    to tell the browser to cache it indefinitely instead of revalidating
    with the server on every page view."""

    def file_response(self, *args, **kwargs) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", _CachedStaticFiles(directory=settings.upload_dir), name="static")

app.include_router(auth.router)
app.include_router(courts.router)
app.include_router(reservations.router)
app.include_router(waitlist.router)
app.include_router(notifications.router)
app.include_router(facility_blocks.router)
app.include_router(reviews.router)
app.include_router(favorites.router)
app.include_router(admin.router)
app.include_router(stats.router)
app.include_router(push.router)
app.include_router(social.router)
app.include_router(chat.router)
app.include_router(teams.router)
app.include_router(ratings.router)
app.include_router(challenges.router)


@app.exception_handler(Exception)
async def log_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """Routers raise HTTPException deliberately (handled by FastAPI's own
    default handler, untouched by this); this only catches genuine bugs —
    previously an unhandled exception produced no application-level log
    line anywhere. Not a logging platform, just the minimum that makes an
    unexpected 500 visible instead of silent."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
