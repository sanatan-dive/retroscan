"use client";

import * as React from "react";
import { Settings2, Volume2, Speaker, Play } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Persistent voice settings hook
// ---------------------------------------------------------------------------

export type VoiceLang = "en" | "hi";

export interface VoiceSettings {
  speed: number;
  volume: number;
  lang: VoiceLang;
}

const STORAGE_KEY = "retroscan:voice-settings:v1";

const DEFAULT_SETTINGS: VoiceSettings = {
  speed: 1.0,
  volume: 80,
  lang: "en",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      speed: clamp(Number(parsed.speed ?? DEFAULT_SETTINGS.speed), 0.5, 1.5),
      volume: clamp(Number(parsed.volume ?? DEFAULT_SETTINGS.volume), 0, 100),
      lang: parsed.lang === "hi" ? "hi" : "en",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(s: VoiceSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* swallow quota / privacy mode errors */
  }
}

/**
 * Hook for reading and updating persistent TTS settings.
 *
 * Settings are stored in localStorage so they survive across reloads and are
 * shared between any component that uses this hook within the same browser.
 */
export function useVoiceSettings() {
  const [settings, setSettings] = React.useState<VoiceSettings>(
    DEFAULT_SETTINGS
  );

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    setSettings(readSettings());
  }, []);

  // Cross-tab + cross-component sync
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setSettings(readSettings());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const persist = React.useCallback((next: VoiceSettings) => {
    setSettings(next);
    writeSettings(next);
    if (typeof window !== "undefined") {
      // Notify same-tab listeners (StorageEvent only fires in other tabs)
      window.dispatchEvent(
        new CustomEvent("retroscan:voice-settings-changed", { detail: next })
      );
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<VoiceSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener("retroscan:voice-settings-changed", handler);
    return () =>
      window.removeEventListener("retroscan:voice-settings-changed", handler);
  }, []);

  const setSpeed = React.useCallback(
    (speed: number) =>
      persist({ ...settings, speed: clamp(speed, 0.5, 1.5) }),
    [persist, settings]
  );

  const setVolume = React.useCallback(
    (volume: number) =>
      persist({ ...settings, volume: clamp(volume, 0, 100) }),
    [persist, settings]
  );

  const setLang = React.useCallback(
    (lang: VoiceLang) => persist({ ...settings, lang }),
    [persist, settings]
  );

  return {
    speed: settings.speed,
    volume: settings.volume,
    lang: settings.lang,
    setSpeed,
    setVolume,
    setLang,
  };
}

/**
 * Pick the best matching SpeechSynthesisVoice for the given language.
 * Mirrors the heuristic used elsewhere in the app (Indian English first).
 */
export function pickVoiceForLang(
  lang: VoiceLang
): SpeechSynthesisVoice | null {
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
  return (
    voices.find((v) => v.lang === "en-IN" || /india/i.test(v.name)) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en-gb")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
    null
  );
}

// ---------------------------------------------------------------------------
// Popover UI
// ---------------------------------------------------------------------------

interface VoiceSettingsProps {
  /** Override the trigger button (e.g. for dense toolbars) */
  triggerClassName?: string;
  /** Render a label next to the gear icon */
  showLabel?: boolean;
}

const TEST_PHRASES: Record<VoiceLang, string> = {
  en: "Voice test successful. RetroScan AI ready.",
  hi: "आवाज़ परीक्षण सफल। रेट्रोस्कैन ए आई तैयार है।",
};

export function VoiceSettingsButton({
  triggerClassName,
  showLabel = false,
}: VoiceSettingsProps) {
  const { speed, volume, lang, setSpeed, setVolume, setLang } =
    useVoiceSettings();
  const [testing, setTesting] = React.useState(false);

  const playTest = React.useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(TEST_PHRASES[lang]);
      utter.lang = lang === "hi" ? "hi-IN" : "en-IN";
      const voice = pickVoiceForLang(lang);
      if (voice) utter.voice = voice;
      utter.rate = speed;
      utter.volume = clamp(volume / 100, 0, 1);
      utter.pitch = 1;
      utter.onstart = () => setTesting(true);
      utter.onend = () => setTesting(false);
      utter.onerror = () => setTesting(false);
      window.speechSynthesis.speak(utter);
    } catch {
      setTesting(false);
    }
  }, [lang, speed, volume]);

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", triggerClassName)}
            aria-label="Voice settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showLabel && <span className="text-xs">Voice</span>}
          </Button>
        }
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className={cn(
              "z-50 w-[300px] origin-(--transform-origin) rounded-lg bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "duration-100"
            )}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Speaker className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">Voice Settings</h3>
              </div>

              <Separator />

              {/* Speed slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Speed</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {speed.toFixed(1)}x
                  </span>
                </div>
                <Slider
                  value={[speed]}
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  onValueChange={(v) => {
                    const next = Array.isArray(v) ? v[0] : Number(v);
                    if (!Number.isNaN(next)) setSpeed(next);
                  }}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>1.5x</span>
                </div>
              </div>

              {/* Volume slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Volume2 className="h-3 w-3" />
                    Volume
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {volume}%
                  </span>
                </div>
                <Slider
                  value={[volume]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => {
                    const next = Array.isArray(v) ? v[0] : Number(v);
                    if (!Number.isNaN(next)) setVolume(next);
                  }}
                />
              </div>

              {/* Language selector */}
              <div className="space-y-2">
                <Label className="text-xs">Language</Label>
                <Select
                  value={lang}
                  onValueChange={(v) => setLang(v as VoiceLang)}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full h-8"
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

              <Separator />

              {/* Test button */}
              <Button
                onClick={playTest}
                size="sm"
                variant="secondary"
                className="w-full gap-1.5"
                disabled={testing}
              >
                <Play className="h-3.5 w-3.5" />
                {testing ? "Speaking..." : "Test voice"}
              </Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export default VoiceSettingsButton;
