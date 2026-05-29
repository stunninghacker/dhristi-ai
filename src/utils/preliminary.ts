import type { AnalysisResult, Detection } from "../types";

type PreliminaryFields = Pick<AnalysisResult, "preliminaryMode" | "reliability" | "ssim">;
type VisualFlagFields = Pick<Detection, "analystDecision" | "priority" | "score">;

export const VISUAL_FLAG_SCORE_THRESHOLD = 68;

export function isPreliminaryReview(result: PreliminaryFields): boolean {
  return result.ssim < 0.20 || result.reliability === "PRELIMINARY" || result.preliminaryMode;
}

export function isVisualFlagRegion(detection: VisualFlagFields): boolean {
  return detection.analystDecision === "Confirmed change" ||
    detection.priority === "CRITICAL" ||
    detection.score >= VISUAL_FLAG_SCORE_THRESHOLD;
}

export function countVisualFlagRegions(detections: VisualFlagFields[]): number {
  return detections.filter(isVisualFlagRegion).length;
}
