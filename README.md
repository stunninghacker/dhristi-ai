# Dhristi AI-Based Satellite Intelligence System

Browser-native satellite change detection — no server, no ML dependencies, purely Canvas 2D pixel analysis.

[![Vercel Deployment](https://img.shields.io/badge/Live%20Demo-dhristi--ai.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://dhristi-ai.vercel.app)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

> **🚨 IMPORTANT DISCLAIMER**
>
> This tool performs automated change detection on satellite or aerial imagery using purely browser-based pixel analysis. It does **not** use machine learning, GPU inference, or server-side processing. All analysis is approximate and intended as a **first-pass triage aid** only.
>
> **Do not** rely solely on this tool for operational, legal, safety-critical, or defense decision-making. Always verify findings with qualified analysts and authoritative sources.
>
> The system does not connect to any external service — all data stays in your browser.

---

## Features

| Capability | Description |
|---|---|
| **Dual detection pipeline** | SSIM-driven dispatch: global RGB difference (low similarity) or localized multi-layer hotspot detection (high similarity) |
| **Automatic registration** | Coarse-to-fine translational alignment corrects camera/sensor shift before comparison |
| **6 Analysis profiles** | Defence, Urban, Environment, Disaster, Agriculture, Water — each with tuned metrics and color coding |
| **Reliability tiering** | Output automatically classified as VERIFIED / REVIEW / PRELIMINARY based on SSIM, alignment, confidence, and scene comparability |
| **Change classification** | Review regions auto-labelled as Structure / Vegetation / Water / Urban Expansion based on spectral-spatial characteristics |
| **Geo-referencing** | Optional lat/lng corner input converts pixel detections to approximate geographic coordinates |
| **Secure Mode** | Toggle ON to activate classification marking (UNCLASSIFIED/RESTRICTED/CONFIDENTIAL), offline banner, and PDF/PNG watermarking |
| **Alert generation** | Severity-banded alerts (CRITICAL/WARNING/INFO) surface high-confidence detections and anomalous scene changes |
| **Analyst review** | Per-region decision log with visual flag detection, MGRS-style grid references, and priority sorting |
| **Export formats** | CSV detection log, annotated PNG map, structured JSON report, formal PDF report — all downloadable client-side |
| **Audit trail** | Session-level audit log persisted in sessionStorage with timestamps for every user action |
| **Scene quality checks** | Cloud detection, haze estimation, brightness/contrast delta analysis with inline warnings |
| **Image normalization** | Optional histogram alignment for multi-sensor pairs before difference computation |

## Project Structure

```
src/
├── App.tsx                        # Main application shell, state, layout
├── engine.ts                      # Core detection pipeline (canvas-based)
├── types/index.ts                 # TypeScript types & interfaces
├── profiles.ts                    # Profile definitions & weights
├── geospatial.ts                  # Geo metadata extraction
├── components/
│   ├── Sidebar.tsx                # Collapsible parameters panel
│   ├── UploadZone.tsx             # File upload area
│   ├── DetectionTable.tsx         # Review regions table with filters
│   ├── ImageViewer.tsx            # Image display & comparison
│   ├── ExportSection.tsx          # CSV/JSON/PDF/PNG export
│   ├── AuditLogPanel.tsx          # Audit trail viewer
│   └── ...                        # Additional panels & cards
├── utils/
│   ├── geoBounds.ts               # Coordinate parsing & conversion
│   ├── qualityCheck.ts            # Cloud/haze detection
│   ├── auditLog.ts                # Session audit storage
│   └── ...
└── public/
```

## Quickstart

```bash
npm install
npm run dev
```

Open the local URL, upload **T1 (baseline)** and **T2 (recent)** images (PNG/JPG/TIFF), or enable demo images, then click **Run Analysis**.

## Analysis Profiles

| Profile | Best for |
|---|---|
| **Defence** | Military installations, strategic assets, restricted zones |
| **Urban** | Construction sites, infrastructure changes, building footprints |
| **Environment** | Vegetation loss, coastal erosion, land degradation |
| **Disaster** | Flood mapping, earthquake damage, fire scar assessment |
| **Agriculture** | Crop rotation, irrigation changes, field boundary shifts |
| **Water** | Reservoir levels, river course changes, shoreline retreat |

Each profile applies specific weightings to change magnitude, compactness, area, mean delta, and aspect ratio during scoring.

## How It Works

1. **Registration** — coarse-to-fine translational alignment finds the best offset between T1 and T2 using cross-correlation
2. **SSIM dispatch** — Structural Similarity Index determines which pipeline to run:
   - **SSIM < 0.5**: Global RGB difference surface with adaptive thresholding
   - **SSIM ≥ 0.5**: Localized multi-layer hotspot detection (3×3 sliding window on intensity/edge/texture channels)
3. **Region extraction** — morphological cleaning + connected-component labeling isolates candidate change regions
4. **Profile scoring** — each region scored against the selected profile's weight matrix
5. **Classification** — regions automatically tagged by object type using spectral-spatial heuristics
6. **Tier assignment** — SSIM, alignment, confidence, and scene comparability determine VERIFIED / REVIEW / PRELIMINARY tier

## Accuracy & Limitations

- Automated pixel-based change detection **cannot achieve 100% accuracy** without ground truth
- Registration is translational only (no full homography or terrain correction)
- Accuracy degrades with cloud cover, seasonal variation, and different sensor types
- Pixel grid references are **review aids only**, not survey-grade coordinates
- Always treat **PRELIMINARY** results as indicative — analyst sign-off required
- **VERIFIED** tier indicates strong image pair quality, not absence of change

## Build

```bash
npm run build      # production build to dist/
npm run preview    # preview production build locally
```

## Tech Stack

React 19 · TypeScript · Vite · Canvas 2D API · jsPDF

No server, no external ML APIs, no GPU required. Runs fully offline.

## License

MIT
