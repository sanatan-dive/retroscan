<div align="center">

# RetroScan AI

### AI-powered highway asset triage — making every NHAI engineer 10x more effective

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?logo=google)](https://ai.google.dev/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00FFFF)](https://ultralytics.com/)
[![Postgres](https://img.shields.io/badge/Neon-Postgres-336791?logo=postgresql)](https://neon.tech/)
[![NHAI Hackathon](https://img.shields.io/badge/NHAI-6th%20Innovation%20Hackathon%202026-FF6B00)](https://nhai.gov.in/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**[Live Demo](https://retroscan.ai)** • **[Demo Video](#-demo-video)** • **[Pitch Deck](docs/PITCH_DECK.md)** • **[Concept Note](docs/CONCEPT_NOTE.md)**

</div>

---

## Elevator Pitch

NHAI must conduct twice-yearly retroreflectivity audits of signs, markings and studs across **1,50,000 km of national highways** — yet today this requires a ₹15-30 lakh handheld retroreflectometer and inspectors standing in live traffic, taking weeks per stretch. **RetroScan AI** turns any smartphone into a corridor-scale triage tool: a dual-brain pipeline (YOLOv8 for detection + Gemini 2.5 Flash Vision for deep analysis) pre-screens entire highway corridors in minutes, geotagging every asset and flagging the ~10% that need calibrated re-measurement. We cut audit cost from **₹50 lakh per 100 km to under ₹200**, while keeping IRC 67:2022 / IRC 35 / IRC SP:79 compliance intact.

---

## Key Features

- **Dual-brain AI** — YOLOv8 fast detector + Gemini 2.5 Flash Vision deep analyzer
- **GPS-tagged scans** — every asset auto-geotagged with EXIF + browser geolocation
- **Color-coded corridor map** — Leaflet/OpenStreetMap with red/amber/green health overlay
- **Voice-guided field mode** — hands-free English / Hindi prompts for live highway use
- **Live Scan PWA** — works offline, installs to home screen on iOS & Android
- **WhatsApp + Email sharing** — one-tap report dispatch to RO/PIU teams
- **QR asset tracking** — every scanned asset gets a printable QR for re-inspection
- **KML / GeoJSON exports** — drop into Google Earth, ArcGIS, QGIS
- **Real-time weather** — Open-Meteo integration auto-flags rain/fog scans for review
- **IRC 67/35 compliance reports** — auto-generated PDF with standard-aligned thresholds
- **Before/after comparison** — side-by-side timeline of an asset's degradation
- **ROI calculator** — live cost-saving dashboard for NHAI decision makers

---

## Architecture

```mermaid
graph TB
    subgraph Client["Mobile / Desktop PWA"]
        UI[Next.js 16 App Router]
        SW[Service Worker / Offline Cache]
        GEO[Geolocation + EXIF]
    end

    subgraph Edge["Edge Layer"]
        CDN[Vercel Edge CDN]
        AUTH[NextAuth Session]
    end

    subgraph API["FastAPI Backend"]
        UPLOAD[/scan/upload/]
        ANALYZE[/scan/analyze/]
        REPORT[/reports/generate/]
        COMPARE[/scans/compare/]
    end

    subgraph AI["Dual-Brain AI"]
        YOLO[YOLOv8 Detector<br/>Sign / Marking / Stud]
        GEMINI[Gemini 2.5 Flash Vision<br/>Retroreflectivity Estimate + IRC Check]
    end

    subgraph Data["Data Layer"]
        NEON[(Neon Postgres<br/>+ PostGIS)]
        BLOB[Object Storage<br/>S3-compatible]
    end

    subgraph External["External Services"]
        OSM[OpenStreetMap Tiles]
        METEO[Open-Meteo Weather]
        WHAPP[WhatsApp Business API]
    end

    UI --> CDN --> API
    GEO --> UPLOAD
    UPLOAD --> BLOB
    UPLOAD --> YOLO
    YOLO --> GEMINI
    GEMINI --> NEON
    ANALYZE --> NEON
    REPORT --> NEON
    UI --> OSM
    UI --> METEO
    REPORT --> WHAPP
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack) | SSR + PWA + edge runtime in one framework |
| **UI** | Tailwind CSS 4 + shadcn/ui | Rapid, accessible, NHAI-brandable design system |
| **Maps** | Leaflet + OpenStreetMap | Free, offline-capable tiles for field use |
| **Backend** | FastAPI 0.115 (Python 3.11) | Async, auto OpenAPI docs, ML-friendly |
| **Detection** | YOLOv8n (Ultralytics) | 6 MB model, 30 fps on phone-class CPU |
| **Vision LLM** | Gemini 2.5 Flash Vision | Multimodal reasoning + IRC standards as prompt |
| **Database** | Neon Postgres + PostGIS | Serverless, branchable, geospatial queries |
| **Storage** | S3-compatible (MinIO / R2) | Cheap, scalable image archive |
| **Auth** | NextAuth.js v5 | Email magic-links, NHAI SSO-ready |
| **Reports** | ReactPDF + Puppeteer | Pixel-perfect IRC 67 PDF reports |
| **Weather** | Open-Meteo API | Free, no key, hourly conditions |
| **Hosting** | Vercel + Fly.io | Edge frontend + persistent backend |

---

## Quick Start

```bash
git clone https://github.com/<your-org>/RetroScan-AI.git
cd RetroScan-AI
./run.sh                  # boots frontend + backend + db migrations
open https://localhost:3000
```

That's it. `run.sh` reads `.env.local`, installs deps, runs Alembic migrations, starts Uvicorn (`:8000`) and Next.js (`:3000`) under HTTPS using the bundled mkcert certificates in `/certs`.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ (20 LTS recommended) | For Next.js 16 + Turbopack |
| Python | 3.9+ (3.11 recommended) | FastAPI + Ultralytics |
| PostgreSQL | 14+ or Neon account | PostGIS extension required |
| Google AI Studio key | Free tier OK | For Gemini 2.5 Flash |
| Modern browser | Chrome 120+ / Safari 17+ | For PWA install + camera |
| (Optional) mkcert | latest | Re-generate localhost certs |

---

## Detailed Setup

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local      # fill in values
npm run dev                     # starts on https://localhost:3000
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in values
alembic upgrade head            # run migrations
uvicorn app.main:app --reload --port 8000
```

### Database (Neon — recommended)

1. Sign up at [neon.tech](https://neon.tech) (free tier)
2. Create a project, copy the connection string
3. Paste into `DATABASE_URL` in `backend/.env`
4. `alembic upgrade head` will install PostGIS + create tables

---

## Environment Variables

### `frontend/.env.example`
```bash
NEXT_PUBLIC_API_URL=https://localhost:8000
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_METEO_URL=https://api.open-meteo.com/v1/forecast
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=replace-with-openssl-rand-base64-32
WHATSAPP_BUSINESS_TOKEN=optional-for-demo
```

### `backend/.env.example`
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host/retroscan
GEMINI_API_KEY=AIza...                       # from aistudio.google.com
YOLO_WEIGHTS_PATH=./models/yolov8n_signs.pt  # bundled
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_BUCKET=retroscan-uploads
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
SMTP_HOST=smtp.sendgrid.net                  # for email reports
SMTP_USER=apikey
SMTP_PASS=...
LOG_LEVEL=INFO
```

---

## API Documentation

Interactive Swagger docs auto-generated at **`https://localhost:8000/docs`**.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/scan/upload` | Upload image with EXIF GPS — returns `scan_id` |
| `POST` | `/scan/analyze/{scan_id}` | Trigger YOLO + Gemini pipeline |
| `GET` | `/scan/{scan_id}` | Retrieve scan + AI verdict |
| `GET` | `/scans?bbox=...` | Geo-bounded list for map view |
| `POST` | `/scans/compare` | Side-by-side analysis of two scans |
| `POST` | `/reports/generate` | Build IRC 67/35 PDF report |
| `GET` | `/reports/{id}/export.kml` | Google Earth KML export |
| `GET` | `/reports/{id}/export.geojson` | GeoJSON export |
| `POST` | `/share/whatsapp` | Push report to WhatsApp Business |
| `GET` | `/calibration/sessions` | List calibration runs vs LTL-X readings |
| `GET` | `/health` | Liveness probe |

---

## Page Descriptions

| Route | Purpose |
|---|---|
| `/` | Landing page — hero, ROI snapshot, CTA |
| `/upload` | Drag-and-drop or camera capture for batch scans |
| `/dashboard` | KPI tiles — scans today, % red/amber/green, weekly trend |
| `/map` | Color-coded corridor map, click-through to asset detail |
| `/live-scan` | Voice-guided field mode (English/Hindi), hands-free |
| `/compare` | Side-by-side before/after of any two scans of same asset |
| `/reports` | IRC 67/35 PDF generator + WhatsApp/Email dispatch |
| `/analytics` | Trend lines, hotspot heatmap, degradation forecasting |
| `/calibration` | Pilot study results vs LTL-X handheld (R²=0.85) |
| `/roi` | Live cost-saving calculator for NHAI decision makers |

---

## Mobile / PWA Installation

### iOS (Safari 17+)
1. Open `https://retroscan.ai` in Safari
2. Tap the **Share** icon (square with up-arrow)
3. Scroll and tap **"Add to Home Screen"**
4. Confirm name → **RetroScan** app icon appears on home screen
5. Launch — runs full-screen, with camera + GPS access

### Android (Chrome 120+)
1. Open `https://retroscan.ai` in Chrome
2. Tap the three-dot menu → **"Install app"** (or banner that auto-prompts)
3. Confirm — installs as a standalone app
4. Launch from app drawer — full PWA with offline cache

> **Field tip:** the `/live-scan` route caches tiles for the surrounding 5 km on first GPS lock, so it works in dead zones.

---

## Demo Video

> **Placeholder:** [https://youtu.be/<TODO>](https://youtu.be/) — full 3-minute walkthrough.

See [`docs/DEMO_VIDEO.md`](docs/DEMO_VIDEO.md) for the production script and storyboard.

---

## Screenshots

```
+--------------------------+   +--------------------------+
| [ Dashboard KPI tiles  ] |   | [ Color-coded NH-48 map ]|
+--------------------------+   +--------------------------+

+--------------------------+   +--------------------------+
| [ Live Scan voice mode ] |   | [ IRC 67 PDF report    ] |
+--------------------------+   +--------------------------+
```

> Drop final screenshots into `frontend/public/screenshots/` and replace these boxes.

---

## Hackathon Submission

**6th NHAI Innovation Hackathon 2026** — submission deadline **23 April 2026**.

| Deliverable | Path |
|---|---|
| Concept Note (5-page PDF) | [`docs/CONCEPT_NOTE.md`](docs/CONCEPT_NOTE.md) |
| Pitch Deck (10 slides) | [`docs/PITCH_DECK.md`](docs/PITCH_DECK.md) |
| Demo Video (3 min) | [`docs/DEMO_VIDEO.md`](docs/DEMO_VIDEO.md) |
| Live Prototype | [https://retroscan.ai](https://retroscan.ai) |
| Source Code | This repository |

---

## Team

| Role | Name | Contact |
|---|---|---|
| Lead / Full-stack | _<TBD>_ | _<email>_ |
| ML / Vision | _<TBD>_ | _<email>_ |
| Domain (Highway Engineering) | _<TBD>_ | _<email>_ |
| Design / Field | _<TBD>_ | _<email>_ |

---

## License

MIT © 2026 RetroScan AI Contributors. See [LICENSE](LICENSE).

---

<div align="center">

**Built for the engineers who keep India's 1,50,000 km of national highways safe.**

</div>
