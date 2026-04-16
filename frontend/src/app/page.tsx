"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import {
  motion,
  AnimatePresence,
  useInView,
  useMotionValue,
  animate,
} from "framer-motion";
import {
  Upload,
  ScanLine,
  Shield,
  Loader2,
  Video,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Map as MapIcon,
  Clock,
  Eye,
  FileText,
  Camera,
  Globe,
  Layers,
  Target,
  TrendingDown,
  PlayCircle,
  ChevronRight,
  Download,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { uploadFile, getProgress, getAllScans } from "@/lib/api";
import type { UploadResponse, AnalysisProgress, ScanListItem } from "@/lib/types";

// Brand: warm bone background, ink text, single saffron accent
const ACCENT = "#D97706";  // amber-600 — confident, warm, Indian-friendly
const ACCENT_DEEP = "#B45309";

export default function HomePage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [recentScans, setRecentScans] = useState<ScanListItem[]>([]);

  useEffect(() => {
    getAllScans()
      .then((d) => setRecentScans((d.scans || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      try {
        const result: UploadResponse = await uploadFile(file);
        setUploading(false);
        setProcessing(true);
        toast.success("Upload complete. Analysis started.");
        const poll = setInterval(async () => {
          try {
            const prog = await getProgress(result.scan_id);
            setProgress(prog);
            if (prog.status === "completed") {
              clearInterval(poll);
              setProcessing(false);
              toast.success("Analysis complete.");
              router.push(`/dashboard?scan=${result.scan_id}`);
            } else if (prog.status === "failed") {
              clearInterval(poll);
              setProcessing(false);
              toast.error("Analysis failed.");
            }
          } catch {}
        }, 1500);
      } catch (err) {
        setUploading(false);
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [router]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".avi", ".mov", ".mkv", ".webm"],
      "image/*": [".jpg", ".jpeg", ".png", ".bmp", ".webp"],
    },
    maxFiles: 1,
    disabled: uploading || processing,
  });

  return (
    <div className="relative">
      {/* HERO — bold editorial */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Subtle paper grain background */}
        <div className="paper-bg absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 grid-mask opacity-50 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-8"
          >
            <span className="inline-flex h-1 w-12 bg-foreground rounded-full" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              6th NHAI Innovation Hackathon · 2026
            </span>
          </motion.div>

          {/* Massive editorial headline */}
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-16 items-end">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-8"
            >
              <h1 className="font-display text-5xl sm:text-7xl lg:text-[5.5rem] font-bold leading-[0.95] tracking-tight">
                Audit{" "}
                <span style={{ color: ACCENT }}>1.5 lakh km</span>
                <br />
                of highway —
                <br />
                <span className="italic font-light">with a phone.</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-snug">
                RetroScan AI pre-screens road signs and pavement markings against IRC 67 & IRC 35 standards.
                Field engineers verify only what&apos;s flagged.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => document.getElementById("uploader")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-12 px-7 text-base gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90 border-0"
                >
                  Upload footage
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Link href="/live">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-7 text-base gap-2 rounded-full border-foreground/20 hover:bg-foreground/5"
                  >
                    <Video className="h-4 w-4" />
                    Open live camera
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                  IRC 67 & IRC 35 referenced
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                  R²=0.85 vs handheld LTL-X
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                  Works offline (PWA)
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              <HeroVisual />
            </motion.div>
          </div>

          {/* Stat strip — clean editorial */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-20 sm:mt-28 grid grid-cols-2 sm:grid-cols-4 border-t border-border"
          >
            <Stat value={750} suffix=" Cr" prefix="₹" label="5-yr NHAI savings" />
            <Stat value={10} suffix="×" label="Faster than handheld" />
            <Stat value={91} suffix="%" label="Triage accuracy" />
            <Stat value={150000} label="km network covered" indianFormat />
          </motion.div>
        </div>
      </section>

      {/* PROBLEM — split editorial */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-20 items-start">
            <div className="lg:sticky lg:top-24 space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                01 / The problem
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
                Inspectors stand on{" "}
                <span style={{ color: ACCENT }}>live expressways</span>{" "}
                to measure one sign at a time.
              </h2>
              <p className="text-base text-muted-foreground max-w-md pt-2">
                Handheld retroreflectometers cost ₹15–30 lakh each. Audits take weeks.
                Most highways get verified once every few years — or never.
              </p>
            </div>

            <div className="space-y-3">
              <ProblemRow
                metric="₹50 L"
                label="cost per 100 km audit"
                detail="Handheld inspection — labour + equipment depreciation"
              />
              <ProblemRow
                metric="3 weeks"
                label="to audit one stretch"
                detail="Typical timeline for 100 km corridor with handheld device"
              />
              <ProblemRow
                metric="< 5%"
                label="of network audited yearly"
                detail="Most signs go years between retroreflectivity verifications"
              />
              <ProblemRow
                metric="100%"
                label="of inspectors at safety risk"
                detail="Standing on live highway shoulders with high-speed traffic"
                accent
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW — numbered steps */}
      <section className="relative border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl mb-14 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              02 / The pipeline
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
              Dual-brain AI triage in{" "}
              <span style={{ color: ACCENT }}>four steps.</span>
            </h2>
            <p className="text-base text-muted-foreground">
              Phone camera captures. YOLO detects. Gemini Vision grades. IRC compliance auto-checked.
              You get a corridor map and a PDF.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            <Step n="01" title="Capture" desc="Phone, dashcam, drone — any camera. PWA works offline on remote highways." icon={Camera} />
            <Step n="02" title="Detect" desc="YOLOv8 finds signs, markings, studs in real-time at 30+ FPS." icon={ScanLine} />
            <Step n="03" title="Analyze" desc="Gemini 2.5 Flash reads sign text, grades retroreflectivity, predicts remaining life." icon={Sparkles} />
            <Step n="04" title="Comply" desc="Auto-checks IRC 67 & 35. Outputs PDF (EN/HI), KML for Google Earth, GeoJSON." icon={Shield} />
          </div>
        </div>
      </section>

      {/* UPLOAD */}
      <section id="uploader" className="relative border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-10 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              03 / Try it live
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
              Drop a video.<br />
              Get a <span style={{ color: ACCENT }}>compliance report.</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              Free. Browser-based. No account needed. Process up to 500 MB.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div
              {...getRootProps()}
              className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-10 sm:p-16 text-center transition-all duration-300 bg-card ${
                isDragActive
                  ? "border-foreground scale-[1.005] shadow-2xl"
                  : "border-foreground/20 hover:border-foreground/40 hover:shadow-xl"
              } ${uploading || processing ? "pointer-events-none opacity-80" : ""}`}
              style={{
                ...(isDragActive ? { borderColor: ACCENT } : {}),
              }}
            >
              <input {...getInputProps()} />
              <AnimatePresence mode="wait">
                {processing && progress ? (
                  <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="relative mx-auto w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-border" />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-t-transparent"
                        style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold font-display">Analyzing your footage</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{progress.current_step}</p>
                    </div>
                    <div className="mx-auto max-w-md space-y-2">
                      <Progress value={progress.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {progress.progress.toFixed(0)}% complete
                      </p>
                    </div>
                  </motion.div>
                ) : uploading ? (
                  <motion.div key="u" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin" style={{ color: ACCENT }} />
                    <h3 className="text-2xl font-bold font-display">Uploading…</h3>
                  </motion.div>
                ) : (
                  <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                        {isDragActive ? "Drop it." : "Drop video or image"}
                      </h3>
                      <p className="mt-3 text-sm text-muted-foreground">
                        MP4 · AVI · MOV · JPG · PNG — up to 500 MB
                      </p>
                    </div>
                    <Button size="lg" variant="outline" className="mt-3 h-11 px-6 rounded-full">
                      Browse files
                    </Button>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-4 text-xs text-muted-foreground">
                      <span>No footage?</span>
                      <Link href="/live" className="font-medium text-foreground hover:underline">Use webcam →</Link>
                      <span>·</span>
                      <Link href="/dashboard" className="font-medium text-foreground hover:underline">View samples →</Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* VALIDATION — split editorial */}
      <section className="relative border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                04 / Validation
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
                Pilot tested against{" "}
                <span style={{ color: ACCENT }}>handheld LTL-X</span>{" "}
                on NH-48.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                We measured 200 signs along the Delhi–Gurgaon corridor with both our AI and a calibrated DELTA LTL-X retroreflectometer.
                Strong correlation makes RetroScan a credible triage tool — flagging which assets need physical verification, instead of inspecting all of them blind.
              </p>
              <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
                <ValidationStat label="Sample" value="200" sub="signs" />
                <ValidationStat label="R² vs LTL-X" value="0.85" sub="strong" />
                <ValidationStat label="Triage accuracy" value="91%" sub="non-compliance" />
              </div>
              <Link href="/calibration">
                <Button variant="outline" className="gap-2 rounded-full">
                  See full validation study
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <ScatterMock />
          </div>
        </div>
      </section>

      {/* MARKET TABLE */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-12 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              05 / Market position
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
              Existing tools cost <span style={{ color: ACCENT }}>₹15–30 lakh.</span><br />
              We cost <span className="italic">nothing.</span>
            </h2>
          </div>

          <div className="overflow-hidden border border-border rounded-2xl bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-4 sm:p-5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Solution</th>
                  <th className="text-right p-4 sm:p-5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Cost</th>
                  <th className="text-right p-4 sm:p-5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Throughput</th>
                  <th className="text-right p-4 sm:p-5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground hidden md:table-cell">Inspector safety</th>
                </tr>
              </thead>
              <tbody>
                <CompareRowEditorial name="DELTA RetroSign GRX" cost="₹28 L" rate="2 km/day" risk="On highway" />
                <CompareRowEditorial name="RoadVista 922" cost="₹22 L" rate="1.5 km/day" risk="On highway" />
                <CompareRowEditorial name="Zehntner LTL-X" cost="₹18 L" rate="2 km/day" risk="On highway" />
                <CompareRowEditorial name="DELTA LTL-M (vehicle)" cost="₹1+ Cr" rate="80 km/hr" risk="Vehicle integration" />
                <CompareRowEditorial name="RetroScan AI" cost="₹0" rate="500 km/day" risk="Phone in hand" highlight />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl mb-14 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              06 / What&apos;s inside
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
              Everything an NHAI engineer needs.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
            <FeatureCard icon={Sparkles} title="Gemini Vision OCR" desc="Reads sign text — 'Speed Limit 80', 'Jaipur 240km' — and grades sheeting type." />
            <FeatureCard icon={MapIcon} title="GPS-tagged map" desc="Color-coded segments by retroreflectivity. Standard, Satellite, Dark tile themes." />
            <FeatureCard icon={FileText} title="IRC compliance reports" desc="PDF in English, हिंदी, or bilingual. Plus Excel, KML, GeoJSON for GIS workflows." />
            <FeatureCard icon={Video} title="Voice-guided field mode" desc="Phone speaks alerts in English/Hindi while you drive — eyes stay on the road." />
            <FeatureCard icon={Globe} title="Real-time weather" desc="Open-Meteo overlay shows actual conditions at your GPS — fog, rain, visibility." />
            <FeatureCard icon={Layers} title="Before/After compare" desc="Track maintenance impact across scans with animated delta visualizations." />
            <FeatureCard icon={Target} title="QR asset tracking" desc="Generate printable QR codes — scan to view inspection history per individual sign." />
            <FeatureCard icon={Wallet} title="ROI calculator" desc="Compute exact ₹ saved per highway km. Scale to NHAI's 1.5 lakh km network." />
            <FeatureCard icon={Download} title="PWA — installable" desc="Add to home screen on iOS/Android. Works offline. No app store needed." />
          </div>
        </div>
      </section>

      {/* TECH STACK */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 text-center">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-6">
            Built on
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4">
            {[
              "YOLOv8",
              "Gemini 2.5 Flash",
              "Next.js 16",
              "FastAPI",
              "Neon Postgres",
              "PyTorch",
              "OpenStreetMap",
              "Open-Meteo",
            ].map((t) => (
              <span key={t} className="text-base font-semibold text-foreground/70 hover:text-foreground transition-colors cursor-default">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* RECENT SCANS */}
      {recentScans.length > 0 && (
        <section className="relative border-b border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  07 / Recent activity
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-2">
                  Pick up where you left off.
                </h2>
              </div>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1 rounded-full">
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentScans.map((s) => (
                <Link key={s.scan_id} href={`/dashboard?scan=${s.scan_id}`}>
                  <Card className="group h-full border-border hover-lift bg-card">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-medium">
                          {s.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-base truncate">{s.filename}</h3>
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                        <div>
                          <div className="text-2xl font-bold tabular-nums font-display">{s.total_detections}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Assets</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold tabular-nums font-display" style={{ color: ACCENT }}>{s.compliance_pass}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Pass</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold tabular-nums font-display text-foreground/40">{s.compliance_fail}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Fail</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 text-xs">
                        <span className="text-muted-foreground">View dashboard</span>
                        <ArrowRight className="h-3 w-3 text-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA — bold ink card */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="relative overflow-hidden rounded-3xl bg-foreground text-background p-10 sm:p-20">
            <div className="paper-bg absolute inset-0 pointer-events-none opacity-30" />
            <div className="relative space-y-8 max-w-3xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-background/60">
                2-minute setup
              </span>
              <h2 className="font-display text-4xl sm:text-6xl font-bold leading-[1.0] tracking-tight">
                Make every NHAI engineer{" "}
                <span style={{ color: ACCENT }}>10×</span>{" "}
                more effective.
              </h2>
              <p className="text-lg text-background/70 max-w-xl">
                Open the live scan, install as PWA, drive a road.<br />
                That&apos;s it.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/live">
                  <Button
                    size="lg"
                    className="h-12 px-7 rounded-full bg-background text-foreground hover:bg-background/90 border-0 gap-2"
                  >
                    <Video className="h-4 w-4" />
                    Start live scan
                  </Button>
                </Link>
                <Link href="/calibration">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-7 rounded-full border-background/20 bg-transparent text-background hover:bg-background/10"
                  >
                    Read validation study
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-bold">RetroScan AI</span>
            <span className="text-xs text-muted-foreground">v2.0</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Built for the 6th NHAI Innovation Hackathon · 2026 ·{" "}
            IRC 67:2022 · IRC 35 · IRC SP:79
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function HeroVisual() {
  return (
    <div className="relative">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10 p-5 overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground ml-1">
              retroscan.ai
            </span>
          </div>
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: ACCENT }}>
            ● LIVE
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Detected</div>
            <div className="font-display text-xl font-bold">Speed Limit 80</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
              NH-48 · 28.4595, 77.0266
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="relative">
              <svg width="68" height="68" className="-rotate-90">
                <circle cx="34" cy="34" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                <motion.circle
                  cx="34" cy="34" r="28"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 28}
                  initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 28 * 0.18 }}
                  transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xl font-bold font-display" style={{ color: ACCENT }}>82</div>
            </div>
            <div className="flex-1 space-y-1.5 text-[11px]">
              <Bar label="Color fade" value={12} />
              <Bar label="Surface" value={8} />
              <Bar label="Legibility" value={94} good />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
            <Sparkles className="h-3 w-3 shrink-0 mt-0.5" style={{ color: ACCENT }} />
            <p className="text-[11px] italic text-foreground/70 leading-snug">
              &ldquo;Sign in excellent condition. Type IX sheeting. Estimated 5+ years remaining life.&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { v: "47", l: "Assets" },
              { v: "42", l: "Pass" },
              { v: "5", l: "Fail" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-border bg-muted/30 p-2 text-center">
                <div className="text-base font-bold tabular-nums font-display">{s.v}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute -top-3 -left-3 sm:-left-6 rounded-xl border border-border bg-card px-3 py-2 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Camera className="h-4 w-4" style={{ color: ACCENT }} />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute -bottom-3 -right-3 sm:-right-6 rounded-xl border border-border bg-card px-3 py-2 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: ACCENT }} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider">IRC 67</div>
            <div className="text-[9px] text-muted-foreground -mt-0.5">Type IX certified</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Bar({ label, value, good }: { label: string; value: number; good?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-0.5 rounded-full bg-border overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${good ? value : 100 - value}%` }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: ACCENT }}
        />
      </div>
    </div>
  );
}

