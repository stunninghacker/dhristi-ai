/**
 * Central type definitions for the AI Satellite Intelligence System.
 *
 * Every shared interface and type alias is defined here and exported.
 * The legacy barrel at `src/types.ts` re-exports this entire module so
 * all existing `import type { … } from "../types"` paths continue to work
 * without modification.
 */

// ─── Primitive union types ─────────────────────────────────────────────────────

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "REVIEW" | "PRELIMINARY";
export type OverallPriority = "PRELIMINARY REVIEW" | "HIGH" | "MEDIUM" | "LOW" | "HIGH (low confidence)";
export type AnalysisMode = "LOCALIZED_HOTSPOT" | "GLOBAL_DIFF";
export type ReliabilityTier = "VERIFIED" | "REVIEW" | "PRELIMINARY";
export type ReliabilityLevel = "PRELIMINARY" | "LOW" | "MODERATE" | "GOOD";
export type SceneComparability = "VERY LOW" | "LOW" | "MODERATE" | "GOOD";

export type ViewerImage = "baseImage" | "recentImage" | "annotatedImage" | "heatmapImage";
export type ActiveTab = "analyse" | "how" | "summary";

export type AnalystDecision =
  | "Pending review"
  | "Confirmed change"
  | "False positive"
  | "Needs better image pair"
  | "Escalate for review";

// ─── Profile ───────────────────────────────────────────────────────────────────

export type ProfileKey =
  | "Defence / Security"
  | "Urban development"
  | "Environmental monitoring"
  | "Disaster assessment"
  | "Agriculture / vegetation"
  | "Water-body change";

/**
 * Per-profile weighting and threshold configuration.
 * Consumed by `src/profiles.ts` and the engine.
 */
export interface AnalysisProfile {
  thresholdBias: number;
  minAreaScale: number;
  maxDetections: number;
  structuralWeight: number;
  spectralWeight: number;
  compactnessWeight: number;
  areaWeight: number;
  edgeWeight: number;
  label: string;
  summary: string;
  color: string;
}

/**
 * @deprecated Use `AnalysisProfile` instead. Kept for backwards compatibility
 * with any code that still references `ProfileConfig` by name.
 */
export type ProfileConfig = AnalysisProfile;

// ─── Geo types ─────────────────────────────────────────────────────────────────

export type GeoPoint = [number, number];
export type GeoBBox = [number, number, number, number];
export type GeoTransform = [number, number, number, number, number, number];
export type GeoSourceImage = "T1" | "T2";
export type GeoModelType = "geographic" | "projected" | "unknown";

export interface GeoReferenceMetadata {
  sourceImage: GeoSourceImage;
  crs: string | null;
  transform: GeoTransform;
  pixelResolution: [number, number];
  boundingBox: GeoBBox;
  width: number;
  height: number;
  modelType: GeoModelType;
}

export interface GeoMetadataSummary {
  available: boolean;
  referenceImage: GeoSourceImage | null;
  crs: string | null;
  transform: GeoTransform | null;
  pixelResolution: [number, number] | null;
  boundingBox: GeoBBox | null;
  baseline: GeoReferenceMetadata | null;
  recent: GeoReferenceMetadata | null;
}

export interface GeoReferencePair {
  baseline: GeoReferenceMetadata | null;
  recent: GeoReferenceMetadata | null;
}

// ─── Image pair ────────────────────────────────────────────────────────────────

/**
 * A before/after image pair supplied by the user, along with optional
 * geo-reference metadata extracted from GeoTIFF tags.
 */
export interface ImagePair {
  /** Baseline (T1) image element or canvas. */
  baseline: HTMLImageElement | HTMLCanvasElement;
  /** Recent (T2) image element or canvas. */
  recent: HTMLImageElement | HTMLCanvasElement;
  /** Optional geo-reference metadata for both images. */
  geoReferences?: GeoReferencePair;
}

// ─── Pipeline configuration ────────────────────────────────────────────────────

/**
 * Tunable parameters forwarded to the analysis pipeline from the UI.
 */
