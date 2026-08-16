export type LngLat = { lng: number; lat: number };

export type RouteScore = {
  day_index_score: number | null;
  night_index_score: number | null;
  accessibility_score: number | null;
  /** Heat & Shade stream (Day Index 40%). May be derived from day + accessibility. */
  heat_shade_score: number | null;
  /** Lighting / After Dark stream (Night Index 40%). */
  lighting_after_dark_score: number | null;
  /** Day Index / 10 — full 60/40 blend (not a stream pill). */
  day_display: number | null;
  /** Night Index / 10 — full 60/40 blend (not a stream pill). */
  night_display: number | null;
  accessibility_display: number | null;
  /** Heat & Shade stream / 10 — resident “Heat & Shade” pill. */
  heat_shade_display: number | null;
  /** Lighting stream / 10 — resident “Lighting” pill. */
  lighting_display: number | null;
  confidence_day: string;
  confidence_night: string;
  segment_count: number;
  matched_length_m: number;
  coverage_ratio: number;
  /**
   * Share of matched corridor length on Casey shared-use path class (0–1).
   * Preference bias only — not part of Day/Night index maths.
   */
  shared_use_ratio: number;
  source: "client-geojson" | "postgis";
};

export type ScoredRoute = {
  id: string;
  index: number;
  distance_m: number;
  duration_s: number;
  geometry: GeoJSON.LineString;
  score: RouteScore;
  /** Diversification strategy that produced this geometry (QA). */
  strategy?: string;
  /** Soft amenity proximity note for Around-here cards (not index maths). */
  amenity_note?: string;
  /** Outing shape honesty (e.g. fell back from circuit to same-path home). */
  outing_note?: string;
  /**
   * 0–100 match used for ranking. When set, the UI must show this (not a
   * recomputed trip score that can disagree with card order).
   */
  match_score?: number;
  /**
   * Share of Streets probes that looked like road-centre footway before any
   * sidewalk paint nudge (Track 0). Used as a soft match penalty.
   */
  centreline_look_share?: number;
  /** True when Mapbox geometry was shifted toward mapped sidewalks for paint. */
  paint_nudged?: boolean;
};

export type RankMode = "day" | "night" | "accessibility";
