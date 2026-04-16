"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Route,
  Search,
  Filter as FilterIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldCheck,
  Layers,
  Triangle,
  Minus,
  Circle as CircleIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAllScans, getScanResults } from "@/lib/api";
import type { Detection } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

// Dynamic import for Leaflet (no SSR)
const MapView = dynamic(() => import("@/components/map-view"), { ssr: false });

export type TileTheme = "standard" | "satellite" | "dark";

interface MapDetection extends Detection {
  scan_filename: string;
}

export default function MapPage() {
  const [detections, setDetections] = useState<MapDetection[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [showSegments, setShowSegments] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tileTheme, setTileTheme] = useState<TileTheme>("dark");
  const [legendOpen, setLegendOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    loadAllDetections();
  }, []);

  async function loadAllDetections() {
    try {
      const { scans } = await getAllScans();
      const allDets: MapDetection[] = [];

      for (const scan of scans) {
        if (scan.status !== "completed") continue;
        try {
          const result = await getScanResults(scan.scan_id);
          const baseLat = 28.6139 + Math.random() * 0.05;
          const baseLng = 77.209 + Math.random() * 0.05;

          result.detections.forEach((det: Detection, i: number) => {
            allDets.push({
              ...det,
              scan_filename: scan.filename,
              gps_lat: det.gps_lat || baseLat + i * 0.001,
              gps_lng: det.gps_lng || baseLng + i * 0.001,
            });
          });
        } catch {
          // skip
        }
      }

      const withGps = allDets.filter((d) => d.gps_lat && d.gps_lng);
      if (allDets.length === 0 || withGps.length === 0) {
        setDetections(generateDemoDetections());
      } else {
        setDetections(allDets);
      }
    } catch {
      setDetections(generateDemoDetections());
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return detections.filter((d) => {
      if (filter !== "all" && d.category !== filter) return false;
      if (q && !d.class_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [detections, filter, search]);

  const stats = {
    total: filtered.length,
    compliant: filtered.filter((d) => d.compliance?.compliant).length,
    critical: filtered.filter((d) => d.priority <= 2).length,
  };

  // km covered (rough estimate using great-circle distances between consecutive pts)
  const kmCovered = useMemo(() => {
    const pts = filtered.filter((d) => d.gps_lat && d.gps_lng);
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += haversine(
        pts[i - 1].gps_lat!,
        pts[i - 1].gps_lng!,
        pts[i].gps_lat!,
        pts[i].gps_lng!
      );
    }
    return total;
  }, [filtered]);

  const density = kmCovered > 0 ? filtered.length / kmCovered : 0;
  const criticalPct = stats.total ? (stats.critical / stats.total) * 100 : 0;

  const filters: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { id: "all", label: "All", icon: Layers },
      { id: "sign", label: "Signs", icon: Triangle },
      { id: "marking", label: "Markings", icon: Minus },
      { id: "stud", label: "Studs", icon: CircleIcon },
    ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Compact header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/25">
              <MapPin className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-sm sm:text-base font-bold whitespace-nowrap">
              Highway Map
            </h1>
          </div>

          {/* Iconified status badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="text-xs gap-1 border-border/60"
            >
              <Layers className="h-3 w-3" />
              {stats.total}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs gap-1 border-emerald-500/30 text-emerald-400"
            >
              <ShieldCheck className="h-3 w-3" />
              {stats.compliant}
            </Badge>
            {stats.critical > 0 && (
              <Badge
                variant="outline"
                className="text-xs gap-1 border-red-500/30 text-red-400"
              >
                <AlertTriangle className="h-3 w-3" />
                {stats.critical}
              </Badge>
            )}
          </div>

          {/* Desktop: search + filters inline */}
          <div className="ml-auto hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sign type..."
                className="h-8 w-56 rounded-lg border border-border/60 bg-card/50 backdrop-blur pl-8 pr-7 text-xs focus:border-emerald-500/60 focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Button
              variant={showSegments ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSegments(!showSegments)}
              className="text-xs gap-1.5 h-8"
              title="Toggle colored corridor segments"
            >
              <Route className="h-3.5 w-3.5" />
              Segments
            </Button>

            <div className="h-5 w-px bg-border/60" />

            <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-card/40 backdrop-blur p-0.5">
              {filters.map((f) => (
                <Button
                  key={f.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "h-7 gap-1.5 rounded-md px-2.5 text-xs",
                    filter === f.id
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <f.icon className="h-3 w-3" />
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Mobile filter toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 md:hidden"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-label="Toggle filters"
          >
            {mobileFiltersOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <FilterIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Mobile expanded filters */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-border/40"
            >
              <div className="px-4 py-3 space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search sign type..."
                    className="h-9 w-full rounded-lg border border-border/60 bg-card/50 pl-8 pr-3 text-sm focus:border-emerald-500/60 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {filters.map((f) => (
                    <Button
                      key={f.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        "h-8 gap-1.5 text-xs",
                        filter === f.id
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      <f.icon className="h-3.5 w-3.5" />
                      {f.label}
                    </Button>
                  ))}
                  <Button
                    variant={showSegments ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setShowSegments(!showSegments)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Route className="h-3.5 w-3.5" />
                    Segments
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[11px] gap-1">
                    <Layers className="h-3 w-3" />
                    {stats.total}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] gap-1 border-emerald-500/30 text-emerald-400"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {stats.compliant}
                  </Badge>
                  {stats.critical > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[11px] gap-1 border-red-500/30 text-red-400"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {stats.critical}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MapPin className="h-8 w-8 animate-pulse text-emerald-500" />
            <p className="text-xs text-muted-foreground">
              Loading highway data…
            </p>
          </div>
        ) : (
          <>
            <MapView
              detections={filtered}
              showSegments={showSegments}
              tileTheme={tileTheme}
            />

            {/* Top-left stats overlay */}
            <div className="absolute top-3 left-3 z-[400] rounded-xl border border-border/60 bg-background/85 backdrop-blur-xl p-3 shadow-xl min-w-[180px]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Coverage
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Km covered</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {kmCovered.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Assets/km</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {density.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Critical</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      criticalPct > 25
                        ? "text-red-400"
                        : criticalPct > 10
                          ? "text-amber-400"
                          : "text-emerald-400"
                    )}
                  >
                    {criticalPct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Tile theme switcher */}
            <div className="absolute top-3 right-3 z-[400] flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/85 backdrop-blur-xl p-0.5 shadow-xl">
              {(
                [
                  { id: "standard", label: "Std" },
                  { id: "satellite", label: "Sat" },
                  { id: "dark", label: "Dark" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTileTheme(t.id)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                    tileTheme === t.id
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Collapsible Legend */}
            <div className="absolute bottom-4 right-4 z-[400] rounded-xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-xl overflow-hidden">
              <button
                onClick={() => setLegendOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-accent/40"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Retroreflectivity
                {legendOpen ? (
                  <ChevronDown className="ml-auto h-3 w-3" />
                ) : (
                  <ChevronUp className="ml-auto h-3 w-3" />
                )}
              </button>
              <AnimatePresence initial={false}>
                {legendOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5 text-xs">
                      {[
                        {
                          color: "#22c55e",
                          label: "HIGH",
                          range: "75-100",
                          icon: ShieldCheck,
                        },
                        {
                          color: "#f59e0b",
                          label: "MEDIUM",
                          range: "50-74",
                          icon: Layers,
                        },
                        {
                          color: "#f97316",
                          label: "LOW",
                          range: "25-49",
                          icon: AlertTriangle,
                        },
                        {
                          color: "#ef4444",
                          label: "FAILED",
                          range: "0-24",
                          icon: AlertTriangle,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="h-3 w-3 rounded-full shrink-0 ring-2 ring-black/40"
                            style={{ backgroundColor: item.color }}
                          />
                          <item.icon
                            className="h-3 w-3"
                            style={{ color: item.color }}
                          />
                          <span className="font-medium">{item.label}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {item.range}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Haversine km
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateDemoDetections(): MapDetection[] {
  const demoData = [
    { lat: 28.4595, lng: 77.0266, name: "speed_limit_sign", retro: 82, cls: "HIGH" as const },
    { lat: 28.452, lng: 77.018, name: "warning_curve", retro: 45, cls: "LOW" as const },
    { lat: 28.445, lng: 77.01, name: "information_sign", retro: 68, cls: "MEDIUM" as const },
    { lat: 28.438, lng: 77.002, name: "lane_marking", retro: 35, cls: "LOW" as const },
    { lat: 28.431, lng: 76.994, name: "stop_sign", retro: 91, cls: "HIGH" as const },
    { lat: 28.424, lng: 76.986, name: "center_line_marking", retro: 22, cls: "FAILED" as const },
    { lat: 28.417, lng: 76.978, name: "road_stud", retro: 55, cls: "MEDIUM" as const },
    { lat: 28.41, lng: 76.97, name: "delineator", retro: 78, cls: "HIGH" as const },
    { lat: 28.403, lng: 76.962, name: "gantry_sign", retro: 62, cls: "MEDIUM" as const },
    { lat: 28.396, lng: 76.954, name: "edge_line_marking", retro: 15, cls: "FAILED" as const },
    { lat: 28.389, lng: 76.946, name: "chevron_sign", retro: 88, cls: "HIGH" as const },
    { lat: 28.382, lng: 76.938, name: "regulatory_sign", retro: 42, cls: "LOW" as const },
  ];

  return demoData.map((d, i) => ({
    id: i + 1,
    frame_index: 0,
    timestamp_sec: i * 5,
    class_name: d.name,
    category:
      d.name.includes("marking") || d.name.includes("line")
        ? "marking"
        : d.name.includes("stud") || d.name.includes("delineator")
          ? "stud"
          : "sign",
    confidence: 0.9,
    bbox: [0, 0, 100, 100],
    retro_class: d.cls,
    retro_score: d.retro,
    condition_grade:
      d.retro >= 75 ? "A" : d.retro >= 50 ? "B" : d.retro >= 25 ? "C" : "F",
    color_fading: 100 - d.retro,
    surface_damage: Math.max(0, 80 - d.retro),
    dirt_level: Math.max(0, 60 - d.retro * 0.5),
    legibility: d.retro,
    compliance: {
      standard: d.name.includes("marking") ? "IRC 35" : "IRC 67",
      compliant: d.retro >= 50,
      threshold: 100,
      unit: "cd/lux/m²",
      margin: d.retro - 100,
      recommendation: d.retro < 50 ? "Replace immediately" : "Monitor",
    },
    priority: d.retro >= 75 ? 5 : d.retro >= 50 ? 4 : d.retro >= 25 ? 2 : 1,
    priority_label:
      PRIORITY_LABELS[d.retro >= 75 ? 5 : d.retro >= 50 ? 4 : d.retro >= 25 ? 2 : 1],
    cost_estimate: d.retro < 50 ? 15000 : 0,
    issues: d.retro < 50 ? ["Below IRC minimum threshold"] : ["No issues"],
    age_estimate:
      d.retro >= 75 ? "1-2 years" : d.retro >= 50 ? "3-5 years" : "7+ years",
    thumbnail_path: "",
    gps_lat: d.lat,
    gps_lng: d.lng,
    scan_filename: "demo_highway_scan.mp4",
  }));
}

