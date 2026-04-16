# RetroScan AI v2 — Advanced Implementation Plan

## Research Findings That Shape Our Approach

### Market Gap
- All existing solutions cost $12K-$100K+ (DELTA RetroSign, LTL-X, RoadVista 922)
- **No one has built a smartphone-camera-based retroreflectivity tool**
- Papers prove camera-based estimation is feasible (Mineta Transportation Institute, MDPI Sensors 2020)
- NHAI explicitly wants safer + faster alternatives to handheld measurement

### Our Edge
- **Zero hardware cost** — any phone camera works
- **Gemini 2.5 Flash Vision** — no existing solution uses multimodal LLM for sign assessment
- **Dual pipeline** — YOLO for fast detection + Gemini for deep analysis (unique approach)
- **PWA** — installable on any phone, works offline on remote highways

---

## Architecture v2: Dual-Brain Pipeline

```
                    ┌─────────────────────────────┐
                    │     INPUT (Phone/Dashcam)     │
                    └──────────────┬──────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────┐
│                   BRAIN 1: YOLO (Speed)                   │
│                                                           │
│  YOLOv11n — runs at 30+ FPS                              │
│  - Detects bounding boxes for signs, markings, studs     │
│  - Classifies asset type                                  │
│  - Provides real-time overlay                            │
│  - Works OFFLINE (model cached locally)                  │
└──────────────────────┬───────────────────────────────────┘
                       │ Cropped ROIs
                       ▼
┌──────────────────────────────────────────────────────────┐
│               BRAIN 2: GEMINI 2.5 Flash (Accuracy)        │
│                                                           │
│  For each detected ROI:                                   │
│  1. Retroreflectivity estimation (0-100 score)           │
│  2. Sign TEXT reading (OCR) — "Speed Limit 80"           │
│  3. Sign TYPE classification (regulatory/warning/info)    │
│  4. Sheeting type estimation (Type I/III/IX/XI)          │
│  5. Damage assessment (cracks, peeling, fading, dirt)    │
│  6. IRC 67/35 compliance check with SPECIFIC thresholds  │
│  7. Estimated age and remaining useful life              │
│  8. Maintenance recommendation                           │
│                                                           │
│  Also per-frame:                                          │
│  - Weather/lighting classification                        │
│  - Road condition context                                │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│              NEON POSTGRESQL DATABASE                      │
│                                                           │
│  - Full scan history with GPS coordinates                │
│  - All detections with Gemini analysis                   │
│  - Compliance tracking over time                         │
│  - Multi-user support                                    │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│           NEXT.js PWA FRONTEND                            │
│                                                           │
│  - Installable mobile app (PWA)                          │
│  - Live camera with YOLO overlay                         │
│  - Interactive Leaflet map with GPS-pinned results       │
│  - Professional IRC compliance reports (PDF/Excel)       │
│  - Analytics dashboard with degradation predictions      │
│  - Offline mode for remote highways                      │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure Upgrade
- [ ] Configure Neon PostgreSQL with Prisma ORM (replace SQLite)
- [ ] Set up Gemini 2.5 Flash with structured JSON output
- [ ] Create `.env` with all keys
- [ ] Update FastAPI to use async PostgreSQL

### Phase 2: Dual-Brain Detection Pipeline
- [ ] Keep YOLO for fast bounding-box detection (real-time overlay)
- [ ] Build Gemini Vision analyzer — single prompt that returns:
      - Asset type, sign text (OCR), sheeting type estimate
      - Retroreflectivity score + class + IRC compliance
      - Condition breakdown (fading, damage, dirt, legibility)
      - Maintenance recommendation + cost estimate
- [ ] Merge YOLO detections with Gemini analysis
- [ ] Add full-frame Gemini analysis mode (no YOLO needed — for when users just upload a photo)

### Phase 3: PWA Mobile App
- [ ] Add `manifest.json` for PWA installation
- [ ] Add service worker for offline caching
- [ ] Add `<meta>` tags for mobile (viewport, theme-color, apple-touch-icon)
- [ ] Camera capture component with rear camera + flash support
- [ ] GPS tagging via Geolocation API
- [ ] Offline queue — capture now, upload when connected

### Phase 4: Interactive Map + GPS
- [ ] Build Leaflet map component with OpenStreetMap tiles
- [ ] Plot detections as color-coded markers (green/yellow/red)
- [ ] Cluster markers for dense areas
- [ ] Click marker → show detection detail popup
- [ ] Route visualization (connect sequential detections)

### Phase 5: Advanced Analytics
- [ ] Degradation prediction — "this sign will fail IRC 67 by [date]"
- [ ] Highway segment scoring — color-code 1km segments by avg retro score
- [ ] Cost estimation dashboard — total replacement cost per stretch
- [ ] Before/after comparison view
- [ ] Export to KML/GeoJSON for Google Earth

### Phase 6: Testing with Real Data
- [ ] Download sample Indian highway images
- [ ] Process through full pipeline
- [ ] Verify Gemini analysis accuracy
- [ ] Test live webcam with actual signs
- [ ] Generate sample reports

---

## Gemini Prompt Strategy (The Secret Sauce)

Instead of generic "analyze this image", we use a **structured expert prompt** that makes
Gemini act as a certified retroreflectivity inspector:

```
You are a certified NHAI road safety inspector with 15 years of experience
in retroreflectivity measurement per IRC 67:2022 and IRC 35 standards.

Analyze this image of a road safety asset captured by a vehicle-mounted camera.

For EACH sign/marking/stud visible, provide:
1. DETECTION: exact location in image, asset type, sign text (OCR)
2. SHEETING: estimated sheeting type (I/III/IV/IX/XI) based on appearance
3. RETROREFLECTIVITY: score 0-100, estimated RA/RL value, IRC compliance
4. CONDITION: color fading %, surface damage %, dirt %, legibility %
5. MAINTENANCE: priority (1-5), recommendation, estimated cost (INR)
6. PREDICTION: estimated remaining useful life based on degradation curves

Return structured JSON.
```

This approach is **unique** — no existing product combines YOLO detection with LLM-powered
expert analysis. The dual-brain approach gives us both speed (YOLO) and depth (Gemini).
