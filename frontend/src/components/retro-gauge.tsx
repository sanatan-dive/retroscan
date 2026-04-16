"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { RETRO_COLORS } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CONFIDENCE_BAND_EXPLANATION,
  RETRO_SCORE_DISCLAIMER,
} from "@/lib/hooks";

interface RetroGaugeProps {
  score: number;
  retroClass: "HIGH" | "MEDIUM" | "LOW" | "FAILED";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  /** Optional ± confidence band shown beneath the score */
  confidenceBand?: number;
  /** Show the AI estimate hover disclaimer (default: true) */
  showDisclaimer?: boolean;
}

export function RetroGauge({
  score,
  retroClass,
  size = "md",
  showLabel = true,
  confidenceBand,
  showDisclaimer = true,
}: RetroGaugeProps) {
  const color = RETRO_COLORS[retroClass];
  const dims = { sm: 64, md: 96, lg: 128 }[size];
  const strokeWidth = { sm: 4, md: 6, lg: 8 }[size];
  const radius = (dims - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const fontSize = { sm: "text-sm", md: "text-xl", lg: "text-3xl" }[size];

  const gauge = (
    <div className="relative" style={{ width: dims, height: dims }}>
      <svg width={dims} height={dims} className="-rotate-90">
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={dims / 2}
          cy={dims / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-bold", fontSize)} style={{ color }}>
          {score.toFixed(0)}
        </span>
      </div>
    </div>
  );

  return (
    <TooltipProvider delay={150}>
      <div className="flex flex-col items-center gap-1">
        {showDisclaimer ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="group relative cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={`Retroreflectivity score ${score.toFixed(0)}`}
                />
              }
            >
              {gauge}
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-center">
              {RETRO_SCORE_DISCLAIMER}
            </TooltipContent>
          </Tooltip>
        ) : (
          gauge
        )}

        {confidenceBand !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
              ± {confidenceBand}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="What is this confidence band?"
                    className="cursor-help text-muted-foreground/70 hover:text-muted-foreground transition-colors outline-none focus-visible:text-foreground"
                  />
                }
              >
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px]">
                {CONFIDENCE_BAND_EXPLANATION}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {showLabel && (
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color }}
          >
            {retroClass}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
