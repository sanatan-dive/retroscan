// Use relative URLs — Next.js rewrites proxy /api/* to backend
const API_BASE = "";

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload/`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }

  return res.json();
}

export async function getProgress(scanId: string) {
  const res = await fetch(`${API_BASE}/api/analyze/progress/${scanId}`);
  if (!res.ok) throw new Error("Failed to get progress");
  return res.json();
}

export async function getScanResults(scanId: string) {
  const res = await fetch(`${API_BASE}/api/results/scans/${scanId}`);
  if (!res.ok) throw new Error("Failed to get results");
  return res.json();
}

export async function getAllScans() {
  const res = await fetch(`${API_BASE}/api/results/scans`);
  if (!res.ok) throw new Error("Failed to get scans");
  return res.json();
}

export async function getDetections(scanId: string, category?: string) {
  const params = category ? `?category=${category}` : "";
  const res = await fetch(`${API_BASE}/api/results/scans/${scanId}/detections${params}`);
  if (!res.ok) throw new Error("Failed to get detections");
  return res.json();
}

/**
 * Fetch a single detection by ID. Tries the dedicated endpoint first
 * (`/api/results/scans/{scan_id}/detections/{detection_id}`); if not
 * available, falls back to scanning all scans and locating the detection.
 *
 * `scanId` is optional — when omitted we search across all scans.
 */
export async function getDetectionById(
  detectionId: string | number,
  scanId?: string
): Promise<{
  scan_id: string;
  detection: import("./types").Detection;
  scan_filename?: string;
  scan_created_at?: string;
}> {
  // Try direct endpoint when we have a scan id
  if (scanId) {
    try {
      const res = await fetch(
        `${API_BASE}/api/results/scans/${scanId}/detections/${detectionId}`
      );
      if (res.ok) {
        const data = await res.json();
        // Endpoint may return either { detection: ... } or the detection directly
        const detection = data.detection ?? data;
        return {
          scan_id: scanId,
          detection,
          scan_filename: data.scan_filename,
          scan_created_at: data.scan_created_at,
        };
      }
    } catch {
      // fall through to scan-all approach
    }

    // Fallback: fetch the scan and find the detection by ID
    try {
      const scan = await getScanResults(scanId);
      const detection = (scan.detections || []).find(
        (d: import("./types").Detection) =>
          String(d.id) === String(detectionId)
      );
      if (detection) {
        return {
          scan_id: scanId,
          detection,
          scan_filename: scan.scan?.filename,
          scan_created_at: scan.scan?.created_at,
        };
      }
    } catch {
      // ignore and fall through
    }
  }

  // Last-resort: search across all scans
  const all = await getAllScans();
  const scans = (all.scans || []) as import("./types").ScanListItem[];
  for (const s of scans) {
    try {
      const scan = await getScanResults(s.scan_id);
      const detection = (scan.detections || []).find(
        (d: import("./types").Detection) =>
          String(d.id) === String(detectionId)
      );
      if (detection) {
        return {
          scan_id: s.scan_id,
          detection,
          scan_filename: scan.scan?.filename,
          scan_created_at: scan.scan?.created_at,
        };
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Detection ${detectionId} not found`);
}

export function getFrameImageUrl(scanId: string, frameIndex: number, annotated = true) {
  return `${API_BASE}/api/results/scans/${scanId}/frames/${frameIndex}/image?annotated=${annotated}`;
}

export function getThumbnailUrl(scanId: string, detectionId: string) {
  return `${API_BASE}/api/results/scans/${scanId}/thumbnails/${detectionId}`;
}

export type ReportLang = "en" | "hi" | "bilingual";

export function getPdfReportUrl(scanId: string, lang: ReportLang = "en") {
  return `${API_BASE}/api/reports/${scanId}/pdf?lang=${lang}`;
}

export function getExcelReportUrl(scanId: string) {
  return `${API_BASE}/api/reports/${scanId}/excel`;
}

export function getGeoJSONUrl(scanId: string) {
  return `${API_BASE}/api/reports/${scanId}/geojson`;
}

export function getKMLUrl(scanId: string) {
  return `${API_BASE}/api/reports/${scanId}/kml`;
}

export function createLiveWebSocket() {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/api/analyze/ws/live`);
}

export async function analyzeFrame(frameB64: string) {
  const res = await fetch(`${API_BASE}/api/analyze/frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frame: frameB64 }),
  });
  if (!res.ok) throw new Error("Frame analysis failed");
  return res.json();
}

export async function getRealWeather(lat: number, lng: number) {
  const res = await fetch(
    `${API_BASE}/api/weather/current?lat=${lat}&lng=${lng}`
  );
  if (!res.ok) throw new Error("Weather fetch failed");
  return res.json();
}

export async function saveLiveSession(payload: {
  detections: unknown[];
  weather: unknown;
  total_frames: number;
  gps_lat?: number;
  gps_lng?: number;
}) {
  const res = await fetch(`${API_BASE}/api/analyze/save-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Save failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}
