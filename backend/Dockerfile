# RetroScan AI Backend — FastAPI + YOLOv8 + Gemini
# Multi-stage build to keep the final image lean.

FROM python:3.11-slim AS base

# System deps for OpenCV, Pillow, ReportLab, psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libpq5 \
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    fonts-noto \
    fonts-noto-core \
    fonts-noto-cjk \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Hindi font for PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-extra \
    && rm -rf /var/lib/apt/lists/* || true

WORKDIR /app

# Install Python deps (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-install CPU-only torch (much smaller than full torch)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision || true

# Pre-download YOLOv8n weights so first request isn't slow
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" || true

# Copy app code
COPY . .

# Create writable dirs that the app expects at runtime
RUN mkdir -p uploads results weights fonts

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:${PORT:-8000}/health || exit 1

# Railway/Render/Fly inject $PORT
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers"]
