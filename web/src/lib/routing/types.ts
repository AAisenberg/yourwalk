export type LngLat = { lng: number; lat: number };

export type RouteScore = {
  day_index_score: number | null;
  night_index_score: number | null;
  accessibility_score: number | null;
  day_display: number | null;
  night_display: number | null;
  accessibility_display: number | null;
  confidence_day: string;
  confidence_night: string;
  segment_count: number;
  matched_length_m: number;
  coverage_ratio: number;
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
};

export type RankMode = "day" | "night" | "accessibility";
