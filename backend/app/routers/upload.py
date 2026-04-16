"""Upload endpoints for video/image files."""

import uuid
import shutil
from pathlib import Path
from threading import Thread

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.config import UPLOAD_DIR
from app.schemas.models import UploadResponse
from app.services.database import create_scan
from app.services.video_processor import process_video, process_image

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


@router.post("/", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """Upload a video or image file for analysis."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = Path(file.filename).suffix.lower()
    is_video = ext in ALLOWED_VIDEO_EXTS
    is_image = ext in ALLOWED_IMAGE_EXTS

    if not (is_video or is_image):
        raise HTTPException(
            400,
            f"Unsupported file type: {ext}. Allowed: {ALLOWED_VIDEO_EXTS | ALLOWED_IMAGE_EXTS}",
        )

    scan_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{scan_id}{ext}"

    # Save file
    with open(file_path, "wb") as f:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large. Maximum 500MB.")
        f.write(content)

    # Create scan record
    create_scan(scan_id, file.filename)

    # Process in background thread
    processor = process_video if is_video else process_image
    thread = Thread(target=processor, args=(scan_id, str(file_path)), daemon=True)
    thread.start()

    return UploadResponse(
        scan_id=scan_id,
        filename=file.filename,
        status="processing",
        message=f"{'Video' if is_video else 'Image'} uploaded. Analysis started.",
    )
