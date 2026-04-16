"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Detection } from "@/lib/types";
import { RETRO_COLORS, PRIORITY_LABELS } from "@/lib/types";

export type TileTheme = "standard" | "satellite" | "dark";

interface MapViewProps {
  detections: (Detection & { scan_filename?: string })[];
  showSegments?: boolean;
  tileTheme?: TileTheme;
}

const TILE_PROVIDERS: Record<
  TileTheme,
  { url: string; attribution: string; subdomains: string }
> = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: "abc",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    subdomains: "abc",
  },
};

export default function MapView({
  detections,
  showSegments = true,
  tileTheme = "dark",
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || detections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No GPS data available. Upload geotagged footage to see results on the
        map.
      </div>
    );
  }

  const validDets = detections.filter((d) => d.gps_lat && d.gps_lng);
  if (validDets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No GPS coordinates found in detections.
      </div>
    );
  }

  const centerLat =
    validDets.reduce((s, d) => s + (d.gps_lat || 0), 0) / validDets.length;
  const centerLng =
    validDets.reduce((s, d) => s + (d.gps_lng || 0), 0) / validDets.length;

  const segments: {
    points: [number, number][];
    avgScore: number;
    color: string;
  }[] = [];

  for (let i = 0; i < validDets.length - 1; i++) {
    const a = validDets[i];
    const b = validDets[i + 1];
    const avgScore = (a.retro_score + b.retro_score) / 2;
    const color = scoreToColor(avgScore);
    segments.push({
      points: [
        [a.gps_lat!, a.gps_lng!],
        [b.gps_lat!, b.gps_lng!],
      ],
      avgScore,
      color,
    });
  }

  const provider = TILE_PROVIDERS[tileTheme];

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={13}
      className="h-full w-full z-0"
      zoomControl={true}
    >
      <TileLayer
        key={tileTheme}
        attribution={provider.attribution}
        url={provider.url}
        subdomains={provider.subdomains}
      />

      {showSegments &&
        segments.map((seg, i) => (
          <Polyline
            key={`seg-${i}`}
            positions={seg.points}
            pathOptions={{
              color: seg.color,
              weight: 5,
              opacity: 0.75,
              lineCap: "round",
              lineJoin: "round",
            }}
          >
            <Popup>
              <div style={popupRoot}>
                <div style={popupTitle}>Highway Segment</div>
                <div style={popupRow}>
                  <span style={popupLabel}>Avg Score</span>
                  <span style={{ ...popupValue, color: seg.color }}>
                    {seg.avgScore.toFixed(0)}/100
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#9ca3af",
                    lineHeight: 1.4,
                  }}
                >
                  {scoreToLabel(seg.avgScore)}
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

      {validDets.map((det, i) => {
        const color = RETRO_COLORS[det.retro_class] || "#888";
        const radius = det.priority <= 2 ? 10 : det.priority <= 3 ? 8 : 6;

        return (
          <CircleMarker
            key={`${det.id}-${i}`}
            center={[det.gps_lat!, det.gps_lng!]}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup maxWidth={300}>
              <div style={popupRoot}>
                {/* Title bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: color,
                      boxShadow: `0 0 0 3px ${color}33`,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      letterSpacing: "-0.01em",
                      color: "#f5f5f5",
                      textTransform: "capitalize",
                    }}
                  >
                    {det.class_name.replace(/_/g, " ")}
                  </div>
                </div>

                {det.sign_text && (
                  <div
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, monospace",
                      background: "rgba(255,255,255,0.06)",
                      padding: "4px 8px",
                      borderRadius: 6,
                      marginBottom: 8,
                      fontSize: 11,
                      color: "#e5e5e5",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    &ldquo;{det.sign_text}&rdquo;
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <Stat label="Score" value={`${det.retro_score.toFixed(0)}/100`} color={color} />
                  <Stat label="Class" value={det.retro_class} color={color} />
                  <Stat label="Grade" value={det.condition_grade} />
                  <Stat
                    label="IRC"
                    value={det.compliance?.compliant ? "PASS" : "FAIL"}
                    color={det.compliance?.compliant ? "#22c55e" : "#ef4444"}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    paddingTop: 6,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Pill>{PRIORITY_LABELS[det.priority] || "Unknown"} priority</Pill>
                  {det.age_estimate && <Pill>~{det.age_estimate}</Pill>}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

// ---------------------------------------------------------------------------
// Inline popup styling helpers
// ---------------------------------------------------------------------------

const popupRoot: React.CSSProperties = {
  fontFamily:
    "var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: 13,
  color: "#f5f5f5",
  minWidth: 180,
};

const popupTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  color: "#f5f5f5",
  marginBottom: 6,
};

const popupRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
};

const popupLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const popupValue: React.CSSProperties = {
  fontWeight: 700,
};

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#9ca3af",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: color || "#f5f5f5",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        color: "#9ca3af",
        background: "rgba(255,255,255,0.05)",
        padding: "2px 6px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.08)",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

function scoreToColor(score: number): string {
  if (score >= 75) return RETRO_COLORS.HIGH;
  if (score >= 50) return RETRO_COLORS.MEDIUM;
  if (score >= 25) return RETRO_COLORS.LOW;
  return RETRO_COLORS.FAILED;
}

function scoreToLabel(score: number): string {
  if (score >= 75) return "Excellent corridor — no action needed";
  if (score >= 50) return "Acceptable — monitor for degradation";
  if (score >= 25) return "Degraded — schedule maintenance";
  return "Critical — immediate attention required";
}
