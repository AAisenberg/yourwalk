-- Public bucket for static map artefacts (segment scores GeoJSON).
-- Uploaded by pipeline/scripts/upload_segment_scores_geojson.py

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'map-data',
  'map-data',
  true,
  52428800, -- 50 MB
  ARRAY[
    'application/geo+json',
    'application/json',
    'application/gzip',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for map-data objects
DROP POLICY IF EXISTS "Public read map-data" ON storage.objects;
CREATE POLICY "Public read map-data"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'map-data');

-- Service role / authenticated upload handled by service_role key in pipeline script
-- (bypasses RLS). Optional: allow authenticated inserts for future admin UI.
DROP POLICY IF EXISTS "Service role write map-data" ON storage.objects;
CREATE POLICY "Service role write map-data"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'map-data')
  WITH CHECK (bucket_id = 'map-data');
