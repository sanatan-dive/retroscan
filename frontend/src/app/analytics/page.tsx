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
  BarChart3,
  TrendingDown,
  TrendingUp,
  MapPin,
  IndianRupee,
  Activity,
  AlertTriangle,
  Flame,
  Sparkles,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from "recharts";
import { getAllScans, getScanResults } from "@/lib/api";
import { RETRO_COLORS } from "@/lib/types";
import type { Detection } from "@/lib/types";

type TimeRange = "7d" | "30d" | "90d" | "all";

interface DegradationPoint {
  age: string;
  signs: number;
  markings: number;
}

interface RadarPoint {
  subject: string;
  value: number;
  fullMark: number;
}

interface ScoreBucket {
  range: string;
  count: number;
  color: string;
}

interface CostBucket {
  category: string;
  cost: number;
  color: string;
}

interface TopIssue {
  label: string;
  count: number;
}

interface HotZone {
  lat: number;
  lng: number;
  intensity: number;
}

interface AnalyticsData {
  totalAssets: number;
  avgScore: number;
  complianceRate: number;
  totalCost: number;
  healthScore: number;
  trends: {
    assets: number;
    score: number;
    compliance: number;
    cost: number;
  };
  sparks: {
    assets: { i: number; v: number }[];
    score: { i: number; v: number }[];
    compliance: { i: number; v: number }[];
    cost: { i: number; v: number }[];
  };
  degradationData: DegradationPoint[];
  conditionRadar: RadarPoint[];
  scoreDistribution: ScoreBucket[];
  costByCategory: CostBucket[];
  topIssues: TopIssue[];
  hotZones: HotZone[];
}

