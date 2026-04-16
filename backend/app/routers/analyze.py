from __future__ import annotations
"""Analysis and progress endpoints."""

import cv2
import base64
import numpy as np
from io import BytesIO
from threading import Thread

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Body

from app.schemas.models import AnalysisProgress
from app.services.database import get_scan_progress, get_scan
from app.models.detector import AssetDetector
from app.models.retroreflectivity import RetroReflectivityEstimator
from app.models.condition import ConditionAnalyzer
from app.models.weather import WeatherClassifier
from app.utils.image_utils import crop_roi, draw_detections

router = APIRouter(prefix="/api/analyze", tags=["analyze"])

# Lazy singletons for live analysis
_live_detector = None
_live_estimator = None
_live_analyzer = None
_live_weather = None

def _get_live_models():
    global _live_detector, _live_estimator, _live_analyzer, _live_weather
    if _live_detector is None:
        _live_detector = AssetDetector()
        _live_estimator = RetroReflectivityEstimator()
        _live_analyzer = ConditionAnalyzer()
        _live_weather = WeatherClassifier()
    return _live_detector, _live_estimator, _live_analyzer, _live_weather


@router.get("/progress/{scan_id}", response_model=AnalysisProgress)
async def get_progress(scan_id: str):
    """Get analysis progress for a scan."""
    progress = get_scan_progress(scan_id)
    if not progress:
        raise HTTPException(404, f"Scan {scan_id} not found")

    return AnalysisProgress(
        scan_id=progress["scan_id"],
        status=progress["status"],
        progress=progress["progress"],
        current_step=progress.get("current_step", ""),
        frames_processed=int(progress["progress"] / 100 * max(progress.get("total_frames", 1), 1)),
        total_frames=progress.get("total_frames", 0),
    )


@router.post("/frame")
async def analyze_frame(payload: dict = Body(...)):
    """
    HTTP POST endpoint for live frame analysis.
    Accepts {"frame": "<base64 jpeg>"} and returns detections + annotated frame.
    Works through ngrok/proxies unlike WebSocket.
    """
    detector, estimator, analyzer, weather_cls = _get_live_models()

    frame_b64 = payload.get("frame", "")
    if not frame_b64:
        raise HTTPException(400, "No frame data")

    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception:
        raise HTTPException(400, "Invalid frame data")

    if frame is None:
        raise HTTPException(400, "Could not decode frame")

    weather = weather_cls.classify(frame)
    is_night = weather_cls.is_night(frame)

    detections = detector.detect(frame)
    results = []
    for det in detections:
        roi = crop_roi(frame, det["bbox"])
        retro = estimator.estimate(roi, category=det["category"], is_night=is_night)
        condition = analyzer.analyze(retro, det["class_name"], det["category"])
        results.append({
            "class_name": det["class_name"],
            "category": det["category"],
            "confidence": det["confidence"],
            "bbox": det["bbox"],
            "retro_class": retro["retro_class"],
            "retro_score": retro["retro_score"],
            "condition_grade": retro["condition_grade"],
            "compliant": condition["compliance"].get("compliant", False),
            "priority": condition["priority"],
        })

    annotated = draw_detections(frame, results)
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
    annotated_b64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "detections": results,
        "annotated_frame": annotated_b64,
        "weather": weather,
        "total_detections": len(results),
    }


