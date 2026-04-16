"""RetroScan AI — FastAPI Backend."""

import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, RESULTS_DIR, UPLOAD_DIR
from app.services.database import init_db
from app.routers import upload, analyze, results, reports, weather


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    logger.info("Initializing Neon PostgreSQL database...")
    init_db()
    logger.info("Database ready. RetroScan AI is live.")
    yield


app = FastAPI(
    title="RetroScan AI",
    description="AI-powered retroreflectivity measurement for road safety assets",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for serving results
app.mount("/static/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")
app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Routers
app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(results.router)
app.include_router(reports.router)
app.include_router(weather.router)


@app.get("/")
async def root():
    return {
        "name": "RetroScan AI",
        "version": "1.0.0",
        "description": "AI-powered retroreflectivity assessment for NHAI road safety",
        "endpoints": {
            "upload": "/api/upload/",
            "progress": "/api/analyze/progress/{scan_id}",
            "live_ws": "/api/analyze/ws/live",
            "results": "/api/results/scans",
            "reports_pdf": "/api/reports/{scan_id}/pdf",
            "reports_excel": "/api/reports/{scan_id}/excel",
            "docs": "/docs",
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
