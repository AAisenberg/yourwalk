import type { ExpressionSpecification } from "mapbox-gl";

import type { IndexMode, ScoreView } from "@/lib/dashboard/areas";
import { CASEY_SCORE_RAMPS, RAMP_COLORS } from "@/lib/scores";

export type DashboardField =
  | "day_index_score"
  | "night_index_score"
  | "accessibility_score"
  | "heat_shade_score"
  | "lighting_after_dark_score";

/**
 * Colour scales under review (24 Sep 2026). "current" is the lab red-to-green.
 * The two candidates avoid the red/green axis that about 1 in 12 men cannot
 * separate, and avoid red reading as "danger". Low scores stay warm.
 */
export type RampId = "current" | "teal" | "blue";

export const RAMPS: Record<RampId, { label: string; colors: readonly string[] }> = {
  current: { label: "Current (red to green)", colors: RAMP_COLORS },
  teal: {
    label: "Option A (orange to teal)",
    colors: ["#9A3412", "#EA580C", "#F59E0B", "#9CCFB8", "#1FA89F", "#0B6E69"],
  },
  blue: {
    label: "Option B (orange to navy)",
    colors: ["#B45309", "#F59E0B", "#FCD34D", "#7DD3FC", "#27AAE1", "#292984"],
  },
};

/**
 * Casey-stretched knots (0–100). Index and Footpaths reuse the lab ramps.
 * Stream knots from eligible segments, v1.1.3 (24 Sep 2026): heat and shade
 * p5≈17, p50≈42, p95≈69; night lighting is bimodal (a cluster near 40 for
 * poorly lit paths, most paths 77–85).
 */
const KNOTS: Record<DashboardField, number[]> = {
  day_index_score: CASEY_SCORE_RAMPS.day_index_score.knots,
  night_index_score: CASEY_SCORE_RAMPS.night_index_score.knots,
  accessibility_score: CASEY_SCORE_RAMPS.accessibility_score.knots,
  heat_shade_score: [15, 25, 35, 45, 55, 72],
  lighting_after_dark_score: [40, 60, 72, 78, 82, 86],
};

export function fieldFor(mode: IndexMode, view: ScoreView): DashboardField {
  if (view === "footpaths") return "accessibility_score";
  if (view === "stream") return mode === "day" ? "heat_shade_score" : "lighting_after_dark_score";
  return mode === "day" ? "day_index_score" : "night_index_score";
}

export function colorExpression(field: DashboardField, ramp: RampId = "current"): ExpressionSpecification {
  const colors = RAMPS[ramp].colors;
  const interpolate: ExpressionSpecification = ["interpolate", ["linear"], ["get", field]];
  KNOTS[field].forEach((k, i) => interpolate.push(k, colors[i]));
  return ["case", ["==", ["typeof", ["get", field]], "number"], interpolate, "#64748b"];
}

export function rampColors(ramp: RampId = "current"): readonly string[] {
  return RAMPS[ramp].colors;
}

export function isRampId(v: string | null): v is RampId {
  return v === "current" || v === "teal" || v === "blue";
}
