import { estimateTranslationShift, shiftCanvas } from "./alignment";
import { mergeOverlappingDetections, mergeProximateDetections } from "./detectionMerge";
import { applyGeoMetadata, isTiffFile, renderTiffToCanvas } from "./geospatial";
import { PROFILES } from "./profiles";
import { isVisualFlagRegion, VISUAL_FLAG_SCORE_THRESHOLD } from "./utils/preliminary";
import type {
  Detection,
  AnalysisResult,
  ProfileKey,
  ProfileConfig,
  Priority,
  OverallPriority,
  AnalysisMode,
  ReliabilityTier,
  ReliabilityLevel,
  SceneComparability,
  GeoReferencePair,
} from "./types";

export function imgToURL(src: any): string {
  if (typeof src === "string") return src;
  if (!src) return "";
  if (src instanceof HTMLCanvasElement) return src.toDataURL("image/jpeg", 0.92);
  const c = document.createElement("canvas");
  c.width = src.width ?? src.shape?.[1] ?? 640;
  c.height = src.height ?? src.shape?.[0] ?? 480;
  const ctx = c.getContext("2d")!;
  if (src instanceof ImageData) ctx.putImageData(src, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

export function toDataURL(source: ImageData | HTMLCanvasElement | string): string {
  return imgToURL(source);
}

// ─── Canvas helpers ────────────────────────────────────────────────────────────

export function loadImageFromFile(file: File): Promise<HTMLImageElement | HTMLCanvasElement> {
  if (isTiffFile(file)) return renderTiffToCanvas(file);

  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { res(img); URL.revokeObjectURL(url); };
    img.onerror = rej;
    img.src = url;
  });
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function getPixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
}



export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return toDataURL(canvas);
}

export function imageDataToDataURL(imgData: ImageData): string {
  return toDataURL(imgData);
}

// ─── Math helpers ──────────────────────────────────────────────────────────────

export async function exportZoneCrop(
  annotatedDataUrl: string,
  detection: Detection,
  note: string,
  timestamp: string
): Promise<void> {
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load annotated image for zone export."));
    img.src = annotatedDataUrl;
  });

  const pad = 40;
  const [x, y, w, h] = detection.bbox;
  const cropX = Math.max(0, x - pad);
  const cropY = Math.max(0, y - pad);
  const cropW = w + pad * 2;
  const cropH = h + pad * 2 + 80;

  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, 0, cropW, cropH);

  ctx.drawImage(img, cropX, cropY, cropW, h + pad * 2, 0, 0, cropW, h + pad * 2);

  ctx.fillStyle = "#0d1f35";
  ctx.fillRect(0, h + pad * 2, cropW, 80);
  ctx.strokeStyle = "#1e4870";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, h + pad * 2, cropW, 80);

  const isPreliminaryCrop = detection.priority === "REVIEW" || detection.priority === "PRELIMINARY";
  ctx.fillStyle = "#3ab5ff";
  ctx.font = "bold 12px monospace";
  ctx.fillText(isPreliminaryCrop ? `Review region #${detection.id} | Score: ${detection.score}` : `Zone #${detection.id} | ${detection.priority} | Score: ${detection.score}`, 8, h + pad * 2 + 18);
  ctx.fillStyle = "#9ab0c5";
  ctx.font = "11px monospace";
  ctx.fillText(`Grid: ${detection.gridRef} | ${timestamp}`, 8, h + pad * 2 + 36);
  ctx.fillStyle = "#e0f0ff";
  ctx.font = "11px sans-serif";

  const words = note.split(" ");
  let line = "";
  let lineY = h + pad * 2 + 54;
  words.forEach(word => {
    const test = line + word + " ";
    if (ctx.measureText(test).width > cropW - 16) {
      ctx.fillText(line, 8, lineY);
      line = word + " ";
      lineY += 16;
    } else {
      line = test;
    }
  });
  ctx.fillText(line, 8, lineY);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `zone_${detection.id}_${detection.gridRef.replace(" ", "_")}.png`;
  a.click();
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const VERY_LOW_SIMILARITY_WARNING =
  "Very low scene comparability; review regions are preliminary visual review regions only.";

const PRELIMINARY_VISIBLE_REGION_LIMIT = 12;

interface ReliabilityGate {
  reliability: ReliabilityLevel;
  sceneComparability: SceneComparability;
  confidenceCap: number | null;
  reliabilityGateApplied: boolean;
  scoringNote: string;
  manualVerificationRequired: boolean;
}

function getReliabilityGate(ssim: number): ReliabilityGate {
  if (ssim < 0.20) {
    return {
      reliability: "PRELIMINARY",
      sceneComparability: "VERY LOW",
      confidenceCap: 55,
      reliabilityGateApplied: true,
      scoringNote: VERY_LOW_SIMILARITY_WARNING,
      manualVerificationRequired: true,
    };
  }

  if (ssim < 0.35) {
    return {
      reliability: "LOW",
      sceneComparability: "LOW",
      confidenceCap: 65,
      reliabilityGateApplied: true,
      scoringNote: "Low image similarity. Detections are low-confidence review regions until registration and image-pair comparability are verified.",
      manualVerificationRequired: true,
    };
  }

  if (ssim < 0.60) {
    return {
      reliability: "MODERATE",
      sceneComparability: "MODERATE",
      confidenceCap: 80,
      reliabilityGateApplied: true,
      scoringNote: "Moderate image similarity. Medium-priority triage is supported; high priority requires strong alignment, compactness, and localized evidence.",
      manualVerificationRequired: false,
    };
  }

  return {
    reliability: "GOOD",
    sceneComparability: "GOOD",
    confidenceCap: null,
    reliabilityGateApplied: false,
    scoringNote: "Image similarity supports normal profile-aware scoring.",
    manualVerificationRequired: false,
  };
}

function reviewTypeForGate(
  detection: Detection,
  gate: ReliabilityGate,
  index: number,
): string {
  if (gate.sceneComparability === "VERY LOW") {
    const preliminaryTypes = [
      "preliminary review region",
      "localized visual difference",
      "low-confidence review region",
    ];
    return preliminaryTypes[index % preliminaryTypes.length];
  }

  if (gate.sceneComparability === "LOW") {
    return detection.score >= 72 ? "localized visual difference" : "low-confidence review region";
  }

  return detection.type;
}

function gateDetectionPriority(
  detection: Detection,
  gate: ReliabilityGate,
  confidence: number,
  alignmentScore: number,
  changedAreaPct: number,
  frameArea: number,
): Priority {
  void gate;
  void alignmentScore;
  void changedAreaPct;
  void frameArea;
  return priorityFromScore(detection.score, confidence);
}

function gaussianKernel(sigma: number): number[] {
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v); s += v;
  }
  return k.map(v => v / s);
}

function separableGaussian(data: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const kernel = gaussianKernel(sigma);
  const r = Math.floor(kernel.length / 2);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ki = 0; ki < kernel.length; ki++) {
        const xi = clamp(x + ki - r, 0, w - 1);
        s += data[y * w + xi] * kernel[ki];
      }
      tmp[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ki = 0; ki < kernel.length; ki++) {
        const yi = clamp(y + ki - r, 0, h - 1);
        s += tmp[yi * w + x] * kernel[ki];
      }
      out[y * w + x] = s;
    }
  }
  return out;
}

function sobelMagnitude(gray: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
        - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
        - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
        + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
      mag[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

function percentile(arr: Float32Array, p: number): number {
  const sorted = Float32Array.from(arr).sort();
  const idx = clamp(Math.floor((p / 100) * sorted.length), 0, sorted.length - 1);
  return sorted[idx];
}

function normalizeScore(arr: Float32Array): Float32Array {
  const lo = percentile(arr, 2);
  const hi = percentile(arr, 98);
  if (hi <= lo) return new Float32Array(arr.length);
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = clamp((arr[i] - lo) / (hi - lo), 0, 1);
  return out;
}

// ─── Color space ───────────────────────────────────────────────────────────────

function rgbToGray(pixels: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }
  return g;
}

// Simple CLAHE approximation using local contrast normalization
function localContrastNorm(gray: Float32Array, w: number, h: number): Float32Array {
  const sigma = 17;
  const localMean = separableGaussian(gray, w, h, sigma);
  const diff = gray.map((v, i) => v - localMean[i]);
  const sq = diff.map(v => v * v);
  const localVar = separableGaussian(sq as Float32Array, w, h, sigma);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const z = diff[i] / (Math.sqrt(localVar[i]) + 8.0);
    out[i] = clamp(z, -3, 3);
  }
  return out;
}


