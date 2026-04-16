"""Neon PostgreSQL database service."""

from __future__ import annotations

import os
import json
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn


def init_db():
    """Initialize database tables in Neon PostgreSQL."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            scan_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            total_frames INTEGER DEFAULT 0,
            total_detections INTEGER DEFAULT 0,
            signs_detected INTEGER DEFAULT 0,
            markings_detected INTEGER DEFAULT 0,
            studs_detected INTEGER DEFAULT 0,
            compliance_pass INTEGER DEFAULT 0,
            compliance_fail INTEGER DEFAULT 0,
            avg_retro_score REAL DEFAULT 0.0,
            weather_json JSONB DEFAULT '{}',
            progress REAL DEFAULT 0.0,
            current_step TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS detections (
            id SERIAL PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
            frame_index INTEGER NOT NULL,
            timestamp_sec REAL DEFAULT 0.0,
            class_name TEXT NOT NULL,
            category TEXT NOT NULL,
            confidence REAL NOT NULL,
            bbox JSONB NOT NULL,
            retro_class TEXT NOT NULL,
            retro_score REAL NOT NULL,
            condition_grade TEXT NOT NULL,
            color_fading REAL DEFAULT 0.0,
            surface_damage REAL DEFAULT 0.0,
            dirt_level REAL DEFAULT 0.0,
            legibility REAL DEFAULT 0.0,
            compliance JSONB DEFAULT '{}',
            priority INTEGER DEFAULT 5,
            priority_label TEXT DEFAULT '',
            cost_estimate REAL DEFAULT 0.0,
            issues JSONB DEFAULT '[]',
            age_estimate TEXT DEFAULT '',
            thumbnail_path TEXT DEFAULT '',
            gps_lat REAL,
            gps_lng REAL,
            sign_text TEXT DEFAULT '',
            sheeting_type TEXT DEFAULT '',
            remaining_life TEXT DEFAULT '',
            gemini_reasoning TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS frames (
            id SERIAL PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
            frame_index INTEGER NOT NULL,
            timestamp_sec REAL DEFAULT 0.0,
            image_path TEXT NOT NULL,
            annotated_path TEXT DEFAULT '',
            weather JSONB DEFAULT '{}',
            gps_lat REAL,
            gps_lng REAL
        );

        CREATE INDEX IF NOT EXISTS idx_detections_scan_id ON detections(scan_id);
        CREATE INDEX IF NOT EXISTS idx_frames_scan_id ON frames(scan_id);
        CREATE INDEX IF NOT EXISTS idx_detections_category ON detections(category);
        CREATE INDEX IF NOT EXISTS idx_detections_retro_class ON detections(retro_class);
    """)
    conn.commit()
    cur.close()
    conn.close()


def create_scan(scan_id: str, filename: str) -> dict:
    conn = get_db()
    cur = conn.cursor()
    now = datetime.now(timezone.utc)
    cur.execute(
        "INSERT INTO scans (scan_id, filename, status, created_at) VALUES (%s, %s, 'pending', %s)",
        (scan_id, filename, now),
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"scan_id": scan_id, "filename": filename, "status": "pending", "created_at": now.isoformat()}


def update_scan_status(scan_id: str, status: str, progress: float = 0, step: str = ""):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "UPDATE scans SET status=%s, progress=%s, current_step=%s WHERE scan_id=%s",
        (status, progress, step, scan_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def update_scan_summary(scan_id: str, summary: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE scans SET
            total_frames=%s, total_detections=%s, signs_detected=%s,
            markings_detected=%s, studs_detected=%s, compliance_pass=%s,
            compliance_fail=%s, avg_retro_score=%s, weather_json=%s,
            status='completed', progress=100.0, current_step='Done'
        WHERE scan_id=%s
    """, (
        summary["total_frames"], summary["total_detections"],
        summary["signs_detected"], summary["markings_detected"],
        summary["studs_detected"], summary["compliance_pass"],
        summary["compliance_fail"], summary["avg_retro_score"],
        json.dumps(summary.get("weather", {})), scan_id,
    ))
    conn.commit()
    cur.close()
    conn.close()


def save_detection(scan_id: str, det: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO detections (
            scan_id, frame_index, timestamp_sec, class_name, category,
            confidence, bbox, retro_class, retro_score, condition_grade,
            color_fading, surface_damage, dirt_level, legibility,
            compliance, priority, priority_label, cost_estimate,
            issues, age_estimate, thumbnail_path, gps_lat, gps_lng,
            sign_text, sheeting_type, remaining_life, gemini_reasoning
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        scan_id, det["frame_index"], det.get("timestamp_sec", 0),
        det["class_name"], det["category"], det["confidence"],
        json.dumps(det["bbox"]), det["retro_class"], det["retro_score"],
        det["condition_grade"], det["color_fading"], det["surface_damage"],
        det["dirt_level"], det["legibility"], json.dumps(det.get("compliance", {})),
        det.get("priority", 5), det.get("priority_label", ""),
        det.get("cost_estimate", 0), json.dumps(det.get("issues", [])),
        det.get("age_estimate", ""), det.get("thumbnail_path", ""),
        det.get("gps_lat"), det.get("gps_lng"),
        det.get("sign_text", ""), det.get("sheeting_type", ""),
        det.get("remaining_life", ""), det.get("gemini_reasoning", ""),
    ))
    conn.commit()
    cur.close()
    conn.close()


def save_frame(scan_id: str, frame_data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO frames (scan_id, frame_index, timestamp_sec, image_path, annotated_path, weather, gps_lat, gps_lng)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        scan_id, frame_data["frame_index"], frame_data.get("timestamp_sec", 0),
        frame_data["image_path"], frame_data.get("annotated_path", ""),
        json.dumps(frame_data.get("weather", {})),
        frame_data.get("gps_lat"), frame_data.get("gps_lng"),
    ))
    conn.commit()
    cur.close()
    conn.close()


def get_scan(scan_id: str) -> dict | None:
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM scans WHERE scan_id=%s", (scan_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row is None:
        return None
    result = dict(row)
    if result.get("created_at"):
        result["created_at"] = result["created_at"].isoformat()
    return result


def get_scan_detections(scan_id: str) -> list[dict]:
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT * FROM detections WHERE scan_id=%s ORDER BY frame_index, id",
        (scan_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_scan_frames(scan_id: str) -> list[dict]:
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT * FROM frames WHERE scan_id=%s ORDER BY frame_index", (scan_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def list_scans() -> list[dict]:
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM scans ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        results.append(d)
    return results


def get_scan_progress(scan_id: str) -> dict | None:
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT scan_id, status, progress, current_step, total_frames FROM scans WHERE scan_id=%s",
        (scan_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None
