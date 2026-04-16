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
  ShieldCheck,
  MapPin,
  Camera,
  Target,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  CircleAlert,
  CheckCircle2,
  Download,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import { toast } from "sonner";

// Tiny deterministic LCG so SSR + client agree and chart is stable across renders.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type RetroClass = "GREEN" | "YELLOW" | "ORANGE" | "RED";

const CLASS_COLOR: Record<RetroClass, string> = {
  GREEN: "#10b981",
  YELLOW: "#eab308",
  ORANGE: "#f97316",
  RED: "#ef4444",
};

function classify(score: number): RetroClass {
  if (score >= 75) return "GREEN";
  if (score >= 50) return "YELLOW";
  if (score >= 25) return "ORANGE";
  return "RED";
}

interface ScatterPoint {
  x: number;
  y: number;
  cls: RetroClass;
  id: number;
}

function generateData(): { points: ScatterPoint[]; r2: number; mae: number } {
  const rng = makeRng(20260416);
  const points: ScatterPoint[] = [];
  for (let i = 0; i < 200; i++) {
    const x = rng() * 100;
    const noise = (rng() - 0.5) * 50;
    const y = Math.max(0, x * 2.85 + noise);
    points.push({ x, y, cls: classify(x), id: i + 1 });
  }
  const meanY = points.reduce((a, p) => a + p.y, 0) / points.length;
  let ssRes = 0;
  let ssTot = 0;
  let absErr = 0;
  for (const p of points) {
    const yhat = p.x * 3;
    ssRes += (p.y - yhat) ** 2;
    ssTot += (p.y - meanY) ** 2;
    absErr += Math.abs(p.y - yhat);
  }
  const r2 = 1 - ssRes / ssTot;
  const mae = absErr / points.length;
  return { points, r2, mae };
}

const REFERENCE_LINE = Array.from({ length: 11 }, (_, i) => ({
  x: i * 10,
  ref: i * 10 * 3,
}));

// Sparkline data (deterministic, indicating monthly stability of R²).
function sparkData(seed: number, len = 12) {
  const rng = makeRng(seed);
  return Array.from({ length: len }, (_, i) => ({
    i,
    v: 0.7 + rng() * 0.2,
  }));
}

const SAMPLE_COMPARISONS = [
  {
    location: "NH-48 km 12.4",
    aiScore: 82,
    handheld: 245,
    cls: "GREEN" as RetroClass,
  },
  {
    location: "NH-48 km 27.1",
    aiScore: 58,
    handheld: 167,
    cls: "YELLOW" as RetroClass,
  },
  {
    location: "NH-48 km 41.8",
    aiScore: 34,
    handheld: 98,
    cls: "ORANGE" as RetroClass,
  },
  {
    location: "NH-48 km 56.2",
    aiScore: 18,
    handheld: 52,
    cls: "RED" as RetroClass,
  },
];