// ─── Morphological operations (binary Uint8Array) ─────────────────────────────

function dilate(mask: Uint8Array, w: number, h: number, ksize: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  const r = Math.floor(ksize / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hit = false;
      for (let ky = -r; ky <= r && !hit; ky++) {
        for (let kx = -r; kx <= r && !hit; kx++) {
          const ny = y + ky, nx = x + kx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && mask[ny * w + nx]) hit = true;
        }
      }
      out[y * w + x] = hit ? 1 : 0;
    }
  }
  return out;
}

function erode(mask: Uint8Array, w: number, h: number, ksize: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  const r = Math.floor(ksize / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let allSet = true;
      for (let ky = -r; ky <= r && allSet; ky++) {
        for (let kx = -r; kx <= r && allSet; kx++) {
          const ny = y + ky, nx = x + kx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w || !mask[ny * w + nx]) allSet = false;
        }
      }
      out[y * w + x] = allSet ? 1 : 0;
    }
  }
  return out;
}

function morphClose(mask: Uint8Array, w: number, h: number, ksize: number): Uint8Array {
  return erode(dilate(mask, w, h, ksize), w, h, ksize);
}

function morphOpen(mask: Uint8Array, w: number, h: number, ksize: number): Uint8Array {
  return dilate(erode(mask, w, h, ksize), w, h, ksize);
}

// ─── Low-SSIM raw diff pipeline (LAB L-channel) ──────────────────────────────

function buildLowSsimSurface(
  p1: Uint8ClampedArray,
  p2norm: Uint8ClampedArray,
  w: number,
  h: number
): { surface: Float32Array; mask: Uint8Array } {
  const len = w * h;

  // Step 1: improved diff calculation (RGB absolute diff, not LAB only)
  const diff = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const r1 = p1[i * 4], g1 = p1[i * 4 + 1], b1 = p1[i * 4 + 2];
    const r2 = p2norm[i * 4], g2 = p2norm[i * 4 + 1], b2 = p2norm[i * 4 + 2];
    const rDiff = Math.abs(r1 - r2);
    const gDiff = Math.abs(g1 - g2);
    const bDiff = Math.abs(b1 - b2);
    diff[i] = 0.4 * rDiff + 0.4 * gDiff + 0.2 * bDiff;
  }

  // Step 2: percentile threshold (global diff mode — pct 80)
  const thr = percentile(diff, 80);

  const rawMask = new Uint8Array(len);
  for (let i = 0; i < len; i++) rawMask[i] = diff[i] >= thr ? 1 : 0;

  // Step 3: morphological close 9x9 then open 5x5
  const closedMask = morphClose(rawMask, w, h, 9);
  const openedMask = morphOpen(closedMask, w, h, 5);

  // Step 4: filter by component area: min 150px, max 20% of frame
  const maxArea = 0.20 * len;
  const regions = findConnectedRegions(openedMask, w, h, 150);
  const finalMask = new Uint8Array(len);
  for (const reg of regions) {
    if (reg.pixels.length > maxArea) continue;
    for (const idx of reg.pixels) finalMask[idx] = 1;
  }

  // Normalise diff to 0-1 for the surface (so downstream scoring works)
  const maxDiff = diff.reduce((m, v) => Math.max(m, v), 1);
  const surface = new Float32Array(len);
  for (let i = 0; i < len; i++) surface[i] = clamp(diff[i] / maxDiff, 0, 1);

  return { surface, mask: finalMask };
}

// Match src channel stats to ref (removes global lighting/sensor bias)
function matchColorStats(src: Uint8ClampedArray, ref: Uint8ClampedArray, len: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let c = 0; c < 3; c++) {
    let sm = 0, rm = 0;
    for (let i = 0; i < len; i++) { sm += src[i * 4 + c]; rm += ref[i * 4 + c]; }
    sm /= len; rm /= len;
    let sv = 0, rv = 0;
    for (let i = 0; i < len; i++) { sv += (src[i * 4 + c] - sm) ** 2; rv += (ref[i * 4 + c] - rm) ** 2; }
    sv = Math.sqrt(sv / len) + 1e-6;
    rv = Math.sqrt(rv / len);
    for (let i = 0; i < len; i++) {
      out[i * 4 + c] = clamp(Math.round((src[i * 4 + c] - sm) * (rv / sv) + rm), 0, 255);
    }
  }
  // Copy alpha
  for (let i = 0; i < len; i++) out[i * 4 + 3] = 255;
  return out;
}

// SSIM approximation
function computeSSIM(g1: Float32Array, g2: Float32Array, w: number, h: number): number {
  const sigma = 5;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;

  const mu1 = separableGaussian(g1, w, h, sigma);
  const mu2 = separableGaussian(g2, w, h, sigma);
  const sq1 = separableGaussian(g1.map((v, i) => v * g1[i]) as Float32Array, w, h, sigma);
  const sq2 = separableGaussian(g2.map((v, i) => v * g2[i]) as Float32Array, w, h, sigma);
  const sq12 = separableGaussian(g1.map((v, i) => v * g2[i]) as Float32Array, w, h, sigma);

  let total = 0;
  for (let i = 0; i < w * h; i++) {
    const var1 = sq1[i] - mu1[i] * mu1[i];
    const var2 = sq2[i] - mu2[i] * mu2[i];
    const cov = sq12[i] - mu1[i] * mu2[i];
    const num = (2 * mu1[i] * mu2[i] + c1) * (2 * cov + c2);
    const den = (mu1[i] * mu1[i] + mu2[i] * mu2[i] + c1) * (var1 + var2 + c2);
    total += num / (den || 1);
  }
  return clamp(total / (w * h), -1, 1);
}

// ─── Vegetation & water proxies ────────────────────────────────────────────────

function vegetationIndex(pixels: Uint8ClampedArray, len: number): Float32Array {
  const exg = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
    exg[i] = 2 * g - r - b;
  }
  return normalizeScore(exg);
}

function waterIndex(pixels: Uint8ClampedArray, len: number): Float32Array {
  const proxy = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
    proxy[i] = (b + 0.7 * g) - 1.15 * r;
  }
  return normalizeScore(proxy);
}

// ─── Change surface ────────────────────────────────────────────────────────────

function buildChangeSurface(
  p1: Uint8ClampedArray,
  p2norm: Uint8ClampedArray,
  w: number,
  h: number,
  profile: ProfileKey,
  ssim: number
): { surface: Float32Array; spectral: Float32Array; structural: Float32Array; edge: Float32Array; special: Float32Array } {
  const cfg = PROFILES[profile];
  const len = w * h;

  const g1 = rgbToGray(p1, w, h);
  const g2 = rgbToGray(p2norm, w, h);

  const z1 = localContrastNorm(g1, w, h);
  const z2 = localContrastNorm(g2, w, h);

  const g1s = separableGaussian(z1, w, h, 2.5);
  const g2s = separableGaussian(z2, w, h, 2.5);
  const structural = new Float32Array(len);
  for (let i = 0; i < len; i++) structural[i] = clamp(Math.abs(g1s[i] - g2s[i]) / 3.0, 0, 1);

  const mag1 = sobelMagnitude(z1, w, h);
  const mag2 = sobelMagnitude(z2, w, h);
  const edge = new Float32Array(len);
  for (let i = 0; i < len; i++) edge[i] = clamp(Math.abs(mag1[i] - mag2[i]) / 2.5, 0, 1);

  // LAB-like chroma difference (simplified using opponent channels)
  const spectral = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const r1 = p1[i * 4], g1v = p1[i * 4 + 1], b1 = p1[i * 4 + 2];
    const r2 = p2norm[i * 4], g2v = p2norm[i * 4 + 1], b2 = p2norm[i * 4 + 2];
    const a1 = r1 - g1v, b1op = 0.5 * r1 + 0.5 * g1v - b1;
    const a2 = r2 - g2v, b2op = 0.5 * r2 + 0.5 * g2v - b2;
    spectral[i] = clamp(Math.sqrt((a1 - a2) ** 2 + (b1op - b2op) ** 2) / 45.0, 0, 1);
  }

  const veg1 = vegetationIndex(p1, len);
  const veg2 = vegetationIndex(p2norm, len);
  const wat1 = waterIndex(p1, len);
  const wat2 = waterIndex(p2norm, len);

  const special = new Float32Array(len);
  if (profile === "Agriculture / vegetation") {
    for (let i = 0; i < len; i++) special[i] = clamp(Math.abs(veg1[i] - veg2[i]) * 3.0, 0, 1);
  } else if (profile === "Water-body change") {
    for (let i = 0; i < len; i++) special[i] = clamp(Math.abs(wat1[i] - wat2[i]) * 3.0, 0, 1);
  } else if (profile === "Environmental monitoring" || profile === "Disaster assessment") {
    for (let i = 0; i < len; i++) special[i] = clamp(Math.max(Math.abs(veg1[i] - veg2[i]), Math.abs(wat1[i] - wat2[i])) * 2.2, 0, 1);
  }

  const raw = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    raw[i] = clamp(
      cfg.spectralWeight * 0.28 * spectral[i] +
      cfg.structuralWeight * 0.38 * structural[i] +
      cfg.edgeWeight * 0.26 * edge[i] +
      0.18 * special[i],
      0, 1
    );
  }

  const surface = new Float32Array(len);
  for (let i = 0; i < len; i++) surface[i] = raw[i];
  if (ssim >= 0.5) {
    const broad = separableGaussian(raw, w, h, 31);
    for (let i = 0; i < len; i++) surface[i] = clamp(raw[i] - 0.72 * broad[i], 0, 1);
  }

  return { surface, spectral, structural, edge, special };
}

