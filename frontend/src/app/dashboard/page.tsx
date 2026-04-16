"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  Eye,
  IndianRupee,
  Layers,
  ShieldCheck,
  Info,
  Clock,
  Share2,
  ChevronDown,
  Filter as FilterIcon,
  Triangle,
  Minus,
  Circle,
  FileVideo,
  Inbox,
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
import { getScanResults, getAllScans } from "@/lib/api";
import { ConditionCard } from "@/components/condition-card";
import { RetroGauge } from "@/components/retro-gauge";
import { DetectionDetailDialog } from "@/components/detection-detail-dialog";
import { RetroDistributionChart } from "@/components/charts/retro-distribution";
import { CategoryBreakdownChart } from "@/components/charts/category-breakdown";
import { PriorityChart } from "@/components/charts/priority-chart";
import type { ScanResult, Detection, ScanListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scan");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [selectedScan, setSelectedScan] = useState<string | null>(scanId);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(
    null
  );
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // Refresh "last updated" label every minute (and initialise on mount to
  // keep render pure for Next.js 16 react-hooks/purity rule).
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    getAllScans()
      .then((data) => setScans(data.scans || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = selectedScan || scanId;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getScanResults(id)
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedScan, scanId]);

  const filteredDetections =
    result?.detections.filter(
      (d) => filter === "all" || d.category === filter
    ) ?? [];

  const recentScans = useMemo(
    () =>
      [...scans]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 6),
    [scans]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-10 sm:p-14 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="gradient-mesh absolute inset-0" />
          </div>
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 ring-1 ring-emerald-500/30">
            <Inbox className="h-9 w-9 text-emerald-400" />
          </div>
          <h2 className="relative text-2xl sm:text-3xl font-bold mb-2">
            No Scan Selected
          </h2>
          <p className="relative text-muted-foreground mb-6 max-w-md mx-auto">
            Upload a video or image to see triage results, IRC compliance, and
            cost estimates here.
          </p>
          <div className="relative flex flex-wrap items-center justify-center gap-3 mb-8">
            <Button onClick={() => router.push("/")} className="gap-2">
              <FileVideo className="h-4 w-4" />
              Upload Footage
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/live")}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Try Live Scan
            </Button>
          </div>
          {scans.length > 0 && (
            <div className="relative space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Or open a previous scan
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {recentScans.map((s) => (
                  <Button
                    key={s.scan_id}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedScan(s.scan_id)}
                  >
                    {s.filename}{" "}
                    <span className="ml-1 text-muted-foreground">
                      ({s.total_detections})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const s = result.summary;
  const scan = result.scan;

  const retroClass =
    s.avg_retro_score >= 75
      ? "HIGH"
      : s.avg_retro_score >= 50
        ? "MEDIUM"
        : s.avg_retro_score >= 25
          ? "LOW"
          : "FAILED";

  const lastUpdatedLabel = formatTimeAgo(scan.created_at, now);

  const filters: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "all", label: "All", icon: Layers },
    { id: "sign", label: "Signs", icon: Triangle },
    { id: "marking", label: "Markings", icon: Minus },
    { id: "stud", label: "Studs", icon: Circle },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Scan Results
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="truncate font-medium text-foreground/80">
              {scan.filename}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {lastUpdatedLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scan.weather?.time_of_day && (
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" />
              {scan.weather.time_of_day}
            </Badge>
          )}
          {scan.weather?.visibility && (
            <Badge variant="outline">{scan.weather.visibility}</Badge>
          )}
          {scan.weather?.moisture && (
            <Badge variant="outline">{scan.weather.moisture}</Badge>
          )}

          {/* Sticky scan switcher */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSwitcherOpen((o) => !o)}
              className="gap-1.5"
            >
              <FileVideo className="h-3.5 w-3.5" />
              Switch scan
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  switcherOpen && "rotate-180"
                )}
              />
            </Button>
            <AnimatePresence>
              {switcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setSwitcherOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-40 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-2xl p-2"
                  >
                    <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent scans
                    </p>
                    {recentScans.map((rs) => {
                      const active = rs.scan_id === scan.scan_id;
                      return (
                        <button
                          key={rs.scan_id}
                          onClick={() => {
                            setSelectedScan(rs.scan_id);
                            setSwitcherOpen(false);
                          }}
                          className={cn(
                            "w-full text-left rounded-lg px-2.5 py-2 transition-colors flex items-center gap-2",
                            active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "hover:bg-accent"
                          )}
                        >
                          <div
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              active ? "bg-emerald-500" : "bg-border"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">
                              {rs.filename}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {rs.total_detections} assets · {formatTimeAgo(rs.created_at, now)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/reports?scan=${scan.scan_id}`)}
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>
      </motion.div>

      {/* Triage banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/[0.06] via-emerald-500/[0.04] to-transparent p-4 text-sm backdrop-blur"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-500/30">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 font-semibold">
            AI triage results
            <Badge
              variant="outline"
              className="border-cyan-500/40 text-cyan-400"
            >
              Pre-screening
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            These scores flag at-risk assets for follow-up. Use a calibrated
            retroreflectometer for IRC 67 / IRC 35 certification before final
            acceptance or rejection.{" "}
            <span className="inline-flex items-center gap-1 text-foreground/80">
              <Info className="h-3 w-3" />
              See <span className="underline">Calibration</span> for the R² =
              0.85 validation study.
            </span>
          </p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          title="Total Assets"
          value={s.total_detections}
          icon={Layers}
          accent="blue"
        />
        <SummaryCard
          title="Compliant"
          value={s.compliance_pass}
          icon={CheckCircle2}
          accent="emerald"
          highlight
        />
        <SummaryCard
          title="Non-Compliant"
          value={s.compliance_fail}
          icon={XCircle}
          accent="red"
        />
        <SummaryCard
          title="Avg Score"
          value={s.avg_retro_score.toFixed(1)}
          icon={TrendingUp}
          accent="amber"
        />
        <SummaryCard
          title="Est. Maint. Cost"
          value={`${(s.total_maintenance_cost / 1000).toFixed(0)}K`}
          icon={IndianRupee}
          accent="purple"
          prefix="INR "
        />
      </div>

      {/* Main Score + Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Overall Retroreflectivity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-4">
            <RetroGauge
              score={s.avg_retro_score}
              retroClass={retroClass}
              size="lg"
            />
            <p className="mt-4 text-sm text-muted-foreground text-center">
              {s.compliance_pass} of {s.total_detections} assets meet IRC
              standards
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Retro Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <RetroDistributionChart distribution={s.retro_distribution} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Asset Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart breakdown={s.category_breakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Priority Chart */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Maintenance Priority</CardTitle>
          <CardDescription>
            Assets grouped by maintenance urgency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriorityChart breakdown={s.priority_breakdown} />
        </CardContent>
      </Card>

      {/* Detections Grid */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Detected Assets
            <Badge variant="outline" className="ml-1">
              {filteredDetections.length}
            </Badge>
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border/50 bg-card/40 backdrop-blur p-1">
            <FilterIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <Button
                  key={f.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "h-8 gap-1.5 rounded-full px-3 text-xs transition-colors",
                    active
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
          {filteredDetections.map((det) => (
            <ConditionCard
              key={det.id}
              detection={det}
              onClick={() => setSelectedDetection(det)}
            />
          ))}
        </div>

        {filteredDetections.length === 0 && (
          <div className="text-center py-16 rounded-xl border border-dashed border-border/50 bg-card/30">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              No detections found for this filter.
            </p>
          </div>
        )}
      </div>

      {selectedDetection && (
        <DetectionDetailDialog
          detection={selectedDetection}
          scanId={scan.scan_id}
          open={!!selectedDetection}
          onClose={() => setSelectedDetection(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-muted/50" />
          <div className="h-4 w-72 rounded-md bg-muted/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-md bg-muted/40" />
          <div className="h-7 w-20 rounded-md bg-muted/40" />
        </div>
      </div>

      <div className="h-16 rounded-xl bg-muted/30" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[88px] rounded-xl border border-border/40 bg-card/40 p-4 flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-lg bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 rounded bg-muted/40" />
              <div className="h-5 w-12 rounded bg-muted/50" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-xl border border-border/40 bg-card/40"
          />
        ))}
      </div>

      <div className="h-72 rounded-xl border border-border/40 bg-card/40" />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl border border-border/40 bg-card/40"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

const ACCENT_MAP = {
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
    grad: "from-blue-500/20 via-blue-500/5 to-transparent",
    border: "border-blue-500/30",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    grad: "from-emerald-500/25 via-emerald-500/5 to-transparent",
    border: "border-emerald-500/40",
  },
  red: {
    text: "text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/20",
    grad: "from-red-500/20 via-red-500/5 to-transparent",
    border: "border-red-500/30",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    grad: "from-amber-500/20 via-amber-500/5 to-transparent",
    border: "border-amber-500/30",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
    grad: "from-purple-500/20 via-purple-500/5 to-transparent",
    border: "border-purple-500/30",
  },
} as const;

type Accent = keyof typeof ACCENT_MAP;

function SummaryCard({
  title,
  value,
  icon: Icon,
  accent,
  prefix = "",
  highlight = false,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
  prefix?: string;
  highlight?: boolean;
}) {
  const tone = ACCENT_MAP[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "relative overflow-hidden border-border/50 bg-card/50 backdrop-blur transition-all hover:border-border",
          highlight && tone.border
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
            tone.grad
          )}
        />
        <CardContent className="relative p-4 flex items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1",
              tone.bg,
              tone.ring
            )}
          >
            <Icon className={cn("h-5 w-5", tone.text)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight truncate">
              {prefix}
              {value}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(iso: string, nowMs: number | null): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "Updated recently";
  if (nowMs == null) return `Updated ${new Date(iso).toLocaleDateString()}`;
  const sec = Math.max(1, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Updated ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Updated ${d}d ago`;
  return `Updated ${new Date(iso).toLocaleDateString()}`;
}
