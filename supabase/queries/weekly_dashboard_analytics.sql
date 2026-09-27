-- Weekly Council insights readout (last 7 days, Australia/Melbourne).
-- Run in Supabase SQL editor as a project owner.
-- No street names, path IDs, or officer identities. Area is suburb or ward only.

WITH bounds AS (
  SELECT
    (date_trunc('day', timezone('Australia/Melbourne', now()))
      - interval '7 days') AT TIME ZONE 'Australia/Melbourne' AS week_start,
    now() AS week_end
),
week AS (
  SELECT e.*
  FROM public.analytics_events e, bounds b
  WHERE e.created_at >= b.week_start
    AND e.created_at < b.week_end
    AND e.event_name LIKE 'dash_%'
)
SELECT 'sessions' AS metric, COUNT(DISTINCT session_id)::text AS value
FROM week
WHERE event_name = 'dash_session_started'

UNION ALL
SELECT 'returning_devices', COUNT(*)::text
FROM (
  SELECT session_id
  FROM week
  GROUP BY session_id
  HAVING COUNT(DISTINCT (created_at AT TIME ZONE 'Australia/Melbourne')::date) >= 2
) r

UNION ALL
SELECT 'areas_opened', COUNT(*)::text
FROM week
WHERE event_name = 'dash_area_opened'

UNION ALL
SELECT 'paths_opened', COUNT(*)::text
FROM week
WHERE event_name = 'dash_path_opened'

UNION ALL
SELECT 'resident_app_opened', COUNT(*)::text
FROM week
WHERE event_name = 'dash_resident_app_opened'

UNION ALL
SELECT
  'when:' || COALESCE(properties ->> 'when', 'unknown'),
  COUNT(*)::text
FROM week
WHERE event_name = 'dash_view_changed'
GROUP BY 1

UNION ALL
SELECT
  'view:' || COALESCE(properties ->> 'view', 'unknown'),
  COUNT(*)::text
FROM week
WHERE event_name = 'dash_view_changed'
GROUP BY 1

UNION ALL
SELECT
  'area:' || COALESCE(properties ->> 'area', 'unknown'),
  COUNT(*)::text
FROM week
WHERE event_name = 'dash_area_opened'
GROUP BY 1

UNION ALL
SELECT
  'layer:' || COALESCE(properties ->> 'layer', 'unknown')
    || CASE WHEN (properties ->> 'layer_on') = 'true' THEN ':on' ELSE ':off' END,
  COUNT(*)::text
FROM week
WHERE event_name = 'dash_layer_toggled'
GROUP BY 1

ORDER BY 1;