// ─── Binary mask ───────────────────────────────────────────────────────────────

function thresholdSurface(surface: Float32Array, sensitivity: number, profile: ProfileKey, ssim: number): Uint8Array {
  const cfg = PROFILES[profile];
  const sensitivityFactor = (sensitivity - 50) / 50.0;
  let baseThr = 0.24 - 0.055 * sensitivityFactor;

  if (profile === "Defence / Security") baseThr += 0.015;
  else if (profile === "Environmental monitoring" || profile === "Agriculture / vegetation" || profile === "Water-body change") baseThr -= 0.015;

  const pct = ssim < 0.5 ? 80 : 94;
  const pVal = percentile(surface, pct);
  let thr = Math.max(baseThr, pVal * 0.72);

  let mask = new Uint8Array(surface.length);
  for (let i = 0; i < surface.length; i++) mask[i] = surface[i] >= thr ? 1 : 0;

  const filled = mask.reduce((s, v) => s + v, 0) / surface.length * 100;
  if (ssim >= 0.5 && filled > 10) {
    const p995 = percentile(surface, 99.55);
    thr = Math.max(p995, thr + 0.06);
    for (let i = 0; i < surface.length; i++) mask[i] = surface[i] >= thr ? 1 : 0;
  }

  return mask;
}

// ─── Connected components (simple flood-fill BFS) ─────────────────────────────

interface Region {
  pixels: number[];
  bbox: [number, number, number, number]; // x,y,w,h
}

