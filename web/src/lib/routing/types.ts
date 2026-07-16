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
};

export type RankMode = "day" | "night" | "accessibility";
