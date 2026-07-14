from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings


class FileStorageService:
    ALLOWED_IMAGES = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    def __init__(self) -> None:
        settings = get_settings()
        self.media_root = Path(settings.media_root).resolve()
        self.url_prefix = settings.media_url_prefix.rstrip("/")
        self.max_size = settings.max_upload_size_bytes

    def save_image(self, file: UploadFile, folder: str, previous_url: str | None = None) -> str:
        extension = self._validate_image(file)
        content = self._read_limited(file)

        target_dir = (self.media_root / folder).resolve()
        if not target_dir.is_relative_to(self.media_root):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage folder")
        target_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{uuid4().hex}{extension}"
        destination = target_dir / filename
        destination.write_bytes(content)

        self.delete_by_url(previous_url)
        return f"{self.url_prefix}/{folder}/{filename}"

    def delete_by_url(self, url: str | None) -> None:
        if not url:
            return
        if url.startswith(f"{self.url_prefix}/"):
            relative_path = url.removeprefix(f"{self.url_prefix}/")
        elif url.startswith("/static/uploads/"):
            relative_path = url.removeprefix("/static/uploads/")
        else:
            return
        target = (self.media_root / relative_path).resolve()
        if not target.is_relative_to(self.media_root):
            return
        if target.is_file():
            target.unlink()

    def ensure_directories(self) -> None:
        (self.media_root / "products").mkdir(parents=True, exist_ok=True)
        (self.media_root / "business").mkdir(parents=True, exist_ok=True)

    def _validate_image(self, file: UploadFile) -> str:
        content_type = (file.content_type or "").lower()
        original_extension = Path(file.filename or "").suffix.lower()
        expected_extension = self.ALLOWED_IMAGES.get(content_type)
        if expected_extension is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")
        if original_extension and original_extension not in set(self.ALLOWED_IMAGES.values()) | {".jpeg"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image extension")
        return expected_extension

    def _read_limited(self, file: UploadFile) -> bytes:
        content = file.file.read(self.max_size + 1)
        if len(content) > self.max_size:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Uploaded file is too large")
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
        return content