function findConnectedRegions(mask: Uint8Array, w: number, h: number, minArea: number): Region[] {
  const visited = new Uint8Array(mask.length);
  const regions: Region[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    const pixels: number[] = [];
    let minX = w, maxX = 0, minY = h, maxY = 0;

    while (queue.length) {
      const idx = queue.pop()!;
      pixels.push(idx);
      const x = idx % w, y = Math.floor(idx / w);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;

      const neighbors = [idx - 1, idx + 1, idx - w, idx + w, idx - w - 1, idx - w + 1, idx + w - 1, idx + w + 1];
      for (const n of neighbors) {
        if (n >= 0 && n < mask.length && mask[n] && !visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
    if (pixels.length >= minArea) {
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      regions.push({ pixels, bbox: [minX, minY, bw, bh] });
    }
  }
  return regions;
}

// ─── Priority / classification ─────────────────────────────────────────────────

function priorityFromScore(score: number, _confidence: number): Priority {
  if (score >= 60) return "HIGH";
  if (score >= 38) return "MEDIUM";
  if (score >= 18) return "LOW";
  return "LOW";
}

function classifyDetection(profile: ProfileKey, meanSpecial: number, meanEdge: number, area: number, compactness: number): string {
  if (profile === "Defence / Security") {
    if (compactness > 0.45 && area < 4500) return "compact activity review zone";
    if (meanEdge > 0.45) return "structural / infrastructure review zone";
    return "activity / terrain change candidate";
  }
  if (profile === "Urban development") {
    if (meanEdge > 0.35) return "built-up / infrastructure change zone";
    return "urban expansion review zone";
  }
  if (profile === "Environmental monitoring") {
    if (meanSpecial > 0.30) return "vegetation / water / land-cover change";
    return "land-cover change zone";
  }
  if (profile === "Disaster assessment") {
    if (area > 3500) return "large disturbance / damage review zone";
    return "localized damage review zone";
  }
  if (profile === "Agriculture / vegetation") return "vegetation / crop condition change";
  if (profile === "Water-body change") return "water boundary / surface change";
  return (PROFILES[profile] as ProfileConfig).label;
}

function compactness(area: number, perimeter: number): number {
  if (perimeter <= 0) return 0;
  return clamp((4 * Math.PI * area) / (perimeter * perimeter), 0, 1);
}

function regionPerimeter(pixels: number[], w: number): number {
  const set = new Set(pixels);
  let p = 0;
  for (const idx of pixels) {
    const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
    for (const n of neighbors) if (!set.has(n)) p++;
  }
  return p;
}

function pixelToMGRS(cx: number, cy: number, w: number, h: number): string {
  const e = Math.round((cx/w)*99999).toString().padStart(5,'0');
  const n = Math.round(((h-cy)/h)*99999).toString().padStart(5,'0');
  return 'NL ' + e + ' ' + n;
}

// ─── Extract detections ────────────────────────────────────────────────────────

function extractDetections(
  surface: Float32Array,
  edgeSurf: Float32Array,
  specialSurf: Float32Array,
  mask: Uint8Array,
  w: number,
  h: number,
  profile: ProfileKey,
  minAreaPx: number,
  confidence: number,
  ssim: number = 1.0,
): Detection[] {
  const cfg = PROFILES[profile];
  const effectiveMin = ssim < 0.5
    ? 150
    : Math.max(40, Math.round(minAreaPx * cfg.minAreaScale));
  const frameArea = w * h;
  const regions = findConnectedRegions(mask, w, h, effectiveMin);
  const dets: Detection[] = [];

  const maxAreaFrac = ssim < 0.5 ? 0.20 : ssim < 0.55 ? 0.15 : 0.16;

  for (const reg of regions) {
    const area = reg.pixels.length;
    if (area > maxAreaFrac * frameArea) continue;
    const [bx, by, bw, bh] = reg.bbox;
    if (bw < 6 || bh < 6) continue;

    const aspectRatio = Math.max(bw / Math.max(bh, 1), bh / Math.max(bw, 1));
    if (aspectRatio > 10 && profile !== "Urban development" && profile !== "Water-body change") continue;
    const fillRatio = area / Math.max(bw * bh, 1);
    if (fillRatio < 0.035) continue;

    let sumDelta = 0, peakDelta = 0, sumEdge = 0, sumSpecial = 0;
    for (const idx of reg.pixels) {
      const v = surface[idx];
      sumDelta += v;
      if (v > peakDelta) peakDelta = v;
      sumEdge += edgeSurf[idx];
      sumSpecial += specialSurf[idx];
    }
    const meanDelta = (sumDelta / area) * 100;
    peakDelta *= 100;
    const meanEdge = sumEdge / area;
    const meanSpecial = sumSpecial / area;

    const perim = regionPerimeter(reg.pixels, w);
    const comp = compactness(area, perim);

    const areaScore = clamp(Math.round((area / Math.max(1, frameArea)) * 2400 * cfg.areaWeight * 1.8), 0, 100);
    const intensityScore = clamp(Math.round((0.65 * peakDelta + 0.35 * meanDelta) * 1.4), 0, 100);
    const compactScore = clamp(Math.round(comp * 100 * cfg.compactnessWeight), 0, 100);
    const edgeScore = clamp(Math.round(meanEdge * 100 * cfg.edgeWeight), 0, 100);
    const specialScore = clamp(Math.round(meanSpecial * 100), 0, 100);

    let score: number;
    if (["Environmental monitoring", "Agriculture / vegetation", "Water-body change"].includes(profile)) {
      score = clamp(Math.round(0.40 * intensityScore + 0.30 * areaScore + 0.20 * specialScore + 0.10 * edgeScore), 0, 100);
    } else if (profile === "Defence / Security") {
      score = clamp(Math.round(0.38 * intensityScore + 0.20 * areaScore + 0.22 * edgeScore + 0.20 * compactScore), 0, 100);
    } else {
      score = clamp(Math.round(0.40 * intensityScore + 0.28 * areaScore + 0.22 * edgeScore + 0.10 * compactScore), 0, 100);
    }

    let reliability_penalty = confidence < 70 ? Math.min(5, Math.round((70 - confidence) / 2)) : 0;
    if (ssim < 0.5) reliability_penalty = 0;
    score = Math.max(0, score - reliability_penalty);

    const rawScore = score;
    if (ssim < 0.3) {
      score = Math.min(99, Math.round(rawScore * 1.4));
    }

    const cx = bx + Math.round(bw / 2);
    const cy = by + Math.round(bh / 2);
    const aspect = Math.max(bw / Math.max(bh, 1), bh / Math.max(bw, 1));

    let objectType = "Unknown";
    if (area > 5000 && comp < 0.4 && meanDelta > 10) objectType = "Vegetation";
    else if (comp > 0.6 && meanDelta > 20 && area < 5000 && aspect < 4) objectType = "Structure";
    else if (area > 3000 && meanDelta < 15 && aspect < 3) objectType = "Water";
    else if (area > 5000 && comp > 0.3 && meanDelta > 15) objectType = "Urban Expansion";

    dets.push({
      id: 0,
      type: classifyDetection(profile, meanSpecial, meanEdge, area, comp),
      objectType,
      priority: priorityFromScore(score, confidence),
      score,
      areaPx: area,
      compactness: Math.round(comp * 1000) / 1000,
      meanDelta: Math.round(meanDelta * 100) / 100,
      pixelCenter: [cx, cy],
      bbox: [bx, by, bw, bh],
      geoCenter: null,
      geoBBox: null,
      areaM2: null,
      gridRef: pixelToMGRS(cx, cy, w, h),
      analystNote: "",
      analystDecision: "Pending review",
      reviewed: false,
    });
  }

  // When ssim < 0.55, allow more detections (up to 20) for better coverage
  const maxDets = ssim < 0.55 ? Math.max(cfg.maxDetections, 20) : cfg.maxDetections;
  const sorted = dets.sort((a, b) => b.score - a.score).slice(0, maxDets);
  sorted.forEach((d, i) => {
    d.id = i + 1;
    d.priority = priorityFromScore(d.score, confidence);
  });
  return sorted;
}

// ─── Low confidence hints ──────────────────────────────────────────────────────

function extractHints(surface: Float32Array, w: number, h: number, profile: ProfileKey, minArea: number): Detection[] {
  const frameArea = w * h;
  const smoothed = separableGaussian(surface, w, h, 5);
  const maxVal = smoothed.reduce((m, v) => Math.max(m, v), 0);
  if (maxVal < 0.08) return [];

  const gate = Math.max(percentile(smoothed, 99.35), maxVal * 0.55);
  const seed = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) seed[i] = smoothed[i] >= gate ? 1 : 0;

  const regions = findConnectedRegions(seed, w, h, Math.max(40, minArea * 0.12));
  const hints: Detection[] = [];

  for (const reg of regions) {
    const area = reg.pixels.length;
    if (area > 0.04 * frameArea) continue;
    const [bx, by, bw, bh] = reg.bbox;
    if (bw < 8 || bh < 8) continue;

    const pad = Math.max(10, Math.round(0.45 * Math.max(bw, bh)));
    const x0 = Math.max(0, bx - pad), y0 = Math.max(0, by - pad);
    const x1 = Math.min(w - 1, bx + bw + pad), y1 = Math.min(h - 1, by + bh + pad);
    const bw2 = x1 - x0, bh2 = y1 - y0;

    let sumDelta = 0, peakDelta = 0;
    for (const idx of reg.pixels) { sumDelta += smoothed[idx]; if (smoothed[idx] > peakDelta) peakDelta = smoothed[idx]; }
    const meanDelta = (sumDelta / area) * 100;
    peakDelta *= 100;
    const perim = regionPerimeter(reg.pixels, w);
    const comp = compactness(area, perim);
    const score = clamp(Math.round(0.55 * peakDelta + 0.25 * meanDelta + 20 * comp), 18, 49);

    const typeMap: Partial<Record<ProfileKey, string>> = {
      "Environmental monitoring": "low-confidence land-cover review hint",
      "Urban development": "low-confidence structural review hint",
      "Agriculture / vegetation": "low-confidence vegetation review hint",
      "Water-body change": "low-confidence water-boundary review hint",
      "Disaster assessment": "low-confidence damage review hint",
      "Defence / Security": "low-confidence activity review hint",
    };

    const cx = x0 + Math.round(bw2 / 2);
    const cy = y0 + Math.round(bh2 / 2);

    hints.push({
      id: 0,
      type: typeMap[profile] ?? "low-confidence review hint",
      priority: "LOW",
      score,
      areaPx: area,
      compactness: Math.round(comp * 1000) / 1000,
      meanDelta: Math.round(meanDelta * 100) / 100,
      pixelCenter: [cx, cy],
      bbox: [x0, y0, bw2, bh2],
      geoCenter: null,
      geoBBox: null,
      areaM2: null,
      evidence: "weak-local-signal",
      gridRef: pixelToMGRS(cx, cy, w, h),
      analystNote: "",
      analystDecision: "Pending review",
      reviewed: false,
    });
  }

  return hints.sort((a, b) => b.score - a.score).slice(0, 4).map((h, i) => ({ ...h, id: i + 1 }));
}

// ─── Confidence ────────────────────────────────────────────────────────────────

function computeReliabilityTier(
  ssim: number,
  alignScore: number,
  confidence: number,
  alignmentUsed: boolean,
): ReliabilityTier {
  if (confidence >= 76 && ssim >= 0.62 && alignmentUsed && alignScore >= 68) return "VERIFIED";
  if (confidence >= 52 && ssim >= 0.42) return "REVIEW";
  return "PRELIMINARY";
}

function computeConfidence(
  ssim: number,
  alignScore: number,
  changedPct: number,
  brightDelta: number,
  contrastDelta: number
): [number, string[]] {
  let conf = 92;
  const notes: string[] = [];

  if (ssim < 0.45) { notes.push("Low image similarity. Global difference signal is boosted for review."); }
  else if (ssim < 0.65) { notes.push("Moderate image similarity. Results are useful for review, not final assessment."); }

  if (alignScore < 45) { conf -= 22; notes.push("Weak alignment quality. Some detected changes may be caused by registration error."); }
  else if (alignScore < 70) { conf -= 8; notes.push("Moderate alignment quality. Local detections should be reviewed manually."); }

  if (changedPct > 28) { conf -= 22; notes.push("Large scene-level difference detected. Lighting, season, sensor, or resolution differences may be present."); }
  else if (changedPct > 14) { conf -= 12; notes.push("Broad image difference detected. Interpret object-level detections carefully."); }

  if (brightDelta > 28) { conf -= 8; notes.push("Noticeable brightness difference between images."); }
  if (contrastDelta > 0.28) { conf -= 6; notes.push("Noticeable contrast difference between images."); }

  if (!notes.length) notes.push("Image pair is suitable for automated first-pass change review.");
  return [clamp(conf, 30, 96), notes];
}

function computePixelDifferenceMetrics(
  baseline: Uint8ClampedArray,
  recent: Uint8ClampedArray,
  mask: Uint8Array,
): { meanAbsoluteDifference: number; psnr: number | null } {
  let changedCount = 0;
  let changedAbsSum = 0;
  let squaredErrorSum = 0;
  let channelCount = 0;

  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4;
    let pixelAbsSum = 0;

    for (let channel = 0; channel < 3; channel += 1) {
      const diff = baseline[offset + channel] - recent[offset + channel];
      const abs = Math.abs(diff);
      pixelAbsSum += abs;
      squaredErrorSum += diff * diff;
      channelCount += 1;
    }

    if (mask[i]) {
      changedAbsSum += pixelAbsSum / 3;
      changedCount += 1;
    }
  }

  const mse = channelCount > 0 ? squaredErrorSum / channelCount : 0;
  const psnr = mse <= 0 ? null : 10 * Math.log10((255 * 255) / mse);

  return {
    meanAbsoluteDifference: changedCount > 0 ? Math.round((changedAbsSum / changedCount) * 100) / 100 : 0,
    psnr: psnr === null ? null : Math.round(psnr * 100) / 100,
  };
}

// ─── Annotation ────────────────────────────────────────────────────────────────

async function renderAnnotated(baseDataURL: string, detections: Detection[], preliminaryMode = false): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      detections.forEach((d, index) => {
        const source = d as Detection & { x?: number; y?: number; w?: number; h?: number };
        const [x, y, w, h] = source.bbox ??
          [source.x ?? 0, source.y ?? 0, source.w ?? 50, source.h ?? 50];
        const col = preliminaryMode
          ? "#7dd3fc"
          : d.priority === "HIGH" ? "#ff6b35"
            : d.priority === "CRITICAL" ? "#ff3333" : "#ffcc00";

        // Outer white glow
        ctx.shadowColor = "white";
        ctx.shadowBlur = 6;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 5;
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);

        // Colored border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        if (preliminaryMode) ctx.setLineDash([7, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Semi-transparent fill
        ctx.fillStyle = col + "33";
        ctx.fillRect(x, y, w, h);

        if (preliminaryMode) {
          const badgeRadius = 12;
          const badgeX = clamp(x + badgeRadius, badgeRadius, c.width - badgeRadius);
          const badgeY = clamp(y - badgeRadius - 4, badgeRadius, c.height - badgeRadius);
          ctx.beginPath();
          ctx.fillStyle = "rgba(2,16,28,0.92)";
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#dff9ff";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`#${index + 1}`, badgeX, badgeY + 0.5);
          ctx.textAlign = "start";
          ctx.textBaseline = "alphabetic";
        } else {
          const labelY = Math.max(0, y - 20);
          ctx.fillStyle = col;
          ctx.fillRect(x, labelY, w, 20);
          ctx.fillStyle = "#000";
          ctx.font = "bold 11px monospace";
          ctx.fillText(
            `#${d.id} ${d.priority} ${d.score}`,
            x + 4, labelY + 14
          );
        }
      });

      resolve(c.toDataURL("image/jpeg", 0.93));
    };
    img.onerror = () => resolve(baseDataURL);
    img.src = baseDataURL;
  });
}

