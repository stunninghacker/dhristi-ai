Browser-based satellite image pair analysis: profile-aware change detection, calibrated confidence, annotated outputs, and exportable reports — no server required.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL, upload **T1 (baseline)** and **T2 (recent)** PNG/JPG/TIFF, or enable **demo images**, then click **Run Analysis**.

## What it does

| Capability | Description |
|------------|-------------|
| **Dual pipeline** | Low SSIM (&lt;0.5) → global RGB difference mode; higher SSIM → localized multi-layer hotspot detection |
| **Registration** | Coarse-to-fine translational shift on T2 before differencing |
| **Profiles** | Defence, Urban, Environment, Disaster, Agriculture, Water — weighted scoring |
| **Reliability tier** | VERIFIED / REVIEW / PRELIMINARY from SSIM, alignment, and confidence |
| **Outputs** | Annotated map, turbo heatmap, detection log, CSV / JSON / PDF |

## Accuracy & limitations

Automated change detection **cannot be 100% accurate** without labeled ground truth and survey-grade georeferencing. This system is designed for **high-quality first-pass triage**:

- Translational registration (not full homography)
- Pixel grid references are **review aids**, not survey coordinates
- Always treat **PRELIMINARY** tier results as indicative
- **VERIFIED** tier means strong pair quality — analyst sign-off still required

For best results: same sensor/resolution, overlapping footprint, minimal cloud, and similar sun angle when possible.

## Build

```bash
npm run build    # single-file dist for offline demo
npm run preview
```

## Tech stack

React 19 · TypeScript · Vite · Canvas 2D CV pipeline (no ML server)

## License
