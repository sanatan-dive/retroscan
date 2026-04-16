from __future__ import annotations
"""
Condition analysis module for road assets.

Provides detailed condition assessment beyond retroreflectivity,
including maintenance priority scoring and cost estimation.
"""

import cv2
import numpy as np
from typing import Optional

from app.utils.irc_standards import (
    check_sign_compliance,
    check_marking_compliance,
    check_stud_compliance,
)


class ConditionAnalyzer:
    """Analyzes overall condition of detected road assets."""

    # Approximate replacement costs in INR
    REPLACEMENT_COSTS = {
        "regulatory_sign": 15000,
        "warning_sign": 12000,
        "information_sign": 25000,
        "gantry_sign": 200000,
        "stop_sign": 10000,
        "speed_limit_sign": 12000,
        "chevron_sign": 8000,
        "traffic_light": 150000,
        "center_line_marking": 50,      # per meter
        "edge_line_marking": 40,        # per meter
        "lane_marking": 45,             # per meter
        "crosswalk_marking": 5000,      # per crosswalk
        "road_stud": 500,               # per stud
        "delineator": 2000,             # per unit
    }

    def analyze(
        self,
        retro_result: dict,
        class_name: str,
        category: str,
    ) -> dict:
        """
        Full condition analysis for a detected asset.

        Returns compliance info, maintenance priority, and cost estimate.
        """
        score = retro_result["retro_score"]

        # IRC compliance check
        if category == "sign":
            compliance = check_sign_compliance(score)
        elif category == "marking":
            color = "yellow" if "center" in class_name else "white"
            compliance = check_marking_compliance(score, color=color)
        else:
            compliance = check_stud_compliance(score)

        # Maintenance priority (1=urgent, 5=no action)
        priority = self._compute_priority(retro_result, compliance)

        # Cost estimate
        base_cost = self.REPLACEMENT_COSTS.get(class_name, 10000)
        cost_estimate = base_cost if not compliance["compliant"] else 0

        return {
            "compliance": compliance,
            "priority": priority,
            "priority_label": self._priority_label(priority),
            "cost_estimate": cost_estimate,
            "issues": self._identify_issues(retro_result),
            "age_estimate": self._estimate_age(score),
        }

    def _compute_priority(self, retro: dict, compliance: dict) -> int:
        """Compute maintenance priority 1-5."""
        score = retro["retro_score"]
        if not compliance["compliant"] and score < 20:
            return 1  # Critical
        if not compliance["compliant"]:
            return 2  # High
        if score < 50:
            return 3  # Medium
        if score < 70:
            return 4  # Low
        return 5  # None needed

    def _priority_label(self, priority: int) -> str:
        labels = {
            1: "CRITICAL - Immediate action required",
            2: "HIGH - Schedule within 1 month",
            3: "MEDIUM - Schedule within 3 months",
            4: "LOW - Monitor in next inspection",
            5: "NONE - Asset in good condition",
        }
        return labels.get(priority, "UNKNOWN")

    def _identify_issues(self, retro: dict) -> list[str]:
        """Identify specific issues from condition metrics."""
        issues = []
        if retro["color_fading"] > 60:
            issues.append("Severe color fading detected")
        elif retro["color_fading"] > 30:
            issues.append("Moderate color fading")

        if retro["surface_damage"] > 60:
            issues.append("Significant surface damage (cracking/peeling)")
        elif retro["surface_damage"] > 30:
            issues.append("Minor surface damage detected")

        if retro["dirt_level"] > 50:
            issues.append("Heavy dirt/grime accumulation")
        elif retro["dirt_level"] > 25:
            issues.append("Moderate dirt accumulation — cleaning recommended")

        if retro.get("legibility", 100) < 40:
            issues.append("Poor text legibility")
        elif retro.get("legibility", 100) < 60:
            issues.append("Reduced text legibility")

        if not issues:
            issues.append("No significant issues detected")

        return issues

    def _estimate_age(self, score: float) -> str:
        """Rough age estimate based on typical degradation curves."""
        if score >= 85:
            return "< 1 year (near-new condition)"
        elif score >= 70:
            return "1-3 years"
        elif score >= 50:
            return "3-5 years"
        elif score >= 30:
            return "5-8 years"
        else:
            return "8+ years (end-of-life)"
