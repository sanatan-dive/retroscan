"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

interface CategoryBreakdownChartProps {
  breakdown: Record<string, number>;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload?: { name?: string; fill?: string };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const color = entry.payload?.fill ?? "#888";
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color }}
        />
        <span className="font-medium text-foreground">
          {entry.payload?.name}
        </span>
      </div>
      <div className="mt-1 text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">{entry.value}</span>{" "}
        detections
      </div>
    </div>
  );
}

export function CategoryBreakdownChart({
  breakdown,
}: CategoryBreakdownChartProps) {
  const data = Object.entries(breakdown).map(([name, value], i) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1) + "s",
    value,
    fill: COLORS[i % COLORS.length],
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 10, right: 8, bottom: 4, left: 8 }}>
        <defs>
          {data.map((entry, i) => (
            <linearGradient
              key={`cat-grad-${i}`}
              id={`cat-grad-${i}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={entry.fill} stopOpacity={1} />
              <stop offset="100%" stopColor={entry.fill} stopOpacity={0.55} />
            </linearGradient>
          ))}
        </defs>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
        <Bar
          dataKey="value"
          radius={[8, 8, 0, 0]}
          isAnimationActive
          animationDuration={600}
          animationEasing="ease-out"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={`url(#cat-grad-${i})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
