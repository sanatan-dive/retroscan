"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  Calculator,
  IndianRupee,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  ScanLine,
  HardHat,
  TrendingUp,
  Network,
  Quote,
  Sparkles,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const HANDHELD_COST_PER_KM = 50_000;
const HANDHELD_HOURS_PER_KM = 4;
const HANDHELD_RISK = 9;
const RETROSCAN_COST_PER_KM = 200;
const RETROSCAN_MIN_PER_KM = 5;
const RETROSCAN_RISK = 1;
const NHAI_NETWORK_KM = 150_000;

const KM_SNAPS = [10, 50, 100, 250, 500, 1000, 2500, 5000];
const FREQ_SNAPS = [1, 2, 3, 4];

function snap(value: number, points: number[]): number {
  let nearest = points[0];
  let minDist = Math.abs(value - points[0]);
  for (const p of points) {
    const d = Math.abs(value - p);
    if (d < minDist) {
      minDist = d;
      nearest = p;
    }
  }
  return nearest;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
}

function formatINRCompact(value: number): string {
  if (value >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (value >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(2)} L`;
  }
  return `₹${formatINR(value)}`;
}

const TESTIMONIALS = [
  {
    quote:
      "If we'd had this 3 years ago, we'd have saved over ₹400 Cr in inspection contracts and avoided 17 inspector incidents on live carriageway.",
    author: "Hypothetical NHAI Director",
    role: "Operations & Maintenance",
  },
  {
    quote:
      "Triage at network scale changes the maintenance equation entirely. We can finally prioritize the right kilometres.",
    author: "Hypothetical Project Director",
    role: "PIU North-West Region",
  },
  {
    quote:
      "Reducing inspector exposure to live traffic alone justifies the deployment. The cost savings are a bonus.",
    author: "Hypothetical Safety Auditor",
    role: "Highway Safety Cell",
  },
];

export default function RoiPage() {
  const [km, setKm] = useState<number>(100);
  const [freq, setFreq] = useState<number>(2);

  const calc = useMemo(() => {
    const auditedKm = km * freq;
    const handheldCost = auditedKm * HANDHELD_COST_PER_KM;
    const handheldHours = auditedKm * HANDHELD_HOURS_PER_KM;
    const retroCost = auditedKm * RETROSCAN_COST_PER_KM;
    const retroHours = (auditedKm * RETROSCAN_MIN_PER_KM) / 60;
    const costSaved = handheldCost - retroCost;
    const timeSaved = handheldHours - retroHours;
    const inspectorDaysSaved = timeSaved / 8;
    const networkSavings =
      (HANDHELD_COST_PER_KM - RETROSCAN_COST_PER_KM) *
      NHAI_NETWORK_KM *
      freq;

    return {
      auditedKm,
      handheldCost,
      handheldHours,
      retroCost,
      retroHours,
      costSaved,
      timeSaved,
      inspectorDaysSaved,
      networkSavings,
    };
  }, [km, freq]);

  const timeline = useMemo(() => {
    const data = [];
    let cumulative = 0;
    for (let year = 1; year <= 5; year++) {
      cumulative += calc.costSaved;
      data.push({
        year: `Year ${year}`,
        cumulative,
        annual: calc.costSaved,
      });
    }
    return data;
  }, [calc.costSaved]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 ring-1 ring-cyan-500/30">
          <Calculator className="h-3.5 w-3.5" />
          ROI Calculator
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          Saved across your network
        </h1>
        <div className="text-5xl sm:text-7xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
          <AnimatedCurrency value={calc.networkSavings} />
        </div>
        <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
          Estimated annual NHAI network savings — adjust your corridor below
          to see your tailored numbers update live.
        </p>
      </motion.div>

      {/* Inputs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      >
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Audit parameters</CardTitle>
            <CardDescription>
              Drag the sliders to model your corridor.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium">Highway length</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums text-emerald-400">
                    {formatINR(km)}
                  </span>
                  <span className="text-xs text-muted-foreground">km</span>
                </div>
              </div>
              <Slider
                value={[km]}
                min={10}
                max={5000}
                step={10}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : (v as number);
                  setKm(snap(n, KM_SNAPS));
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                {KM_SNAPS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setKm(p)}
                    className={`rounded px-1 py-0.5 hover:text-foreground transition-colors ${km === p ? "text-emerald-400 font-semibold" : ""}`}
                  >
                    {p < 1000 ? p : `${p / 1000}k`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium">Audit frequency</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums text-emerald-400">
                    {freq}
                  </span>
                  <span className="text-xs text-muted-foreground">x / year</span>
                </div>
              </div>
              <Slider
                value={[freq]}
                min={1}
                max={4}
                step={1}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : (v as number);
                  setFreq(snap(n, FREQ_SNAPS));
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                {FREQ_SNAPS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setFreq(p)}
                    className={`rounded px-1 py-0.5 hover:text-foreground transition-colors ${freq === p ? "text-emerald-400 font-semibold" : ""}`}
                  >
                    {p}x
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Method comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <Card className="relative h-full overflow-hidden border-l-4 border-l-rose-500 border-rose-500/30 bg-rose-500/[0.04] backdrop-blur">
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/15 blur-2xl" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-rose-400" />
                  Handheld inspection
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-rose-500/40 text-rose-400 gap-1"
                >
                  <XCircle className="h-3 w-3" />
                  Legacy
                </Badge>
              </div>
              <CardDescription>
                Crew with retroreflectometer walks each km of carriageway.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <MethodRow
                icon={IndianRupee}
                label="Cost per km"
                value={`₹${formatINR(HANDHELD_COST_PER_KM)}`}
              />
              <MethodRow
                icon={Clock}
                label="Time per km"
                value={`${HANDHELD_HOURS_PER_KM} hours`}
              />
              <MethodRow
                icon={ShieldAlert}
                label="Safety risk"
                value="HIGH"
                valueClass="text-rose-400"
                badge="Inspectors on live carriageway"
              />
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    For {formatINR(calc.auditedKm)} audit-km
                  </span>
                  <span className="font-semibold tabular-nums text-rose-400">
                    ₹{formatINR(calc.handheldCost)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Field hours</span>
                  <span className="tabular-nums">
                    {formatINR(calc.handheldHours)} hrs
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        >
          <Card className="relative h-full overflow-hidden border-l-4 border-l-emerald-500 border-emerald-500/30 bg-emerald-500/[0.04] backdrop-blur">
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScanLine className="h-4 w-4 text-emerald-400" />
                  RetroScan AI triage
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-400 gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Recommended
                </Badge>
              </div>
              <CardDescription>
                Dashcam footage processed by AI - flag at-risk assets at scale.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <MethodRow
                icon={IndianRupee}
                label="Cost per km"
                value={`₹${formatINR(RETROSCAN_COST_PER_KM)}`}
              />
              <MethodRow
                icon={Clock}
                label="Time per km"
                value={`${RETROSCAN_MIN_PER_KM} minutes`}
              />
              <MethodRow
                icon={ShieldCheck}
                label="Safety risk"
                value="NONE"
                valueClass="text-emerald-400"
                badge="Drive-by capture, no exposure"
              />
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    For {formatINR(calc.auditedKm)} audit-km
                  </span>
                  <span className="font-semibold tabular-nums text-emerald-400">
                    ₹{formatINR(calc.retroCost)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Field hours</span>
                  <span className="tabular-nums">
                    {formatINR(calc.retroHours)} hrs
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Totals card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] via-cyan-500/[0.06] to-transparent backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Total annual savings
            </CardTitle>
            <CardDescription>
              {formatINR(km)} km audited {freq}x per year ={" "}
              {formatINR(calc.auditedKm)} audit-km total.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <BigStat
              label="Cost saved"
              value={formatINRCompact(calc.costSaved)}
              sub={`₹${formatINR(calc.costSaved)}`}
              icon={IndianRupee}
              tone="emerald"
            />
            <BigStat
              label="Time saved"
              value={`${formatINR(calc.timeSaved)} hrs`}
              sub={`${formatINR(calc.timeSaved / 24)} days of field work`}
              icon={Clock}
              tone="cyan"
            />
            <BigStat
              label="Inspector days saved"
              value={`${formatINR(calc.inspectorDaysSaved)}`}
              sub="at 8 hrs / inspector / day"
              icon={HardHat}
              tone="amber"
            />
            <BigStat
              label="Safety"
              value="Zero exposure"
              sub="Inspectors removed from live traffic"
              icon={ShieldCheck}
              tone="emerald"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Savings timeline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
      >
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">
              Cumulative savings — 5-year projection
            </CardTitle>
            <CardDescription>
              At {freq}x annual audits over {formatINR(km)} km.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id="savings-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => formatINRCompact(Number(v))}
                  />
                  <Tooltip content={<TimelineTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative savings"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#savings-grad)"
                    isAnimationActive
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* NHAI scale-up with India SVG */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-cyan-500/30 bg-gradient-to-br from-cyan-500/[0.06] via-emerald-500/[0.05] to-transparent backdrop-blur">
          <CardContent className="grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
            <div className="relative mx-auto h-44 w-44 sm:h-56 sm:w-56">
              <IndiaMap savingsCr={calc.networkSavings / 1_00_00_000} />
            </div>
            <div className="space-y-3 text-center md:text-left">
              <Badge
                variant="outline"
                className="border-cyan-500/40 text-cyan-400 mx-auto md:mx-0"
              >
                <Network className="h-3 w-3 mr-1" />
                Scale to NHAI
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-bold">
                <AnimatedCurrency value={calc.networkSavings} /> per year
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Applied across the 1,50,000 km national highway network at{" "}
                {freq}x annual audits, NHAI saves an estimated above figure
                from inspection budgets alone — before counting reduced
                downtime, inspector safety, and faster maintenance cycles.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Testimonials */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            What stakeholders are saying
          </h2>
          <Badge variant="outline" className="text-[10px]">
            Hypothetical scenarios
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.4 + i * 0.07,
                ease: "easeOut",
              }}
            >
              <Card className="h-full border-border/40 bg-card/50 backdrop-blur">
                <CardContent className="p-5 space-y-3">
                  <Quote className="h-5 w-5 text-emerald-400/60" />
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {t.quote}
                  </p>
                  <div className="border-t border-border/40 pt-3">
                    <p className="text-sm font-semibold">{t.author}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.role}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground">
        Estimates based on published NHAI inspection contracts and pilot
        study timings. Actual costs vary by terrain, traffic management
        overhead, and device calibration cycles.
      </p>
    </div>
  );
}

interface TimelineTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { year: string; annual: number } }>;
}

function TimelineTooltip({ active, payload }: TimelineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5">
      <div className="font-semibold text-foreground">{p.payload.year}</div>
      <div className="mt-1 space-y-0.5 tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cumulative:</span>
          <span className="text-emerald-400 font-medium">
            {formatINRCompact(p.value)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">This year:</span>
          <span className="font-medium">
            {formatINRCompact(p.payload.annual)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MethodRow({
  icon: Icon,
  label,
  value,
  valueClass,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${valueClass ?? ""}`}>
          {value}
        </div>
        {badge ? (
          <div className="text-[11px] text-muted-foreground">{badge}</div>
        ) : null}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "cyan" | "amber";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 ring-cyan-500/20",
    amber: "text-amber-400 bg-amber-500/10 ring-amber-500/20",
  };
  return (
    <div className="space-y-2">
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function AnimatedCurrency({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, margin: "-50px" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => formatINRCompact(v));

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [inView, value, mv]);

  useEffect(() => {
    return display.on("change", (latest) => {
      if (ref.current) ref.current.textContent = latest;
    });
  }, [display]);

  return (
    <span ref={ref} className="tabular-nums inline-block">
      {formatINRCompact(0)}
    </span>
  );
}