export interface PipelineConfig {
  /** Width (px) to which both images are scaled before analysis. */
  resolution: number;
  /** Change sensitivity 0–100 (higher → more detections). */
  sensitivity: number;
  /** Minimum connected-component area (px²) to report as a detection. */
  minimumAreaPx: number;
  /** Analysis profile key that controls weighting and thresholds. */
  profile: ProfileKey;
  /** Whether to render detection-label overlays. */
  showLabels: boolean;
  /** Whether to apply per-channel histogram equalization before analysis. */
  normalize?: boolean;
  /** False-positive filter threshold (0-100) — adjusts min score for detections. */
  falsePositiveFilter?: number;
}

// ─── Review region (detection) ─────────────────────────────────────────────────

/**
 * A single review region produced by the analysis pipeline.
 *
 * Named `ReviewRegion` for clarity; the engine internally calls these
 * "detections" and the `Detection` alias below preserves that.
 */
export interface ReviewRegion {
  id: number;
  type: string;
  priority: Priority;
  score: number;
  areaPx: number;
  compactness: number;
  meanDelta: number;
  pixelCenter: [number, number];
  bbox: [number, number, number, number];
  geoCenter: GeoPoint | null;
  geoBBox: GeoBBox | null;
  areaM2: number | null;
  gridRef: string;
  objectType?: string;
  analystNote: string;
  analystDecision: AnalystDecision;
  reviewed: boolean;
  /** Present only for hint-mode detections. */
  evidence?: string;
}

/**
 * @deprecated Use `ReviewRegion` instead. Kept for backwards compatibility.
 */
export type Detection = ReviewRegion;

// ─── Validation ────────────────────────────────────────────────────────────────

export interface ValidationGroundTruth {
  truePositives: number | null;
  falsePositives: number | null;
  falseNegatives: number | null;
}

/**
 * Computed validation metrics combining image-pair quality signals with
 * optional analyst-supplied ground-truth counts.
 */
export interface ValidationMetrics {
  totalReviewRegions: number;
  highConfidenceRegions: number;
  preliminaryRegions: number;
  sceneComparability: SceneComparability;
  ssimScore: number;
  meanAbsoluteDifference: number;
  psnr: number | null;
  registrationShift: [number, number];
  reviewRegionDensityPct: number;
  confidenceBand: ReliabilityTier;
  confidenceScore: number;
  manualVerificationRequired: boolean;
  groundTruth: ValidationGroundTruth;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
}

/**
 * @deprecated Use `ValidationMetrics` instead. Kept for backwards compatibility.
 */
export type ValidationMetricsReport = ValidationMetrics;

// ─── Timeline ──────────────────────────────────────────────────────────────────

export interface TimelineMetadata {
  baselineDate: string | null;
  recentDate: string | null;
}

// ─── Full analysis result ──────────────────────────────────────────────────────

/**
 * The complete output produced by `analysePair`, returned to the UI and
 * included in JSON / PDF / CSV exports.
 */
export interface AnalysisResult {
  timestampUtc: string;
  profile: ProfileKey;
  analysisPriority: OverallPriority;
  changedAreaPct: number;
  detectionCount: number;
  highPriorityFlags: number;
  maxScore: number;
  confidence: number;
  ssim: number;
  reliability: ReliabilityLevel;
  sceneComparability: SceneComparability;
  reliabilityGateApplied: boolean;
  scoringNote: string;
  manualVerificationRequired: boolean;
  detectionsAreConfirmed: boolean;
  preliminaryMode: boolean;
  visibleRegionLimit: number;
  totalReviewRegions: number;
  alignmentUsed: boolean;
  alignmentScore: number;
  brightnessDelta: number;
  contrastDelta: number;
  qualityNotes: string[];
  analysisMode: AnalysisMode;
  reliabilityTier: ReliabilityTier;
  maskChangedPct: number;
  alignmentShift: [number, number];
  meanAbsoluteDifference: number;
  psnr: number | null;
  reviewRegionDensityPct: number;
  regionsFiltered: number;
  timeline: TimelineMetadata;
  detections: ReviewRegion[];
  geoMetadata: GeoMetadataSummary;
  images: {
    baseImage: string;
    recentImage: string;
    annotatedImage: string;
    heatmapImage: string;
    originalBaseImage?: string;
    originalRecentImage?: string;
  };
  parameters: PipelineConfig;
}
