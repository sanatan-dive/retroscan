# RetroScan AI — Detailed Implementation Plan

## One-Line Pitch
**AI-powered retroreflectivity assessment from dashcam/phone/webcam video — no specialized hardware needed.**

---

## Core Concept

Instead of expensive retroreflectometers or custom vehicle rigs, we use **any camera** (dashcam footage, phone video, webcam, drone footage uploaded as files) + AI/ML to:

1. **Detect** all road safety assets (signs, markings, studs, delineators) in video frames
2. **Estimate retroreflectivity** using a trained CNN that learns the visual appearance → retroreflectivity mapping
3. **Classify condition** (good / degraded / non-compliant) against IRC 67 & IRC 35 thresholds
4. **Generate compliance reports** with GPS-tagged results on an interactive map

The key insight: retroreflectivity degradation has **visible correlates** — color fading, surface wear, dirt accumulation, cracking, delamination. A well-trained model can predict retroreflectivity class from appearance alone, validated against ground-truth handheld measurements.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     INPUT SOURCES                         │
│                                                           │
│  📹 Dashcam Video    📱 Phone Video    🖥️ Webcam Live     │
│  (uploaded MP4)      (uploaded MP4)    (browser stream)   │
│                                                           │
│  🚁 Drone Footage   📸 Still Images                      │
│  (uploaded MP4)      (uploaded JPG/PNG)                   │
└───────────────────────┬──────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────┐
│              PYTHON BACKEND (FastAPI)                     │
│                                                           │
│  ┌────────────────────────────────────────────────┐      │
│  │  MODULE 1: Asset Detection (YOLOv8)            │      │
│  │                                                 │      │
│  │  Detects & classifies:                          │      │
│  │  - Traffic signs (regulatory/warning/info)      │      │
│  │  - Pavement markings (white/yellow, solid/dash) │      │
│  │  - Road studs / RPMs                            │      │
│  │  - Delineators & chevron signs                  │      │
│  │  - Gantry / overhead signs                      │      │
│  │                                                 │      │
│  │  Output: bounding boxes + class + confidence    │      │
│  └──────────────────┬─────────────────────────────┘      │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────┐      │
│  │  MODULE 2: Retroreflectivity Estimator         │      │
│  │                                                 │      │
│  │  For each detected asset ROI:                   │      │
│  │  - Extract visual features (brightness,         │      │
│  │    contrast, color histogram, edge sharpness,   │      │
│  │    surface texture, wear patterns)              │      │
│  │  - Feed through trained regression/             │      │
│  │    classification model                         │      │
│  │  - Output: estimated retroreflectivity class    │      │
│  │    (HIGH / MEDIUM / LOW / FAILED)               │      │
│  │  - Map to IRC 67/35 thresholds                  │      │
│  │                                                 │      │
│  │  Model: EfficientNet-B0 or ResNet-18            │      │
│  │  (fine-tuned on sign/marking condition data)    │      │
│  └──────────────────┬─────────────────────────────┘      │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────┐      │
│  │  MODULE 3: Condition Analyzer                   │      │
│  │                                                 │      │
│  │  - Color fading score (0-100)                   │      │
│  │  - Surface damage detection (cracks, peeling)   │      │
│  │  - Dirt/occlusion percentage                    │      │
│  │  - Legibility score for text signs              │      │
│  │  - Overall condition grade (A/B/C/D/F)          │      │
│  │  - Maintenance urgency flag                     │      │
│  └──────────────────┬─────────────────────────────┘      │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────┐      │
│  │  MODULE 4: Weather & Lighting Classifier        │      │
│  │                                                 │      │
│  │  Classifies capture conditions:                 │      │
│  │  - Day / Night / Twilight                       │      │
│  │  - Dry / Wet                                    │      │
│  │  - Clear / Foggy / Rainy                        │      │
│  │  - Streetlight present / absent                 │      │
│  │                                                 │      │
│  │  Used to normalize readings and tag results     │      │
│  └──────────────────┬─────────────────────────────┘      │
│                     ▼                                     │
│  ┌────────────────────────────────────────────────┐      │
│  │  MODULE 5: Report Generator                     │      │
│  │                                                 │      │
│  │  - PDF compliance report per survey             │      │
│  │  - Excel data export                            │      │
│  │  - IRC 67 / IRC 35 compliance matrix            │      │
│  │  - Before/after comparison for maintenance      │      │
│  └────────────────────────────────────────────────┘      │
└───────────────────────┬──────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────┐
│              NEXT.JS FRONTEND DASHBOARD                   │
│         (adapted from Rakshak-AI codebase)                │
│                                                           │
│  Page 1: UPLOAD & ANALYZE                                 │
│  ┌─────────────────────────────────────────────┐         │
│  │  - Drag & drop video/image upload            │         │
│  │  - Webcam live capture option                 │         │
│  │  - Real-time detection overlay on video       │         │
│  │  - Progress bar for batch processing          │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
│  Page 2: RESULTS DASHBOARD                                │
│  ┌─────────────────────────────────────────────┐         │
│  │  - Interactive map (Leaflet/Mapbox) with      │         │
│  │    GPS-pinned assets color-coded by status    │         │
│  │  - Summary stats: total assets scanned,       │         │
│  │    pass/fail counts, avg retroreflectivity    │         │
│  │  - Filterable asset table with thumbnails     │         │
│  │  - Charts: condition distribution, trends     │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
│  Page 3: ASSET DETAIL VIEW                                │
│  ┌─────────────────────────────────────────────┐         │
│  │  - Zoomed detected asset image               │         │
│  │  - Retroreflectivity estimation + confidence  │         │
│  │  - Condition breakdown (color, damage, dirt)  │         │
│  │  - IRC compliance status                      │         │
│  │  - Historical trend (if resurveyed)           │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
│  Page 4: REPORTS                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │  - Generate PDF/Excel reports                 │         │
│  │  - IRC 67 / IRC 35 compliance summary         │         │
│  │  - Maintenance priority list                  │         │
│  │  - Export for NHAI submission                  │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
│  Page 5: ANALYTICS                                        │
│  ┌─────────────────────────────────────────────┐         │
│  │  - Degradation prediction over time           │         │
│  │  - Highway segment comparison                 │         │
│  │  - Weather impact analysis                    │         │
│  │  - Cost-of-replacement estimation             │         │
│  └─────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend (Python)
| Component | Technology | Why |
|-----------|-----------|-----|
| API Server | **FastAPI** | Async, fast, auto-docs with Swagger |
| Object Detection | **YOLOv8 (ultralytics)** | SOTA real-time detection, easy fine-tuning |
| Retroreflectivity Model | **PyTorch + EfficientNet-B0** | Lightweight, accurate image classification/regression |
| Image Processing | **OpenCV + Pillow** | Frame extraction, ROI cropping, preprocessing |
| Weather Classification | **torchvision pretrained model** | Scene classification from frames |
| Video Processing | **OpenCV + FFmpeg** | Frame extraction, annotated video output |
| Report Generation | **ReportLab (PDF) + openpyxl (Excel)** | Professional compliance reports |
| Database | **SQLite** (prototype) | Zero config, single file, good enough for hackathon |
| GPS Extraction | **exifread + gpxpy** | Extract GPS from video metadata / GPX files |

