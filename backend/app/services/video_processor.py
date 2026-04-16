from __future__ import annotations
"""
Core video processing pipeline — Dual-Brain Architecture.

Brain 1 (YOLO): Fast bounding-box detection at 30+ FPS
Brain 2 (Gemini): Deep multimodal analysis per detection

Pipeline: Frame → YOLO detect → Crop ROIs → Gemini analyze each → Store results
"""

import cv2
import logging
import numpy as np
from pathlib import Path

from app.config import RESULTS_DIR, FRAME_SAMPLE_RATE
from app.models.detector import AssetDetector
from app.models.gemini_analyzer import GeminiAnalyzer
from app.models.retroreflectivity import RetroReflectivityEstimator
from app.models.weather import WeatherClassifier
from app.utils.image_utils import (
    extract_frames,
    crop_roi,
    draw_detections,
    save_thumbnail,
    classify_scene_lighting,
)
from app.services.database import (
    update_scan_status,
    update_scan_summary,
    save_detection,
    save_frame,
)

logger = logging.getLogger(__name__)

# Lazy singletons
_detector: AssetDetector | None = None
_gemini: GeminiAnalyzer | None = None
_cv_estimator: RetroReflectivityEstimator | None = None
_weather: WeatherClassifier | None = None


def _get_detector() -> AssetDetector:
    global _detector
    if _detector is None:
        _detector = AssetDetector()
    return _detector


def _get_gemini() -> GeminiAnalyzer | None:
    global _gemini
    if _gemini is None:
        try:
            _gemini = GeminiAnalyzer()
        except Exception as e:
            logger.warning(f"Gemini not available: {e}")
    return _gemini


def _get_cv_estimator() -> RetroReflectivityEstimator:
    global _cv_estimator
    if _cv_estimator is None:
        _cv_estimator = RetroReflectivityEstimator()
    return _cv_estimator


def _get_weather() -> WeatherClassifier:
    global _weather
    if _weather is None:
        _weather = WeatherClassifier()
    return _weather


