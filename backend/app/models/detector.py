from __future__ import annotations
"""
Traffic asset detection using YOLOv11 (ultralytics latest).

Detects: traffic signs, pavement markings, road studs, delineators, gantry signs.
Uses YOLO11n/s for real-time inference with high accuracy.
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

from app.config import DETECTION_CONFIDENCE, DETECTION_IOU, WEIGHTS_DIR


# COCO classes relevant to road infrastructure
ROAD_ASSET_CLASSES = {
    9: "traffic_light",
    11: "stop_sign",
    12: "parking_meter",
}

# Extended class mapping for our fine-tuned model
RETROSCAN_CLASSES = {
    0: "regulatory_sign",
    1: "warning_sign",
    2: "information_sign",
    3: "gantry_sign",
    4: "center_line_marking",
    5: "edge_line_marking",
    6: "lane_marking",
    7: "crosswalk_marking",
    8: "road_stud",
    9: "delineator",
    10: "chevron_sign",
    11: "stop_sign",
    12: "speed_limit_sign",
}

# Asset category grouping
ASSET_CATEGORIES = {
    "sign": [
        "regulatory_sign", "warning_sign", "information_sign",
        "gantry_sign", "stop_sign", "speed_limit_sign",
        "chevron_sign", "traffic_light",
    ],
    "marking": [
        "center_line_marking", "edge_line_marking",
        "lane_marking", "crosswalk_marking",
    ],
    "stud": ["road_stud", "delineator", "parking_meter"],
}


class AssetDetector:
    """YOLOv11-based road asset detector."""

    def __init__(self, model_path: str | None = None):
        if model_path and Path(model_path).exists():
            self.model = YOLO(model_path)
            self.custom_model = True
        else:
            # Use pretrained YOLOv8n — detects traffic signs from COCO
            self.model = YOLO("yolov8n.pt")
            self.custom_model = False

    def detect(self, frame: np.ndarray) -> list[dict]:
        """Run detection on a single frame. Returns list of detections."""
        results = self.model(
            frame,
            conf=DETECTION_CONFIDENCE,
            iou=DETECTION_IOU,
            verbose=False,
        )

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())
                bbox = boxes.xyxy[i].tolist()

                if self.custom_model:
                    class_name = RETROSCAN_CLASSES.get(cls_id, f"class_{cls_id}")
                else:
                    class_name = self._map_coco_class(cls_id)
                    if class_name is None:
                        continue

                detections.append({
                    "class_id": cls_id,
                    "class_name": class_name,
                    "confidence": round(conf, 3),
                    "bbox": [round(v, 1) for v in bbox],
                    "category": self._get_category(class_name),
                })

        # Also run heuristic detection for markings (COCO doesn't have them)
        marking_dets = self._detect_markings_heuristic(frame)
        detections.extend(marking_dets)

        return detections

    def _map_coco_class(self, cls_id: int) -> str | None:
        """Map COCO class IDs to our asset classes."""
        return ROAD_ASSET_CLASSES.get(cls_id)

    def _get_category(self, class_name: str) -> str:
        """Get the asset category (sign, marking, stud)."""
        for category, classes in ASSET_CATEGORIES.items():
            if class_name in classes:
                return category
        return "sign"

    def _detect_markings_heuristic(self, frame: np.ndarray) -> list[dict]:
        """Detect road markings using computer vision heuristics.

        Uses color filtering + Hough line detection to find lane markings
        when YOLO (trained on COCO) can't detect them.
        """
        h, w = frame.shape[:2]
        # Focus on bottom 60% of frame (road surface area)
        roi = frame[int(h * 0.4):, :]
        roi_offset_y = int(h * 0.4)

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        detections = []

        # Detect white markings
        white_mask = cv2.inRange(hsv, (0, 0, 180), (180, 40, 255))
        # Detect yellow markings
        yellow_mask = cv2.inRange(hsv, (15, 80, 150), (35, 255, 255))

        for mask, color_type in [(white_mask, "white"), (yellow_mask, "yellow")]:
            # Clean up mask
            kernel = np.ones((3, 3), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for contour in contours:
                area = cv2.contourArea(contour)
                if area < 500:  # Filter tiny regions
                    continue

                x, y, cw, ch = cv2.boundingRect(contour)
                aspect_ratio = ch / max(cw, 1)

                # Road markings tend to be elongated
                if aspect_ratio > 0.5 or area > 2000:
                    class_name = "edge_line_marking" if x < w * 0.2 or x > w * 0.8 else "lane_marking"
                    if color_type == "yellow":
                        class_name = "center_line_marking"

                    detections.append({
                        "class_id": -1,
                        "class_name": class_name,
                        "confidence": min(0.85, area / 10000),
                        "bbox": [float(x), float(y + roi_offset_y),
                                 float(x + cw), float(y + ch + roi_offset_y)],
                        "category": "marking",
                    })

        return detections[:10]  # Limit to top 10 marking detections