### Frontend (Next.js — from Rakshak-AI)
| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | **Next.js 14+ (TypeScript)** | Already built in Rakshak-AI |
| UI Components | **Radix UI + Tailwind** | Already in Rakshak-AI |
| Maps | **Leaflet + react-leaflet** | Free, no API key needed, great for India maps |
| Charts | **Recharts** | Already in Rakshak-AI |
| Video Player | **react-player or HTML5 video** | Overlay detections on video |
| PDF/Excel Export | **jsPDF + ExcelJS** | Already in Rakshak-AI |
| State Management | **React Context + SWR** | Simple, effective |

---

## Data Strategy (Critical for Hackathon)

### For Detection Model (YOLOv8)
- **Indian Traffic Sign Dataset**: Use publicly available Indian road sign datasets
- **GTSDB** (German Traffic Sign Detection Benchmark): 900+ images, transferable
- **Mapillary Traffic Sign Dataset**: 100k+ images with Indian signs
- **Self-collected**: Record 30 min of driving footage, annotate with LabelImg (even 100 images helps)
- **Pavement markings**: Use dashcam datasets (BDD100K has lane markings)

### For Retroreflectivity Estimation
Since we can't get real retroreflectometer readings easily, we use a **proxy approach**:

1. **Synthetic training data**: Take good sign images, apply degradation transforms
   (blur, color shift, noise, fade, crack overlay) to simulate aging
2. **Condition scoring**: Train on visual condition → score, where score correlates
   with retroreflectivity based on published degradation curves from research papers
3. **Published correlations**: Use data from FHWA/NCHRP research that maps sign age,
   sheeting type, and visual condition to retroreflectivity values
