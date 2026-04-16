from __future__ import annotations
"""
Weather and lighting condition classifier.

Primary: Gemini 2.5 Flash Vision for accurate scene classification.
Fallback: OpenCV-based heuristics using brightness, contrast, and color analysis.
"""

import os
import cv2
import json
import base64
import logging
import numpy as np

import google.generativeai as genai

from app.utils.image_utils import classify_scene_lighting

logger = logging.getLogger(__name__)

WEATHER_PROMPT = """Analyze this road/highway image and classify the environmental conditions.

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "time_of_day": "day" or "night" or "twilight",
  "moisture": "dry" or "wet",
  "visibility": "clear" or "foggy" or "rainy",
  "streetlight": "present" or "absent"
}}"""


class WeatherClassifier:
    """Classifies weather and lighting conditions from video frames."""

    def __init__(self):
        self.gemini_available = False
        self.model = None
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel("gemini-2.5-flash")
                self.gemini_available = True
            except Exception as e:
                logger.warning(f"Gemini weather init failed: {e}")

    def classify(self, frame: np.ndarray) -> dict:
        """Classify weather/lighting conditions."""
        # Try Gemini first
        if self.gemini_available:
            result = self._classify_gemini(frame)
            if result:
                return result

        # Fallback to CV
        base = classify_scene_lighting(frame)

        if self._detect_fog_dcp(frame):
            base["visibility"] = "foggy"

        if self._detect_wet_road(frame):
            base["moisture"] = "wet"

        return base

    def _classify_gemini(self, frame: np.ndarray) -> dict | None:
        """Use Gemini Vision for scene classification."""
        try:
            # Downsample for speed
            small = cv2.resize(frame, (512, 384))
            _, buffer = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 70])
            img_b64 = base64.b64encode(buffer).decode("utf-8")

            response = self.model.generate_content(
                [
                    WEATHER_PROMPT,
                    {"mime_type": "image/jpeg", "data": img_b64},
                ],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.0,
                    max_output_tokens=200,
                ),
            )

            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            if text.startswith("json"):
                text = text[4:].strip()

            result = json.loads(text)

            # Validate
            valid_tod = ("day", "night", "twilight")
            valid_moist = ("dry", "wet")
            valid_vis = ("clear", "foggy", "rainy")
            valid_sl = ("present", "absent")

            if result.get("time_of_day") not in valid_tod:
                return None
            if result.get("moisture") not in valid_moist:
                result["moisture"] = "dry"
            if result.get("visibility") not in valid_vis:
                result["visibility"] = "clear"
            if result.get("streetlight") not in valid_sl:
                result["streetlight"] = "absent"

            return result

        except Exception as e:
            logger.warning(f"Gemini weather classification failed: {e}")
            return None

    def _detect_fog_dcp(self, frame: np.ndarray) -> bool:
        """Fog detection using Dark Channel Prior."""
        min_channel = np.min(frame, axis=2)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dark_channel = cv2.erode(min_channel, kernel)
        return float(np.mean(dark_channel)) > 100

    def _detect_wet_road(self, frame: np.ndarray) -> bool:
        """Detect wet road from specular reflections."""
        h = frame.shape[0]
        road_region = frame[int(h * 0.6):, :]
        gray = cv2.cvtColor(road_region, cv2.COLOR_BGR2GRAY)
        highlights = np.sum(gray > 230) / gray.size
        std = float(np.std(gray.astype(float)))
        return highlights > 0.03 and std > 50

    def is_night(self, frame: np.ndarray) -> bool:
        """Quick check if frame is night-time."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return float(np.mean(gray)) < 60
