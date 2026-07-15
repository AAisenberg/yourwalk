-- YourWalk Sprint A — scored segments production table
-- Project: muxatxlmpbkrsygmxcje (YourWalk)
-- Source: pipeline/data/intermediate/segment_scores.parquet

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.segment_scores (
  segment_id bigint PRIMARY KEY,
  geometry geometry(Polygon, 4326) NOT NULL,
  walk_path_class text,
  score_eligible boolean NOT NULL DEFAULT true,
  suburb text,
  ward text,
  length_m double precision,
  score_width double precision,
  score_surface double precision,
  score_speed double precision,
  score_graffiti double precision,
  score_school_crossing_bonus double precision,
  accessibility_score double precision,
  score_heat double precision,
  score_canopy double precision,
  score_comfort double precision,
  heat_shade_score double precision,
  day_index_score double precision,
  score_lighting double precision,
  score_crash double precision,
  lighting_after_dark_score double precision,
  night_index_score double precision,
  day_index_display double precision,
  night_index_display double precision,
  confidence_day text,
  confidence_night text,
  data_vintage text,
  scored_at timestamptz,
  methodology_version text,
  scoring_spec_version text,
  loaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS segment_scores_geometry_gix
  ON public.segment_scores USING GIST (geometry);

CREATE INDEX IF NOT EXISTS segment_scores_suburb_idx
  ON public.segment_scores (suburb);

CREATE INDEX IF NOT EXISTS segment_scores_eligible_idx
  ON public.segment_scores (score_eligible);

CREATE INDEX IF NOT EXISTS segment_scores_spec_idx
  ON public.segment_scores (scoring_spec_version);

COMMENT ON TABLE public.segment_scores IS
  'YourWalk Day/Night Vulnerability Index scores per T1EAM footpath segment. Pipeline SoT remains GeoParquet.';

ALTER TABLE public.segment_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon and authenticated can read segment scores"
  ON public.segment_scores;

CREATE POLICY "Anon and authenticated can read segment scores"
  ON public.segment_scores
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.segment_scores TO anon, authenticated;
GRANT ALL ON public.segment_scores TO service_role;
