from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UploadResponse(BaseModel):
    scan_id: str
    filename: str
    status: str
    message: str


class DetectionResult(BaseModel):
    id: int
    frame_index: int
    class_name: str
    confidence: float
    bbox: list[float]  # [x1, y1, x2, y2]
    retro_class: str  # HIGH, MEDIUM, LOW, FAILED
    retro_score: float  # 0-100
    condition_grade: str  # A, B, C, F
    color_fading: float  # 0-100
    surface_damage: float  # 0-100
    dirt_level: float  # 0-100
    legibility: float  # 0-100
    thumbnail_path: Optional[str] = None


class WeatherInfo(BaseModel):
    time_of_day: str  # day, night, twilight
    moisture: str  # dry, wet
    visibility: str  # clear, foggy, rainy
    streetlight: str  # present, absent


class FrameResult(BaseModel):
    frame_index: int
    timestamp_sec: float
    image_path: str
    annotated_path: str
    detections: list[DetectionResult]
    weather: WeatherInfo
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None


class ScanSummary(BaseModel):
    scan_id: str
    filename: str
    status: str
    created_at: str
    total_frames: int
    total_detections: int
    signs_detected: int
    markings_detected: int
    studs_detected: int
    compliance_pass: int
    compliance_fail: int
    avg_retro_score: float
    weather: WeatherInfo
    frames: list[FrameResult]


class ScanListItem(BaseModel):
    scan_id: str
    filename: str
    status: str
    created_at: str
    total_detections: int
    compliance_pass: int
    compliance_fail: int
    avg_retro_score: float


class AnalysisProgress(BaseModel):
    scan_id: str
    status: str  # processing, completed, failed
    progress: float  # 0-100
    current_step: str
    frames_processed: int
    total_frames: int


class IRCComplianceResult(BaseModel):
    asset_type: str
    standard: str  # IRC 67 or IRC 35
    sheeting_type: Optional[str] = None
    measured_value: float
    threshold: float
    unit: str
    compliant: bool
    recommendation: str
