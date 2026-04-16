from __future__ import annotations
"""
Retroreflectivity estimation using Google Gemini 2.5 Flash Vision + physics-informed CV fallback.

Primary: Gemini multimodal AI analyzes the visual condition of detected road assets
and returns structured retroreflectivity assessments.

Fallback: Handcrafted OpenCV features (brightness, saturation, sharpness, texture)
used when Gemini is unavailable or rate-limited.
"""

import os
import cv2
import json
import base64
import logging
import numpy as np
from typing import Optional

import google.generativeai as genai

from app.utils.image_utils import (
    compute_brightness_features,
    estimate_color_fading,
    estimate_surface_damage,
    estimate_dirt_level,
    estimate_legibility,
)

logger = logging.getLogger(__name__)

GEMINI_PROMPT = """You are an expert road safety engineer specializing in retroreflectivity measurement per Indian IRC 67 (signs) and IRC 35 (markings) standards.

Analyze this cropped image of a road {asset_type}. Assess its retroreflectivity condition based on visual indicators:

**For signs:** color vibrancy, sheeting condition, surface damage (cracks, peeling, delamination), dirt/grime, text legibility, fading from UV exposure, corrosion
**For markings:** paint thickness, color intensity, wear from tyre erosion, edge sharpness, coverage uniformity
**For studs/delineators:** lens clarity, housing damage, reflective surface condition

Capture conditions: {conditions}

Return ONLY a valid JSON object (no markdown, no code fences) with these exact fields:
{{
  "retro_class": "HIGH" or "MEDIUM" or "LOW" or "FAILED",
  "retro_score": <number 0-100, where 100=new/perfect, 0=completely degraded>,
  "condition_grade": "A" or "B" or "C" or "F",
  "color_fading": <number 0-100, 0=no fading, 100=completely faded>,
  "surface_damage": <number 0-100, 0=no damage, 100=severe damage>,
  "dirt_level": <number 0-100, 0=clean, 100=heavily soiled>,
  "legibility": <number 0-100, 0=unreadable, 100=perfectly clear>,
  "reasoning": "<one sentence explaining your assessment>"
}}

Be precise. A brand new highway sign is 85-95. A moderately worn 3-year sign is 50-65. A severely degraded end-of-life sign is 10-25."""


