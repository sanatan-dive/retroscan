"use client";

import { use, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ScanLine,
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  ImageOff,
  Wrench,
  QrCode,
  Printer,
  Layers,
  Clock3,
  Sparkles,
  ClipboardList,
  ChevronRight,
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComplianceBadge } from "@/components/compliance-badge";
import { RetroGauge } from "@/components/retro-gauge";
import {
  getDetectionById,
  getScanResults,
  getThumbnailUrl,
} from "@/lib/api";
import type { Detection } from "@/lib/types";
import { RETRO_COLORS, PRIORITY_LABELS } from "@/lib/types";
import { toast } from "sonner";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scan?: string }>;
};

export default function AssetDetailPage({ params, searchParams }: Props) {
  const { id } = use(params);
  const { scan: scanIdFromQuery } = use(searchParams);

  const [detection, setDetection] = useState<Detection | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanFilename, setScanFilename] = useState<string | undefined>(undefined);
  const [scanCreatedAt, setScanCreatedAt] = useState<string | undefined>(undefined);
  const [adjacent, setAdjacent] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thumbBroken, setThumbBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDetectionById(id, scanIdFromQuery)
      .then(async (res) => {
        if (cancelled) return;
        setDetection(res.detection);
        setScanId(res.scan_id);
        setScanFilename(res.scan_filename);
        setScanCreatedAt(res.scan_created_at);
        // load scan to find adjacent assets
        try {
          const scan = await getScanResults(res.scan_id);
          const others = (scan.detections || []).filter(
            (d: Detection) => d.id !== res.detection.id
          );
          // Pick adjacent by frame_index proximity
          others.sort(
            (a: Detection, b: Detection) =>
              Math.abs(a.frame_index - res.detection.frame_index) -
              Math.abs(b.frame_index - res.detection.frame_index)
          );
          if (!cancelled) setAdjacent(others.slice(0, 4));
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load asset");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, scanIdFromQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ScanLine className="h-8 w-8 animate-pulse text-emerald-500" />
      </div>
    );
  }

  if (error || !detection || !scanId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <ImageOff className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Asset Not Found</h2>
        <p className="text-muted-foreground">
          {error ?? `No detection found for ID ${id}.`}
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const lastScannedDays = scanCreatedAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(scanCreatedAt).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const scanDate = scanCreatedAt ? new Date(scanCreatedAt) : null;
  const compliance = detection.compliance;
  const className = detection.class_name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Top crumb */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScanLine className="h-3.5 w-3.5" />
          <span>RetroScan AI</span>
          <ChevronRight className="h-3 w-3" />
          <span>Public Asset Record</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-mono">{detection.id}</span>
        </div>
        <Link href={`/dashboard?scan=${scanId}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            View Full Scan
          </Button>
        </Link>
      </motion.div>

      {/* Hero asset card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-border/40 bg-card/50 backdrop-blur">
          <div className="grid gap-0 md:grid-cols-[1fr_auto]">
            {/* Photo + status */}
            <div className="relative aspect-video md:aspect-auto md:min-h-[260px] bg-muted/40">
              {!thumbBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getThumbnailUrl(scanId, String(detection.id))}
                  alt={className}
                  className="h-full w-full object-cover"
                  onError={() => setThumbBroken(true)}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ImageOff className="h-10 w-10" />
                  <p className="text-sm">Photo unavailable</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <ComplianceBadge
                  compliant={compliance?.compliant ?? false}
                  standard={compliance?.standard}
                />
                <Badge
                  variant="outline"
                  className="bg-background/70 backdrop-blur"
                >
                  Frame {detection.frame_index}
                </Badge>
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow">
                  {className}
                </h1>
                <div className="flex items-center gap-2 text-xs text-white/80 mt-1">
                  <span className="font-mono">ID {detection.id}</span>
                  <span>·</span>
                  <span>{detection.category}</span>
                  {detection.gps_lat && detection.gps_lng && (
                    <>
                      <span>·</span>
                      <MapPin className="h-3 w-3" />
                      <span className="tabular-nums">
                        {detection.gps_lat.toFixed(4)},{" "}
                        {detection.gps_lng.toFixed(4)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Score gauge */}
            <div className="flex flex-col items-center justify-center gap-4 p-6 md:min-w-[280px]">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Retro Score
              </div>
              <RetroGauge
                score={detection.retro_score}
                retroClass={detection.retro_class}
                size="lg"
              />
              <div className="grid grid-cols-3 gap-3 text-center w-full pt-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Grade
                  </p>
                  <p
                    className="text-xl font-bold tabular-nums"
                    style={{ color: RETRO_COLORS[detection.retro_class] }}
                  >
                    {detection.condition_grade}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Conf
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {(detection.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Priority
                  </p>
                  <p className="text-xl font-bold">
                    {PRIORITY_LABELS[detection.priority] ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => printInspectionCard(detection, scanFilename, scanCreatedAt)}
        >
          <Printer className="h-3.5 w-3.5" />
          Print Inspection Card
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const url = typeof window !== "undefined" ? window.location.href : "";
            navigator.clipboard?.writeText(url);
            toast.success("Asset link copied");
          }}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Copy Asset Link
        </Button>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Inspection History</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Log</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {compliance && (
            <Card className="border-border/40 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {compliance.compliant ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                  )}
                  IRC Compliance
                </CardTitle>
                <CardDescription>
                  {compliance.compliant
                    ? "Asset meets the IRC standard threshold"
                    : "Asset is below IRC standard — maintenance recommended"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ComplianceCell label="Standard" value={compliance.standard} />
                  <ComplianceCell label="Sheeting" value={compliance.sheeting_type ?? "N/A"} />
                  <ComplianceCell
                    label="Estimated"
                    value={`${
                      compliance.estimated_ra ??
                      compliance.estimated_rl ??
                      compliance.estimated_value ??
                      "N/A"
                    } ${compliance.unit}`}
                  />
                  <ComplianceCell
                    label="Threshold"
                    value={`${compliance.threshold} ${compliance.unit}`}
                  />
                </div>
                {compliance.recommendation && (
                  <div className="rounded-lg border border-border/40 bg-background/50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                      Recommendation
                    </p>
                    <p className="text-sm leading-relaxed">
                      {compliance.recommendation}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Adjacent assets */}
          {adjacent.length > 0 && (
            <Card className="border-border/40 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  Adjacent Assets
                </CardTitle>
                <CardDescription>
                  Other detections from the same scan, near this frame.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {adjacent.map((a) => (
                    <AdjacentCard key={a.id} det={a} scanId={scanId} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick facts */}
          <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Quick Facts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                Last scanned:{" "}
                {lastScannedDays === null
                  ? "Unknown"
                  : lastScannedDays === 0
                    ? "Today"
                    : `${lastScannedDays} day${lastScannedDays === 1 ? "" : "s"} ago`}
              </Badge>
              <Badge variant="outline">
                Est. Age: {detection.age_estimate}
              </Badge>
              {detection.cost_estimate > 0 && (
                <Badge variant="outline">
                  Replacement: INR {detection.cost_estimate.toLocaleString()}
                </Badge>
              )}
              {detection.remaining_life && (
                <Badge variant="outline">
                  Life left: {detection.remaining_life}
                </Badge>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSPECTION HISTORY */}
        <TabsContent value="history" className="mt-6">
          <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-400" />
                Inspection Timeline
              </CardTitle>
              <CardDescription>
                Recorded inspections and condition changes for this asset.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-6 border-l-2 border-emerald-500/20 pl-7">
                <TimelineEntry
                  isFirst
                  date={scanDate}
                  title={
                    scanDate
                      ? scanDate.toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Recent inspection"
                  }
                  scanId={scanId}
                  scanFilename={scanFilename}
                  detection={detection}
                />
                <TimelineEntry
                  date={null}
                  title="Future inspection"
                  placeholder="Schedule next inspection from the maintenance log."
                />
              </ol>
              <Separator className="my-6" />
              <div className="rounded-lg border border-border/40 bg-background/40 p-4 text-sm text-muted-foreground">
                Historical inspection records will populate here as additional
                scans of this corridor are processed.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR CODE */}
        <TabsContent value="qr" className="mt-6">
          <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4 text-cyan-400" />
                Asset QR Code
              </CardTitle>
              <CardDescription>
                Print and affix to the physical asset for quick lookup.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <QrCodePlaceholder
                detectionId={String(detection.id)}
                scanId={scanId}
              />
              <div className="text-center">
                <p className="font-mono text-xs text-muted-foreground">
                  Asset ID: {detection.id}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scan with any QR reader to open this record.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  printInspectionCard(detection, scanFilename, scanCreatedAt)
                }
              >
                <Printer className="h-3.5 w-3.5" />
                Print QR Card
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAINTENANCE LOG */}
        <TabsContent value="maintenance" className="mt-6">
          <Card className="border-border/40 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-400" />
                Maintenance Log
              </CardTitle>
              <CardDescription>
                Issues identified and recommended remediation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detection.issues.length > 0 ? (
                <ul className="space-y-2">
                  {detection.issues.map((issue, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
                    >
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No issues recorded for this asset.
                </p>
              )}
              {compliance?.recommendation && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
                  <p className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    Recommended action
                  </p>
                  <p className="text-sm leading-relaxed">
                    {compliance.recommendation}
                  </p>
                </div>
              )}
              {detection.cost_estimate > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 p-3 text-sm">
                  <span className="text-muted-foreground">
                    Estimated replacement cost
                  </span>
                  <span className="font-semibold tabular-nums">
                    INR {detection.cost_estimate.toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-center text-[11px] text-muted-foreground pt-2">
        Generated by RetroScan AI · NHAI Innovation Hackathon
      </p>
    </div>
  );
}

function ComplianceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className="font-medium text-sm mt-0.5">{value}</p>
    </div>
  );
}

function AdjacentCard({
  det,
  scanId,
}: {
  det: Detection;
  scanId: string;
}) {
  const [broken, setBroken] = useState(false);
  const className = det.class_name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const color = RETRO_COLORS[det.retro_class];
  return (
    <Link href={`/asset/${det.id}?scan=${scanId}`}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="group relative overflow-hidden rounded-xl border border-border/40 bg-background/40 hover:ring-1 hover:ring-foreground/20 transition-all"
      >
        <div className="aspect-video bg-muted/40 relative overflow-hidden">
          {!broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getThumbnailUrl(scanId, String(det.id))}
              alt={className}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setBroken(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-5 w-5" />
            </div>
          )}
          <div className="absolute top-1.5 left-1.5">
            <span
              className="inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-semibold text-white ring-1 ring-white/30"
              style={{ background: color }}
            >
              {det.retro_score.toFixed(0)}
            </span>
          </div>
        </div>
        <div className="p-2.5">
          <p className="text-xs font-medium truncate">{className}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
            Frame {det.frame_index} · {det.condition_grade}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}

function TimelineEntry({
  isFirst,
  date,
  title,
  scanId,
  scanFilename,
  detection,
  placeholder,
}: {
  isFirst?: boolean;
  date: Date | null;
  title: string;
  scanId?: string;
  scanFilename?: string;
  detection?: Detection;
  placeholder?: string;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background ${
          isFirst
            ? "bg-emerald-500"
            : "bg-muted ring-border/40 border border-border/40"
        }`}
      >
        {isFirst ? (
          <ScanLine className="h-3.5 w-3.5 text-white" />
        ) : (
          <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          {date && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {detection && (
            <Badge variant="outline" className="text-[10px]">
              Score {detection.retro_score.toFixed(0)}
            </Badge>
          )}
          {detection?.compliance && (
            <ComplianceBadge
              compliant={detection.compliance.compliant}
              standard={detection.compliance.standard}
            />
          )}
        </div>
        {placeholder ? (
          <p className="text-xs text-muted-foreground italic">{placeholder}</p>
        ) : (
          <>
            {scanFilename && scanId && (
              <p className="text-xs text-muted-foreground">
                Source scan:{" "}
                <Link
                  href={`/dashboard?scan=${scanId}`}
                  className="underline hover:text-foreground"
                >
                  {scanFilename}
                </Link>
              </p>
            )}
            {detection && detection.issues.length > 0 && (
              <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                {detection.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {issue}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function QrCodePlaceholder({
  detectionId,
  scanId,
}: {
  detectionId: string;
  scanId: string;
}) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/asset/${detectionId}?scan=${scanId}`
      : `/asset/${detectionId}?scan=${scanId}`;
  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-foreground/10">
      <QRCodeSVG
        value={url}
        size={192}
        level="M"
        marginSize={0}
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  );
}

function printInspectionCard(
  detection: Detection,
  scanFilename?: string,
  scanCreatedAt?: string
) {
  if (typeof window === "undefined") return;
  const className = detection.class_name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const date = scanCreatedAt
    ? new Date(scanCreatedAt).toLocaleString()
    : "Unknown";
  const compliance = detection.compliance;
  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Inspection Card - Asset ${detection.id}</title>
<style>
  @page { size: A6; margin: 8mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  .card { border: 1.5px solid #111; border-radius: 8px; padding: 12px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 11px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; border-bottom: 1px dashed #ddd; }
  .row:last-child { border-bottom: 0; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; color: #fff; background: ${compliance?.compliant ? "#10b981" : "#ef4444"}; }
  .footer { font-size: 9px; color: #777; margin-top: 8px; text-align: center; }
</style>
</head><body>
<div class="card">
  <h1>${className}</h1>
  <div class="muted">RetroScan AI · ID ${detection.id}</div>
  <div style="margin-top: 8px;">
    <span class="badge">${compliance?.compliant ? "COMPLIANT" : "NON-COMPLIANT"}</span>
    <span class="badge" style="background:#374151">SCORE ${detection.retro_score.toFixed(0)}</span>
  </div>
  <div style="margin-top: 10px;">
    <div class="row"><span>Class:</span><span>${detection.retro_class}</span></div>
    <div class="row"><span>Grade:</span><span>${detection.condition_grade}</span></div>
    <div class="row"><span>Priority:</span><span>${PRIORITY_LABELS[detection.priority] ?? "—"}</span></div>
    <div class="row"><span>Standard:</span><span>${compliance?.standard ?? "—"}</span></div>
    <div class="row"><span>Frame:</span><span>${detection.frame_index}</span></div>
    ${detection.gps_lat && detection.gps_lng ? `<div class="row"><span>GPS:</span><span>${detection.gps_lat.toFixed(4)}, ${detection.gps_lng.toFixed(4)}</span></div>` : ""}
    <div class="row"><span>Inspected:</span><span>${date}</span></div>
    ${scanFilename ? `<div class="row"><span>Scan:</span><span>${scanFilename}</span></div>` : ""}
  </div>
  <div class="footer">NHAI Innovation Hackathon · printed ${new Date().toLocaleDateString()}</div>
</div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
</body></html>`;
  const w = window.open("", "_blank", "width=420,height=600");
  if (!w) {
    toast.error("Pop-up blocked — allow pop-ups to print.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
