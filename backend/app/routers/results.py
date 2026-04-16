from __future__ import annotations
"""Results retrieval endpoints."""

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.database import (
    get_scan, get_scan_detections, get_scan_frames, list_scans,
)
from app.config import RESULTS_DIR

router = APIRouter(prefix="/api/results", tags=["results"])


@router.get("/scans")
async def get_all_scans():
    """List all scans."""
    scans = list_scans()
    return {"scans": scans}


@router.get("/scans/{scan_id}")
async def get_scan_details(scan_id: str):
    """Get full scan results including all detections."""
    scan = get_scan(scan_id)
    if not scan:
        raise HTTPException(404, f"Scan {scan_id} not found")

    detections = get_scan_detections(scan_id)
    frames = get_scan_frames(scan_id)

    # Parse weather JSON (handle both dict from JSONB and string)
    weather_raw = scan.get("weather_json", {})
    if isinstance(weather_raw, str):
        weather = json.loads(weather_raw or "{}")
    else:
        weather = weather_raw or {}

    return {
        "scan": {
            **scan,
            "weather": weather,
        },
        "detections": detections,
        "frames": frames,
        "summary": {
            "total_frames": scan["total_frames"],
            "total_detections": scan["total_detections"],
            "signs_detected": scan["signs_detected"],
            "markings_detected": scan["markings_detected"],
            "studs_detected": scan["studs_detected"],
            "compliance_pass": scan["compliance_pass"],
            "compliance_fail": scan["compliance_fail"],
            "avg_retro_score": scan["avg_retro_score"],
            "retro_distribution": _compute_distribution(detections),
            "category_breakdown": _compute_category_breakdown(detections),
            "priority_breakdown": _compute_priority_breakdown(detections),
            "total_maintenance_cost": sum(d.get("cost_estimate", 0) for d in detections),
        },
    }


@router.get("/scans/{scan_id}/detections")
async def get_detections(scan_id: str, category: Optional[str] = None):
    """Get detections for a scan, optionally filtered by category."""
    detections = get_scan_detections(scan_id)
    if category:
        detections = [d for d in detections if d["category"] == category]
    return {"detections": detections}


@router.get("/scans/{scan_id}/frames/{frame_index}/image")
async def get_frame_image(scan_id: str, frame_index: int, annotated: bool = True):
    """Get a frame image (raw or annotated)."""
    subdir = "annotated" if annotated else "frames"
    prefix = "annotated_" if annotated else "frame_"
    path = RESULTS_DIR / scan_id / subdir / f"{prefix}{frame_index:06d}.jpg"

    if not path.exists():
        raise HTTPException(404, "Frame not found")
    return FileResponse(str(path), media_type="image/jpeg")


@router.get("/scans/{scan_id}/thumbnails/{detection_id}")
async def get_thumbnail(scan_id: str, detection_id: str):
    """Get a detection thumbnail."""
    # Search for thumbnail file
    thumb_dir = RESULTS_DIR / scan_id / "thumbnails"
    if not thumb_dir.exists():
        raise HTTPException(404, "Thumbnails not found")

    # Try exact match
    for f in thumb_dir.glob(f"det_*_{detection_id}.jpg"):
        return FileResponse(str(f), media_type="image/jpeg")

    # Try by index
    thumbs = sorted(thumb_dir.glob("det_*.jpg"))
    try:
        idx = int(detection_id)
        if 0 <= idx < len(thumbs):
            return FileResponse(str(thumbs[idx]), media_type="image/jpeg")
    except (ValueError, IndexError):
        pass

    raise HTTPException(404, "Thumbnail not found")


def _compute_distribution(detections: list[dict]) -> dict:
    """Compute retroreflectivity class distribution."""
    dist = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "FAILED": 0}
    for d in detections:
        cls = d.get("retro_class", "MEDIUM")
        dist[cls] = dist.get(cls, 0) + 1
    return dist


def _compute_category_breakdown(detections: list[dict]) -> dict:
    """Compute detection counts by category."""
    breakdown = {}
    for d in detections:
        cat = d.get("category", "unknown")
        breakdown[cat] = breakdown.get(cat, 0) + 1
    return breakdown


def _compute_priority_breakdown(detections: list[dict]) -> dict:
    """Compute counts by maintenance priority."""
    breakdown = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for d in detections:
        p = d.get("priority", 5)
        breakdown[p] = breakdown.get(p, 0) + 1
    return breakdown