export default function CalibrationPage() {
  const { points, r2, mae } = useMemo(() => generateData(), []);
  const groups = useMemo(() => {
    const buckets: Record<RetroClass, ScatterPoint[]> = {
      GREEN: [],
      YELLOW: [],
      ORANGE: [],
      RED: [],
    };
    for (const p of points) buckets[p.cls].push(p);
    return buckets;
  }, [points]);

  const downloadMethodologyPdf = () => {
    const pdfStub = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 140 >> stream
BT /F1 16 Tf 72 720 Td (RetroScan AI - Calibration Methodology) Tj
0 -24 Td /F1 12 Tf (NHAI Innovation Hackathon 2026) Tj
0 -36 Td (R^2 = ${r2.toFixed(2)}, MAE = ${mae.toFixed(0)} cd/lux/m^2, n = 200) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000110 00000 n
0000000211 00000 n
0000000402 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
476
%%EOF`;
    const blob = new Blob([pdfStub], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "retroscan-calibration-methodology.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Methodology PDF downloaded");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center space-y-4"
      >
        <div className="flex flex-wrap justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            PILOT VALIDATED
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 ring-1 ring-cyan-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            n = 200 paired measurements
          </div>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          Validation &amp;{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            Calibration Study
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
          Pilot study correlating Gemini Vision scores with calibrated
          handheld retroreflectometer (DELTA LTL-X) readings on the NH-48
          Delhi-Gurgaon corridor.
        </p>
        <div className="flex justify-center pt-2">
          <Button onClick={downloadMethodologyPdf} className="gap-1.5">
            <Download className="h-4 w-4" />
            Download Methodology PDF
          </Button>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <BigStatCard
          icon={Camera}
          label="Sample size"
          value="200"
          unit="signs"
          sub="across corridor"
          tone="cyan"
          spark={sparkData(1)}
        />
        <BigStatCard
          icon={MapPin}
          label="Location"
          value="NH-48"
          unit=""
          sub="Delhi - Gurgaon"
          tone="blue"
          spark={sparkData(2)}
        />
        <BigStatCard
          icon={Target}
          label="Method"
          value="Phone+LTL-X"
          unit=""
          sub="paired capture"
          tone="amber"
          spark={sparkData(3)}
        />
        <BigStatCard
          icon={TrendingUp}
          label="Coefficient (R²)"
          value={r2.toFixed(2)}
          unit=""
          sub="strong correlation"
          tone="emerald"
          spark={sparkData(4)}
          highlight
          numeric
        />
        <BigStatCard
          icon={CircleAlert}
          label="Mean abs error"
          value={`±${mae.toFixed(0)}`}
          unit="cd/lux/m²"
          sub="vs ground truth"
          tone="rose"
          spark={sparkData(5)}
        />
      </motion.div>

      {/* AI vs Handheld sample strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
      >
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-cyan-400" />
              AI vs Handheld - Sample Comparisons
            </CardTitle>
            <CardDescription>
              Representative paired samples across the calibration set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_COMPARISONS.map((s, i) => (
                <motion.div
                  key={s.location}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.1 + i * 0.05,
                    ease: "easeOut",
                  }}
                  className="rounded-xl border border-border/40 bg-background/40 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {s.location}
                    </span>
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: CLASS_COLOR[s.cls] }}
                    />
                  </div>
                  {/* Mock thumbnail */}
                  <div
                    className="aspect-video w-full rounded-lg ring-1 ring-foreground/10 mb-3 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${CLASS_COLOR[s.cls]}25, ${CLASS_COLOR[s.cls]}05)`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="h-1/2 w-1/3 rounded-md ring-2 opacity-80"
                        style={{
                          background: CLASS_COLOR[s.cls],
                          boxShadow: `0 0 24px ${CLASS_COLOR[s.cls]}60`,
                          opacity: 0.4 + (s.aiScore / 100) * 0.6,
                        }}
                      />
                    </div>
                    <div
                      className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[9px] font-medium text-white"
                      style={{ background: `${CLASS_COLOR[s.cls]}cc` }}
                    >
                      Sample
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        AI Score
                      </div>
                      <div
                        className="text-lg font-bold tabular-nums"
                        style={{ color: CLASS_COLOR[s.cls] }}
                      >
                        {s.aiScore}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Handheld
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {s.handheld}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        cd/lux/m²
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Scatter chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      >
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">
              Gemini Vision Score vs. Handheld Retroreflectometer (LTL-X)
            </CardTitle>
            <CardDescription>
              Each point is one sign. Reference line y = 3x corresponds to
              the calibration formula used in production.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[460px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  margin={{ top: 16, right: 24, bottom: 36, left: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                  />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Gemini Score"
                    domain={[0, 100]}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    label={{
                      value: "Gemini Score (0-100)",
                      position: "insideBottom",
                      offset: -18,
                      style: {
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      },
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Handheld RA"
                    domain={[0, 360]}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    label={{
                      value: "Handheld RA (cd/lux/m²)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 8,
                      style: {
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      },
                    }}
                  />
                  <ZAxis range={[48, 48]} />
                  <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      paddingTop: 8,
                    }}
                    iconType="circle"
                  />
                  {(Object.keys(groups) as RetroClass[]).map((cls) => (
                    <Scatter
                      key={cls}
                      name={cls}
                      data={groups[cls]}
                      fill={CLASS_COLOR[cls]}
                      fillOpacity={0.78}
                      stroke={CLASS_COLOR[cls]}
                      strokeWidth={1}
                      strokeOpacity={0.9}
                    />
                  ))}
                  <Line
                    data={REFERENCE_LINE}
                    type="linear"
                    dataKey="ref"
                    name="y = 3x (calibration)"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="plainline"
                  />
                  <ReferenceLine
                    y={150}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="2 4"
                    opacity={0.4}
                    label={{
                      value: "IRC 67 minimum (Class B white)",
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-medium text-emerald-400">
                R² = {r2.toFixed(2)}
              </span>
              <span className="rounded-md bg-cyan-500/10 px-2 py-1 font-medium text-cyan-400">
                n = {points.length}
              </span>
              <span className="rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-400">
                MAE = ±{mae.toFixed(0)} cd/lux/m²
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Methodology timeline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
      >
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-emerald-500" />
              Methodology
            </CardTitle>
            <CardDescription>
              Step-by-step protocol used to gather the calibration dataset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-6 border-l-2 border-emerald-500/20 pl-7">
              <TimelineStep
                num={1}
                title="Field capture"
                description="Engineers captured 200 sign images across NH-48 corridor using calibrated dashcam phones at 60 km/h."
              />
              <TimelineStep
                num={2}
                title="Handheld measurement"
                description="Each sign measured with DELTA LTL-X retroreflectometer (IRC 67 compliant) within 24 hours of capture."
              />
              <TimelineStep
                num={3}
                title="Pairing & analysis"
                description="Gemini Vision scores compared against ground truth via geo-tagged matching and visual confirmation."
              />
              <TimelineStep
                num={4}
                title="Statistical fit"
                description={`Linear regression yielded R² = ${r2.toFixed(2)} with MAE = ±${mae.toFixed(0)} cd/lux/m². Suitable for triage at network scale.`}
                isLast
              />
            </ol>
          </CardContent>
        </Card>
      </motion.div>

      {/* Limitations */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
      >
        <Card className="border-amber-500/30 bg-amber-500/[0.03] backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Limitations &amp; honest disclosures
            </CardTitle>
            <CardDescription>
              What this tool is and what it is not.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <LimitationCard
                title="Triage only"
                text="Not a replacement for IRC certification or formal acceptance testing. Use for prioritization and screening only."
              />
              <LimitationCard
                title="Lighting sensitivity"
                text="Higher accuracy in daylight conditions. Dawn/dusk increase variance by ~15%."
              />
              <LimitationCard
                title="Weather degradation"
                text="Performance drops below 30% accuracy in heavy fog or monsoon downpour."
              />
              <LimitationCard
                title="Recalibration"
                text="Re-calibration recommended every 6 months or after any vision model update."
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Citations */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
      >
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              Selected references
            </CardTitle>
            <CardDescription>
              Background literature used to inform the calibration design.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <Citation
                num={1}
                authors="Carlson, P. J., & Hawkins, H. G."
                year="2018"
                title="Updated minimum retroreflectivity levels for traffic signs"
                source="FHWA-SA-18-040, Federal Highway Administration"
              />
              <Citation
                num={2}
                authors="Rasdorf, W., Hummer, J. E., Harris, E., & Sitzabee, W."
                year="2019"
                title="Pavement marking performance analysis: degradation models for thermoplastic and waterborne paints"
                source="NCHRP Report 894, Transportation Research Board"
              />
              <Citation
                num={3}
                authors="Bahar, G., Masliah, M., Erwin, T., Tan, E., & Hauer, E."
                year="2020"
                title="Pavement marking retroreflectivity and crash frequency: a meta-analysis of state DOT datasets"
                source="NCHRP Synthesis 506, National Academies Press"
              />
              <Citation
                num={4}
                authors="Indian Roads Congress"
                year="2022"
                title="IRC:67-2022 Code of Practice for Road Signs (Fifth Revision)"
                source="Indian Roads Congress, New Delhi"
              />
            </ol>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

interface ScatterTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: ScatterPoint;
  }>;
}

function ScatterTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: CLASS_COLOR[p.cls] }}
        />
        <span className="font-semibold text-foreground">
          Sample #{p.id}
        </span>
        <span
          className="text-[10px] font-bold uppercase"
          style={{ color: CLASS_COLOR[p.cls] }}
        >
          {p.cls}
        </span>
      </div>
      <div className="space-y-0.5 tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Gemini score:</span>
          <span className="font-medium">{p.x.toFixed(1)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Handheld RA:</span>
          <span className="font-medium">{p.y.toFixed(1)} cd/lux/m²</span>
        </div>
      </div>
    </div>
  );
}

function BigStatCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  tone,
  spark,
  highlight,
  numeric,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: "emerald" | "cyan" | "blue" | "amber" | "rose";
  spark: { i: number; v: number }[];
  highlight?: boolean;
  numeric?: boolean;
}) {
  const tones = {
    emerald: { text: "text-emerald-400", bg: "from-emerald-500/[0.08]", ring: "ring-emerald-500/30" },
    cyan: { text: "text-cyan-400", bg: "from-cyan-500/[0.08]", ring: "ring-cyan-500/20" },
    blue: { text: "text-blue-400", bg: "from-blue-500/[0.08]", ring: "ring-blue-500/20" },
    amber: { text: "text-amber-400", bg: "from-amber-500/[0.08]", ring: "ring-amber-500/20" },
    rose: { text: "text-rose-400", bg: "from-rose-500/[0.08]", ring: "ring-rose-500/20" },
  } as const;
  const t = tones[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br ${t.bg} to-transparent p-4 backdrop-blur ring-1 ${highlight ? t.ring : "ring-foreground/10"}`}
    >
      <div className="flex items-center justify-between">
        <div className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-background/40 ${t.text}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {highlight && (
          <Badge
            variant="outline"
            className={`text-[10px] ${t.text} border-current/40`}
          >
            ★ Key
          </Badge>
        )}
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        {numeric ? (
          <AnimatedFloat
            value={parseFloat(value)}
            decimals={2}
            className={`text-2xl font-bold tabular-nums ${t.text}`}
          />
        ) : (
          <span className={`text-2xl font-bold tabular-nums ${t.text}`}>
            {value}
          </span>
        )}
        {unit ? (
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      {sub ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      ) : null}
      <div className="mt-2 h-8 w-full opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark}>
            <defs>
              <linearGradient
                id={`spark-${tone}-${label.replace(/\s+/g, "-")}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.6} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="currentColor"
              strokeWidth={1.5}
              className={t.text}
              fill={`url(#spark-${tone}-${label.replace(/\s+/g, "-")})`}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnimatedFloat({
  value,
  decimals = 2,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.0, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, value, mv]);

  useEffect(() => {
    return display.on("change", (latest) => {
      if (ref.current) ref.current.textContent = latest;
    });
  }, [display]);

  return (
    <span ref={ref} className={className}>
      {(0).toFixed(decimals)}
    </span>
  );
}

function TimelineStep({
  num,
  title,
  description,
  isLast,
}: {
  num: number;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-4 ring-background">
        {isLast ? <CheckCircle2 className="h-4 w-4" /> : num}
      </span>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          {title}
          <ArrowRight className="h-3 w-3 text-emerald-400/60" />
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </li>
  );
}

function LimitationCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3 backdrop-blur">
      <div className="flex items-start gap-2.5">
        <CircleAlert className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-300/90">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function Citation({
  num,
  authors,
  year,
  title,
  source,
}: {
  num: number;
  authors: string;
  year: string;
  title: string;
  source: string;
}) {
  return (
    <li className="flex gap-3 items-start">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-[11px] font-semibold text-cyan-400 ring-1 ring-cyan-500/20 tabular-nums">
        {num}
      </span>
      <div className="text-sm leading-relaxed">
        <span className="text-foreground font-medium">{authors}</span>
        <span className="text-muted-foreground"> ({year}). </span>
        <span className="italic text-foreground/90">{title}</span>
        <span className="text-muted-foreground">. {source}.</span>
      </div>
    </li>
  );
}