class RetroReflectivityEstimator:
    """
    Estimates retroreflectivity using Gemini Vision AI with CV fallback.

    Strategy:
    1. Try Gemini 2.5 Flash for accurate multimodal analysis
    2. Fall back to physics-informed CV features if Gemini unavailable
    3. Combine both signals when possible for highest accuracy
    """

    def __init__(self):
        self.gemini_available = False
        self.model = None
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel("gemini-2.5-flash")
                self.gemini_available = True
                logger.info("Gemini Vision initialized successfully")
            except Exception as e:
                logger.warning(f"Gemini init failed, using CV fallback: {e}")

    def estimate(
        self,
        roi: np.ndarray,
        category: str = "sign",
        is_night: bool = False,
    ) -> dict:
        """
        Estimate retroreflectivity for a cropped asset ROI.

        Returns dict with retro_class, retro_score, condition details.
        """
        if roi.size == 0 or roi.shape[0] < 5 or roi.shape[1] < 5:
            return self._failed_result()

        roi_resized = cv2.resize(roi, (256, 256), interpolation=cv2.INTER_AREA)

        # Try Gemini first
        gemini_result = None
        if self.gemini_available:
            gemini_result = self._estimate_gemini(roi_resized, category, is_night)

        # Always compute CV features (used as fallback or to cross-validate)
        cv_result = self._estimate_cv(roi_resized, category, is_night)

        if gemini_result:
            # Use Gemini as primary, but cross-validate with CV
            return self._merge_results(gemini_result, cv_result)

        return cv_result

    def _estimate_gemini(self, roi: np.ndarray, category: str, is_night: bool) -> dict | None:
        """Use Gemini Vision to analyze the asset condition."""
        try:
            # Encode image
            _, buffer = cv2.imencode(".jpg", roi, [cv2.IMWRITE_JPEG_QUALITY, 90])
            img_b64 = base64.b64encode(buffer).decode("utf-8")

            conditions = f"{'Night' if is_night else 'Day'} time capture"
            asset_type = {
                "sign": "traffic sign",
                "marking": "road/pavement marking",
                "stud": "road stud or delineator",
            }.get(category, "road safety asset")

            prompt = GEMINI_PROMPT.format(asset_type=asset_type, conditions=conditions)

            response = self.model.generate_content(
                [
                    prompt,
                    {"mime_type": "image/jpeg", "data": img_b64},
                ],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=500,
                ),
            )

            text = response.text.strip()
            # Clean potential markdown fences
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            if text.startswith("json"):
                text = text[4:].strip()

            result = json.loads(text)

            # Validate required fields
            required = ["retro_class", "retro_score", "condition_grade",
                        "color_fading", "surface_damage", "dirt_level", "legibility"]
            for field in required:
                if field not in result:
                    logger.warning(f"Gemini missing field: {field}")
                    return None

            # Clamp values
            result["retro_score"] = max(0, min(100, float(result["retro_score"])))
            result["color_fading"] = max(0, min(100, float(result["color_fading"])))
            result["surface_damage"] = max(0, min(100, float(result["surface_damage"])))
            result["dirt_level"] = max(0, min(100, float(result["dirt_level"])))
            result["legibility"] = max(0, min(100, float(result["legibility"])))

            # Validate class
            if result["retro_class"] not in ("HIGH", "MEDIUM", "LOW", "FAILED"):
                result["retro_class"] = self._score_to_class(result["retro_score"])
            if result["condition_grade"] not in ("A", "B", "C", "F"):
                result["condition_grade"] = self._score_to_grade(result["retro_score"])

            return result

        except Exception as e:
            logger.warning(f"Gemini estimation failed: {e}")
            return None

    def _estimate_cv(self, roi: np.ndarray, category: str, is_night: bool) -> dict:
        """Fallback: CV-based estimation using handcrafted features."""
        if is_night:
            score = self._cv_night(roi, category)
        else:
            score = self._cv_day(roi, category)

        color_fading = estimate_color_fading(roi)
        surface_damage = estimate_surface_damage(roi)
        dirt_level = estimate_dirt_level(roi)
        legibility = estimate_legibility(roi) if category == "sign" else 75.0

        condition_penalty = (
            color_fading * 0.3 +
            surface_damage * 0.25 +
            dirt_level * 0.15
        )
        adjusted_score = max(0, min(100, score - condition_penalty * 0.3))

        return {
            "retro_class": self._score_to_class(adjusted_score),
            "retro_score": round(adjusted_score, 1),
            "condition_grade": self._score_to_grade(adjusted_score),
            "color_fading": color_fading,
            "surface_damage": surface_damage,
            "dirt_level": dirt_level,
            "legibility": legibility,
        }

    def _merge_results(self, gemini: dict, cv: dict) -> dict:
        """
        Merge Gemini and CV results for highest accuracy.
        Gemini is primary (0.7 weight), CV cross-validates (0.3 weight).
        """
        merged_score = gemini["retro_score"] * 0.7 + cv["retro_score"] * 0.3
        merged_score = round(max(0, min(100, merged_score)), 1)

        return {
            "retro_class": self._score_to_class(merged_score),
            "retro_score": merged_score,
            "condition_grade": self._score_to_grade(merged_score),
            "color_fading": round(gemini["color_fading"] * 0.7 + cv["color_fading"] * 0.3, 1),
            "surface_damage": round(gemini["surface_damage"] * 0.7 + cv["surface_damage"] * 0.3, 1),
            "dirt_level": round(gemini["dirt_level"] * 0.7 + cv["dirt_level"] * 0.3, 1),
            "legibility": round(gemini["legibility"] * 0.7 + cv["legibility"] * 0.3, 1),
        }

    def _cv_night(self, roi: np.ndarray, category: str) -> float:
        """Night: brightness = retroreflectivity proxy."""
        features = compute_brightness_features(roi)

        if category == "sign":
            brightness_score = min(100, features["mean_brightness"] / 2.0 * 100 / 128)
            contrast_score = min(100, features["contrast"] / 200 * 100)
            sharpness_score = min(100, features["sharpness"] / 500 * 100)
            score = brightness_score * 0.5 + contrast_score * 0.3 + sharpness_score * 0.2
        elif category == "marking":
            brightness_score = min(100, features["mean_brightness"] / 180 * 100)
            uniformity = 100 - min(100, features["std_brightness"] / 80 * 100)
            score = brightness_score * 0.6 + uniformity * 0.4
        else:
            brightness_score = min(100, features["max_brightness"] / 255 * 100)
            score = brightness_score

        return max(0, min(100, score))

    def _cv_day(self, roi: np.ndarray, category: str) -> float:
        """Day: visual condition as retroreflectivity proxy."""
        features = compute_brightness_features(roi)
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        sat_score = min(100, float(np.mean(hsv[:, :, 1])) / 180 * 100)
        val_score = min(100, float(np.mean(hsv[:, :, 2])) / 200 * 100)
        sharpness_score = min(100, features["sharpness"] / 600 * 100)
        contrast_score = min(100, features["contrast"] / 180 * 100)
        uniformity = 100 - min(100, features["std_brightness"] / 60 * 100)

        if category == "sign":
            score = (sat_score * 0.25 + val_score * 0.20 +
                     sharpness_score * 0.20 + contrast_score * 0.20 + uniformity * 0.15)
        elif category == "marking":
            score = (val_score * 0.35 + contrast_score * 0.25 +
                     uniformity * 0.25 + sharpness_score * 0.15)
        else:
            score = (val_score * 0.40 +
                     features["mean_brightness"] / 255 * 100 * 0.35 + uniformity * 0.25)

        return max(0, min(100, score))

    def _score_to_class(self, score: float) -> str:
        if score >= 75:
            return "HIGH"
        elif score >= 50:
            return "MEDIUM"
        elif score >= 25:
            return "LOW"
        return "FAILED"

    def _score_to_grade(self, score: float) -> str:
        if score >= 75:
            return "A"
        elif score >= 50:
            return "B"
        elif score >= 25:
            return "C"
        return "F"

    def _failed_result(self) -> dict:
        return {
            "retro_class": "FAILED",
            "retro_score": 0.0,
            "condition_grade": "F",
            "color_fading": 100.0,
            "surface_damage": 100.0,
            "dirt_level": 100.0,
            "legibility": 0.0,
        }
