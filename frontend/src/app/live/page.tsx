"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  VideoOff,
  Play,
  Square,
  AlertCircle,
  Save,
  LayoutDashboard,
  FileDown,
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  Triangle,
  Minus,
  Circle as CircleIcon,
  CheckCircle2,
  Activity,
  PartyPopper,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  analyzeFrame,
  saveLiveSession,
  getPdfReportUrl,
  getExcelReportUrl,
  getRealWeather,
} from "@/lib/api";
import { ComplianceBadge } from "@/components/compliance-badge";
import type { LiveDetection, WeatherInfo } from "@/lib/types";
import { RETRO_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function LivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzingRef = useRef(false);
  const sessionDetectionsRef = useRef<LiveDetection[]>([]);
  const gpsRef = useRef<{ lat?: number; lng?: number }>({});

  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en" | "hi">("en");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenAtRef = useRef<number>(0);
  const announcedKeysRef = useRef<Set<string>>(new Set());
  const [detections, setDetections] = useState<LiveDetection[]>([]);
  const [sessionDetections, setSessionDetections] = useState<LiveDetection[]>(
    []
  );
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [realWeather, setRealWeather] = useState<{
    temperature_c?: number;
    humidity_pct?: number;
    wind_speed_kmh?: number;
    cloud_cover_pct?: number;
    precipitation_mm?: number;
    visibility_m?: number;
    weather_description?: string;
    time_of_day?: string;
    moisture?: string;
    visibility?: string;
    location?: { timezone?: string };
  } | null>(null);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalDetected: 0,
    totalCompliant: 0,
    totalFrames: 0,
  });

  // Track per-frame detection count over time for sparklines
  const [frameCountHistory, setFrameCountHistory] = useState<number[]>([]);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Get GPS on mount, then fetch real weather
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          gpsRef.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          try {
            const w = await getRealWeather(
              pos.coords.latitude,
              pos.coords.longitude
            );
            setRealWeather(w);
          } catch {
            // weather fetch failed — fall back to AI estimation
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Stop ongoing speech when voice toggle is turned off or component unmounts
  useEffect(() => {
    if (!voiceEnabled && typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const pickVoice = useCallback(
    (lang: "en" | "hi"): SpeechSynthesisVoice | null => {
      if (typeof window === "undefined" || !window.speechSynthesis) return null;
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return null;
      if (lang === "hi") {
        return (
          voices.find((v) => v.lang?.toLowerCase().startsWith("hi")) ||
          voices.find((v) => /hindi/i.test(v.name)) ||
          null
        );
      }
      // Prefer Indian English voices, then any en
      return (
        voices.find((v) => v.lang === "en-IN" || /india/i.test(v.name)) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("en-gb")) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
        null
      );
    },
    []
  );

  const speakDetection = useCallback(
    (det: LiveDetection) => {
      if (!voiceEnabled) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      const now = Date.now();
      if (now - lastSpokenAtRef.current < 4000) return;

      const className = det.class_name.replace(/_/g, " ");
      const score = Math.round(det.retro_score);
      const retroClass = det.retro_class;

      let text = "";
      if (voiceLang === "hi") {
        const hiRetro: Record<string, string> = {
          HIGH: "उच्च गुणवत्ता",
          MEDIUM: "मध्यम",
          LOW: "निम्न",
          FAILED: "खराब",
        };
        const hiCompliance = det.compliant
          ? "मानक के अनुसार है।"
          : "कार्रवाई की आवश्यकता है।";
        text = `${hiRetro[retroClass] ?? retroClass} ${className} मिली। स्कोर ${score}। ${hiCompliance}`;
      } else {
        const enRetro: Record<string, string> = {
          HIGH: "High quality",
          MEDIUM: "Medium",
          LOW: "Low",
          FAILED: "Failed",
        };
        const enCompliance = det.compliant ? "Compliant." : "Action required.";
        text = `${enRetro[retroClass] ?? retroClass} ${className} detected. Score ${score}. ${enCompliance}`;
      }

      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = voiceLang === "hi" ? "hi-IN" : "en-IN";
        const voice = pickVoice(voiceLang);
        if (voice) utter.voice = voice;
        utter.rate = 1;
        utter.pitch = 1;
        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        lastSpokenAtRef.current = now;
        window.speechSynthesis.speak(utter);
      } catch {
        setIsSpeaking(false);
      }
    },
    [voiceEnabled, voiceLang, pickVoice]
  );

  // Warm up voices list (Chrome loads voices asynchronously)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const handler = () => {
      // Trigger a re-evaluation; no state needed since we read from synthesis.
    };
    window.speechSynthesis.onvoiceschanged = handler;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Keep the latest speakDetection accessible from stable callbacks
  const speakDetectionRef = useRef(speakDetection);
  useEffect(() => {
    speakDetectionRef.current = speakDetection;
  }, [speakDetection]);

  // Refresh real weather every 5 minutes
  useEffect(() => {
    if (!gpsRef.current.lat) return;
    const interval = setInterval(async () => {
      if (!gpsRef.current.lat || !gpsRef.current.lng) return;
      try {
        const w = await getRealWeather(
          gpsRef.current.lat,
          gpsRef.current.lng
        );
        setRealWeather(w);
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [realWeather]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      setError(null);
    } catch {
      setError("Could not access camera. Please allow camera permissions.");
    }
  }, []);

  const stopAnalysis = useCallback(() => {
    analyzingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsAnalyzing(false);
  }, []);

  const stopCamera = useCallback(() => {
    stopAnalysis();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setAnnotatedFrame(null);
  }, [stopAnalysis]);

  const startAnalysis = useCallback(() => {
    if (!isStreaming) return;
    setIsAnalyzing(true);
    setSavedScanId(null);
    analyzingRef.current = true;
    setError(null);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !analyzingRef.current)
        return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const b64 = dataUrl.split(",")[1];

      try {
        const data = await analyzeFrame(b64);
        if (!analyzingRef.current) return;

        const newDets = (data.detections || []) as LiveDetection[];
        setDetections(newDets);
        setWeather(data.weather || null);
        if (data.annotated_frame) {
          setAnnotatedFrame(data.annotated_frame);
        }

        // Track per-frame counts for sparkline
        setFrameCountHistory((prev) => {
          const next = [...prev, newDets.length];
          return next.slice(-30);
        });

        if (newDets.length > 0) {
          const avgScore =
            newDets.reduce((sum, d) => sum + d.retro_score, 0) / newDets.length;
          setScoreHistory((prev) => {
            const next = [...prev, avgScore];
            return next.slice(-30);
          });

          sessionDetectionsRef.current = [
            ...sessionDetectionsRef.current,
            ...newDets,
          ];
          setSessionDetections([...sessionDetectionsRef.current]);

          // Voice announcement
          const sorted = [...newDets].sort(
            (a, b) => a.retro_score - b.retro_score
          );
          for (const det of sorted) {
            const key = `${det.class_name}|${det.retro_class}|${det.compliant}`;
            if (announcedKeysRef.current.has(key)) continue;
            announcedKeysRef.current.add(key);
            speakDetectionRef.current?.(det);
            break;
          }
        }

        setStats((prev) => ({
          totalDetected: prev.totalDetected + (data.total_detections || 0),
          totalCompliant:
            prev.totalCompliant +
            (newDets.filter((d) => d.compliant).length || 0),
          totalFrames: prev.totalFrames + 1,
        }));
        setError(null);
      } catch {
        if (analyzingRef.current) {
          setError("Analysis server not reachable. Is the backend running?");
        }
      }
    }, 1500);
  }, [isStreaming]);

  const resetSession = useCallback(() => {
    sessionDetectionsRef.current = [];
    setSessionDetections([]);
    setDetections([]);
    setAnnotatedFrame(null);
    setSavedScanId(null);
    setFrameCountHistory([]);
    setScoreHistory([]);
    announcedKeysRef.current = new Set();
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setStats({ totalDetected: 0, totalCompliant: 0, totalFrames: 0 });
    toast.success("Session cleared");
  }, []);

  const saveSession = useCallback(async () => {
    if (sessionDetectionsRef.current.length === 0) {
      toast.error("No detections to save. Run analysis first.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveLiveSession({
        detections: sessionDetectionsRef.current,
        weather: weather || {},
        total_frames: stats.totalFrames,
        gps_lat: gpsRef.current.lat,
        gps_lng: gpsRef.current.lng,
      });
      setSavedScanId(result.scan_id);
      toast.success(`Session saved — ${result.total_detections} detections`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save session";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [weather, stats.totalFrames]);

  useEffect(() => {
    return () => {
      analyzingRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const hasSession = sessionDetections.length > 0;
  const showActions = !isAnalyzing && hasSession;
  const compliancePct = stats.totalDetected
    ? Math.round((stats.totalCompliant / stats.totalDetected) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Live Webcam Scan
            </h1>
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 gap-1"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              REAL-TIME
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Point your camera at road signs or markings for real-time
            retroreflectivity analysis.
          </p>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Video Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className={cn(
              "relative rounded-2xl overflow-hidden border bg-card/40 backdrop-blur transition-all duration-300",
              isAnalyzing
                ? "border-emerald-500/60 shadow-[0_0_60px_-15px_rgb(16_185_129/0.55)]"
                : "border-border/60"
            )}
          >
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "w-full h-full object-cover",
                  annotatedFrame && isAnalyzing && "hidden"
                )}
              />
              {annotatedFrame && isAnalyzing && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/jpeg;base64,${annotatedFrame}`}
                  alt="Annotated"
                  className="w-full h-full object-cover"
                />
              )}
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/40">
                      <VideoOff className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Camera is off — click Start Camera to begin
                    </p>
                  </div>
                </div>
              )}
              {isAnalyzing && (
                <>
                  {/* Scan-line accent */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-shimmer" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <Badge className="bg-red-500/95 text-white gap-1.5 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-white" />
                      ANALYZING
                    </Badge>
                    <Badge variant="outline" className="bg-black/50 border-white/20 text-white gap-1.5">
                      <Activity className="h-3 w-3" />
                      {detections.length} live
                    </Badge>
                  </div>
                </>
              )}
              <AnimatePresence>
                {voiceEnabled && isSpeaking && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute top-3 right-3"
                  >
                    <Badge className="bg-emerald-500 text-white gap-1.5">
                      <motion.span
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.9,
                          ease: "easeInOut",
                        }}
                        className="inline-flex"
                      >
                        <Volume2 className="h-3 w-3" />
                      </motion.span>
                      SPEAKING
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Session toolbar */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!isStreaming ? (
                    <Button onClick={startCamera} className="gap-2">
                      <Video className="h-4 w-4" />
                      Start Camera
                    </Button>
                  ) : (
                    <Button
                      onClick={stopCamera}
                      variant="destructive"
                      className="gap-2"
                    >
                      <VideoOff className="h-4 w-4" />
                      Stop Camera
                    </Button>
                  )}
                  {isStreaming && !isAnalyzing && (
                    <Button
                      onClick={startAnalysis}
                      variant="secondary"
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      {hasSession ? "Resume Analysis" : "Start Analysis"}
                    </Button>
                  )}
                  {isAnalyzing && (
                    <Button
                      onClick={stopAnalysis}
                      variant="outline"
                      className="gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Stop Analysis
                    </Button>
                  )}
                </div>

                <div className="hidden lg:block h-6 w-px bg-border/60" />

                {/* Voice Alerts toggle + language selector */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 lg:ml-auto">
                  <Label
                    htmlFor="voice-alerts"
                    className="cursor-pointer gap-2 text-xs sm:text-sm"
                  >
                    {voiceEnabled ? (
                      <Volume2
                        className={cn(
                          "h-4 w-4",
                          isSpeaking
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                        )}
                      />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                    Voice Alerts
                  </Label>
                  <Switch
                    id="voice-alerts"
                    checked={voiceEnabled}
                    onCheckedChange={(checked) => {
                      setVoiceEnabled(checked);
                      if (checked) {
                        toast.success(
                          voiceLang === "hi"
                            ? "ध्वनि चेतावनी चालू"
                            : "Voice alerts enabled"
                        );
                      } else {
                        toast.message("Voice alerts disabled");
                      }
                    }}
                  />
                  <Select
                    value={voiceLang}
                    onValueChange={(v) => setVoiceLang(v as "en" | "hi")}
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-7 min-w-24"
                      aria-label="Voice language"
                    >
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">हिन्दी</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Post-analysis action bar */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="relative overflow-hidden border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.03] to-cyan-500/[0.05]">
                  {/* Confetti-like accents */}
                  <div className="pointer-events-none absolute inset-0">
                    <span className="absolute -top-2 left-8 h-2 w-2 rounded-full bg-emerald-400/70" />
                    <span className="absolute top-3 right-12 h-1.5 w-1.5 rotate-45 bg-cyan-400/70" />
                    <span className="absolute bottom-3 left-1/3 h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                    <span className="absolute top-1/2 right-4 h-1 w-3 rotate-12 bg-emerald-400/50" />
                    <span className="absolute bottom-2 right-1/3 h-2 w-2 rotate-45 bg-purple-400/60" />
                  </div>
                  <CardContent className="relative p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/40">
                          <PartyPopper className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            Analysis Complete
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sessionDetections.length} detections across{" "}
                            {stats.totalFrames} frames · {compliancePct}%
                            compliant
                          </p>
                        </div>
                      </div>
                      {savedScanId && (
                        <Badge className="bg-emerald-500 text-white gap-1">
                          <Save className="h-3 w-3" />
                          Saved
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!savedScanId ? (
                        <Button
                          onClick={saveSession}
                          disabled={saving}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {saving ? "Saving..." : "Save Session"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() =>
                              router.push(`/dashboard?scan=${savedScanId}`)
                            }
                            variant="secondary"
                            className="gap-2"
                          >
                            <LayoutDashboard className="h-4 w-4" />
                            View on Dashboard
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              window.open(
                                getPdfReportUrl(savedScanId),
                                "_blank"
                              );
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                            PDF Report
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              window.open(
                                getExcelReportUrl(savedScanId),
                                "_blank"
                              );
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                            Excel
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        className="gap-2"
                        onClick={resetSession}
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Results Panel */}
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Session Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SparkRow
                label="Frames Analyzed"
                value={stats.totalFrames}
                series={frameCountHistory}
                stroke="#22c55e"
                accent="emerald"
              />
              <SparkRow
                label="Detections"
                value={sessionDetections.length}
                series={frameCountHistory}
                stroke="#22d3ee"
                accent="cyan"
              />
              <SparkRow
                label="Avg Score"
                value={
                  scoreHistory.length
                    ? Math.round(
                        scoreHistory.reduce((a, b) => a + b, 0) /
                          scoreHistory.length
                      )
                    : 0
                }
                series={scoreHistory}
                stroke="#f59e0b"
                accent="amber"
                suffix="/100"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Compliant</span>
                <span className="font-medium text-emerald-500">
                  {stats.totalCompliant}
                </span>
              </div>
              {gpsRef.current.lat && (
                <div className="flex justify-between text-sm pt-2 border-t border-border/40">
                  <span className="text-muted-foreground">GPS</span>
                  <span className="font-mono text-xs">
                    {gpsRef.current.lat.toFixed(4)},{" "}
                    {gpsRef.current.lng?.toFixed(4)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Real weather (from GPS via Open-Meteo) */}
          {realWeather && (
            <Card className="border-emerald-500/20 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Live Weather
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-500/30 text-emerald-500"
                  >
                    Open-Meteo
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {realWeather.weather_description && (
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Conditions</span>
                    <span>{realWeather.weather_description}</span>
                  </div>
                )}
                {realWeather.temperature_c !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Temperature</span>
                    <span>{realWeather.temperature_c.toFixed(1)}°C</span>
                  </div>
                )}
                {realWeather.humidity_pct !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Humidity</span>
                    <span>{realWeather.humidity_pct}%</span>
                  </div>
                )}
                {realWeather.wind_speed_kmh !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wind</span>
                    <span>{realWeather.wind_speed_kmh.toFixed(1)} km/h</span>
                  </div>
                )}
                {realWeather.cloud_cover_pct !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cloud Cover</span>
                    <span>{realWeather.cloud_cover_pct}%</span>
                  </div>
                )}
                {realWeather.precipitation_mm !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precipitation</span>
                    <span>{realWeather.precipitation_mm.toFixed(1)} mm</span>
                  </div>
                )}
                {realWeather.visibility_m !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <span>
                      {(realWeather.visibility_m / 1000).toFixed(1)} km
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                  <Badge variant="outline" className="text-xs">
                    {realWeather.time_of_day}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {realWeather.visibility}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {realWeather.moisture}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI-detected camera scene */}
          {weather && (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Camera Scene
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500/30 text-amber-500"
                  >
                    AI Vision
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  What the camera image looks like (may differ from real
                  weather):
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline">{weather.time_of_day}</Badge>
                  <Badge variant="outline">{weather.visibility}</Badge>
                  <Badge variant="outline">{weather.moisture}</Badge>
                  <Badge variant="outline">
                    Streetlight: {weather.streetlight}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {!realWeather && !gpsRef.current.lat && (
            <Card className="border-amber-500/20 bg-card/50 backdrop-blur">
              <CardContent className="p-3 text-xs text-muted-foreground">
                Allow location access to see real weather conditions.
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isAnalyzing
                  ? `Current Detections (${detections.length})`
                  : `Session Log (${sessionDetections.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {(isAnalyzing ? detections : sessionDetections).length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isAnalyzing
                      ? "Scanning for road assets..."
                      : "Start analysis to detect assets"}
                  </p>
                </div>
              ) : (
                (isAnalyzing ? detections : sessionDetections).map((det, i) => {
                  const CategoryIcon =
                    det.category === "marking"
                      ? Minus
                      : det.category === "stud"
                        ? CircleIcon
                        : Triangle;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18 }}
                      className="group flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 p-2.5 transition-colors hover:border-border hover:bg-card/70"
                    >
                      <div
                        className="h-10 w-1 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            RETRO_COLORS[
                              det.retro_class as keyof typeof RETRO_COLORS
                            ],
                        }}
                      />
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
                        <CategoryIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {det.class_name.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Score: {det.retro_score.toFixed(0)} ·{" "}
                          {det.retro_class}
                        </p>
                      </div>
                      <ComplianceBadge compliant={det.compliant} />
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline row
// ---------------------------------------------------------------------------

function SparkRow({
  label,
  value,
  series,
  stroke,
  accent,
  suffix = "",
}: {
  label: string;
  value: number;
  series: number[];
  stroke: string;
  accent: "emerald" | "cyan" | "amber";
  suffix?: string;
}) {
  const path = useMemo(() => buildSparkPath(series, 80, 24), [series]);
  const accentText =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "cyan"
        ? "text-cyan-400"
        : "text-amber-400";

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        {series.length > 1 && (
          <svg
            width="80"
            height="24"
            viewBox="0 0 80 24"
            className="opacity-80"
            aria-hidden
          >
            <defs>
              <linearGradient id={`spark-${accent}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            {path.fill && (
              <path d={path.fill} fill={`url(#spark-${accent})`} />
            )}
            {path.line && (
              <path
                d={path.line}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        )}
        <span className={cn("font-semibold tabular-nums", accentText)}>
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function buildSparkPath(
  values: number[],
  w: number,
  h: number
): { line: string; fill: string } {
  if (values.length < 2) return { line: "", fill: "" };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const fill = `${line} L${w.toFixed(1)},${h} L0,${h} Z`;
  return { line, fill };
}
