"""Upload storage: resize + re-encode so a phone photo never ships
multi-megabyte over the wire, and normalize to one predictable format/name."""

import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

from reservations.config import settings

AVATAR_MAX_DIMENSION = 512
COURT_IMAGE_MAX_DIMENSION = 1600
JPEG_QUALITY = 82
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _upload_subdir(name: str) -> Path:
    directory = settings.upload_dir / name
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _compress_and_store(upload: UploadFile, raw: bytes, subdir: str, max_dimension: int) -> str:
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be a JPEG, PNG, WEBP or GIF image")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be smaller than 8MB")

    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is not a valid image") from exc

    image = ImageOps.exif_transpose(image) or image
    image = image.convert("RGB")
    image.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)

    filename = f"{uuid.uuid4()}.jpg"
    destination = _upload_subdir(subdir) / filename
    destination.write_bytes(buffer.getvalue())

    return f"/static/{subdir}/{filename}"


def compress_and_store_avatar(upload: UploadFile, raw: bytes) -> str:
    return _compress_and_store(upload, raw, "avatars", AVATAR_MAX_DIMENSION)


def compress_and_store_court_image(upload: UploadFile, raw: bytes) -> str:
    return _compress_and_store(upload, raw, "courts", COURT_IMAGE_MAX_DIMENSION)
