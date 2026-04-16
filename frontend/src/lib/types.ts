export interface Detection {
  id: number;
  frame_index: number;
  timestamp_sec: number;
  class_name: string;
  category: string;
  confidence: number;
  bbox: number[];
  retro_class: "HIGH" | "MEDIUM" | "LOW" | "FAILED";
  retro_score: number;
  condition_grade: string;
  color_fading: number;
  surface_damage: number;
  dirt_level: number;
  legibility: number;
  compliance: ComplianceResult;
  priority: number;
  priority_label: string;
  cost_estimate: number;
  issues: string[];
  age_estimate: string;
  thumbnail_path: string;
  gps_lat?: number;
  gps_lng?: number;
  sign_text?: string;
  sheeting_type?: string;
  remaining_life?: string;
  gemini_reasoning?: string;
}

export interface ComplianceResult {
  standard: string;
  compliant: boolean;
  threshold: number;
  estimated_ra?: number;
  estimated_rl?: number;
  estimated_value?: number;
  unit: string;
  margin: number;
  recommendation: string;
  sheeting_type?: string;
  color?: string;
}

export interface WeatherInfo {
  time_of_day: string;
  moisture: string;
  visibility: string;
  streetlight: string;
}

export interface FrameResult {
  frame_index: number;
  timestamp_sec: number;
  image_path: string;
  annotated_path: string;
  weather: WeatherInfo;
  gps_lat?: number;
  gps_lng?: number;
}

export interface ScanResult {
  scan: {
    scan_id: string;
    filename: string;
    status: string;
    created_at: string;
    total_frames: number;
    total_detections: number;
    signs_detected: number;
    markings_detected: number;
    studs_detected: number;
    compliance_pass: number;
    compliance_fail: number;
    avg_retro_score: number;
    weather: WeatherInfo;
  };
  detections: Detection[];
  frames: FrameResult[];
  summary: {
    total_frames: number;
    total_detections: number;
    signs_detected: number;
    markings_detected: number;
    studs_detected: number;
    compliance_pass: number;
    compliance_fail: number;
    avg_retro_score: number;
    retro_distribution: Record<string, number>;
    category_breakdown: Record<string, number>;
    priority_breakdown: Record<string, number>;
    total_maintenance_cost: number;
  };
}

export interface ScanListItem {
  scan_id: string;
  filename: string;
  status: string;
  created_at: string;
  total_detections: number;
  compliance_pass: number;
  compliance_fail: number;
  avg_retro_score: number;
}

export interface UploadResponse {
  scan_id: string;
  filename: string;
  status: string;
  message: string;
}

export interface AnalysisProgress {
  scan_id: string;
  status: string;
  progress: number;
  current_step: string;
  frames_processed: number;
  total_frames: number;
}

export interface LiveDetection {
  class_name: string;
  category: string;
  confidence: number;
  bbox: number[];
  retro_class: string;
  retro_score: number;
  condition_grade: string;
  compliant: boolean;
  priority: number;
}

export const RETRO_COLORS = {
  HIGH: "#22c55e",
  MEDIUM: "#f59e0b",
  LOW: "#f97316",
  FAILED: "#ef4444",
} as const;

export const GRADE_COLORS = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#f59e0b",
  F: "#ef4444",
} as const;

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "None",
};