4. **Night-time analysis**: For night footage, actual pixel brightness of signs
   IS a direct measure of retroreflectivity (brighter = more retroreflective)

### Reference Data (IRC Standards)
- **IRC 67**: Minimum retroreflectivity for traffic signs by sheeting type
  - Type I (Engineering Grade): RA ≥ 70 cd/lux/m²
  - Type III (High Intensity): RA ≥ 120 cd/lux/m²
  - Type IX (Diamond Grade): RA ≥ 250 cd/lux/m²
- **IRC 35**: Minimum retroreflectivity for road markings
  - White markings: RL ≥ 150 mcd/m²/lux (new), ≥ 100 (maintained)
  - Yellow markings: RL ≥ 100 mcd/m²/lux (new), ≥ 80 (maintained)

---

## Directory Structure

```
RetroScan-AI/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # App configuration
│   │   ├── models/
│   │   │   ├── detector.py         # YOLOv8 detection wrapper
│   │   │   ├── retroreflectivity.py # Retroreflectivity estimator
│   │   │   ├── condition.py        # Condition analyzer
│   │   │   └── weather.py          # Weather/lighting classifier
│   │   ├── routers/
│   │   │   ├── upload.py           # Video/image upload endpoints
│   │   │   ├── analyze.py          # Analysis trigger endpoints
│   │   │   ├── results.py          # Results retrieval endpoints
│   │   │   └── reports.py          # Report generation endpoints
│   │   ├── services/
│   │   │   ├── video_processor.py  # Frame extraction & processing
│   │   │   ├── gps_extractor.py    # GPS metadata extraction
│   │   │   ├── report_generator.py # PDF/Excel report creation
│   │   │   └── database.py         # SQLite operations
│   │   ├── schemas/
│   │   │   └── models.py           # Pydantic request/response models
│   │   └── utils/
│   │       ├── irc_standards.py    # IRC 67/35 threshold data
│   │       └── image_utils.py      # Image preprocessing helpers
│   ├── weights/                    # Model weight files (.pt)
│   ├── data/
│   │   ├── sample_videos/          # Demo videos
│   │   └── training/               # Training datasets
│   ├── notebooks/
│   │   ├── 01_data_preparation.ipynb
│   │   ├── 02_yolo_training.ipynb
│   │   ├── 03_retro_model_training.ipynb
│   │   └── 04_evaluation.ipynb
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                       # Next.js app (fork from Rakshak-AI)
│   ├── app/
│   │   ├── page.tsx                # Landing / upload page
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Results dashboard with map
│   │   ├── analyze/
│   │   │   └── page.tsx            # Live analysis view
│   │   ├── reports/
│   │   │   └── page.tsx            # Report generation
│   │   └── api/
│   │       └── proxy/              # API proxy to backend
│   ├── components/
│   │   ├── video-upload.tsx        # Drag & drop uploader
│   │   ├── detection-overlay.tsx   # Bounding box overlay on video
│   │   ├── retro-gauge.tsx         # Retroreflectivity meter widget
│   │   ├── highway-map.tsx         # Leaflet map with asset pins
│   │   ├── condition-card.tsx      # Asset condition summary card
│   │   ├── compliance-badge.tsx    # IRC pass/fail badge
│   │   ├── weather-indicator.tsx   # Weather condition display
│   │   └── charts/
│   │       ├── retro-distribution.tsx
│   │       ├── condition-trend.tsx
│   │       └── asset-breakdown.tsx
│   ├── lib/
│   │   ├── api.ts                  # Backend API client
│   │   ├── types.ts                # TypeScript interfaces
│   │   └── irc-standards.ts        # IRC threshold constants
│   ├── public/
│   │   └── demo/                   # Demo screenshots/videos
│   ├── package.json
│   └── Dockerfile
│
├── PLAN.md                         # This file
└── README.md                       # Project overview (for submission)
```

---

## Implementation Phases

### Phase 1: Detection Pipeline (Day 1-2)
**Goal**: Detect traffic signs, markings, and road studs from video

- [ ] Set up FastAPI backend skeleton with upload endpoint
- [ ] Integrate YOLOv8 pretrained model (coco has stop signs, traffic lights)
- [ ] Fine-tune YOLOv8 on Indian traffic sign dataset (even 200-500 images)
- [ ] Add pavement marking detection (lane lines, edge markings)
- [ ] Frame extraction from uploaded video (1-5 fps sampling)
- [ ] Return annotated frames with bounding boxes + classes
- [ ] Test with sample dashcam footage from YouTube/own recording

