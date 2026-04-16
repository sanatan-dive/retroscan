"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { RETRO_COLORS } from "@/lib/types";

interface RetroDistributionChartProps {
  distribution: Record<string, number>;
}

const LABELS: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  FAILED: "Failed",
};

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload?: { total?: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const total = entry.payload?.total ?? 0;
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
  const color =
    RETRO_COLORS[entry.name as keyof typeof RETRO_COLORS] ?? "#888";
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
        <span className="font-medium text-foreground">
          {LABELS[entry.name] ?? entry.name}
        </span>
      </div>
      <div className="mt-1 text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">{entry.value}</span>{" "}
        assets
        <span className="ml-2 text-[11px]">({pct}%)</span>
      </div>
    </div>
  );
}

export function RetroDistributionChart({
  distribution,
}: RetroDistributionChartProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const data = Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, total }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data
      </div>
    );
  }

  return (
    <div className="relative w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.map((entry) => {
              const c =
                RETRO_COLORS[entry.name as keyof typeof RETRO_COLORS] ??
                "#888";
              return (
                <radialGradient
                  key={`g-${entry.name}`}
                  id={`retro-grad-${entry.name}`}
                  cx="50%"
                  cy="50%"
                  r="65%"
                >
                  <stop offset="0%" stopColor={c} stopOpacity={1} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.65} />
                </radialGradient>
              );
            })}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={3}
            dataKey="value"
            stroke="hsl(var(--background))"
            strokeWidth={2}
            isAnimationActive
            animationDuration={600}
            animationEasing="ease-out"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={`url(#retro-grad-${entry.name})`}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} cursor={false} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold tabular-nums">{total}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          assets
        </div>
      </div>
    </div>
  );
}
