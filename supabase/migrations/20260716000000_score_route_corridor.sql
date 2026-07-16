-- YourWalk Sprint C — length-weighted route scoring over segment_scores
-- Apply when DATABASE_URL is available (pipeline/.env) or via Supabase SQL editor.
-- Called from web as: supabase.rpc('score_route_corridor', { route_geojson, buffer_m })

CREATE OR REPLACE FUNCTION public.score_route_corridor(
  route_geojson jsonb,
  buffer_m double precision DEFAULT 20
)
RETURNS TABLE (
  segment_count bigint,
  route_length_m double precision,
  matched_length_m double precision,
  coverage_ratio double precision,
  day_index_score double precision,
  night_index_score double precision,
  accessibility_score double precision,
  confidence_day text,
  confidence_night text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH route AS (
    SELECT
      ST_SetSRID(
        ST_GeomFromGeoJSON(route_geojson::text),
        4326
      ) AS geom
  ),
  route_m AS (
    SELECT
      geom,
      ST_Transform(geom, 7855) AS geom_m,
      ST_Length(ST_Transform(geom, 7855)) AS route_length_m
    FROM route
  ),
  corridor AS (
    SELECT
      ST_Buffer(geom_m, buffer_m) AS buf_m,
      route_length_m
    FROM route_m
  ),
  hits AS (
    SELECT
      s.day_index_score,
      s.night_index_score,
      s.accessibility_score,
      s.confidence_day,
      s.confidence_night,
      ST_Length(
        ST_Intersection(ST_Transform(s.geometry, 7855), c.buf_m)
      ) AS overlap_m
    FROM public.segment_scores s
    CROSS JOIN corridor c
    WHERE s.score_eligible
      AND s.geometry IS NOT NULL
      AND ST_Intersects(ST_Transform(s.geometry, 7855), c.buf_m)
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS segment_count,
      (SELECT route_length_m FROM corridor) AS route_length_m,
      COALESCE(SUM(overlap_m), 0) AS matched_length_m,
      CASE
        WHEN COALESCE(SUM(overlap_m), 0) > 0 THEN
          SUM(day_index_score * overlap_m) / SUM(overlap_m)
        ELSE NULL
      END AS day_index_score,
      CASE
        WHEN COALESCE(SUM(overlap_m), 0) > 0 THEN
          SUM(night_index_score * overlap_m) / SUM(overlap_m)
        ELSE NULL
      END AS night_index_score,
      CASE
        WHEN COALESCE(SUM(overlap_m), 0) > 0 THEN
          SUM(accessibility_score * overlap_m) / SUM(overlap_m)
        ELSE NULL
      END AS accessibility_score,
      MODE() WITHIN GROUP (ORDER BY confidence_day) AS confidence_day,
      MODE() WITHIN GROUP (ORDER BY confidence_night) AS confidence_night
    FROM hits
    WHERE overlap_m > 0.5
  )
  SELECT
    segment_count,
    route_length_m,
    matched_length_m,
    CASE
      WHEN route_length_m > 0 THEN matched_length_m / route_length_m
      ELSE 0
    END AS coverage_ratio,
    day_index_score,
    night_index_score,
    accessibility_score,
    CASE
      WHEN route_length_m > 0 AND matched_length_m / route_length_m < 0.35
        THEN 'reduced'
      ELSE COALESCE(confidence_day, 'reduced')
    END AS confidence_day,
    CASE
      WHEN route_length_m > 0 AND matched_length_m / route_length_m < 0.35
        THEN 'reduced'
      ELSE COALESCE(confidence_night, 'reduced')
    END AS confidence_night
  FROM agg;
$$;

COMMENT ON FUNCTION public.score_route_corridor(jsonb, double precision) IS
  'Sprint C: length-weighted Day/Night/Accessibility scores for a walk route LineString (GeoJSON), 20 m corridor default.';

GRANT EXECUTE ON FUNCTION public.score_route_corridor(jsonb, double precision)
  TO anon, authenticated, service_role;
