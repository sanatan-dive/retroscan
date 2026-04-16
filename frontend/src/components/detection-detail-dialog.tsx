"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, QrCode, Download, Printer, Info } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RetroGauge } from "@/components/retro-gauge";
import { ComplianceBadge } from "@/components/compliance-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Detection } from "@/lib/types";
import { RETRO_COLORS, PRIORITY_LABELS } from "@/lib/types";
import {
  CONFIDENCE_BAND_EXPLANATION,
  useDetectionInsights,
} from "@/lib/hooks";
import { toast } from "sonner";

interface DetectionDetailDialogProps {
  detection: Detection;
  scanId: string;
  open: boolean;
  onClose: () => void;
}

export function DetectionDetailDialog({
  detection: d,
  scanId,
  open,
  onClose,
}: DetectionDetailDialogProps) {
  const compliance = d.compliance;
  const { confidenceBand, scoreLowerBound, scoreUpperBound } =
    useDetectionInsights(d);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>
              {d.class_name
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            <ComplianceBadge
              compliant={compliance?.compliant ?? false}
              standard={compliance?.standard}
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Score */}
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <RetroGauge
              score={d.retro_score}
              retroClass={d.retro_class}
              size="lg"
              confidenceBand={confidenceBand}
            />
            <TooltipProvider delay={150}>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Score: {d.retro_score.toFixed(0)} ± {confidenceBand}
                </span>
                <span className="text-xs">
                  ({scoreLowerBound}–{scoreUpperBound}, estimated)
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="What is this confidence band?"
                        className="cursor-help text-muted-foreground/70 hover:text-foreground transition-colors"
                      />
                    }
                  >
                    <Info className="h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px]">
                    {CONFIDENCE_BAND_EXPLANATION}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Grade</p>
              <p
                className="text-lg font-bold"
                style={{ color: RETRO_COLORS[d.retro_class] }}
              >
                {d.condition_grade}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-bold">
                {(d.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Priority</p>
              <p className="text-lg font-bold">
                {PRIORITY_LABELS[d.priority]}
              </p>
            </div>
          </div>

          <Separator />

          {/* IRC Compliance Details */}
          {compliance && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">IRC Compliance</h4>
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard</span>
                  <span>{compliance.standard}</span>
                </div>
                {compliance.sheeting_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sheeting</span>
                    <span>{compliance.sheeting_type}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Value</span>
                  <span className="font-medium">
                    {compliance.estimated_ra ?? compliance.estimated_rl ?? compliance.estimated_value ?? "N/A"}{" "}
                    {compliance.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Threshold</span>
                  <span>
                    {compliance.threshold} {compliance.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin</span>
                  <span
                    className={
                      (compliance.margin ?? 0) >= 0
                        ? "text-emerald-500"
                        : "text-red-500"
                    }
                  >
                    {(compliance.margin ?? 0) >= 0 ? "+" : ""}
                    {compliance.margin?.toFixed(1)} {compliance.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Gemini AI Insights */}
          {(d.sign_text || d.sheeting_type || d.remaining_life || d.gemini_reasoning) && (
            <AiAnalysisCard
              signText={d.sign_text}
              sheetingType={d.sheeting_type}
              remainingLife={d.remaining_life}
              reasoning={d.gemini_reasoning}
              dialogOpen={open}
            />
          )}

          <Separator />

          {/* Condition Metrics */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Condition Analysis</h4>
            <div className="grid grid-cols-2 gap-3">
              <MetricBox
                label="Color Fading"
                value={d.color_fading}
                inverted
              />
              <MetricBox
                label="Surface Damage"
                value={d.surface_damage}
                inverted
              />
              <MetricBox label="Dirt Level" value={d.dirt_level} inverted />
              <MetricBox label="Legibility" value={d.legibility} />
            </div>
          </div>

          {/* Issues */}
          {d.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Issues</h4>
              <div className="space-y-1">
                {d.issues.map((issue, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {issue}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {compliance?.recommendation && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Recommendation
              </p>
              <p className="text-sm">{compliance.recommendation}</p>
            </div>
          )}

          <Separator />

          {/* QR Code for asset tracking */}
          <QrCodeSection detectionId={d.id} scanId={scanId} />

          {/* Meta */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              Frame {d.frame_index}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {d.timestamp_sec.toFixed(1)}s
            </Badge>
            <Badge variant="outline" className="text-xs">
              Est. Age: {d.age_estimate}
            </Badge>
            {d.cost_estimate > 0 && (
              <Badge variant="outline" className="text-xs">
                Replacement: INR {d.cost_estimate.toLocaleString()}
              </Badge>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// QR Code section — generates a QR linking to the public asset page,
// allows downloading as PNG, and shows a printable label.
// ---------------------------------------------------------------------------

interface QrCodeSectionProps {
  detectionId: number;
  scanId: string;
}

function QrCodeSection({ detectionId, scanId }: QrCodeSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assetUrl, setAssetUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(
      `/asset/${detectionId}?scan=${scanId}`,
      window.location.origin
    ).toString();
    setAssetUrl(url);
  }, [detectionId, scanId]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("QR code not ready yet");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `retroscan-asset-${detectionId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR code downloaded");
    } catch {
      toast.error("Failed to download QR code");
    }
  };

  const printLabel = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("QR code not ready yet");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const win = window.open("", "_blank", "width=400,height=600");
      if (!win) {
        toast.error("Popup blocked — allow popups to print");
        return;
      }
      win.document.write(`<!doctype html>
<html>
  <head>
    <title>RetroScan Label ${detectionId}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:24px;text-align:center;color:#111;background:#fff;}
      .id{font-family:ui-monospace,monospace;font-weight:600;font-size:14px;margin-top:12px;}
      .hint{font-size:12px;color:#555;margin-top:6px;}
      img{image-rendering:pixelated;}
      @media print { @page { margin: 0.4in; } }
    </style>
  </head>
  <body>
    <h2 style="margin:0 0 12px 0;font-size:16px;">RetroScan AI</h2>
    <img src="${dataUrl}" width="220" height="220" alt="QR" />
    <div class="id">RetroScan ID: ${detectionId}</div>
    <div class="hint">Scan QR for inspection history</div>
    <script>window.onload=function(){window.print();};</script>
  </body>
</html>`);
      win.document.close();
    } catch {
      toast.error("Failed to open print view");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <QrCode className="h-4 w-4 text-emerald-500" />
          QR Code
        </h4>
        <Badge
          variant="outline"
          className="text-[10px] border-emerald-500/30 text-emerald-500"
        >
          Asset Tracking
        </Badge>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 flex flex-col sm:flex-row items-center gap-4">
        {/* QR canvas (white background for scanability even in dark mode) */}
        <div className="rounded-md bg-white p-2 shrink-0">
          {assetUrl ? (
            <QRCodeCanvas
              ref={canvasRef}
              value={assetUrl}
              size={144}
              level="M"
              marginSize={1}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          ) : (
            <div className="h-36 w-36 animate-pulse rounded bg-muted" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
          <p className="text-xs font-mono break-all text-muted-foreground">
            RetroScan ID: <span className="font-semibold text-foreground">{detectionId}</span> | Scan QR for inspection history
          </p>
          <p className="text-[11px] text-muted-foreground">
            Print and affix this QR code to the asset for tracking.
          </p>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={downloadPng}
            >
              <Download className="h-3.5 w-3.5" />
              Download PNG
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 h-8"
              onClick={printLabel}
            >
              <Printer className="h-3.5 w-3.5" />
              Print Label
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: number;
  inverted?: boolean;
}) {
  const good = inverted ? value < 30 : value > 70;
  const bad = inverted ? value > 60 : value < 30;
  const color = good
    ? "text-emerald-500"
    : bad
      ? "text-red-500"
      : "text-amber-500";

  return (
    <div className="rounded-lg border p-2.5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value.toFixed(0)}%</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Analysis card with typewriter + key-term highlighting
// ---------------------------------------------------------------------------

interface AiAnalysisCardProps {
  signText?: string;
  sheetingType?: string;
  remainingLife?: string;
  reasoning?: string;
  dialogOpen: boolean;
}

function AiAnalysisCard({
  signText,
  sheetingType,
  remainingLife,
  reasoning,
  dialogOpen,
}: AiAnalysisCardProps) {
  const fullText = reasoning ?? "";
  const typed = useTypewriter(fullText, dialogOpen, 30);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">AI Analysis</h4>
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-400 text-[10px] gap-1 px-1.5 py-0"
        >
          <Sparkles className="h-2.5 w-2.5" />
          Powered by Gemini 2.5 Flash
        </Badge>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-3 space-y-2.5 text-sm">
        {/* Header row: avatar + label */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-[11px] font-bold text-white shadow-md shadow-emerald-500/30">
            AI
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500">
                <Sparkles className="h-2 w-2 text-white" />
              </span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-emerald-300">
              AI Inspector
            </span>
            <span className="text-[10px] text-muted-foreground">
              Visual reasoning over the asset crop
            </span>
          </div>
        </div>

        {/* Structured fields */}
        <div className="space-y-1 text-xs">
          {signText && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sign Text (OCR)</span>
              <span className="font-mono font-medium">{signText}</span>
            </div>
          )}
          {sheetingType && sheetingType !== "unknown" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sheeting Type</span>
              <span>{sheetingType.replace("_", " ").toUpperCase()}</span>
            </div>
          )}
          {remainingLife && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Life</span>
              <span>{remainingLife}</span>
            </div>
          )}
        </div>

        {/* Reasoning blurb with typewriter + highlights */}
        {fullText && (
          <div className="rounded-md border border-emerald-500/20 bg-background/40 p-2.5">
            <p className="text-xs italic leading-relaxed text-foreground/90 min-h-[2.5em]">
              {highlightKeyTerms(typed)}
              {typed.length < fullText.length && (
                <span className="ml-0.5 inline-block w-0.5 h-3 align-middle bg-emerald-400 animate-pulse" />
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Hook: types out text one char at a time when active turns true. */
function useTypewriter(text: string, active: boolean, speedMs: number) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }
    setCount(0);
    if (!text) return;
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, active, speedMs]);

  return useMemo(() => text.slice(0, count), [text, count]);
}

const KEY_TERM_PATTERN =
  /(non[- ]compliant|compliant|good condition|degraded|failing|excellent|poor condition|critical|severely degraded)/gi;

function highlightKeyTerms(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(KEY_TERM_PATTERN);
  return parts.map((part, idx) => {
    const lower = part.toLowerCase();
    if (lower === "compliant" || lower === "good condition" || lower === "excellent") {
      return (
        <span
          key={idx}
          className="font-semibold text-emerald-400 bg-emerald-500/10 px-1 rounded"
        >
          {part}
        </span>
      );
    }
    if (
      lower === "non-compliant" ||
      lower === "non compliant" ||
      lower === "failing" ||
      lower === "critical" ||
      lower === "severely degraded"
    ) {
      return (
        <span
          key={idx}
          className="font-semibold text-red-400 bg-red-500/10 px-1 rounded"
        >
          {part}
        </span>
      );
    }
    if (lower === "degraded" || lower === "poor condition") {
      return (
        <span
          key={idx}
          className="font-semibold text-amber-400 bg-amber-500/10 px-1 rounded"
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}