/**
 * Simplified India outline SVG with savings counter overlay.
 */
function IndiaMap({ savingsCr }: { savingsCr: number }) {
  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 200 220"
        className="h-full w-full drop-shadow-[0_0_20px_rgba(34,211,238,0.25)]"
      >
        <defs>
          <linearGradient id="india-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.25} />
          </linearGradient>
          <radialGradient id="india-glow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect
          x="40"
          y="30"
          width="120"
          height="120"
          rx="60"
          fill="url(#india-glow)"
          opacity={0.6}
        />
        {/* Stylized India shape (simplified) */}
        <path
          d="M 95 12
             L 110 18
             L 130 22
             L 145 30
             L 152 45
             L 158 60
             L 156 80
             L 148 95
             L 138 110
             L 130 125
             L 120 145
             L 112 165
             L 105 185
             L 98 200
             L 92 195
             L 85 180
             L 78 165
             L 70 150
             L 60 138
             L 52 125
             L 48 110
             L 50 92
             L 55 75
             L 60 60
             L 62 45
             L 70 30
             L 82 20
             Z"
          fill="url(#india-fill)"
          stroke="#22d3ee"
          strokeWidth={1.2}
          strokeOpacity={0.7}
        />
        {/* Highway dots */}
        {[
          [80, 50],
          [120, 60],
          [100, 80],
          [85, 100],
          [120, 110],
          [105, 130],
          [95, 150],
          [100, 175],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="1.6"
            fill="#fbbf24"
            opacity={0.85}
          >
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur={`${2 + (i % 3) * 0.3}s`}
              begin={`${i * 0.15}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="inline-flex flex-col items-center rounded-xl border border-emerald-500/30 bg-background/80 px-3 py-1.5 backdrop-blur">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
            Annual savings
          </span>
          <span className="text-base font-bold tabular-nums text-emerald-400">
            ₹{savingsCr.toFixed(2)} Cr
          </span>
        </div>
      </div>
    </div>
  );
}
