/**
 * Backwards-compatibility barrel.
 *
 * All types now live in `src/types/index.ts`.
 * This file re-exports everything so that every existing import path
 * (`from "./types"` or `from "../types"`) continues to resolve without
 * touching any other source file.
 */
export type {
  // Primitive unions
  Priority,
  OverallPriority,
  AnalysisMode,
  ReliabilityTier,
  ReliabilityLevel,
  SceneComparability,
  ViewerImage,
  ActiveTab,
  AnalystDecision,

  // Profile
  ProfileKey,
  AnalysisProfile,
  ProfileConfig,          // deprecated alias → AnalysisProfile

  // Geo
  GeoPoint,
  GeoBBox,
  GeoTransform,
  GeoSourceImage,
  GeoModelType,
  GeoReferenceMetadata,
  GeoMetadataSummary,
  GeoReferencePair,

  // Image pair & pipeline config
  ImagePair,
  PipelineConfig,

  // Review region
  ReviewRegion,
  Detection,              // deprecated alias → ReviewRegion

  // Validation
  ValidationGroundTruth,
  ValidationMetrics,
  ValidationMetricsReport, // deprecated alias → ValidationMetrics

  // Timeline & result
  TimelineMetadata,
  AnalysisResult,
} from "./types/index";

