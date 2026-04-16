from __future__ import annotations
"""
Gemini Vision Analyzer — Brain 2 of the dual-brain pipeline.

Uses Gemini 2.5 Flash for deep multimodal analysis of road safety assets:
- Retroreflectivity estimation with IRC 67/35 compliance
- Sign text reading (OCR)
- Sheeting type identification
- Condition assessment with reasoning
- Maintenance recommendations
- Remaining useful life prediction

Two modes:
1. ROI mode: Analyze a single cropped detection from YOLO
2. Full-frame mode: Analyze entire frame, detect + assess everything (no YOLO needed)
"""

import os
import cv2
import json
import base64
import logging
import numpy as np
from typing import Optional

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ─── Prompts ───────────────────────────────────────────────────────────────

ROI_ANALYSIS_PROMPT = """You are a certified NHAI road safety inspector with 15 years of experience in retroreflectivity measurement per IRC 67:2022 and IRC 35 standards.

Analyze this cropped image of a detected road {asset_type}.

Capture conditions: {conditions}

Provide your expert assessment. Return ONLY valid JSON (no markdown fences):
{{
  "sign_text": "<text visible on the sign, or empty string if marking/stud>",
  "asset_subtype": "<specific type: speed_limit, warning_curve, stop, no_entry, highway_marker, lane_marking, edge_marking, center_line, crosswalk, road_stud, delineator, etc.>",
  "sheeting_type": "<estimated: type_i, type_iii, type_iv, type_ix, type_xi, or unknown>",
  "sign_color": "<primary color: white, yellow, red, green, blue, orange, or mixed>",
  "retro_score": <number 0-100>,
  "retro_class": "<HIGH or MEDIUM or LOW or FAILED>",
  "condition_grade": "<A or B or C or F>",
  "color_fading": <number 0-100>,
  "surface_damage": <number 0-100>,
  "dirt_level": <number 0-100>,
  "legibility": <number 0-100>,
  "estimated_ra": <estimated RA value in cd/lux/m² for signs, or 0 for markings>,
  "estimated_rl": <estimated RL value in mcd/m²/lux for markings, or 0 for signs>,
  "irc_compliant": <true or false>,
  "irc_standard": "<IRC 67 or IRC 35 or IRC SP:79>",
  "irc_threshold": <minimum threshold value for this asset type>,
  "priority": <1-5, where 1=critical immediate action, 5=no action needed>,
  "age_estimate": "<estimated age: <1 year, 1-3 years, 3-5 years, 5-8 years, 8+ years>",
  "remaining_life": "<estimated remaining useful life before non-compliance>",
  "maintenance_action": "<specific recommendation>",
  "cost_estimate_inr": <estimated replacement/repair cost in INR>,
  "issues": ["<list of specific issues found>"],
  "reasoning": "<2-3 sentence expert reasoning for your assessment>"
}}

Scoring guide:
- 90-100: Brand new, pristine condition
- 70-89: Good condition, minor wear
- 50-69: Moderate degradation, still functional
- 30-49: Significant degradation, approaching non-compliance
- 10-29: Severe degradation, likely non-compliant
- 0-9: Complete failure, unreadable/non-functional"""

FULL_FRAME_PROMPT = """You are a certified NHAI road safety inspector. Analyze this road/highway image captured from a vehicle-mounted camera.

Identify ALL road safety assets visible (traffic signs, road markings, road studs, delineators, chevron signs, gantry signs) and assess each one.

Capture conditions: {conditions}

Return ONLY valid JSON (no markdown fences):
{{
  "weather": {{
    "time_of_day": "<day or night or twilight>",
    "moisture": "<dry or wet>",
    "visibility": "<clear or foggy or rainy>",
    "streetlight": "<present or absent>"
  }},
  "assets": [
    {{
      "bbox_pct": [<x1%>, <y1%>, <x2%>, <y2%>],
      "class_name": "<asset type>",
      "category": "<sign or marking or stud>",
      "sign_text": "<text on sign or empty>",
      "sheeting_type": "<type_i/iii/iv/ix/xi/unknown>",
      "retro_score": <0-100>,
      "retro_class": "<HIGH/MEDIUM/LOW/FAILED>",
      "condition_grade": "<A/B/C/F>",
      "color_fading": <0-100>,
      "surface_damage": <0-100>,
      "dirt_level": <0-100>,
      "legibility": <0-100>,
      "irc_compliant": <true/false>,
      "priority": <1-5>,
      "age_estimate": "<age range>",
      "remaining_life": "<time until non-compliance>",
      "issues": ["<issues>"],
      "reasoning": "<expert reasoning>"
    }}
  ]
}}

Be thorough — identify every sign, marking, and stud visible. Even partially visible assets should be assessed."""


