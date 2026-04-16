"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COMPLIANCE_DISCLAIMER } from "@/lib/hooks";

interface ComplianceBadgeProps {
  compliant: boolean;
  standard?: string;
  className?: string;
  /** Render the AI estimation tooltip on hover (default true) */
  withTooltip?: boolean;
}

export function ComplianceBadge({
  compliant,
  standard,
  className,
  withTooltip = true,
}: ComplianceBadgeProps) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        compliant
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
          : "border-red-500/30 bg-red-500/10 text-red-500",
        withTooltip && "cursor-help",
        className
      )}
    >
      {compliant ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {standard ? `${standard} ` : ""}
      {compliant ? "PASS" : "FAIL"}
      {withTooltip && (
        <Info className="h-3 w-3 opacity-60" aria-hidden="true" />
      )}
    </Badge>
  );

  if (!withTooltip) return badge;

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="button"
              tabIndex={0}
              aria-label={`Compliance ${compliant ? "pass" : "fail"} — hover for details`}
              className="inline-flex outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
            />
          }
        >
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-center">
          {COMPLIANCE_DISCLAIMER}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
