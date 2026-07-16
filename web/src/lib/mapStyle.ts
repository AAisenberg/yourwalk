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
 * Lab scored network — T1EAM polygons filled like Leaflet QA
 * (`fillOpacity` ~0.72, hairline outline). Do not use line-only on polygons
 * (that strokes rings → shards).
 */
export function segmentsFillPaint(
  scoreField: ScoreField,
): FillLayerSpecification["paint"] {
  return {
    "fill-color": scoreColorExpression(scoreField),
    "fill-opacity": 0.72,
  };
}

/** Hairline outline matching fill colour (Leaflet weight: 1). */
export function segmentsOutlinePaint(
  scoreField: ScoreField,
): LineLayerSpecification["paint"] {
  return {
    "line-color": scoreColorExpression(scoreField),
    "line-width": 1,
    "line-opacity": 0.9,
  };
}

/** @deprecated Use segmentsOutlinePaint — kept for call-site migration. */
export function segmentsLinePaint(
  scoreField: ScoreField,
): LineLayerSpecification["paint"] {
  return segmentsOutlinePaint(scoreField);
}