### Phase 2: Retroreflectivity Estimation (Day 2-3)
**Goal**: Estimate retroreflectivity class for each detected asset

- [ ] Build training dataset:
  - Collect good/new sign images → label as HIGH retroreflectivity
  - Collect old/faded sign images → label as LOW retroreflectivity
  - Apply synthetic degradation to augment dataset
- [ ] Train EfficientNet-B0 classifier: HIGH / MEDIUM / LOW / FAILED
- [ ] For night images: implement brightness-based direct estimation
  - Extract sign ROI → compute mean luminance → map to RA value
- [ ] Add confidence scores to predictions
- [ ] Implement IRC 67/35 threshold checking
- [ ] Add weather/lighting classification (day/night/wet/fog)

### Phase 3: Frontend Dashboard (Day 3-4)
**Goal**: Beautiful, functional dashboard showing results

- [ ] Fork Rakshak-AI frontend, strip surveillance-specific parts
- [ ] Build upload page with drag-drop and webcam capture
- [ ] Build analysis page with video player + detection overlay
- [ ] Build results dashboard:
  - Summary stats cards (total scanned, pass/fail, avg score)
  - Interactive map with color-coded pins (Leaflet)
  - Filterable results table with thumbnails
  - Retroreflectivity distribution charts
- [ ] Build asset detail modal (zoomed image, scores, IRC compliance)
- [ ] Connect frontend to FastAPI backend via API routes

### Phase 4: Reports & Polish (Day 4-5)
**Goal**: Professional reports + demo-ready product

- [ ] PDF report generator (IRC compliance report format)
- [ ] Excel data export with all measurements
- [ ] Condition trend analysis (if multiple surveys uploaded)
- [ ] Maintenance priority scoring algorithm
- [ ] Record demo video with real dashcam footage
- [ ] Add sample/demo mode with pre-loaded results
- [ ] Performance optimization (batch processing, caching)
- [ ] Error handling, loading states, empty states

### Phase 5: Submission Prep (Day 5-6)
**Goal**: Winning submission package

- [ ] System overview document
- [ ] Concept note explaining the physics + ML approach
- [ ] Demo video (2-3 minutes) showing full workflow
- [ ] Presentation slides (10-12 slides)
- [ ] README with setup instructions
- [ ] Deploy frontend (Vercel) + backend (Railway/Render)

---

## Demo Strategy

For the hackathon demo, we need **impressive visual results**. Here's how:

1. **Pre-record dashcam footage** driving on a local highway (even 5-10 min is enough)
2. **Upload to RetroScan AI** → show real-time detection running
3. **Show the dashboard** with detected signs color-coded on a map
4. **Click into a specific sign** → show retroreflectivity estimation, condition score
5. **Generate a PDF report** → show professional IRC compliance report
6. **Compare day vs night** footage → show how the system adapts
7. **Show the "before/after"** — a manual process taking hours vs our 2-minute scan

### Demo Fallback
If detection model isn't perfect, use **pre-processed demo data** loaded into the dashboard to show the full workflow. The judges care about the concept + feasibility + presentation, not whether YOLOv8 catches every sign.

---

## Leveraging Rakshak-AI

What we reuse from the existing codebase:
- **Next.js project structure** and config
- **Radix UI component library** (buttons, dialogs, tables, etc.)
- **Chart components** (Recharts setup)
- **Video processing UI patterns** (upload, playback, overlay)
- **PDF/Excel export** (jsPDF, ExcelJS already integrated)
- **Dark/light theme** system
- **Authentication patterns** (if needed)

What we build new:
- Leaflet map integration
- Retroreflectivity-specific components (gauges, compliance badges)
- FastAPI backend (Python ML pipeline)
- All ML models and training

---

## Winning Edge — What Sets Us Apart

1. **No special hardware** — works with any camera, any phone, any dashcam
   (₹0 additional cost vs ₹15-30L for commercial retroreflectometers)

2. **Scalable to all of NHAI** — any field engineer with a phone can survey
   their section, upload footage, get results in minutes

3. **IRC-compliant reporting** — output matches what NHAI actually needs,
   mapped to IRC 67 and IRC 35 thresholds

4. **Works in all conditions** — weather-aware normalization for day/night,
   dry/wet, clear/foggy

5. **Actionable output** — not just "this sign is bad" but "this sign's
   retroreflectivity is below IRC minimum, priority: HIGH, estimated
   replacement cost: ₹X"

6. **Already partially built** — Rakshak-AI's dashboard and video pipeline
   give us a 2-day head start