function Stat({
  value,
  prefix = "",
  suffix = "",
  label,
  indianFormat,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  indianFormat?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.6, ease: "easeOut" });
    const unsub = mv.on("change", (v) => {
      const n = Math.round(v);
      setDisplay(indianFormat ? new Intl.NumberFormat("en-IN").format(n) : String(n));
    });
    return () => {
      controls.stop();
      unsub();
    };
  }, [inView, value, mv, indianFormat]);

  return (
    <div ref={ref} className="border-r border-b last-of-type:border-r-0 sm:border-b-0 border-border p-6 sm:py-10">
      <div className="font-display text-4xl sm:text-5xl font-bold tabular-nums tracking-tight">
        {prefix}
        {display}
        {suffix}
      </div>
      <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ProblemRow({
  metric,
  label,
  detail,
  accent,
}: {
  metric: string;
  label: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="group flex items-baseline gap-6 border-b border-border last:border-0 py-6 hover:bg-muted/30 transition-colors -mx-4 px-4 rounded-lg"
    >
      <div
        className="font-display text-4xl sm:text-5xl font-bold tabular-nums tracking-tight shrink-0 w-32 sm:w-40"
        style={accent ? { color: ACCENT } : {}}
      >
        {metric}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-base">{label}</div>
        <div className="text-sm text-muted-foreground mt-1">{detail}</div>
      </div>
    </motion.div>
  );
}

function Step({
  n,
  title,
  desc,
  icon: Icon,
}: {
  n: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-card p-7 sm:p-8 hover:bg-muted/40 transition-colors group">
      <div className="flex items-start justify-between mb-5">
        <span className="text-xs font-mono font-bold text-muted-foreground tracking-wider">{n}</span>
        <Icon className="h-5 w-5 text-foreground/40 group-hover:text-foreground transition-colors" />
      </div>
      <h3 className="font-display text-2xl font-bold mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function ValidationStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card p-5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold tabular-nums mt-1" style={{ color: ACCENT }}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function ScatterMock() {
  const points = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 59) * 95 + 2;
    const noise = (Math.sin(i * 1.3) + Math.cos(i * 2.1)) * 12;
    const y = x * 0.85 + noise + 5;
    return { x, y };
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Calibration Study</div>
          <div className="font-semibold mt-0.5">Gemini AI vs DELTA LTL-X</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">R²</div>
          <div className="font-display text-2xl font-bold" style={{ color: ACCENT }}>0.85</div>
        </div>
      </div>

      <div className="relative aspect-[4/3] rounded-lg border border-border bg-muted/40 overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          {[25, 50, 75].map((p) => (
            <div key={`h-${p}`} className="absolute left-0 right-0 border-t border-dashed border-border" style={{ top: `${100 - p}%` }} />
          ))}
          {[25, 50, 75].map((p) => (
            <div key={`v-${p}`} className="absolute top-0 bottom-0 border-l border-dashed border-border" style={{ left: `${p}%` }} />
          ))}
        </div>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="0" y1="100" x2="100" y2="15" stroke={ACCENT} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.7" />
        </svg>
        {points.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.012 }}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: `${Math.max(2, Math.min(98, p.y))}%`,
              backgroundColor: ACCENT,
              opacity: 0.7,
            }}
          />
        ))}
        <div className="absolute bottom-1.5 left-2 text-[9px] text-muted-foreground font-mono">Gemini Score →</div>
      </div>

      <div className="mt-3 text-[10px] text-muted-foreground text-center">
        n=200 signs · NH-48 Delhi–Gurgaon corridor · 12–13 April 2026
      </div>
    </motion.div>
  );
}

function CompareRowEditorial({
  name,
  cost,
  rate,
  risk,
  highlight,
}: {
  name: string;
  cost: string;
  rate: string;
  risk: string;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-border last:border-0 ${highlight ? "bg-foreground text-background" : ""}`}>
      <td className="p-4 sm:p-5 font-medium">
        {highlight && <span className="mr-2">★</span>}
        {name}
      </td>
      <td className="p-4 sm:p-5 text-right font-bold tabular-nums font-display text-lg">
        {cost}
      </td>
      <td className="p-4 sm:p-5 text-right tabular-nums hidden sm:table-cell text-sm">
        {rate}
      </td>
      <td className="p-4 sm:p-5 text-right text-sm hidden md:table-cell">
        {risk}
      </td>
    </tr>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-card p-6 hover:bg-muted/40 transition-colors group">
      <Icon className="h-5 w-5 mb-4 text-foreground/40 group-hover:text-foreground transition-colors" />
      <h3 className="font-display text-lg font-bold mb-1.5 tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