function makeHeatmap(canvas: HTMLCanvasElement, surface: Float32Array, detections: Detection[], preliminaryMode = false): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const out = createCanvas(w, h);
  const ctx = out.getContext("2d")!;
  if (preliminaryMode) ctx.drawImage(canvas, 0, 0, w, h);

  const heatSurface = separableGaussian(surface, w, h, 18);
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < heatSurface.length; i++) {
    const value = heatSurface[i];
    if (value < minV) minV = value;
    if (value > maxV) maxV = value;
  }
  const range = maxV - minV || 1;
  const heatImg = ctx.createImageData(w, h);
  const stops: Array<[number, [number, number, number]]> = preliminaryMode
    ? [
        [0, [103, 213, 225]],
        [90, [96, 205, 219]],
        [166, [214, 177, 105]],
        [226, [240, 210, 118]],
        [255, [249, 228, 146]],
      ]
    : [
        [0, [10, 14, 30]],
        [64, [100, 20, 100]],
        [128, [220, 80, 0]],
        [192, [255, 200, 0]],
        [255, [255, 255, 240]],
      ];
  const colorFor = (value: number): [number, number, number] => {
    for (let i = 0; i < stops.length - 1; i++) {
      const [aPos, aColor] = stops[i];
      const [bPos, bColor] = stops[i + 1];
      if (value <= bPos) {
        const t = (value - aPos) / Math.max(1, bPos - aPos);
        return [
          Math.round(aColor[0] + (bColor[0] - aColor[0]) * t),
          Math.round(aColor[1] + (bColor[1] - aColor[1]) * t),
          Math.round(aColor[2] + (bColor[2] - aColor[2]) * t),
        ];
      }
    }
    return stops[stops.length - 1][1];
  };

  for (let i = 0; i < w * h; i++) {
    const normalized = Math.round(((heatSurface[i] - minV) / range) * 255);
    const [rr, gg, bb] = colorFor(clamp(normalized, 0, 255));
    const boost = preliminaryMode ? 1 : 1.5;
    heatImg.data[i * 4] = Math.min(255, Math.round(rr * boost));
    heatImg.data[i * 4 + 1] = Math.min(255, Math.round(gg * boost));
    heatImg.data[i * 4 + 2] = bb;
    heatImg.data[i * 4 + 3] = preliminaryMode ? preliminaryOverlayAlpha(normalized) : 255;
  }

  if (preliminaryMode) {
    const overlay = createCanvas(w, h);
    overlay.getContext("2d")!.putImageData(heatImg, 0, 0);
    ctx.drawImage(overlay, 0, 0);
  } else {
    ctx.putImageData(heatImg, 0, 0);
  }

  for (const d of preliminaryMode ? [] : detections) {
    const [x, y, bw, bh] = d.bbox;
    ctx.shadowColor = "white";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 2, y - 2, bw + 4, bh + 4);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x, y, bw, bh);
    ctx.setLineDash([]);
  }

  return out;
}

function preliminaryOverlayAlpha(value: number): number {
  const intensity = clamp(value, 0, 255) / 255;
  const opacity = intensity < 0.18
    ? (intensity / 0.18) * 0.25
    : 0.25 + ((intensity - 0.18) / 0.82) * 0.20;

  return Math.round(clamp(opacity, 0, 0.45) * 255);
}

// ─── Demo image generator ──────────────────────────────────────────────────────

