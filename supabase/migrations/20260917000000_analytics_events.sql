-- YourWalk resident planner — first-party anonymous usage events (ADR-013)
-- Project: muxatxlmpbkrsygmxcje
-- Insert via POST /api/events. No public read. No coordinates or addresses.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid NOT NULL,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT analytics_events_name_chk CHECK (
    event_name IN (
      'session_started',
      'find_started',
      'find_completed',
      'find_failed',
      'route_selected',
      'use_this_route',
      'layer_toggled',
      'area_context'
    )
  ),
  CONSTRAINT analytics_events_props_size_chk CHECK (pg_column_size(properties) < 2048)
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx
  ON public.analytics_events (event_name);

CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON public.analytics_events (session_id);

COMMENT ON TABLE public.analytics_events IS
  'Anonymous resident planner events. session_id is a device-local UUID, not an account. Properties are allowlisted (suburb, never lat/lon or address).';

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.analytics_events FROM PUBLIC;
REVOKE ALL ON public.analytics_events FROM anon, authenticated;

GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT ALL ON public.analytics_events TO service_role;

DROP POLICY IF EXISTS "Anon can insert analytics events" ON public.analytics_events;

CREATE POLICY "Anon can insert analytics events"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_name IN (
      'session_started',
      'find_started',
      'find_completed',
      'find_failed',
      'route_selected',
      'use_this_route',
      'layer_toggled',
      'area_context'
    )
  );