@router.post("/save-session")
async def save_live_session(payload: dict = Body(...)):
    """
    Save a completed live scan session as a persistent scan.

    Expects:
    {
      "detections": [{class_name, retro_class, retro_score, ...}, ...],
      "weather": {...},
      "total_frames": int,
      "gps_lat": optional float,
      "gps_lng": optional float
    }
    """
    import uuid
    from datetime import datetime, timezone

    from app.services.database import create_scan, save_detection, update_scan_summary

    detections = payload.get("detections", [])
    weather = payload.get("weather", {})
    total_frames = int(payload.get("total_frames", 1))
    gps_lat = payload.get("gps_lat")
    gps_lng = payload.get("gps_lng")

    scan_id = str(uuid.uuid4())
    filename = f"live_scan_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

    create_scan(scan_id, filename)

    compliant_count = 0
    signs = markings = studs = 0
    score_sum = 0.0

    for i, det in enumerate(detections):
        category = det.get("category", "sign")
        if category == "sign":
            signs += 1
        elif category == "marking":
            markings += 1
        elif category == "stud":
            studs += 1

        if det.get("compliant", False):
            compliant_count += 1

        score_sum += float(det.get("retro_score", 0))

        retro_class = det.get("retro_class", "MEDIUM")
        retro_score = float(det.get("retro_score", 50))
        grade = {"HIGH": "A", "MEDIUM": "B", "LOW": "C", "FAILED": "F"}.get(retro_class, "B")

        priority = int(det.get("priority", 3))
        priority_labels = {
            1: "CRITICAL - Immediate action required",
            2: "HIGH - Schedule within 1 month",
            3: "MEDIUM - Schedule within 3 months",
            4: "LOW - Monitor in next inspection",
            5: "NONE - Asset in good condition",
        }

        save_detection(scan_id, {
            "frame_index": i,
            "timestamp_sec": i * 1.5,
            "class_name": det.get("class_name", "unknown"),
            "category": category,
            "confidence": float(det.get("confidence", 0.8)),
            "bbox": det.get("bbox", [0, 0, 100, 100]),
            "retro_class": retro_class,
            "retro_score": retro_score,
            "condition_grade": det.get("condition_grade", grade),
            "color_fading": float(det.get("color_fading", 30)),
            "surface_damage": float(det.get("surface_damage", 20)),
            "dirt_level": float(det.get("dirt_level", 15)),
            "legibility": float(det.get("legibility", 70)),
            "compliance": {
                "standard": "IRC 67" if category == "sign" else "IRC 35",
                "compliant": det.get("compliant", retro_score >= 50),
            },
            "priority": priority,
            "priority_label": priority_labels.get(priority, ""),
            "cost_estimate": 0,
            "issues": [],
            "age_estimate": "",
            "thumbnail_path": "",
            "gps_lat": gps_lat,
            "gps_lng": gps_lng,
            "sign_text": det.get("sign_text", ""),
            "sheeting_type": "",
            "remaining_life": "",
            "gemini_reasoning": "",
        })

    avg_score = score_sum / len(detections) if detections else 0

    update_scan_summary(scan_id, {
        "total_frames": total_frames,
        "total_detections": len(detections),
        "signs_detected": signs,
        "markings_detected": markings,
        "studs_detected": studs,
        "compliance_pass": compliant_count,
        "compliance_fail": len(detections) - compliant_count,
        "avg_retro_score": round(avg_score, 1),
        "weather": weather,
    })

    return {"scan_id": scan_id, "filename": filename, "total_detections": len(detections)}


@router.websocket("/ws/live")
async def websocket_live_analysis(websocket: WebSocket):
    """
    WebSocket endpoint for live webcam analysis.

    Client sends base64-encoded frames, server returns detections.
    """
    await websocket.accept()

    detector = AssetDetector()
    estimator = RetroReflectivityEstimator()
    analyzer = ConditionAnalyzer()
    weather_cls = WeatherClassifier()

    try:
        while True:
            data = await websocket.receive_text()

            # Decode base64 frame
            try:
                img_bytes = base64.b64decode(data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception:
                await websocket.send_json({"error": "Invalid frame data"})
                continue

            if frame is None:
                await websocket.send_json({"error": "Could not decode frame"})
                continue

            # Classify conditions
            weather = weather_cls.classify(frame)
            is_night = weather_cls.is_night(frame)

            # Detect
            detections = detector.detect(frame)

            results = []
            for det in detections:
                roi = crop_roi(frame, det["bbox"])
                retro = estimator.estimate(roi, category=det["category"], is_night=is_night)
                condition = analyzer.analyze(retro, det["class_name"], det["category"])

                results.append({
                    "class_name": det["class_name"],
                    "category": det["category"],
                    "confidence": det["confidence"],
                    "bbox": det["bbox"],
                    "retro_class": retro["retro_class"],
                    "retro_score": retro["retro_score"],
                    "condition_grade": retro["condition_grade"],
                    "compliant": condition["compliance"].get("compliant", False),
                    "priority": condition["priority"],
                })

            # Draw annotations and return
            annotated = draw_detections(frame, results)
            _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            annotated_b64 = base64.b64encode(buffer).decode("utf-8")

            await websocket.send_json({
                "detections": results,
                "annotated_frame": annotated_b64,
                "weather": weather,
                "total_detections": len(results),
            })

    except WebSocketDisconnect:
        pass