export function generateDemoImages(): [HTMLCanvasElement, HTMLCanvasElement] {
  const w = 760, h = 460;
  const base = createCanvas(w, h);
  const ctx = base.getContext("2d")!;

  // ── Deterministic pseudo-random seeded helpers ──
  function seeded(s: number) { const n = Math.sin(s * 127.1 + 311.7) * 43758.5; return n - Math.floor(n); }
  function srgb(s: number, ri: number, gi: number, bi: number) {
    return `rgb(${Math.floor(seeded(s + ri) * 80 + 70)},${Math.floor(seeded(s + gi) * 75 + 85)},${Math.floor(seeded(s + bi) * 60 + 50)})`;
  }

  // ── Base terrain ──
  ctx.fillStyle = "#3a5540";
  ctx.fillRect(0, 0, w, h);

  // Vegetation patches (green fields, forest blocks)
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(seeded(i * 100) * (w - 40));
    const y = Math.floor(seeded(i * 100 + 1) * (h - 40));
    const rw = 35 + Math.floor(seeded(i * 100 + 2) * 70);
    const rh = 25 + Math.floor(seeded(i * 100 + 3) * 50);
    ctx.fillStyle = srgb(i * 200, 10, 50, 5);
    ctx.fillRect(x, y, Math.min(rw, w - x - 2), Math.min(rh, h - y - 2));
  }

  // Agricultural fields (lighter brown/gold patches)
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(seeded(i * 300 + 50) * (w - 30));
    const y = Math.floor(seeded(i * 300 + 51) * (h - 30));
    const rw = 30 + Math.floor(seeded(i * 300 + 52) * 60);
    const rh = 20 + Math.floor(seeded(i * 300 + 53) * 45);
    ctx.fillStyle = srgb(i * 400, 80, 40, 0);
    ctx.fillRect(x, y, Math.min(rw, w - x - 2), Math.min(rh, h - y - 2));
  }

  // Water body (lake, top-right quadrant)
  ctx.fillStyle = "#1a3f5e";
  ctx.beginPath();
  ctx.ellipse(580, 280, 85, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  // Roads
  ctx.strokeStyle = "#7a786a";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 220); ctx.lineTo(340, 220); ctx.lineTo(520, 280); ctx.lineTo(760, 280); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(280, 0); ctx.lineTo(280, 220); ctx.lineTo(340, 380); ctx.lineTo(310, 460); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(80, 160); ctx.lineTo(180, 320); ctx.stroke();

  // Existing structures (small buildings)
  for (const [bx, by, bw, bh] of [[100, 70, 28, 22], [135, 72, 18, 18], [160, 75, 22, 20], [400, 160, 35, 28]]) {
    ctx.fillStyle = "#8a8a82";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#7a7a72";
    ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
  }

  // Bare soil patches
  for (const [sx, sy, sw, sh] of [[520, 100, 55, 40], [640, 380, 50, 38], [460, 320, 45, 35]]) {
    ctx.fillStyle = "#8a7a5a";
    ctx.fillRect(sx, sy, sw, sh);
  }

  // ── AFTER image (copy of base then apply changes) ──
  const after = createCanvas(w, h);
  const actx = after.getContext("2d")!;
  actx.drawImage(base, 0, 0);

  // 1. NEW CONSTRUCTION: replace a green field (center-left) with a tan building complex
  actx.fillStyle = "#a8a08e";
  actx.fillRect(190, 95, 58, 42);
  actx.fillStyle = "#b8b09e";
  actx.fillRect(195, 100, 10, 10);
  actx.fillRect(210, 100, 10, 10);
  actx.fillRect(225, 100, 10, 10);
  actx.fillRect(195, 115, 10, 10);
  actx.fillRect(210, 115, 10, 10);
  actx.fillRect(225, 115, 10, 10);

  // 2. CLEARED LAND: change a vegetation patch (mid-left) to bare soil (deforestation)
  actx.fillStyle = "#9a8a68";
  actx.beginPath();
  actx.ellipse(80, 260, 38, 30, 0, 0, Math.PI * 2);
  actx.fill();
  actx.fillStyle = "#8a7a58";
  actx.beginPath();
  actx.ellipse(80, 260, 22, 16, 0, 0, Math.PI * 2);
  actx.fill();

  // 3. WATER LEVEL CHANGE: shoreline receded — fill part of lake with sediment
  actx.fillStyle = "#5a6a4a";
  actx.beginPath();
  actx.ellipse(540, 260, 30, 20, 0.3, 0, Math.PI * 2);
  actx.fill();
  actx.fillStyle = "#6a7a52";
  actx.beginPath();
  actx.ellipse(542, 258, 18, 12, 0.3, 0, Math.PI * 2);
  actx.fill();

  // 4. NEW ROAD: extension connecting to the main road network
  actx.strokeStyle = "#a09a88";
  actx.lineWidth = 5;
  actx.beginPath(); ctx.moveTo(340, 220); ctx.lineTo(420, 310); ctx.lineTo(580, 340); ctx.stroke();

  // 5. NEW STRUCTURE: industrial building in the bottom-right bare area
  actx.fillStyle = "#7a8686";
  actx.fillRect(648, 382, 38, 32);
  actx.fillStyle = "#6a7676";
  actx.fillRect(653, 387, 10, 8);
  actx.fillRect(668, 387, 10, 8);
  actx.fillRect(653, 399, 10, 8);
  actx.fillRect(668, 399, 10, 8);

  return [base, after];
}

// ─── Simple alignment (brightness-based shift estimation) ─────────────────────

// Histogram equalisation on ImageData (user-specified implementation)
function equalise(gray: ImageData): Uint8ClampedArray {
  const hist = new Array(256).fill(0);
  gray.data.forEach((_,i)=>{ if(i%4===0) hist[gray.data[i]]++; });
  const cdf = hist.reduce((a: number[],v: number,i: number)=>[...a, (a[i-1]||0)+v],[] as number[]);
  const min = cdf.find((v: number)=>v>0) || 0;
  const scale = 255/((gray.data.length/4 - min) || 1);
  return new Uint8ClampedArray(gray.data.map((v,i)=>i%4===3?255:Math.round(((cdf[v]-min)*scale) || 0)));
}

export function normalizeRGBCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (let ch = 0; ch < 3; ch++) {
    const hist = new Array(256).fill(0);
    for (let i = ch; i < data.length; i += 4) {
      hist[data[i]]++;
    }
    const total = width * height;
    const cdf = new Array(256);
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + hist[i];
    }
    const minCdf = cdf.find(v => v > 0) ?? 0;
    const scale = 255 / (total - minCdf);
    for (let i = ch; i < data.length; i += 4) {
      data[i] = Math.round((cdf[data[i]] - minCdf) * scale);
    }
  }

  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

// Convert Float32Array grayscale (0-255 range) into an ImageData for equalise()
function grayToImageData(gray: Float32Array, w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = clamp(Math.round(gray[i]), 0, 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, w, h);
}

// Convert equalised Uint8ClampedArray back to Float32Array (0-1 range)
function equalisedToFloat(eq: Uint8ClampedArray, len: number): Float32Array {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = (eq[i * 4] || 0) / 255;
  }
  return out;
}

function estimateAlignment(g1: Float32Array, g2: Float32Array, len: number): { score: number; goodMatches: number } {
  // Compare histograms & structural similarity to estimate alignment quality
  // (True ORB not available in browser without WASM; we use correlation proxy)
  let corr = 0, s1 = 0, s2 = 0;
  const step = Math.max(1, Math.floor(len / 5000));
  let n = 0;
  for (let i = 0; i < len; i += step) {
    const v1 = g1[i] || 0;
    const v2 = g2[i] || 0;
    corr += v1 * v2;
    s1 += v1 * v1;
    s2 += v2 * v2;
    n++;
  }
  const denom = Math.sqrt(s1 * s2) || 1;
  const r = (corr / denom) || 0;
  const rawScore = clamp(Math.round(r * 100) || 0, 0, 100);

  // Estimate "good matches" count from correlation strength
  // Higher correlation → more equivalent ORB good-matches
  const goodMatches = Math.max(0, Math.round((rawScore / 100) * n * 0.02) || 0);

  // If fewer than 8 good matches, alignment is unreliable
  const finalScore = goodMatches < 8 ? 0 : rawScore;

  return { score: isFinite(finalScore) ? finalScore : 0, goodMatches };
}

// ─── Main analysis entry point ─────────────────────────────────────────────────

