import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from reservations.api import admin, auth, courts, facility_blocks, favorites, notifications, reservations, reviews, waitlist
from reservations.config import settings
from reservations.deps import session_factory
from reservations.worker import run_forever


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

settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.upload_dir), name="static")

app.include_router(auth.router)
app.include_router(courts.router)
app.include_router(reservations.router)
app.include_router(waitlist.router)
app.include_router(notifications.router)
app.include_router(facility_blocks.router)
app.include_router(reviews.router)
app.include_router(favorites.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
