export type ScoreField =
  | "day_index_score"
  | "night_index_score"
  | "accessibility_score";

export const SCORE_FIELD_LABELS: Record<ScoreField, string> = {
  day_index_score: "Day Index",
  night_index_score: "Night Index",
  accessibility_score: "Accessibility",
};

/**
 * Casey v1.1.2 score distribution (eligible segments) — stretch the choropleth
 * so the map shows relative variation within the LGA.
 *
 * Absolute 0–100 scores still appear in popups. A fixed 0–100 colour ramp makes
 * Night/Accessibility look almost uniformly green (medians ~81 / ~80).
 *
 * Source: segment_scores.parquet, 15 Jul 2026 re-score.
 */
export const CASEY_SCORE_RAMPS: Record<
  ScoreField,
  { knots: number[]; note: string }
> = {
  day_index_score: {
    // p5≈52, p25≈59, p50≈65, p75≈69, p95≈75
    knots: [45, 55, 62, 68, 75, 85],
    note: "Casey Day range (stretched) · absolute score in popup",
  },
  night_index_score: {
    knots: [60, 70, 76, 81, 85, 92],
    note: "Casey Night range (stretched) · absolute score in popup",
  },
  accessibility_score: {
    knots: [55, 66, 73, 80, 86, 95],
    note: "Casey Accessibility range (stretched) · absolute score in popup",
  },
};

export const RAMP_COLORS = [
  "#b91c1c",
  "#f97316",
  "#facc15",
  "#84cc16",
  "#22c55e",
  "#15803d",
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Colour for a score on the active field’s Casey-stretched ramp. */
export function scoreColor(
  score: number | null | undefined,
  field: ScoreField = "day_index_score",
): string {
  if (score == null || Number.isNaN(score)) return "#64748b";
  const { knots } = CASEY_SCORE_RAMPS[field];
  if (score <= knots[0]) return RAMP_COLORS[0];
  if (score >= knots[knots.length - 1]) {
    return RAMP_COLORS[RAMP_COLORS.length - 1];
  }
  for (let i = 0; i < knots.length - 1; i++) {
    if (score <= knots[i + 1]) {
      const t = (score - knots[i]) / (knots[i + 1] - knots[i]);
      const a = hexToRgb(RAMP_COLORS[i]);
      const b = hexToRgb(RAMP_COLORS[i + 1]);
      return rgbToHex(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      );
    }
  }
  return RAMP_COLORS[RAMP_COLORS.length - 1];
}

export function legendStops(
  field: ScoreField,
): { value: number; color: string }[] {
  const { knots } = CASEY_SCORE_RAMPS[field];
  return knots.map((value, i) => ({
    value,
    color: RAMP_COLORS[i],
  }));
}

export const CASEY_BOUNDS = {
  west: 145.18,
  south: -38.25,
  east: 145.42,
  north: -37.95,
} as const;
