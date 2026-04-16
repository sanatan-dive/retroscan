from __future__ import annotations
"""Image preprocessing and analysis utilities."""

import cv2
import numpy as np
from pathlib import Path


def extract_frames(video_path: str, fps: int = 2) -> list[tuple[int, np.ndarray]]:
    """Extract frames from a video file at the specified FPS rate."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = max(1, int(video_fps / fps))
    frames = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_interval == 0:
            frames.append((frame_idx, frame))
        frame_idx += 1

    cap.release()
    return frames


def crop_roi(frame: np.ndarray, bbox: list[float]) -> np.ndarray:
    """Crop a region of interest from a frame given [x1, y1, x2, y2]."""
    x1, y1, x2, y2 = [int(v) for v in bbox]
    h, w = frame.shape[:2]
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(w, x2)
    y2 = min(h, y2)
    return frame[y1:y2, x1:x2]


def compute_brightness_features(roi: np.ndarray) -> dict:
    """Compute brightness and color features from an ROI for retroreflectivity estimation."""
    if roi.size == 0:
        return _empty_features()

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    mean_brightness = float(np.mean(gray))
    std_brightness = float(np.std(gray))
    max_brightness = float(np.max(gray))
    mean_saturation = float(np.mean(hsv[:, :, 1]))
    mean_value = float(np.mean(hsv[:, :, 2]))

    # Edge sharpness (higher = sharper = better condition)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = float(np.var(laplacian))

    # Color histogram uniformity
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    hist = hist.flatten() / hist.sum()
    entropy = float(-np.sum(hist[hist > 0] * np.log2(hist[hist > 0])))

    # Contrast
    contrast = float(max_brightness - np.min(gray))

    return {
        "mean_brightness": mean_brightness,
        "std_brightness": std_brightness,
        "max_brightness": max_brightness,
        "mean_saturation": mean_saturation,
        "mean_value": mean_value,
        "sharpness": sharpness,
        "entropy": entropy,
        "contrast": contrast,
    }


def estimate_color_fading(roi: np.ndarray) -> float:
    """Estimate color fading level (0=no fading, 100=completely faded)."""
    if roi.size == 0:
        return 100.0

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mean_sat = np.mean(hsv[:, :, 1])
    # Low saturation = faded colors
    fading = max(0, 100 - (mean_sat / 255 * 100))
    return round(float(fading), 1)


def estimate_surface_damage(roi: np.ndarray) -> float:
    """Estimate surface damage from texture analysis (0=no damage, 100=severe)."""
    if roi.size == 0:
        return 100.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # Use Canny edge detection - damaged surfaces have more irregular edges
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.sum(edges > 0) / edges.size

    # High edge density with irregular patterns suggests damage
    # Normal signs have clean edges; damaged ones have cracks, peeling
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    irregularity = float(np.std(laplacian))

    # Normalize: typical range for irregularity is 10-80
    damage = min(100, max(0, (irregularity - 10) / 70 * 100))
    return round(float(damage), 1)


def estimate_dirt_level(roi: np.ndarray) -> float:
    """Estimate dirt/occlusion level (0=clean, 100=fully occluded)."""
    if roi.size == 0:
        return 100.0

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    # Dirt tends to be low-saturation, medium-value (brownish/grayish)
    low_sat_mask = hsv[:, :, 1] < 40
    mid_val_mask = (hsv[:, :, 2] > 60) & (hsv[:, :, 2] < 180)
    dirt_mask = low_sat_mask & mid_val_mask
    dirt_ratio = np.sum(dirt_mask) / dirt_mask.size
    return round(float(dirt_ratio * 100), 1)


def estimate_legibility(roi: np.ndarray) -> float:
    """Estimate text legibility for signs (0=unreadable, 100=perfectly readable)."""
    if roi.size == 0:
        return 0.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # Contrast between text and background
    contrast = float(np.std(gray))
    # Sharpness
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = float(np.var(laplacian))

    # Combine: high contrast + high sharpness = readable
    legibility = min(100, (contrast / 80 * 50) + (min(sharpness, 500) / 500 * 50))
    return round(float(legibility), 1)


def classify_scene_lighting(frame: np.ndarray) -> dict:
    """Classify lighting/weather conditions from a frame."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    mean_bright = float(np.mean(gray))
    std_bright = float(np.std(gray))
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Time of day
    if mean_bright > 120:
        time_of_day = "day"
    elif mean_bright > 50:
        time_of_day = "twilight"
    else:
        time_of_day = "night"

    # Moisture (wet surfaces are more reflective with specular highlights)
    highlights = np.sum(gray > 240) / gray.size
    moisture = "wet" if highlights > 0.02 else "dry"

    # Visibility (fog reduces contrast)
    if std_bright < 25 and mean_bright > 80:
        visibility = "foggy"
    elif mean_bright < 40 and std_bright < 30:
        visibility = "rainy"
    else:
        visibility = "clear"

    # Streetlight detection (bright spots in dark scenes)
    streetlight = "absent"
    if time_of_day in ("night", "twilight"):
        bright_spots = np.sum(gray > 200) / gray.size
        if bright_spots > 0.005:
            streetlight = "present"

    return {
        "time_of_day": time_of_day,
        "moisture": moisture,
        "visibility": visibility,
        "streetlight": streetlight,
    }


def draw_detections(frame: np.ndarray, detections: list[dict]) -> np.ndarray:
    """Draw bounding boxes and labels on a frame."""
    annotated = frame.copy()

    color_map = {
        "HIGH": (0, 200, 0),      # Green
        "MEDIUM": (0, 200, 255),   # Yellow
        "LOW": (0, 100, 255),      # Orange
        "FAILED": (0, 0, 255),     # Red
    }

    for det in detections:
        bbox = [int(v) for v in det["bbox"]]
        retro_class = det.get("retro_class", "MEDIUM")
        color = color_map.get(retro_class, (200, 200, 200))

        # Draw box
        cv2.rectangle(annotated, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)

        # Label
        label = f"{det['class_name']} | {retro_class} ({det.get('retro_score', 0):.0f}%)"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
        cv2.rectangle(
            annotated,
            (bbox[0], bbox[1] - label_size[1] - 10),
            (bbox[0] + label_size[0], bbox[1]),
            color,
            -1,
        )
        cv2.putText(
            annotated, label,
            (bbox[0], bbox[1] - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
        )

    return annotated


def save_thumbnail(roi: np.ndarray, path: str, size: tuple = (128, 128)) -> str:
    """Save a thumbnail of an ROI."""
    if roi.size == 0:
        return ""
    resized = cv2.resize(roi, size, interpolation=cv2.INTER_AREA)
    cv2.imwrite(path, resized)
    return path


def _empty_features() -> dict:
    return {
        "mean_brightness": 0.0,
        "std_brightness": 0.0,
        "max_brightness": 0.0,
        "mean_saturation": 0.0,
        "mean_value": 0.0,
        "sharpness": 0.0,
        "entropy": 0.0,
        "contrast": 0.0,
    }
