import type { ProfileKey } from "../types";

export interface ProfileDisplayConfig {
  ssimThreshold: number;
  minRegionSize: number;
  confidenceThreshold: number;
  flagSensitivity: number;
  displayName: string;
  description: string;
}

export const DEFENCE: ProfileDisplayConfig = {
  ssimThreshold: 0.65,
  minRegionSize: 48,
  confidenceThreshold: 0.55,
  flagSensitivity: 0.85,
  displayName: "Defence / Security",
  description: "Flags compact, object-like activity signals for analyst-safe security triage.",
};

export const URBAN: ProfileDisplayConfig = {
  ssimThreshold: 0.55,
  minRegionSize: 100,
  confidenceThreshold: 0.50,
  flagSensitivity: 0.70,
  displayName: "Urban",
  description: "Highlights built-up expansion, roads, rooftops, and infrastructure shifts.",
};

export const ENVIRONMENT: ProfileDisplayConfig = {
  ssimThreshold: 0.45,
  minRegionSize: 160,
  confidenceThreshold: 0.45,
  flagSensitivity: 0.55,
  displayName: "Environmental",
  description: "Surfaces broad land-cover, vegetation, water, and soil spectral changes.",
};

export const DISASTER: ProfileDisplayConfig = {
  ssimThreshold: 0.35,
  minRegionSize: 80,
  confidenceThreshold: 0.40,
  flagSensitivity: 0.90,
  displayName: "Disaster",
  description: "Prioritises flood, fire, debris, and damage signals for rapid post-event review.",
};

export const AGRICULTURE: ProfileDisplayConfig = {
  ssimThreshold: 0.50,
  minRegionSize: 150,
  confidenceThreshold: 0.45,
  flagSensitivity: 0.60,
  displayName: "Agriculture",
  description: "Detects crop condition, vegetation loss, exposed soil, and field-level spectral shifts.",
};

export const WATER: ProfileDisplayConfig = {
  ssimThreshold: 0.40,
  minRegionSize: 120,
  confidenceThreshold: 0.42,
  flagSensitivity: 0.65,
  displayName: "Water-body",
  description: "Tracks shoreline movement, water extent, reservoir, and surface changes.",
};

export const PROFILE_DISPLAY_CONFIGS: Record<ProfileKey, ProfileDisplayConfig> = {
  "Defence / Security": DEFENCE,
  "Urban development": URBAN,
  "Environmental monitoring": ENVIRONMENT,
  "Disaster assessment": DISASTER,
  "Agriculture / vegetation": AGRICULTURE,
  "Water-body change": WATER,
};
