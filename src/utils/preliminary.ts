import type { AnalysisResult } from "../types";

type PreliminaryFields = Pick<AnalysisResult, "preliminaryMode" | "reliability" | "ssim">;

export function isPreliminaryReview(result: PreliminaryFields): boolean {
  return result.ssim < 0.20 || result.reliability === "PRELIMINARY" || result.preliminaryMode;
}
