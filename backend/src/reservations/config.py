import os
from pathlib import Path

DEFAULT_DATABASE_URL = "postgresql+psycopg://reservations:reservations@localhost:5432/reservations"
DEFAULT_SECRET_KEY = "dev-only-insecure-secret-change-me"
DEFAULT_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


class Settings:
    def __init__(self) -> None:
        self.database_url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
        self.secret_key = os.environ.get("SECRET_KEY", DEFAULT_SECRET_KEY)
        self.access_token_expire_minutes = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        self.frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
        self.upload_dir = Path(os.environ.get("UPLOAD_DIR", str(DEFAULT_UPLOAD_DIR)))


settings = Settings()
