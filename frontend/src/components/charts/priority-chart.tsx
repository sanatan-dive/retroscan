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

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#f59e0b",
  Low: "#3b82f6",
  None: "#22c55e",
};

const PRIORITY_NAMES: Record<string, string> = {
  "1": "Critical",
  "2": "High",
  "3": "Medium",
  "4": "Low",
  "5": "None",
};

interface PriorityChartProps {
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
        items
      </div>
    </div>
  );
}

export function PriorityChart({ breakdown }: PriorityChartProps) {
  const data = Object.entries(breakdown).map(([key, value]) => {
    const name = PRIORITY_NAMES[key] || key;
    return {
      name,
      value,
      fill: PRIORITY_COLORS[name] ?? "#888",
    };
  });

  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} layout="vertical" barSize={18} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <defs>
          {data.map((entry, i) => (
            <linearGradient
              key={`prio-grad-${i}`}
              id={`prio-grad-${i}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor={entry.fill} stopOpacity={0.55} />
              <stop offset="100%" stopColor={entry.fill} stopOpacity={1} />
            </linearGradient>
          ))}
        </defs>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
        <Bar
          dataKey="value"
          radius={[0, 8, 8, 0]}
          isAnimationActive
          animationDuration={600}
          animationEasing="ease-out"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={`url(#prio-grad-${i})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
