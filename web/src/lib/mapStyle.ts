import { CASEY_SCORE_RAMPS, RAMP_COLORS, type ScoreField } from "@/lib/scores";
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "mapbox-gl";

/**
 * Casey-stretched choropleth (higher = better within LGA distribution).
 * Knots from CASEY_SCORE_RAMPS — not a linear 0–100 absolute scale.
 */
export function scoreColorExpression(
  scoreField: ScoreField,
): ExpressionSpecification {
  const { knots } = CASEY_SCORE_RAMPS[scoreField];
  const interpolate: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["get", scoreField],
  ];
  for (let i = 0; i < knots.length; i++) {
    interpolate.push(knots[i], RAMP_COLORS[i]);
  }
  return [
    "case",
    ["==", ["typeof", ["get", scoreField]], "number"],
    interpolate,
    "#64748b",
  ];
}

/**
 * City / suburb zoom: draw polygon exteriors as score-coloured strokes.
 * Thin T1EAM footpath polygons read as a network; fill shards are avoided.
 */
export function segmentsLinePaint(
  scoreField: ScoreField,
): LineLayerSpecification["paint"] {
  return {
    "line-color": scoreColorExpression(scoreField),
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      9,
      1.2,
      11,
      1.5,
      13,
      2.0,
      15,
      2.6,
      17,
      3.4,
    ],
    "line-opacity": 0.9,
  };
}

/** Street-level zoom only: true polygon footprint. */
export function segmentsFillPaint(
  scoreField: ScoreField,
): FillLayerSpecification["paint"] {
  return {
    "fill-color": scoreColorExpression(scoreField),
    "fill-opacity": 0.55,
  };
}

export const SEGMENTS_FILL_MIN_ZOOM = 15;
