# 🛰️ Drishti AI

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-97%25-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Live](https://img.shields.io/badge/Live-Vercel-black?logo=vercel)

> Browser-native satellite change detection.
> No server. No ML dependencies. Zero data egress.

## 🌐 Live Demo
[https://dhristi-ai.vercel.app](https://dhristi-ai.vercel.app)

## What it does
- Compares before/after satellite imagery using Canvas 2D CV pipeline
- Detects structural, vegetation, water, and urban change regions
- Exports analysis reports as CSV / JSON / PDF with audit trail

## How it works
T1 → Normalize → Register → SSIM Score
├── SSIM < 0.5 → Global RGB Difference Mode
└── SSIM ≥ 0.5 → Localized Hotspot Detection Mode
         ↓
Region Scoring → False Positive Filter → Export

## Quick Start
```bash
npm install
npm run dev
```

## Analysis Profiles
| Profile | Use Case | Sensitivity |
|---|---|---|
| Defence/Security | Infrastructure, objects | High |
| Urban Planning | Buildings, roads | Medium |
| Environment | Vegetation, water | Medium |
| Disaster Response | Rapid damage | Very High |
| Agriculture | Crop change | Low |
| Water Bodies | Flood, drought | Medium |

## Features
- Dual CV pipeline (SSIM-routed)
- Cloud/haze detection with warnings
- Histogram equalization normalization
- Translational image registration
- Coordinate system (lat/lng input)
- Secure mode with classification labels
- Audit log with session persistence
- Evidence export (CSV/JSON/PDF)

## Roadmap
- [ ] Multi-temporal stack analysis
- [ ] Continuous monitoring mode
- [ ] REST API for batch processing
- [ ] Ground truth validation upload
- [ ] Real-time alert webhooks

## License
MIT © 2026 stunninghacker