def process_video(scan_id: str, video_path: str):
    """Process video through dual-brain pipeline."""
    scan_dir = RESULTS_DIR / scan_id
    for subdir in ["frames", "annotated", "thumbnails"]:
        (scan_dir / subdir).mkdir(parents=True, exist_ok=True)

    detector = _get_detector()
    gemini = _get_gemini()
    cv_estimator = _get_cv_estimator()
    weather_cls = _get_weather()

    update_scan_status(scan_id, "processing", 5, "Extracting frames...")

    frames = extract_frames(video_path, fps=FRAME_SAMPLE_RATE)
    total_frames = len(frames)

    if total_frames == 0:
        update_scan_status(scan_id, "failed", 0, "No frames extracted")
        return

    cap = cv2.VideoCapture(video_path)
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()

    update_scan_status(scan_id, "processing", 10, f"Processing {total_frames} frames...")

    all_detections = []
    overall_weather = None

    for i, (frame_idx, frame) in enumerate(frames):
        progress = 10 + (i / total_frames * 80)
        update_scan_status(scan_id, "processing", progress, f"Frame {i + 1}/{total_frames}")

        timestamp = frame_idx / video_fps
        is_night = weather_cls.is_night(frame)

        # Weather classification (first frame only for overall)
        if overall_weather is None:
            weather = weather_cls.classify(frame)
            overall_weather = weather
        else:
            weather = overall_weather

        # Save raw frame
        frame_path = str(scan_dir / "frames" / f"frame_{frame_idx:06d}.jpg")
        cv2.imwrite(frame_path, frame)

        # BRAIN 1: YOLO detection (fast)
        yolo_dets = detector.detect(frame)

        frame_detections = []
        for det_idx, det in enumerate(yolo_dets):
            roi = crop_roi(frame, det["bbox"])
            if roi.size == 0:
                continue

            # BRAIN 2: Gemini deep analysis (accurate)
            if gemini:
                gemini_result = gemini.analyze_roi(roi, category=det["category"], is_night=is_night)
            else:
                # Fallback to CV-based estimation
                cv_result = cv_estimator.estimate(roi, category=det["category"], is_night=is_night)
                gemini_result = {
                    **cv_result,
                    "sign_text": "", "sheeting_type": "unknown", "remaining_life": "",
                    "gemini_reasoning": "", "irc_compliant": cv_result["retro_score"] >= 50,
                    "priority": 3, "cost_estimate_inr": 0, "issues": [],
                    "age_estimate": "", "maintenance_action": "",
                }

            # Save thumbnail
            thumb_path = str(scan_dir / "thumbnails" / f"det_{frame_idx}_{det_idx}.jpg")
            save_thumbnail(roi, thumb_path)

            # Build detection record merging YOLO + Gemini
            full_det = {
                "frame_index": frame_idx,
                "timestamp_sec": timestamp,
                "class_name": gemini_result.get("asset_subtype") or det["class_name"],
                "category": det["category"],
                "confidence": det["confidence"],
                "bbox": det["bbox"],
                "retro_class": gemini_result.get("retro_class", "MEDIUM"),
                "retro_score": gemini_result.get("retro_score", 50),
                "condition_grade": gemini_result.get("condition_grade", "B"),
                "color_fading": gemini_result.get("color_fading", 30),
                "surface_damage": gemini_result.get("surface_damage", 20),
                "dirt_level": gemini_result.get("dirt_level", 15),
                "legibility": gemini_result.get("legibility", 70),
                "compliance": {
                    "standard": gemini_result.get("irc_standard", "IRC 67"),
                    "compliant": gemini_result.get("irc_compliant", True),
                    "threshold": gemini_result.get("irc_threshold", 0),
                    "estimated_ra": gemini_result.get("estimated_ra", 0),
                    "estimated_rl": gemini_result.get("estimated_rl", 0),
                    "sheeting_type": gemini_result.get("sheeting_type", "unknown"),
                    "recommendation": gemini_result.get("maintenance_action", ""),
                },
                "priority": gemini_result.get("priority", 3),
                "priority_label": _priority_label(gemini_result.get("priority", 3)),
                "cost_estimate": gemini_result.get("cost_estimate_inr", 0),
                "issues": gemini_result.get("issues", []),
                "age_estimate": gemini_result.get("age_estimate", ""),
                "thumbnail_path": thumb_path,
                "sign_text": gemini_result.get("sign_text", ""),
                "sheeting_type": gemini_result.get("sheeting_type", ""),
                "remaining_life": gemini_result.get("remaining_life", ""),
                "gemini_reasoning": gemini_result.get("reasoning", ""),
            }

            save_detection(scan_id, full_det)
            frame_detections.append(full_det)
            all_detections.append(full_det)

        # Draw annotations
        annotated_path = str(scan_dir / "annotated" / f"annotated_{frame_idx:06d}.jpg")
        annotated = draw_detections(frame, frame_detections)
        cv2.imwrite(annotated_path, annotated)

        save_frame(scan_id, {
            "frame_index": frame_idx,
            "timestamp_sec": timestamp,
            "image_path": frame_path,
            "annotated_path": annotated_path,
            "weather": weather,
        })

    # If YOLO found nothing, try Gemini full-frame analysis on select frames
    if len(all_detections) == 0 and gemini and total_frames > 0:
        update_scan_status(scan_id, "processing", 92, "Gemini full-frame analysis...")
        # Analyze first, middle, last frames
        sample_indices = [0, total_frames // 2, total_frames - 1]
        for si in sample_indices:
            if si >= len(frames):
                continue
            frame_idx, frame = frames[si]
            result = gemini.analyze_full_frame(frame)
            for asset in result.get("assets", []):
                bbox = asset.get("bbox", [0, 0, 100, 100])
                det = {
                    "frame_index": frame_idx,
                    "timestamp_sec": frame_idx / video_fps,
                    "class_name": asset.get("class_name", "unknown"),
                    "category": asset.get("category", "sign"),
                    "confidence": 0.85,
                    "bbox": bbox,
                    "retro_class": asset.get("retro_class", "MEDIUM"),
                    "retro_score": asset.get("retro_score", 50),
                    "condition_grade": asset.get("condition_grade", "B"),
                    "color_fading": asset.get("color_fading", 30),
                    "surface_damage": asset.get("surface_damage", 20),
                    "dirt_level": asset.get("dirt_level", 15),
                    "legibility": asset.get("legibility", 70),
                    "compliance": {"standard": "IRC 67", "compliant": True},
                    "priority": asset.get("priority", 3),
                    "priority_label": _priority_label(asset.get("priority", 3)),
                    "cost_estimate": 0,
                    "issues": asset.get("issues", []),
                    "age_estimate": asset.get("age_estimate", ""),
                    "thumbnail_path": "",
                    "sign_text": asset.get("sign_text", ""),
                    "sheeting_type": "",
                    "remaining_life": asset.get("remaining_life", ""),
                    "gemini_reasoning": asset.get("reasoning", ""),
                }
                save_detection(scan_id, det)
                all_detections.append(det)
            if result.get("weather"):
                overall_weather = result["weather"]

    _finalize_scan(scan_id, all_detections, total_frames, overall_weather)


def process_image(scan_id: str, image_path: str):
    """Process a single image through the dual-brain pipeline."""
    frame = cv2.imread(image_path)
    if frame is None:
        update_scan_status(scan_id, "failed", 0, "Cannot read image")
        return

    scan_dir = RESULTS_DIR / scan_id
    for subdir in ["frames", "annotated", "thumbnails"]:
        (scan_dir / subdir).mkdir(parents=True, exist_ok=True)

    detector = _get_detector()
    gemini = _get_gemini()
    cv_estimator = _get_cv_estimator()
    weather_cls = _get_weather()

    update_scan_status(scan_id, "processing", 20, "Analyzing image...")

    is_night = weather_cls.is_night(frame)
    weather = weather_cls.classify(frame)

    frame_path = str(scan_dir / "frames" / "frame_000000.jpg")
    cv2.imwrite(frame_path, frame)

    # Try YOLO first
    yolo_dets = detector.detect(frame)
    all_detections = []

    if yolo_dets:
        update_scan_status(scan_id, "processing", 40, f"Analyzing {len(yolo_dets)} detections with Gemini...")
        for det_idx, det in enumerate(yolo_dets):
            roi = crop_roi(frame, det["bbox"])
            if roi.size == 0:
                continue

            if gemini:
                g = gemini.analyze_roi(roi, category=det["category"], is_night=is_night)
            else:
                cv_r = cv_estimator.estimate(roi, category=det["category"], is_night=is_night)
                g = {**cv_r, "sign_text": "", "sheeting_type": "unknown", "remaining_life": "",
                     "reasoning": "", "irc_compliant": True, "priority": 3, "cost_estimate_inr": 0,
                     "issues": [], "age_estimate": "", "maintenance_action": ""}

            thumb_path = str(scan_dir / "thumbnails" / f"det_0_{det_idx}.jpg")
            save_thumbnail(roi, thumb_path)

            full_det = _build_detection(0, 0, det, g, thumb_path)
            save_detection(scan_id, full_det)
            all_detections.append(full_det)

    # Also run Gemini full-frame for comprehensive analysis
    if gemini:
        update_scan_status(scan_id, "processing", 70, "Gemini full-frame analysis...")
        ff_result = gemini.analyze_full_frame(frame)
        for asset in ff_result.get("assets", []):
            # Skip if YOLO already found something at similar location
            bbox = asset.get("bbox", [0, 0, 100, 100])
            if not _overlaps_existing(bbox, all_detections):
                det = {
                    "class_id": -1, "class_name": asset.get("class_name", "unknown"),
                    "confidence": 0.85, "bbox": bbox,
                    "category": asset.get("category", "sign"),
                }
                full_det = _build_detection(0, 0, det, asset, "")
                save_detection(scan_id, full_det)
                all_detections.append(full_det)
        if ff_result.get("weather"):
            weather = ff_result["weather"]

    # Draw annotations
    annotated_path = str(scan_dir / "annotated" / "annotated_000000.jpg")
    annotated = draw_detections(frame, all_detections)
    cv2.imwrite(annotated_path, annotated)

    save_frame(scan_id, {
        "frame_index": 0, "timestamp_sec": 0,
        "image_path": frame_path, "annotated_path": annotated_path, "weather": weather,
    })

    _finalize_scan(scan_id, all_detections, 1, weather)


def _build_detection(frame_idx: int, timestamp: float, det: dict, g: dict, thumb: str) -> dict:
    return {
        "frame_index": frame_idx,
        "timestamp_sec": timestamp,
        "class_name": g.get("asset_subtype") or g.get("class_name") or det["class_name"],
        "category": det["category"],
        "confidence": det["confidence"],
        "bbox": det["bbox"],
        "retro_class": g.get("retro_class", "MEDIUM"),
        "retro_score": g.get("retro_score", 50),
        "condition_grade": g.get("condition_grade", "B"),
        "color_fading": g.get("color_fading", 30),
        "surface_damage": g.get("surface_damage", 20),
        "dirt_level": g.get("dirt_level", 15),
        "legibility": g.get("legibility", 70),
        "compliance": {
            "standard": g.get("irc_standard", "IRC 67"),
            "compliant": g.get("irc_compliant", True),
            "threshold": g.get("irc_threshold", 0),
            "estimated_ra": g.get("estimated_ra", 0),
            "estimated_rl": g.get("estimated_rl", 0),
            "recommendation": g.get("maintenance_action", ""),
        },
        "priority": g.get("priority", 3),
        "priority_label": _priority_label(g.get("priority", 3)),
        "cost_estimate": g.get("cost_estimate_inr", 0),
        "issues": g.get("issues", []),
        "age_estimate": g.get("age_estimate", ""),
        "thumbnail_path": thumb,
        "sign_text": g.get("sign_text", ""),
        "sheeting_type": g.get("sheeting_type", ""),
        "remaining_life": g.get("remaining_life", ""),
        "gemini_reasoning": g.get("reasoning", ""),
    }


def _overlaps_existing(bbox: list, detections: list, iou_thresh: float = 0.3) -> bool:
    """Check if bbox overlaps with any existing detection."""
    for d in detections:
        if _compute_iou(bbox, d["bbox"]) > iou_thresh:
            return True
    return False


def _compute_iou(box1: list, box2: list) -> float:
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    return intersection / union if union > 0 else 0


def _finalize_scan(scan_id: str, detections: list, total_frames: int, weather: dict | None):
    update_scan_status(scan_id, "processing", 95, "Finalizing...")

    signs = [d for d in detections if d["category"] == "sign"]
    markings = [d for d in detections if d["category"] == "marking"]
    studs = [d for d in detections if d["category"] == "stud"]
    compliant = [d for d in detections if d.get("compliance", {}).get("compliant", False)]
    avg_score = (sum(d["retro_score"] for d in detections) / len(detections)) if detections else 0

    update_scan_summary(scan_id, {
        "total_frames": total_frames,
        "total_detections": len(detections),
        "signs_detected": len(signs),
        "markings_detected": len(markings),
        "studs_detected": len(studs),
        "compliance_pass": len(compliant),
        "compliance_fail": len(detections) - len(compliant),
        "avg_retro_score": round(avg_score, 1),
        "weather": weather or {},
    })


def _priority_label(p: int) -> str:
    return {
        1: "CRITICAL - Immediate action required",
        2: "HIGH - Schedule within 1 month",
        3: "MEDIUM - Schedule within 3 months",
        4: "LOW - Monitor in next inspection",
        5: "NONE - Asset in good condition",
    }.get(p, "UNKNOWN")
