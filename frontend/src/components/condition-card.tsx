"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RetroGauge } from "@/components/retro-gauge";
import { ComplianceBadge } from "@/components/compliance-badge";
import type { Detection } from "@/lib/types";
import { RETRO_COLORS, PRIORITY_LABELS } from "@/lib/types";
import { useDetectionInsights } from "@/lib/hooks";

interface ConditionCardProps {
  detection: Detection;
  onClick?: () => void;
}

export function ConditionCard({ detection, onClick }: ConditionCardProps) {
  const d = detection;
  const { confidenceBand, humanReadableClass, priorityColor } =
    useDetectionInsights(d);

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:border-emerald-500/30"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{humanReadableClass}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Frame {d.frame_index} | {d.timestamp_sec.toFixed(1)}s
            </p>
          </div>
          <ComplianceBadge
            compliant={d.compliance?.compliant ?? false}
            standard={d.compliance?.standard}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <RetroGauge
            score={d.retro_score}
            retroClass={d.retro_class}
            size="sm"
            confidenceBand={confidenceBand}
          />
          <div className="text-right space-y-1">
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                color: RETRO_COLORS[d.retro_class],
                borderColor: RETRO_COLORS[d.retro_class] + "40",
              }}
            >
              Grade {d.condition_grade}
            </Badge>
            <p className={`text-xs font-medium ${priorityColor}`}>
              {PRIORITY_LABELS[d.priority] ?? "Unknown"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <ConditionBar label="Color Fading" value={d.color_fading} inverted />
          <ConditionBar label="Surface Damage" value={d.surface_damage} inverted />
          <ConditionBar label="Dirt Level" value={d.dirt_level} inverted />
          <ConditionBar label="Legibility" value={d.legibility} />
        </div>

        {d.issues.length > 0 && d.issues[0] !== "No significant issues detected" && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2">
            {d.issues.map((issue, i) => (
              <p key={i} className="text-xs text-red-400">
                {issue}
              </p>
            ))}
          </div>
        )}

        {d.gemini_reasoning && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 animate-pulse-border">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] italic text-emerald-200/90 leading-snug line-clamp-2">
                {d.gemini_reasoning.length > 100
                  ? d.gemini_reasoning.slice(0, 100).trimEnd() + "..."
                  : d.gemini_reasoning}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConditionBar({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: number;
  inverted?: boolean;
}) {
  // For inverted metrics (fading, damage, dirt): high = bad
  const displayValue = inverted ? 100 - value : value;
  const color =
    displayValue >= 70
      ? "bg-emerald-500"
      : displayValue >= 40
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
    </div>
  );
}