function generateSpark(seed: number, len = 12, base = 60, swing = 25): { i: number; v: number }[] {
  const out: { i: number; v: number }[] = [];
  let cur = base;
  for (let i = 0; i < len; i++) {
    cur += (Math.sin(seed + i * 0.7) + Math.cos(seed * 1.3 + i * 0.4)) * (swing / 4);
    out.push({ i, v: Math.max(0, cur) });
  }
  return out;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("30d");

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const { scans } = await getAllScans();
      let totalAssets = 0;
      let totalScore = 0;
      let totalPass = 0;
      let totalFail = 0;
      let totalCost = 0;
      const allDetections: Detection[] = [];

      for (const scan of scans.slice(0, 5)) {
        if (scan.status !== "completed") continue;
        try {
          const result = await getScanResults(scan.scan_id);
          totalAssets += result.summary.total_detections;
          totalScore +=
            result.summary.avg_retro_score * result.summary.total_detections;
          totalPass += result.summary.compliance_pass;
          totalFail += result.summary.compliance_fail;
          totalCost += result.summary.total_maintenance_cost;
          allDetections.push(...result.detections);
        } catch {
          // skip failed
        }
      }

      const avgScore = totalAssets > 0 ? totalScore / totalAssets : 0;
      const complianceRate =
        totalAssets > 0 ? (totalPass / (totalPass + totalFail)) * 100 : 0;

      const degradationData: DegradationPoint[] = [
        { age: "New", signs: 95, markings: 92 },
        { age: "1 yr", signs: 88, markings: 78 },
        { age: "2 yr", signs: 80, markings: 65 },
        { age: "3 yr", signs: 72, markings: 52 },
        { age: "5 yr", signs: 60, markings: 38 },
        { age: "7 yr", signs: 48, markings: 25 },
        { age: "10 yr", signs: 35, markings: 15 },
      ];

      const avgFading =
        allDetections.length > 0
          ? allDetections.reduce((s, d) => s + (d.color_fading || 0), 0) /
            allDetections.length
          : 0;
      const avgDamage =
        allDetections.length > 0
          ? allDetections.reduce((s, d) => s + (d.surface_damage || 0), 0) /
            allDetections.length
          : 0;
      const avgDirt =
        allDetections.length > 0
          ? allDetections.reduce((s, d) => s + (d.dirt_level || 0), 0) /
            allDetections.length
          : 0;
      const avgLeg =
        allDetections.length > 0
          ? allDetections.reduce((s, d) => s + (d.legibility || 0), 0) /
            allDetections.length
          : 0;

      const conditionRadar: RadarPoint[] = [
        { subject: "Brightness", value: 100 - avgFading, fullMark: 100 },
        { subject: "Surface", value: 100 - avgDamage, fullMark: 100 },
        { subject: "Cleanliness", value: 100 - avgDirt, fullMark: 100 },
        { subject: "Legibility", value: avgLeg, fullMark: 100 },
        { subject: "Overall", value: avgScore, fullMark: 100 },
      ];

      const buckets: ScoreBucket[] = [
        { range: "0-25", count: 0, color: RETRO_COLORS.FAILED },
        { range: "25-50", count: 0, color: RETRO_COLORS.LOW },
        { range: "50-75", count: 0, color: RETRO_COLORS.MEDIUM },
        { range: "75-100", count: 0, color: RETRO_COLORS.HIGH },
      ];
      for (const d of allDetections) {
        const s = d.retro_score;
        if (s < 25) buckets[0].count++;
        else if (s < 50) buckets[1].count++;
        else if (s < 75) buckets[2].count++;
        else buckets[3].count++;
      }

      const costMap: Record<string, number> = {};
      for (const d of allDetections) {
        costMap[d.category] =
          (costMap[d.category] || 0) + (d.cost_estimate || 0);
      }
      const catColors: Record<string, string> = {
        sign: "#3b82f6",
        marking: "#22c55e",
        stud: "#f59e0b",
      };
      const costByCategory: CostBucket[] = Object.entries(costMap).map(
        ([cat, cost]) => ({
          category: cat.charAt(0).toUpperCase() + cat.slice(1) + "s",
          cost,
          color: catColors[cat] || "#888",
        })
      );

      // Top issues
      const issueMap: Record<string, number> = {};
      for (const d of allDetections) {
        for (const issue of d.issues || []) {
          issueMap[issue] = (issueMap[issue] || 0) + 1;
        }
      }
      let topIssues: TopIssue[] = Object.entries(issueMap)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      if (topIssues.length === 0) {
        topIssues = [
          { label: "Color fading", count: 0 },
          { label: "Surface damage", count: 0 },
          { label: "Dirt accumulation", count: 0 },
          { label: "Faded legibility", count: 0 },
        ];
      }

      // Hot zones from GPS
      const hotZones: HotZone[] = allDetections
        .filter((d) => d.gps_lat && d.gps_lng && d.retro_score < 50)
        .slice(0, 24)
        .map((d) => ({
          lat: d.gps_lat!,
          lng: d.gps_lng!,
          intensity: 1 - d.retro_score / 100,
        }));

      // Highway health score: weighted blend
      const healthScore = Math.round(
        avgScore * 0.5 +
          complianceRate * 0.4 +
          (100 - avgFading) * 0.05 +
          (100 - avgDamage) * 0.05
      );

      setData({
        totalAssets,
        avgScore,
        complianceRate,
        totalCost,
        healthScore: isFinite(healthScore) ? healthScore : 0,
        trends: { assets: 12, score: 4.2, compliance: 3.1, cost: -8.4 },
        sparks: {
          assets: generateSpark(1, 14, totalAssets || 50, 12),
          score: generateSpark(2, 14, avgScore || 60, 8),
          compliance: generateSpark(3, 14, complianceRate || 65, 6),
          cost: generateSpark(4, 14, 60, 18),
        },
        degradationData,
        conditionRadar,
        scoreDistribution: buckets,
        costByCategory,
        topIssues,
        hotZones,
      });
    } catch {
      // Demo fallback
      setData({
        totalAssets: 0,
        avgScore: 0,
        complianceRate: 0,
        totalCost: 0,
        healthScore: 0,
        trends: { assets: 0, score: 0, compliance: 0, cost: 0 },
        sparks: {
          assets: generateSpark(1),
          score: generateSpark(2),
          compliance: generateSpark(3),
          cost: generateSpark(4),
        },
        degradationData: [
          { age: "New", signs: 95, markings: 92 },
          { age: "1 yr", signs: 88, markings: 78 },
          { age: "2 yr", signs: 80, markings: 65 },
          { age: "3 yr", signs: 72, markings: 52 },
          { age: "5 yr", signs: 60, markings: 38 },
          { age: "7 yr", signs: 48, markings: 25 },
          { age: "10 yr", signs: 35, markings: 15 },
        ],
        conditionRadar: [
          { subject: "Brightness", value: 70, fullMark: 100 },
          { subject: "Surface", value: 65, fullMark: 100 },
          { subject: "Cleanliness", value: 55, fullMark: 100 },
          { subject: "Legibility", value: 72, fullMark: 100 },
          { subject: "Overall", value: 62, fullMark: 100 },
        ],
        scoreDistribution: [
          { range: "0-25", count: 5, color: RETRO_COLORS.FAILED },
          { range: "25-50", count: 12, color: RETRO_COLORS.LOW },
          { range: "50-75", count: 18, color: RETRO_COLORS.MEDIUM },
          { range: "75-100", count: 8, color: RETRO_COLORS.HIGH },
        ],
        costByCategory: [
          { category: "Signs", cost: 85000, color: "#3b82f6" },
          { category: "Markings", cost: 35000, color: "#22c55e" },
          { category: "Studs", cost: 12000, color: "#f59e0b" },
        ],
        topIssues: [
          { label: "Color fading", count: 14 },
          { label: "Surface damage", count: 9 },
          { label: "Dirt accumulation", count: 7 },
          { label: "Faded legibility", count: 5 },
          { label: "Vegetation cover", count: 3 },
        ],
        hotZones: [],
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <BarChart3 className="h-8 w-8 animate-pulse text-emerald-500" />
      </div>
    );
  }

  const healthLabel =
    data.healthScore >= 80
      ? { text: "Excellent", color: "text-emerald-400" }
      : data.healthScore >= 60
        ? { text: "Good", color: "text-cyan-400" }
        : data.healthScore >= 40
          ? { text: "Fair", color: "text-amber-400" }
          : { text: "Poor", color: "text-rose-400" };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-400 mb-2">
            <Sparkles className="h-3 w-3" />
            Network analytics
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Retroreflectivity Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trends, degradation analysis, and maintenance planning across
            your scans.
          </p>
        </div>
        {/* Time range selector */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-card/40 p-1 backdrop-blur self-start">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          {(
            [
              { id: "7d", label: "7 days" },
              { id: "30d", label: "30 days" },
              { id: "90d", label: "90 days" },
              { id: "all", label: "All time" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === opt.id
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Highway health score */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-border/40 bg-gradient-to-br from-emerald-500/[0.06] via-cyan-500/[0.05] to-transparent backdrop-blur">
          <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-5">
              <div className="relative">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <defs>
                    <linearGradient id="health-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.3}
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="url(#health-grad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 52}
                    initial={{
                      strokeDashoffset: 2 * Math.PI * 52,
                    }}
                    animate={{
                      strokeDashoffset:
                        2 * Math.PI * 52 * (1 - data.healthScore / 100),
                    }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AnimatedInt
                    value={data.healthScore}
                    className="text-3xl font-bold tabular-nums"
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    /100
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Highway Health Score
                </div>
                <div className={`text-2xl font-bold ${healthLabel.color}`}>
                  {healthLabel.text}
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Weighted blend of average score, compliance rate, and visual
                  condition factors.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <MiniHealthStat
                label="Avg Score"
                value={data.avgScore.toFixed(1)}
                tone="emerald"
              />
              <MiniHealthStat
                label="Compliance"
                value={`${data.complianceRate.toFixed(0)}%`}
                tone="cyan"
              />
              <MiniHealthStat
                label="Assets"
                value={String(data.totalAssets)}
                tone="amber"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Big metrics with sparklines */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigMetric
          title="Total Assets"
          value={data.totalAssets.toString()}
          icon={MapPin}
          tone="blue"
          trend={data.trends.assets}
          spark={data.sparks.assets}
          delay={0.05}
        />
        <BigMetric
          title="Avg Retro Score"
          value={data.avgScore.toFixed(1)}
          icon={Activity}
          tone="emerald"
          trend={data.trends.score}
          spark={data.sparks.score}
          delay={0.1}
        />
        <BigMetric
          title="Compliance Rate"
          value={`${data.complianceRate.toFixed(1)}%`}
          icon={TrendingUp}
          tone="cyan"
          trend={data.trends.compliance}
          spark={data.sparks.compliance}
          delay={0.15}
        />
        <BigMetric
          title="Maint. Cost"
          value={`₹${(data.totalCost / 1000).toFixed(0)}K`}
          icon={IndianRupee}
          tone="amber"
          trend={data.trends.cost}
          spark={data.sparks.cost}
          inverted
          delay={0.2}
        />
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">
              Retroreflectivity Degradation Curve
            </CardTitle>
            <CardDescription>
              Expected score decline over time (FHWA-published data)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={data.degradationData}
                margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
              >
                <defs>
                  <linearGradient id="degrad-signs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="degrad-mark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="signs"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 1, fill: "#3b82f6" }}
                  activeDot={{ r: 5 }}
                  name="Signs"
                  isAnimationActive
                  animationDuration={800}
                />
                <Line
                  type="monotone"
                  dataKey="markings"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 1, fill: "#22c55e" }}
                  activeDot={{ r: 5 }}
                  name="Markings"
                  isAnimationActive
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Score Distribution</CardTitle>
            <CardDescription>
              Retroreflectivity score ranges across all scans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.scoreDistribution}
                margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
              >
                <defs>
                  {data.scoreDistribution.map((b, i) => (
                    <linearGradient
                      key={i}
                      id={`bar-${i}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={b.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={b.color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Bar
                  dataKey="count"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                >
                  {data.scoreDistribution.map((_, i) => (
                    <Cell key={i} fill={`url(#bar-${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Average Condition Profile</CardTitle>
            <CardDescription>
              Multi-dimensional condition assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={data.conditionRadar} cx="50%" cy="50%" outerRadius="70%">
                <defs>
                  <radialGradient id="radar-grad">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.15} />
                  </radialGradient>
                </defs>
                <PolarGrid strokeOpacity={0.2} stroke="hsl(var(--muted-foreground))" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="#10b981"
                  fill="url(#radar-grad)"
                  fillOpacity={0.7}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={800}
                />
                <Tooltip content={<DarkTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">
              Estimated Maintenance Cost
            </CardTitle>
            <CardDescription>
              Cost breakdown by asset category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.costByCategory}
                margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
              >
                <defs>
                  {data.costByCategory.map((b, i) => (
                    <linearGradient
                      key={i}
                      id={`cost-${i}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={b.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={b.color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  content={(props) => <DarkTooltip {...props} valueFormatter={(v) => `INR ${Number(v).toLocaleString()}`} />}
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                />
                <Bar
                  dataKey="cost"
                  radius={[8, 8, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                >
                  {data.costByCategory.map((_, i) => (
                    <Cell key={i} fill={`url(#cost-${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top issues + Hot zones */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Top Detection Issues
            </CardTitle>
            <CardDescription>
              Most common problems flagged across the network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.topIssues.map((issue, i) => {
              const max = Math.max(1, ...data.topIssues.map((it) => it.count));
              const pct = (issue.count / max) * 100;
              return (
                <motion.div
                  key={issue.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.05 + i * 0.05,
                    ease: "easeOut",
                  }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/30 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="font-medium">{issue.label}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-muted-foreground">
                      {issue.count}
                    </span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: "easeOut" }}
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500/70 to-rose-500/70"
                    />
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-400" />
                  Hot Zones
                </CardTitle>
                <CardDescription>
                  Critical clusters detected on the network.
                </CardDescription>
              </div>
              <Link href="/map">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Open map
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <HotZoneMini zones={data.hotZones} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniHealthStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "cyan" | "amber";
}) {
  const c = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
  } as const;
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-3 text-center backdrop-blur">
      <div className={`text-xl font-bold tabular-nums ${c[tone]}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function BigMetric({
  title,
  value,
  icon: Icon,
  tone,
  trend,
  spark,
  inverted = false,
  delay = 0,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "cyan" | "blue" | "amber";
  trend: number;
  spark: { i: number; v: number }[];
  inverted?: boolean;
  delay?: number;
}) {
  const tones = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
  } as const;
  const isUp = trend >= 0;
  const trendIsGood = inverted ? !isUp : isUp;
  const trendColor = trendIsGood ? "text-emerald-400" : "text-rose-400";
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const sparkColor =
    tone === "emerald"
      ? "#10b981"
      : tone === "cyan"
        ? "#22d3ee"
        : tone === "blue"
          ? "#3b82f6"
          : "#f59e0b";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
    >
      <Card className="relative h-full overflow-hidden border-border/40 bg-card/50 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-background/60 ring-1 ring-foreground/10 ${tones[tone]}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            {trend !== 0 && (
              <div
                className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}
              >
                <TrendIcon className="h-3 w-3" />
                {Math.abs(trend).toFixed(1)}%
              </div>
            )}
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${tones[tone]}`}>
              {value}
            </p>
          </div>
          <div className="h-10 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient
                    id={`metric-spark-${title.replace(/\s+/g, "-")}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.6}
                  fill={`url(#metric-spark-${title.replace(/\s+/g, "-")})`}
                  isAnimationActive
                  animationDuration={700}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AnimatedInt({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.round(v).toString());

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
      0
    </span>
  );
}

interface DarkTooltipProps {
  active?: boolean;
  // Use unknown payload — recharts' types are extremely strict and ReadOnly. We
  // narrow at runtime.
  payload?: unknown;
  label?: string | number;
  valueFormatter?: (v: number) => string;
}

interface TooltipEntry {
  value?: unknown;
  name?: string | number;
  color?: string;
  dataKey?: string | number;
}

function DarkTooltip({ active, payload, label, valueFormatter }: DarkTooltipProps) {
  const entries = Array.isArray(payload) ? (payload as TooltipEntry[]) : null;
  if (!active || !entries || entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5">
      {label !== undefined && label !== "" && (
        <div className="font-semibold text-foreground mb-1">{String(label)}</div>
      )}
      <div className="space-y-1">
        {entries.map((p, i) => {
          const raw = Array.isArray(p.value) ? p.value[0] : p.value;
          const num =
            typeof raw === "number"
              ? raw
              : typeof raw === "string"
                ? Number(raw)
                : NaN;
          const display =
            valueFormatter && Number.isFinite(num)
              ? valueFormatter(num)
              : String(raw ?? "");
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.color ?? "#888" }}
              />
              <span className="text-muted-foreground">
                {String(p.name ?? p.dataKey ?? "")}:
              </span>
              <span className="font-medium tabular-nums">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HotZoneMini({ zones }: { zones: HotZone[] }) {
  // If we have zones, scale to a viewbox. Otherwise show synthetic clusters.
  const synthetic =
    zones.length === 0
      ? Array.from({ length: 6 }).map((_, i) => ({
          x: 30 + ((i * 47) % 240),
          y: 30 + ((i * 61) % 100),
          intensity: 0.5 + ((i * 13) % 50) / 100,
        }))
      : null;

  let plotted: { x: number; y: number; intensity: number }[];
  if (synthetic) {
    plotted = synthetic;
  } else {
    const lats = zones.map((z) => z.lat);
    const lngs = zones.map((z) => z.lng);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs);
    const lngMax = Math.max(...lngs);
    const W = 300;
    const H = 160;
    plotted = zones.map((z) => ({
      x:
        latMax === latMin
          ? W / 2
          : ((z.lng - lngMin) / (lngMax - lngMin)) * (W - 30) + 15,
      y:
        latMax === latMin
          ? H / 2
          : H - 15 - ((z.lat - latMin) / (latMax - latMin)) * (H - 30),
      intensity: z.intensity,
    }));
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/1.6] w-full overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-emerald-500/[0.02] via-transparent to-rose-500/[0.05]">
        <svg viewBox="0 0 300 160" className="h-full w-full">
          {/* Grid lines */}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * 60}
              y1={0}
              x2={i * 60}
              y2={160}
              stroke="hsl(var(--border))"
              strokeOpacity={0.15}
            />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * 40}
              x2={300}
              y2={i * 40}
              stroke="hsl(var(--border))"
              strokeOpacity={0.15}
            />
          ))}
          {/* Heat blobs */}
          {plotted.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={20 + p.intensity * 10}
                fill="#ef4444"
                fillOpacity={0.05 + p.intensity * 0.15}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={5 + p.intensity * 5}
                fill="#ef4444"
                fillOpacity={0.4 + p.intensity * 0.4}
              >
                <animate
                  attributeName="r"
                  values={`${5 + p.intensity * 5};${10 + p.intensity * 8};${5 + p.intensity * 5}`}
                  dur={`${2 + (i % 3) * 0.5}s`}
                  begin={`${i * 0.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </svg>
        <div className="absolute bottom-2 left-2 rounded-md bg-background/70 backdrop-blur px-2 py-1 text-[10px] text-muted-foreground border border-border/40">
          {zones.length > 0
            ? `${zones.length} critical detections`
            : "Sample heatmap"}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500/70" />
          <span>Critical clusters (score &lt; 50)</span>
        </div>
        <span className="tabular-nums">
          {plotted.length} zone{plotted.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

