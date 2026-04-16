import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
RESULTS_DIR = BASE_DIR / "results"
WEIGHTS_DIR = BASE_DIR / "weights"

UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

# API Keys
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Detection settings
DETECTION_CONFIDENCE = 0.35
DETECTION_IOU = 0.45
FRAME_SAMPLE_RATE = 2  # Extract N frames per second

# Gemini model
GEMINI_MODEL = "gemini-2.5-flash"

# IRC 67:2022 thresholds (cd/lux/m² at 0.2° observation angle)
IRC_67_THRESHOLDS = {
    "type_i": {"name": "Engineering Grade", "white": 70, "yellow": 50, "red": 14.5, "green": 9, "blue": 4},
    "type_iii": {"name": "High Intensity Prismatic", "white": 120, "yellow": 85, "red": 25, "green": 15, "blue": 8},
    "type_iv": {"name": "High Intensity Prismatic (IV)", "white": 180, "yellow": 120, "red": 36, "green": 18, "blue": 11},
    "type_ix": {"name": "Diamond Grade DG3", "white": 250, "yellow": 170, "red": 45, "green": 25, "blue": 15},
    "type_xi": {"name": "Diamond Grade DG3 (XI)", "white": 380, "yellow": 285, "red": 76, "green": 38, "blue": 19},
}

# IRC 35 thresholds (mcd/m²/lux)
IRC_35_THRESHOLDS = {
    "white_new": 150,
    "white_maintained": 100,
    "yellow_new": 100,
    "yellow_maintained": 80,
}

RETRO_CLASS_MAP = {
    "HIGH": {"grade": "A", "description": "Excellent retroreflectivity", "score_range": (75, 100)},
    "MEDIUM": {"grade": "B", "description": "Acceptable retroreflectivity", "score_range": (50, 74)},
    "LOW": {"grade": "C", "description": "Below standard, needs attention", "score_range": (25, 49)},
    "FAILED": {"grade": "F", "description": "Non-compliant, immediate replacement", "score_range": (0, 24)},
}

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "*",  # For PWA testing
]
