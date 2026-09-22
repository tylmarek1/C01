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
REVIEW_IMAGE_MAX_DIMENSION = 1200
CHAT_IMAGE_MAX_DIMENSION = 1200
JPEG_QUALITY = 82
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
# A byte-size cap alone doesn't bound decode cost — a tiny, highly-
# compressed file can still claim an enormous pixel grid (a decompression
# bomb). Pillow has its own implicit default (~89M px) via
# Image.MAX_IMAGE_PIXELS, but leaving that as the only guard means the
# limit is inherited, not asserted. 50MP comfortably covers any real
# phone/camera photo used here (avatars/court photos), while decisively
# rejecting a small file claiming an outsized grid.
MAX_IMAGE_PIXELS = 50_000_000
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _upload_subdir(name: str) -> Path:
    directory = settings.upload_dir / name
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _compress_and_store(
    upload: UploadFile, raw: bytes, subdir: str, max_dimension: int
) -> str:
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "File must be a JPEG, PNG, WEBP or GIF image"
        )
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "File must be smaller than 8MB"
        )

    try:
        image = Image.open(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "File is not a valid image"
        ) from exc

    # Cheap: Image.open() only reads the header. Check dimensions before the
    # expensive full decode below, which is exactly the cost a decompression
    # bomb is designed to trigger.
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Image dimensions are too large"
        )

    try:
        image.load()
    except Exception as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "File is not a valid image"
        ) from exc

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


def compress_and_store_team_avatar(upload: UploadFile, raw: bytes) -> str:
    return _compress_and_store(upload, raw, "team_avatars", AVATAR_MAX_DIMENSION)


def compress_and_store_court_image(upload: UploadFile, raw: bytes) -> str:
    return _compress_and_store(upload, raw, "courts", COURT_IMAGE_MAX_DIMENSION)


def compress_and_store_review_image(upload: UploadFile, raw: bytes) -> str:
    return _compress_and_store(upload, raw, "reviews", REVIEW_IMAGE_MAX_DIMENSION)


def compress_and_store_chat_attachment(upload: UploadFile, raw: bytes) -> str:
    return _compress_and_store(upload, raw, "chat", CHAT_IMAGE_MAX_DIMENSION)