export async function analysePair(
  img1: HTMLImageElement | HTMLCanvasElement,
  img2: HTMLImageElement | HTMLCanvasElement,
  profile: ProfileKey,
  resolution: number,
  sensitivity: number,
  minArea: number,
  showLabels: boolean,
  geoReferences?: GeoReferencePair,
  normalize?: boolean,
  falsePositiveFilter?: number,
  onProgress?: (pct: number) => void,
): Promise<AnalysisResult> {

  const now = new Date();
  const ts = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // ── Width alignment & Cropping ──
  let w1 = img1 instanceof HTMLImageElement ? img1.naturalWidth : img1.width;
  let w2 = img2 instanceof HTMLImageElement ? img2.naturalWidth : img2.width;
  let h1_orig = img1 instanceof HTMLImageElement ? img1.naturalHeight : img1.height;
  let h2_orig = img2 instanceof HTMLImageElement ? img2.naturalHeight : img2.height;
  let baselineCropX = 0;
  let recentCropX = 0;

  if (Math.abs(w1 - w2) > 2) {
    console.warn(`Images differ in size: ${w1}x${h1_orig} vs ${w2}x${h2_orig}. Cropping wider image to match narrower from center.`);
    if (w1 > w2) {
      const cropX = Math.floor((w1 - w2) / 2);
      baselineCropX = cropX;
      const c = createCanvas(w2, h1_orig);
      c.getContext("2d")!.drawImage(img1, cropX, 0, w2, h1_orig, 0, 0, w2, h1_orig);
      img1 = c;
      w1 = w2;
    } else {
      const cropX = Math.floor((w2 - w1) / 2);
      recentCropX = cropX;
      const c = createCanvas(w1, h2_orig);
      c.getContext("2d")!.drawImage(img2, cropX, 0, w1, h2_orig, 0, 0, w1, h2_orig);
      img2 = c;
      w2 = w1;
    }
  }

  // ── Resize ──
  const scale1 = resolution / w1;
  const scale2 = resolution / w2;
  const h1 = Math.max(1, Math.round(h1_orig * scale1));
  const h2 = Math.max(1, Math.round(h2_orig * scale2));

  const c1 = createCanvas(resolution, h1);
  c1.getContext("2d")!.drawImage(img1, 0, 0, resolution, h1);

  const c2raw = createCanvas(resolution, h2);
  c2raw.getContext("2d")!.drawImage(img2, 0, 0, resolution, h2);

  // Resize c2 to match c1 height if needed
  let c2 = createCanvas(resolution, h1);
  c2.getContext("2d")!.drawImage(c2raw, 0, 0, resolution, h1);

  // ── Per-channel histogram equalization ──
  let originalBaseImage: string | undefined;
  let originalRecentImage: string | undefined;
  if (normalize) {
    originalBaseImage = imgToURL(c1);
    originalRecentImage = imgToURL(c2);
    normalizeRGBCanvas(c1);
    normalizeRGBCanvas(c2);
  }
  onProgress?.(15);

  const p1 = getPixels(c1);
  let p2raw = getPixels(c2);

  const g1Raw = rgbToGray(p1, resolution, h1);
  const g2Raw = rgbToGray(p2raw, resolution, h1);
  const g1EqData = equalise(grayToImageData(g1Raw, resolution, h1));
  const g2EqData = equalise(grayToImageData(g2Raw, resolution, h1));
  const g1ForAlign = equalisedToFloat(g1EqData, resolution * h1);
  const g2ForAlign = equalisedToFloat(g2EqData, resolution * h1);

  let alignmentShift: [number, number] = [0, 0];
  const maxShiftPx = Math.floor(Math.min(resolution, h1) * 0.06);
  const shiftEst = estimateTranslationShift(g1ForAlign, g2ForAlign, resolution, h1, maxShiftPx);
  if (shiftEst.score >= 42 && (shiftEst.dx !== 0 || shiftEst.dy !== 0)) {
    c2 = shiftCanvas(c2, shiftEst.dx, shiftEst.dy);
    p2raw = getPixels(c2);
    alignmentShift = [shiftEst.dx, shiftEst.dy];
  }
  onProgress?.(35);

  const p2norm = matchColorStats(p2raw, p1, resolution * h1);

  const g2AlignedForScore = rgbToGray(p2raw, resolution, h1);
  const g2EqAligned = equalisedToFloat(equalise(grayToImageData(g2AlignedForScore, resolution, h1)), resolution * h1);
  const alignResult = estimateAlignment(g1ForAlign, g2EqAligned, resolution * h1);

  let alignScore = Math.max(alignResult.score, shiftEst.score);
  alignScore = isFinite(alignScore) ? clamp(alignScore, 0, 100) : 0;
  const alignUsed = (alignResult.goodMatches >= 8 && alignScore >= 35) || alignmentShift[0] !== 0 || alignmentShift[1] !== 0;

  const g1 = rgbToGray(p1, resolution, h1);
  const g2norm = rgbToGray(p2norm, resolution, h1);
  const ssimScore = clamp(computeSSIM(g1, g2norm, resolution, h1), -1, 1);
  const reliabilityGate = getReliabilityGate(ssimScore);

  const g2 = rgbToGray(p2raw, resolution, h1);
  let m1 = 0, m2 = 0, std1 = 0, std2 = 0;
  for (let i = 0; i < g1.length; i++) { m1 += g1[i]; m2 += g2[i]; }
  m1 /= g1.length; m2 /= g2.length;
  for (let i = 0; i < g1.length; i++) { std1 += (g1[i] - m1) ** 2; std2 += (g2[i] - m2) ** 2; }
  std1 = Math.sqrt(std1 / g1.length); std2 = Math.sqrt(std2 / g2.length);
  const brightnessDelta = Math.abs(m1 - m2);
  const contrastDelta = Math.abs(std1 - std2) / Math.max(std1, 1);
  onProgress?.(55);

  // ── Change surface ──
  const isVeryDifferent = ssimScore < 0.20;
  let surface: Float32Array;
  let edge: Float32Array;
  let special: Float32Array;
  let mask: Uint8Array;

  if (isVeryDifferent) {
    // RAW mode: grayscale abs diff, no Gaussian suppression (SSIM < 0.20)
    const g2normGray = rgbToGray(p2norm, resolution, h1);
    const absDiff = new Float32Array(resolution * h1);
    for (let i = 0; i < resolution * h1; i++) {
      absDiff[i] = Math.abs(g1[i] - g2normGray[i]);
    }
    // Threshold at mean + 0.5 * stddev
    let diffMean = 0;
    for (let i = 0; i < absDiff.length; i++) diffMean += absDiff[i];
    diffMean /= absDiff.length;
    let diffVariance = 0;
    for (let i = 0; i < absDiff.length; i++) diffVariance += (absDiff[i] - diffMean) ** 2;
    const diffStd = Math.sqrt(diffVariance / absDiff.length);
    const rawThr = diffMean + 0.5 * diffStd;

    // Build raw binary mask (percentile 70 equivalent via stats threshold)
    const rawMask70 = new Uint8Array(resolution * h1);
    for (let i = 0; i < absDiff.length; i++) rawMask70[i] = absDiff[i] >= rawThr ? 1 : 0;

    // Normalize surface to 0-1
    const maxDiff = absDiff.reduce((mx, v) => Math.max(mx, v), 1);
    surface = new Float32Array(resolution * h1);
    for (let i = 0; i < absDiff.length; i++) surface[i] = clamp(absDiff[i] / maxDiff, 0, 1);

    // Filter components: min 100px, max 30% of frame
    const frameAreaRaw = resolution * h1;
    const regionsRaw = findConnectedRegions(rawMask70, resolution, h1, 100);
    mask = new Uint8Array(resolution * h1);
    for (const reg of regionsRaw) {
      if (reg.pixels.length > 0.30 * frameAreaRaw) continue;
      for (const idx of reg.pixels) mask[idx] = 1;
    }
    edge = new Float32Array(resolution * h1);
    special = new Float32Array(resolution * h1);
  } else if (ssimScore < 0.50) {
    // Global diff mode: raw RGB diff pipeline
    const lowSsim = buildLowSsimSurface(p1, p2norm, resolution, h1);
    surface = lowSsim.surface;
    mask = lowSsim.mask;
    // Provide empty edge/special surfaces for scoring (not used in raw diff mode)
    edge = new Float32Array(resolution * h1);
    special = new Float32Array(resolution * h1);
  } else {
    // Normal pipeline
    const cs = buildChangeSurface(p1, p2norm, resolution, h1, profile, ssimScore);
    surface = cs.surface;
    edge = cs.edge;
    special = cs.special;
    // ── Binary mask ──
    mask = thresholdSurface(surface, sensitivity, profile, ssimScore);
  }

  // ── Preliminary metrics ──
  const maskedCount = mask.reduce((s, v) => s + v, 0);
  const prelimChangedPct = (maskedCount / (resolution * h1)) * 100;
  const differenceMetrics = computePixelDifferenceMetrics(p1, p2norm, mask);
  const [rawPrelimConf] = computeConfidence(ssimScore, alignScore, prelimChangedPct, brightnessDelta, contrastDelta);
  const prelimConf = reliabilityGate.confidenceCap === null
    ? rawPrelimConf
    : Math.min(rawPrelimConf, reliabilityGate.confidenceCap);

  const analysisMode: AnalysisMode = ssimScore < 0.5 ? "GLOBAL_DIFF" : "LOCALIZED_HOTSPOT";

  let detections = extractDetections(surface, edge, special, mask, resolution, h1, profile, minArea, prelimConf, ssimScore);
  detections = mergeOverlappingDetections(detections);
  detections = mergeProximateDetections(detections, 10);
  onProgress?.(75);

  let usedHintMode = false;
  if (detections.length === 0 && prelimChangedPct < 3.0) {
    detections = extractHints(surface, resolution, h1, profile, minArea);
    usedHintMode = detections.length > 0;
  }

  const fpThreshold = falsePositiveFilter != null ? falsePositiveFilter / 100 : 0;
  const beforeFilter = detections.length;
  if (fpThreshold > 0) {
    detections = detections.filter(d => d.score >= fpThreshold * 100);
  }
  const regionsFiltered = beforeFilter - detections.length;

  const localArea = detections.reduce((s, d) => s + d.areaPx, 0);
  const localChangedPct = (localArea / (resolution * h1)) * 100;
  const changedArea = ssimScore < 0.5 ? prelimChangedPct : Math.max(localChangedPct, prelimChangedPct * 0.85);

  console.log('SSIM:', ssimScore, 'mode:', isVeryDifferent ? 'RAW' : 'LOCAL', 'changed:', changedArea + '%');

  const [rawConfidence, notes] = computeConfidence(ssimScore, alignScore, changedArea, brightnessDelta, contrastDelta);
  const confidence = reliabilityGate.confidenceCap === null
    ? rawConfidence
    : Math.min(rawConfidence, reliabilityGate.confidenceCap);

  if (alignmentShift[0] !== 0 || alignmentShift[1] !== 0) {
    notes.push(`Translational registration applied: shift (${alignmentShift[0]}, ${alignmentShift[1]}) px on T2.`);
  }
  notes.push(`Profile logic: ${PROFILES[profile].summary}`);
  if (reliabilityGate.reliabilityGateApplied) {
    notes.push(reliabilityGate.scoringNote);
    if (reliabilityGate.sceneComparability === "VERY LOW") {
      notes.push("Very low scene comparability. Review regions are visual review regions only, not confirmed changes.");
    }
  }
  if (usedHintMode) notes.push("Only weak localized signals were found; displayed zones are low-confidence review hints, not confirmed changes.");
  else if (detections.length === 0) notes.push("No localized review zone exceeded the configured threshold; broad scene differences were suppressed.");

  // Re-calibrate priorities with the SSIM reliability gate applied last.
  const frameArea = resolution * h1;
  detections.forEach((d, index) => {
    d.priority = gateDetectionPriority(d, reliabilityGate, confidence, alignScore, changedArea, frameArea);
    d.type = reviewTypeForGate(d, reliabilityGate, index);
  });

  // Top 3 priority bump is reserved for image pairs with good comparability.
  if (reliabilityGate.sceneComparability === "GOOD" && changedArea > 5) {
    const sortedByScore = [...detections].sort((a, b) => b.score - a.score);
    const top3 = sortedByScore.slice(0, 3);
    for (const d of detections) {
      if (top3.includes(d)) {
        if (d.priority === "MEDIUM") {
          d.priority = "HIGH";
        } else if (d.priority === "LOW") {
          d.priority = "MEDIUM";
        }
      }
    }
  }

  const visualFlagDetections = detections.filter(isVisualFlagRegion);
  const outputDetections = reliabilityGate.sceneComparability === "VERY LOW"
    ? visualFlagDetections
    : detections;

  if (reliabilityGate.sceneComparability === "VERY LOW") {
    const suppressedCount = detections.length - outputDetections.length;
    if (suppressedCount > 0) {
      notes.push(`${suppressedCount} preliminary visual review region(s) fell below the visual flag confidence threshold (${VISUAL_FLAG_SCORE_THRESHOLD}/100) and were omitted from the review log.`);
    }
  }

  outputDetections.forEach((d, index) => {
    d.id = index + 1;
  });

  const highFlags = outputDetections.length;
  const maxScore = outputDetections.reduce((m, d) => Math.max(m, d.score), 0);
  const reviewRegionArea = outputDetections.reduce((sum, detection) => sum + detection.areaPx, 0);
  const reviewRegionDensityPct = Math.round((reviewRegionArea / Math.max(1, frameArea)) * 100000) / 1000;

  let analysisPriority: OverallPriority = "LOW";
  if (reliabilityGate.sceneComparability === "VERY LOW") {
    analysisPriority = "PRELIMINARY REVIEW";
  } else if (reliabilityGate.sceneComparability === "LOW") {
    analysisPriority = outputDetections.length >= 1 ? "MEDIUM" : "LOW";
  } else if (reliabilityGate.sceneComparability === "MODERATE") {
    if (highFlags >= 1) analysisPriority = "HIGH";
    else if (outputDetections.length >= 1) analysisPriority = "MEDIUM";
  } else if (changedArea > 10 && confidence < 70) {
    analysisPriority = "HIGH (low confidence)";
  } else if (highFlags >= 1) {
    analysisPriority = maxScore >= 68 ? "HIGH" : "MEDIUM";
  } else if (outputDetections.length >= 1) {
    analysisPriority = "MEDIUM";
  }

  const reliabilityTier = computeReliabilityTier(ssimScore, alignScore, confidence, alignUsed);
  if (reliabilityTier === "PRELIMINARY") {
    notes.push("Reliability tier PRELIMINARY: treat outputs as indicative only; confirm with manual review or higher-quality pair.");
  } else if (reliabilityTier === "VERIFIED") {
    notes.push("Reliability tier VERIFIED: image pair quality supports high-trust automated triage (analyst sign-off still required).");
  }

  onProgress?.(90);

  // ── Annotated & heatmap (all stored as data URL strings) ──
  const base = c1;
  const reg = c2;
  const visibleDetections = reliabilityGate.sceneComparability === "VERY LOW"
    ? outputDetections.slice(0, PRELIMINARY_VISIBLE_REGION_LIMIT)
    : outputDetections;
  const preliminaryOutput = reliabilityGate.reliability === "PRELIMINARY" || ssimScore < 0.20;
  const geoMetadata = applyGeoMetadata(outputDetections, geoReferences, {
    analysisWidth: resolution,
    analysisHeight: h1,
    baselineScale: scale1,
    baselineCropX,
    recentScale: scale2,
    recentCropX,
    recentScaledHeight: h2,
    alignmentShift,
  });
  const annotated = await renderAnnotated(imgToURL(reg), visibleDetections, preliminaryOutput);
  const heatmap = makeHeatmap(reg, surface, visibleDetections, preliminaryOutput);
  const baseImage = imgToURL(base);
  const recentImage = imgToURL(reg);
  const annotatedImage = annotated;
  const heatmapImage = imgToURL(heatmap);
  console.log("imageType:", typeof annotatedImage, annotatedImage.slice(0, 30));
  onProgress?.(100);

  return {
    timestampUtc: ts,
    profile,
    analysisPriority,
    changedAreaPct: Math.round(changedArea * 1000) / 1000,
    detectionCount: outputDetections.length,
    highPriorityFlags: highFlags,
    maxScore,
    confidence,
    ssim: Math.round(ssimScore * 10000) / 10000,
    reliability: reliabilityGate.reliability,
    sceneComparability: reliabilityGate.sceneComparability,
    reliabilityGateApplied: reliabilityGate.reliabilityGateApplied,
    scoringNote: reliabilityGate.scoringNote,
    manualVerificationRequired: reliabilityGate.manualVerificationRequired,
    detectionsAreConfirmed: false,
    preliminaryMode: reliabilityGate.sceneComparability === "VERY LOW",
    visibleRegionLimit: reliabilityGate.sceneComparability === "VERY LOW"
      ? Math.min(PRELIMINARY_VISIBLE_REGION_LIMIT, outputDetections.length)
      : outputDetections.length,
    totalReviewRegions: outputDetections.length,
    alignmentUsed: alignUsed,
    alignmentScore: isFinite(alignScore) ? clamp(alignScore, 0, 100) : 0,
    brightnessDelta: Math.round(brightnessDelta * 100) / 100,
    contrastDelta: Math.round(contrastDelta * 1000) / 1000,
    qualityNotes: notes,
    analysisMode,
    reliabilityTier,
    maskChangedPct: Math.round(prelimChangedPct * 1000) / 1000,
    alignmentShift,
    meanAbsoluteDifference: differenceMetrics.meanAbsoluteDifference,
    psnr: differenceMetrics.psnr,
    regionsFiltered,
    reviewRegionDensityPct,
    timeline: {
      baselineDate: null,
      recentDate: null,
    },
    detections: outputDetections,
    geoMetadata,
    images: {
      baseImage,
      recentImage,
      annotatedImage,
      heatmapImage,
      ...(normalize ? { originalBaseImage, originalRecentImage } : {}),
    },
    parameters: { resolution, sensitivity, minimumAreaPx: minArea, profile, normalize, showLabels, falsePositiveFilter },
  };
}
