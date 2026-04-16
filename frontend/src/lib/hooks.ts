"use client";

import { useMemo } from "react";
import type { Detection } from "@/lib/types";

/**
 * Confidence band (±) around a retroreflectivity score, derived from a
 * pilot calibration study (R² = 0.85, n = 200).
 *
 * Wider bands for partial visibility, lighting variations, and occlusions.
 * FAILED is the most certain class because severely degraded assets are
 * easy to identify visually.
 */
export function getConfidenceBand(
  retroClass: "HIGH" | "MEDIUM" | "LOW" | "FAILED" | string
): number {
  switch (retroClass) {
    case "HIGH":
      return 12;
    case "MEDIUM":
      return 15;
    case "LOW":
      return 20;
    case "FAILED":
      return 10;
    default:
      return 15;
  }
}

/** Human-friendly label, e.g. "stop_sign" -> "Stop Sign" */
export function humanizeClassName(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-red-500",
  3: "text-amber-500",
  4: "text-emerald-500",
  5: "text-emerald-500",
};

/** Standard explanation copy for the confidence band info tooltip. */
export const CONFIDENCE_BAND_EXPLANATION =
  "Confidence bands derived from pilot study (R²=0.85, n=200). Wider bands for partial visibility, lighting variations, occlusions.";

/** Standard disclaimer for AI retroreflectivity scores. */
export const RETRO_SCORE_DISCLAIMER =
  "AI estimate from visual condition. For IRC certification, use a calibrated retroreflectometer.";

/** Standard disclaimer for AI compliance verdicts. */
export const COMPLIANCE_DISCLAIMER =
  "Based on AI estimation against IRC threshold. Verify with field measurement.";

export interface DetectionInsights {
  confidenceBand: number;
  humanReadableClass: string;
  statusEmoji: "✓" | "⚠" | "✗";
  priorityColor: string;
  scoreLowerBound: number;
  scoreUpperBound: number;
}

/**
 * Computes derived UI insights for a Detection: confidence bands, status
 * glyphs, formatted labels, and priority colours.
 */
export function useDetectionInsights(
  detection: Detection | null | undefined
): DetectionInsights {
  return useMemo<DetectionInsights>(() => {
    if (!detection) {
      return {
        confidenceBand: 15,
        humanReadableClass: "",
        statusEmoji: "⚠",
        priorityColor: "text-muted-foreground",
        scoreLowerBound: 0,
        scoreUpperBound: 0,
      };
    }

    const confidenceBand = getConfidenceBand(detection.retro_class);
    const humanReadableClass = humanizeClassName(detection.class_name);

    let statusEmoji: "✓" | "⚠" | "✗" = "⚠";
    if (detection.compliance?.compliant) {
      statusEmoji = "✓";
    } else if (
      detection.retro_class === "FAILED" ||
      detection.retro_class === "LOW"
    ) {
      statusEmoji = "✗";
    }

    const priorityColor =
      PRIORITY_COLORS[detection.priority] ?? "text-muted-foreground";

    const scoreLowerBound = Math.max(
      0,
      Math.round(detection.retro_score - confidenceBand)
    );
    const scoreUpperBound = Math.min(
      100,
      Math.round(detection.retro_score + confidenceBand)
    );

    return {
      confidenceBand,
      humanReadableClass,
      statusEmoji,
      priorityColor,
      scoreLowerBound,
      scoreUpperBound,
    };
  }, [detection]);
}
