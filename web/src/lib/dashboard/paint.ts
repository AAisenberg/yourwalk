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

export function colorExpression(field: DashboardField): ExpressionSpecification {
  const interpolate: ExpressionSpecification = ["interpolate", ["linear"], ["get", field]];
  KNOTS[field].forEach((k, i) => interpolate.push(k, RAMP_COLORS[i]));
  return ["case", ["==", ["typeof", ["get", field]], "number"], interpolate, "#64748b"];
}

export function rampColors(): readonly string[] {
  return RAMP_COLORS;
}