class GeminiAnalyzer:
    """Gemini 2.5 Flash Vision analyzer for road safety assets."""

    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        logger.info("GeminiAnalyzer initialized with gemini-2.5-flash")

    def analyze_roi(
        self,
        roi: np.ndarray,
        category: str = "sign",
        is_night: bool = False,
    ) -> dict:
        """
        Analyze a single cropped ROI from YOLO detection.
        Returns structured assessment.
        """
        if roi.size == 0 or roi.shape[0] < 10 or roi.shape[1] < 10:
            return self._empty_result()

        # Resize for API (keep quality but limit size)
        h, w = roi.shape[:2]
        max_dim = 512
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            roi = cv2.resize(roi, (int(w * scale), int(h * scale)))

        img_b64 = self._encode_image(roi)

        asset_type = {"sign": "traffic sign", "marking": "road/pavement marking",
                      "stud": "road stud or delineator"}.get(category, "road safety asset")
        conditions = "Night-time" if is_night else "Daytime"

        prompt = ROI_ANALYSIS_PROMPT.format(asset_type=asset_type, conditions=conditions)

        try:
            response = self.model.generate_content(
                [prompt, {"mime_type": "image/jpeg", "data": img_b64}],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=1000,
                ),
            )
            result = self._parse_json(response.text)
            if result:
                return self._validate_roi_result(result)
        except Exception as e:
            logger.error(f"Gemini ROI analysis failed: {e}")

        return self._empty_result()

    def analyze_full_frame(
        self,
        frame: np.ndarray,
        conditions: str = "Daytime, clear visibility",
    ) -> dict:
        """
        Analyze an entire frame — detect + assess all assets.
        No YOLO needed. Returns weather + list of assets with bboxes.
        """
        # Resize frame for API
        h, w = frame.shape[:2]
        max_dim = 1024
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        img_b64 = self._encode_image(frame)
        prompt = FULL_FRAME_PROMPT.format(conditions=conditions)

        try:
            response = self.model.generate_content(
                [prompt, {"mime_type": "image/jpeg", "data": img_b64}],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=4000,
                ),
            )
            result = self._parse_json(response.text)
            if result and "assets" in result:
                # Convert bbox percentages to pixel coords
                fh, fw = frame.shape[:2]
                for asset in result["assets"]:
                    if "bbox_pct" in asset:
                        bp = asset["bbox_pct"]
                        asset["bbox"] = [
                            bp[0] / 100 * fw, bp[1] / 100 * fh,
                            bp[2] / 100 * fw, bp[3] / 100 * fh,
                        ]
                return result
        except Exception as e:
            logger.error(f"Gemini full-frame analysis failed: {e}")

        return {"weather": {}, "assets": []}

    def _encode_image(self, img: np.ndarray) -> str:
        _, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buffer).decode("utf-8")

    def _parse_json(self, text: str) -> dict | None:
        text = text.strip()
        # Strip markdown fences
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        if text.startswith("json"):
            text = text[4:].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse failed: {e}\nRaw: {text[:500]}")
            return None

    def _validate_roi_result(self, r: dict) -> dict:
        """Validate and clamp values from Gemini response."""
        def clamp(v, lo=0, hi=100):
            try:
                return max(lo, min(hi, float(v)))
            except (ValueError, TypeError):
                return 50.0

        score = clamp(r.get("retro_score", 50))
        return {
            "sign_text": str(r.get("sign_text", "")),
            "asset_subtype": str(r.get("asset_subtype", "")),
            "sheeting_type": str(r.get("sheeting_type", "unknown")),
            "sign_color": str(r.get("sign_color", "")),
            "retro_score": round(score, 1),
            "retro_class": r.get("retro_class", self._score_to_class(score)),
            "condition_grade": r.get("condition_grade", self._score_to_grade(score)),
            "color_fading": round(clamp(r.get("color_fading", 30)), 1),
            "surface_damage": round(clamp(r.get("surface_damage", 20)), 1),
            "dirt_level": round(clamp(r.get("dirt_level", 15)), 1),
            "legibility": round(clamp(r.get("legibility", 70)), 1),
            "estimated_ra": float(r.get("estimated_ra", 0)),
            "estimated_rl": float(r.get("estimated_rl", 0)),
            "irc_compliant": bool(r.get("irc_compliant", True)),
            "irc_standard": str(r.get("irc_standard", "")),
            "irc_threshold": float(r.get("irc_threshold", 0)),
            "priority": max(1, min(5, int(r.get("priority", 3)))),
            "age_estimate": str(r.get("age_estimate", "")),
            "remaining_life": str(r.get("remaining_life", "")),
            "maintenance_action": str(r.get("maintenance_action", "")),
            "cost_estimate_inr": float(r.get("cost_estimate_inr", 0)),
            "issues": r.get("issues", []),
            "reasoning": str(r.get("reasoning", "")),
        }

    def _score_to_class(self, score: float) -> str:
        if score >= 75: return "HIGH"
        if score >= 50: return "MEDIUM"
        if score >= 25: return "LOW"
        return "FAILED"

    def _score_to_grade(self, score: float) -> str:
        if score >= 75: return "A"
        if score >= 50: return "B"
        if score >= 25: return "C"
        return "F"

    def _empty_result(self) -> dict:
        return {
            "sign_text": "", "asset_subtype": "", "sheeting_type": "unknown",
            "sign_color": "", "retro_score": 0.0, "retro_class": "FAILED",
            "condition_grade": "F", "color_fading": 100.0, "surface_damage": 100.0,
            "dirt_level": 100.0, "legibility": 0.0, "estimated_ra": 0,
            "estimated_rl": 0, "irc_compliant": False, "irc_standard": "",
            "irc_threshold": 0, "priority": 1, "age_estimate": "unknown",
            "remaining_life": "0", "maintenance_action": "Immediate replacement",
            "cost_estimate_inr": 0, "issues": ["Asset unreadable"], "reasoning": "",
        }
