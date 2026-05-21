import type { SceneComparability } from "../types";

export interface ReliabilityPossibleCause {
  status: "Possible cause";
  cause: string;
}

const LOW_COMPARABILITY_CAUSES = [
  "sensor mismatch",
  "lighting difference",
  "seasonal variation",
  "crop or resolution mismatch",
  "registration uncertainty",
  "cloud/shadow or haze",
] as const;

export function getReliabilityPossibleCauses(
  sceneComparability: SceneComparability,
): ReliabilityPossibleCause[] {
  if (sceneComparability !== "LOW" && sceneComparability !== "VERY LOW") {
    return [];
  }

  return LOW_COMPARABILITY_CAUSES.map(cause => ({
    status: "Possible cause",
    cause,
  }));
}
