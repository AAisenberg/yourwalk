-- YourWalk Council insights: allow dashboard usage events (docs/DASHBOARD.md DB-7)
-- Project: muxatxlmpbkrsygmxcje
-- Same table, same privacy rules as ADR-013. Dashboard events are prefixed dash_.

ALTER TABLE public.analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_name_chk;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_name_chk CHECK (
    event_name IN (
      'session_started',
      'find_started',
      'find_completed',
      'find_failed',
      'route_selected',
      'use_this_route',
      'layer_toggled',
      'area_context',
      'dash_session_started',
      'dash_view_changed',
      'dash_area_opened',
      'dash_layer_toggled',
      'dash_path_opened',
      'dash_resident_app_opened'
    )
  );

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
      'area_context',
      'dash_session_started',
      'dash_view_changed',
      'dash_area_opened',
      'dash_layer_toggled',
      'dash_path_opened',
      'dash_resident_app_opened'
    )
  );
