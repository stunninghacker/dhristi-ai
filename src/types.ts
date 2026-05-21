export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "REVIEW" | "PRELIMINARY";
export type OverallPriority = "PRELIMINARY REVIEW" | "HIGH" | "MEDIUM" | "LOW" | "HIGH (low confidence)";
export type AnalysisMode = "LOCALIZED_HOTSPOT" | "GLOBAL_DIFF";
export type ReliabilityTier = "VERIFIED" | "REVIEW" | "PRELIMINARY";
export type ReliabilityLevel = "PRELIMINARY" | "LOW" | "MODERATE" | "GOOD";
export type SceneComparability = "VERY LOW" | "LOW" | "MODERATE" | "GOOD";

export type ProfileKey =
  | "Defence / Security"
  | "Urban development"
  | "Environmental monitoring"
  | "Disaster assessment"
  | "Agriculture / vegetation"
  | "Water-body change";

export interface ProfileConfig {
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

export type GeoPoint = [number, number];
export type GeoBBox = [number, number, number, number];
export type GeoTransform = [number, number, number, number, number, number];
export type GeoSourceImage = "T1" | "T2";
export type GeoModelType = "geographic" | "projected" | "unknown";
export type AnalystDecision =
  | "Pending review"
  | "Confirmed change"
  | "False positive"
  | "Needs better image pair"
  | "Escalate for review";

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

export interface ValidationGroundTruth {
  truePositives: number | null;
  falsePositives: number | null;
  falseNegatives: number | null;
}

export interface ValidationMetricsReport {
  totalReviewRegions: number;
  highConfidenceRegions: number;
  preliminaryRegions: number;
  sceneComparability: SceneComparability;
  ssimScore: number;
  confidenceScore: number;
  manualVerificationRequired: boolean;
  groundTruth: ValidationGroundTruth;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
}

export interface Detection {
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
  analystNote: string;
  analystDecision: AnalystDecision;
  reviewed: boolean;
  evidence?: string;
}

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
  detections: Detection[];
  geoMetadata: GeoMetadataSummary;
  images: {
    baseImage: string;
    recentImage: string;
    annotatedImage: string;
    heatmapImage: string;
  };
  parameters: {
    resolution: number;
    sensitivity: number;
    minimumAreaPx: number;
    profile: ProfileKey;
  };
}

export type ViewerImage = "baseImage" | "recentImage" | "annotatedImage" | "heatmapImage";

export type ActiveTab = "analyse" | "how" | "summary";
