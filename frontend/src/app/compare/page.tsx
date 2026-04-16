"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Sparkles,
  ImageOff,
  Layers,
  ScanLine,
  Calendar,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllScans, getScanResults, getFrameImageUrl } from "@/lib/api";
import type { ScanListItem, ScanResult } from "@/lib/types";
import { RETRO_COLORS } from "@/lib/types";

export default function ComparePage() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [scanA, setScanA] = useState<string | null>(null);
  const [scanB, setScanB] = useState<string | null>(null);
  const [resultA, setResultA] = useState<ScanResult | null>(null);
  const [resultB, setResultB] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllScans()
      .then((data) => {
        const completed = (data.scans || []).filter(
          (s: ScanListItem) => s.status === "completed"
        );
        setScans(completed);
        if (completed.length >= 2) {
          setScanA(completed[1].scan_id);
          setScanB(completed[0].scan_id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!scanA || !scanB) return;
    setLoading(true);
    Promise.all([getScanResults(scanA), getScanResults(scanB)])
      .then(([a, b]) => {
        setResultA(a);
        setResultB(b);
      })
      .finally(() => setLoading(false));
  }, [scanA, scanB]);

  const delta =
    resultA && resultB
      ? {
          score:
            resultB.summary.avg_retro_score -
            resultA.summary.avg_retro_score,
          pass:
            resultB.summary.compliance_pass -
            resultA.summary.compliance_pass,
          fail:
            resultB.summary.compliance_fail -
            resultA.summary.compliance_fail,
          total:
            resultB.summary.total_detections -
            resultA.summary.total_detections,
        }
      : null;

  const insight = useMemo(() => {
    if (!resultA || !resultB || !delta) return null;
    const totalA = resultA.summary.compliance_pass + resultA.summary.compliance_fail;
    const totalB = resultB.summary.compliance_pass + resultB.summary.compliance_fail;
    const complianceA = totalA > 0 ? (resultA.summary.compliance_pass / totalA) * 100 : 0;
    const complianceB = totalB > 0 ? (resultB.summary.compliance_pass / totalB) * 100 : 0;
    const compDelta = complianceB - complianceA;

    let verdict: "improved" | "declined" | "stable" = "stable";
    if (delta.score > 2 && compDelta > 1) verdict = "improved";
    else if (delta.score < -2 && compDelta < -1) verdict = "declined";

    return {
      complianceA,
      complianceB,
      compDelta,
      verdict,
      score: delta.score,
    };
  }, [resultA, resultB, delta]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <GitCompare className="h-3.5 w-3.5" />
          Temporal Comparison
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
            Before
          </span>{" "}
          /{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            After
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
          Compare two scans side-by-side to track retroreflectivity change,
          maintenance impact, and compliance shift over time.
        </p>
      </motion.div>

      {/* Scan picker cards */}
      {scans.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch"
        >
          <ScanPickerCard
            label="Before"
            tone="rose"
            value={scanA}
            onChange={setScanA}
            scans={scans}
            result={resultA}
          />
          <div className="flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/15 to-emerald-500/15 ring-1 ring-foreground/10 lg:rotate-0">
              <ArrowRight className="h-5 w-5 text-emerald-400 rotate-90 lg:rotate-0" />
            </div>
          </div>
          <ScanPickerCard
            label="After"
            tone="emerald"
            value={scanB}
            onChange={setScanB}
            scans={scans}
            result={resultB}
          />
        </motion.div>
      )}

      {loading && (
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardContent className="flex items-center justify-center py-12">
            <ScanLine className="h-6 w-6 animate-pulse text-emerald-500 mr-2" />
            <span className="text-muted-foreground text-sm">
              Loading comparison...
            </span>
          </CardContent>
        </Card>
      )}

      {!loading && scans.length < 2 && <NotEnoughScansState count={scans.length} />}

      {!loading && resultA && resultB && delta && insight && (
        <>
          {/* AI Insight narrative */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          >
            <Card className="overflow-hidden border-border/40 bg-gradient-to-br from-cyan-500/[0.05] via-emerald-500/[0.04] to-transparent backdrop-blur">
              <CardContent className="flex items-start gap-4 p-5 sm:p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 ring-1 ring-cyan-500/30">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                    AI Summary Insight
                  </p>
                  <p className="text-sm sm:text-base leading-relaxed">
                    {insightNarrative(insight, resultA, resultB)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Delta cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DeltaMetricCard
              label="Avg Retro Score"
              before={resultA.summary.avg_retro_score}
              after={resultB.summary.avg_retro_score}
              delta={delta.score}
              format={(v) => v.toFixed(1)}
              decimals={1}
              delay={0.0}
            />
            <DeltaMetricCard
              label="Compliant Assets"
              before={resultA.summary.compliance_pass}
              after={resultB.summary.compliance_pass}
              delta={delta.pass}
              format={(v) => v.toFixed(0)}
              decimals={0}
              delay={0.05}
            />
            <DeltaMetricCard
              label="Non-Compliant"
              before={resultA.summary.compliance_fail}
              after={resultB.summary.compliance_fail}
              delta={delta.fail}
              inverted
              format={(v) => v.toFixed(0)}
              decimals={0}
              delay={0.1}
            />
            <DeltaMetricCard
              label="Total Detections"
              before={resultA.summary.total_detections}
              after={resultB.summary.total_detections}
              delta={delta.total}
              format={(v) => v.toFixed(0)}
              decimals={0}
              delay={0.15}
            />
          </div>

          {/* Visual diff */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
          >
            <Card className="border-border/40 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  Visual Diff
                </CardTitle>
                <CardDescription>
                  Representative frames from each scan side-by-side.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <ScanThumb
                  label="Before"
                  tone="rose"
                  result={resultA}
                />
                <ScanThumb
                  label="After"
                  tone="emerald"
                  result={resultB}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Side-by-side scan summary cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <ScanCard
              title="Before"
              filename={resultA.scan.filename}
              date={resultA.scan.created_at}
              summary={resultA.summary}
              tone="rose"
            />
            <ScanCard
              title="After"
              filename={resultB.scan.filename}
              date={resultB.scan.created_at}
              summary={resultB.summary}
              tone="emerald"
              highlight
            />
          </div>

          {/* Animated distribution comparison */}
          <DistributionComparison resultA={resultA} resultB={resultB} />
        </>
      )}
    </div>
  );
}

function insightNarrative(
  insight: Insight,
  resultA: ScanResult,
  resultB: ScanResult
): string {
  const fmt = (n: number, d = 1) => n.toFixed(d);
  const compChangeStr =
    insight.compDelta === 0
      ? "remained flat"
      : insight.compDelta > 0
        ? `improved by ${fmt(insight.compDelta)}%`
        : `declined by ${fmt(Math.abs(insight.compDelta))}%`;

  const scoreStr =
    insight.score === 0
      ? "average score is unchanged"
      : insight.score > 0
        ? `average score gained ${fmt(insight.score)} points`
        : `average score dropped ${fmt(Math.abs(insight.score))} points`;

  if (insight.verdict === "improved") {
    return `Between these two scans, compliance ${compChangeStr} and ${scoreStr}. Maintenance work appears to be having a positive measurable impact on the corridor's retroreflectivity health.`;
  }
  if (insight.verdict === "declined") {
    return `Compliance ${compChangeStr} and ${scoreStr} between scans. Consider prioritizing maintenance for ${resultB.summary.compliance_fail} non-compliant assets in the latest scan.`;
  }
  return `Compliance ${compChangeStr} and ${scoreStr} between scans. The corridor's retroreflectivity profile is broadly stable — continue monitoring at the current frequency.`;
}

// Helper type
type Insight = {
  complianceA: number;
  complianceB: number;
  compDelta: number;
  verdict: "improved" | "declined" | "stable";
  score: number;
};

function ScanPickerCard({
  label,
  tone,
  value,
  onChange,
  scans,
  result,
}: {
  label: "Before" | "After";
  tone: "rose" | "emerald";
  value: string | null;
  onChange: (v: string) => void;
  scans: ScanListItem[];
  result: ScanResult | null;
}) {
  const ringMap = {
    rose: "ring-rose-500/30 from-rose-500/10",
    emerald: "ring-emerald-500/30 from-emerald-500/10",
  };
  const badgeMap = {
    rose: "border-rose-500/40 text-rose-300 bg-rose-500/10",
    emerald: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  };

  return (
    <Card
      className={`relative h-full overflow-hidden border-border/40 bg-card/50 backdrop-blur ring-1 ${ringMap[tone]}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
          tone === "rose"
            ? "from-rose-500/[0.06]"
            : "from-emerald-500/[0.06]"
        } to-transparent`}
      />
      <CardContent className="relative space-y-4 p-5">
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[11px] uppercase tracking-wider ${badgeMap[tone]}`}
          >
            {label}
          </Badge>
          {result && (
            <Badge variant="outline" className="text-[11px]">
              <Calendar className="h-3 w-3 mr-1" />
              {new Date(result.scan.created_at).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <Select
          value={value ?? ""}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`Select ${label.toLowerCase()} scan`} />
          </SelectTrigger>
          <SelectContent>
            {scans.map((s) => (
              <SelectItem key={s.scan_id} value={s.scan_id}>
                {s.filename} —{" "}
                {new Date(s.created_at).toLocaleDateString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {result ? (
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <PickerStat
              label="Score"
              value={result.summary.avg_retro_score.toFixed(1)}
            />
            <PickerStat
              label="Pass"
              value={String(result.summary.compliance_pass)}
              tone="emerald"
            />
            <PickerStat
              label="Fail"
              value={String(result.summary.compliance_fail)}
              tone="rose"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PickerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const c = tone === "emerald" ? "text-emerald-400" : tone === "rose" ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-background/50 px-2 py-1.5">
      <div className={`text-sm font-bold tabular-nums ${c}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ScanThumb({
  label,
  tone,
  result,
}: {
  label: string;
  tone: "rose" | "emerald";
  result: ScanResult;
}) {
  const [broken, setBroken] = useState(false);
  const frame = result.frames?.[0];
  const url = frame ? getFrameImageUrl(result.scan.scan_id, frame.frame_index, true) : null;
  const ringClass =
    tone === "rose" ? "ring-rose-500/30" : "ring-emerald-500/30";
  const badgeClass =
    tone === "rose"
      ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  return (
    <div className={`relative overflow-hidden rounded-xl ring-1 ${ringClass}`}>
      <div className="aspect-video bg-muted/40">
        {url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-1.5">
            <ImageOff className="h-7 w-7" />
            <p className="text-xs">No frame preview</p>
          </div>
        )}
      </div>
      <div className="absolute top-2 left-2">
        <Badge variant="outline" className={badgeClass}>
          {label}
        </Badge>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <p className="text-xs font-medium text-white truncate">
          {result.scan.filename}
        </p>
        <p className="text-[10px] text-white/70 tabular-nums">
          {new Date(result.scan.created_at).toLocaleDateString()} ·{" "}
          {result.summary.total_detections} detections
        </p>
      </div>
    </div>
  );
}

function DeltaMetricCard({
  label,
  before,
  after,
  delta,
  inverted = false,
  format,
  decimals = 0,
  delay = 0,
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
  inverted?: boolean;
  format: (v: number) => string;
  decimals?: number;
  delay?: number;
}) {
  const good = inverted ? delta < 0 : delta > 0;
  const bad = inverted ? delta > 0 : delta < 0;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  const tone = good ? "emerald" : bad ? "rose" : "muted";
  const colorMap = {
    emerald: "text-emerald-400",
    rose: "text-rose-400",
    muted: "text-muted-foreground",
  } as const;
  const bgMap = {
    emerald: "from-emerald-500/[0.08] to-emerald-500/[0.02] ring-emerald-500/30",
    rose: "from-rose-500/[0.08] to-rose-500/[0.02] ring-rose-500/30",
    muted: "from-foreground/[0.04] to-transparent ring-foreground/10",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
    >
      <Card
        className={`group relative h-full overflow-hidden border-border/40 bg-gradient-to-br ${bgMap[tone]} backdrop-blur ring-1`}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className={`flex items-center gap-1 ${colorMap[tone]}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tabular-nums">
                {delta > 0 ? "+" : ""}
                {format(Math.abs(delta))}
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber
              value={after}
              decimals={decimals}
              className={`text-3xl font-bold tabular-nums ${colorMap[tone]}`}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>was {format(before)}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="text-foreground font-medium">
              now {format(after)}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AnimatedNumber({
  value,
  decimals = 0,
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
    <span ref={ref} className={className}>
      {(0).toFixed(decimals)}
    </span>
  );
}

function ScanCard({
  title,
  filename,
  date,
  summary,
  tone,
  highlight = false,
}: {
  title: string;
  filename: string;
  date: string;
  summary: ScanResult["summary"];
  tone: "rose" | "emerald";
  highlight?: boolean;
}) {
  const ring = highlight
    ? tone === "emerald"
      ? "ring-emerald-500/30"
      : "ring-rose-500/30"
    : "ring-foreground/10";
  return (
    <Card className={`border-border/40 bg-card/50 backdrop-blur ${ring}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              tone === "emerald"
                ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                : "border-rose-500/40 text-rose-300 bg-rose-500/10"
            }
          >
            {title}
          </Badge>
          <span className="truncate">{filename}</span>
        </CardTitle>
        <CardDescription className="text-xs">
          {new Date(date).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Avg Score" value={summary.avg_retro_score.toFixed(1)} bold />
        <Row label="Detections" value={String(summary.total_detections)} />
        <Row
          label="Pass / Fail"
          value={
            <>
              <span className="text-emerald-400">
                {summary.compliance_pass}
              </span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-rose-400">
                {summary.compliance_fail}
              </span>
            </>
          }
        />
        <Row
          label="Maint. Cost"
          value={`INR ${summary.total_maintenance_cost.toLocaleString()}`}
        />
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function DistributionComparison({
  resultA,
  resultB,
}: {
  resultA: ScanResult;
  resultB: ScanResult;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const classes = ["HIGH", "MEDIUM", "LOW", "FAILED"] as const;
  const max = Math.max(
    1,
    ...classes.map((c) =>
      Math.max(
        resultA.summary.retro_distribution[c] || 0,
        resultB.summary.retro_distribution[c] || 0
      )
    )
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
    >
      <Card className="border-border/40 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">
            Retroreflectivity Distribution
          </CardTitle>
          <CardDescription>
            Bars morph from before (translucent) to after (solid) as you scroll.
          </CardDescription>
        </CardHeader>
        <CardContent ref={ref} className="space-y-4">
          {classes.map((cls) => {
            const beforeCount = resultA.summary.retro_distribution[cls] || 0;
            const afterCount = resultB.summary.retro_distribution[cls] || 0;
            const diff = afterCount - beforeCount;
            const color = RETRO_COLORS[cls];
            const beforePct = (beforeCount / max) * 100;
            const afterPct = (afterCount / max) * 100;
            const diffGood =
              cls === "HIGH" ? diff > 0 : diff < 0;
            const diffBad =
              cls === "HIGH" ? diff < 0 : diff > 0;

            return (
              <div key={cls} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="font-medium" style={{ color }}>
                      {cls}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">
                      {beforeCount} → {afterCount}
                    </span>
                    <span
                      className={`font-semibold ${
                        diffGood
                          ? "text-emerald-400"
                          : diffBad
                            ? "text-rose-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </span>
                  </div>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted/30">
                  {/* Before (translucent baseline) */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full opacity-30"
                    style={{
                      background: color,
                      width: `${beforePct}%`,
                    }}
                  />
                  {/* After (animated solid) */}
                  <motion.div
                    initial={{ width: `${beforePct}%` }}
                    animate={inView ? { width: `${afterPct}%` } : {}}
                    transition={{
                      duration: 0.9,
                      ease: "easeOut",
                    }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${color}99, ${color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function NotEnoughScansState({ count }: { count: number }) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 ring-1 ring-emerald-500/30">
            <GitCompare className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            Need at least 2 scans to compare
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            You currently have {count} completed scan{count === 1 ? "" : "s"}.
            Run more scans to track how your highway changes between
            inspections.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center pt-1">
          <Link href="/">
            <Button className="gap-1.5">
              <ScanLine className="h-3.5 w-3.5" />
              Start a New Scan
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" className="gap-1.5">
              View Existing Reports
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

