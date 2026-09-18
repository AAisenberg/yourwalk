-- Weekly resident planner readout (last 7 days, Australia/Melbourne).
-- Run in Supabase SQL editor as a project owner, or:
--   python pipeline/scripts/weekly_resident_analytics.py
-- Never select raw properties that could contain more than suburb.

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
)
SELECT 'sessions' AS metric, COUNT(DISTINCT session_id)::text AS value
FROM week
WHERE event_name = 'session_started'

UNION ALL
SELECT 'returning_devices', COUNT(*)::text
FROM (
  SELECT session_id
  FROM week
  GROUP BY session_id
  HAVING COUNT(DISTINCT (created_at AT TIME ZONE 'Australia/Melbourne')::date) >= 2
) r

UNION ALL
SELECT 'finds_started', COUNT(*)::text
FROM week
WHERE event_name = 'find_started'

UNION ALL
SELECT 'finds_completed', COUNT(*)::text
FROM week
WHERE event_name = 'find_completed'

UNION ALL
SELECT 'avg_options_per_find',
  COALESCE(ROUND(AVG((properties ->> 'option_count')::numeric), 2)::text, '0')
FROM week
WHERE event_name = 'find_completed'

UNION ALL
SELECT 'finds_failed', COUNT(*)::text
FROM week
WHERE event_name = 'find_failed'

UNION ALL
SELECT 'use_this_route', COUNT(*)::text
FROM week
WHERE event_name = 'use_this_route'

UNION ALL
SELECT
  'intent:' || COALESCE(properties ->> 'intent', 'unknown'),
  COUNT(*)::text
FROM week
WHERE event_name = 'find_started'
GROUP BY 1

UNION ALL
SELECT
  'suburb:' || COALESCE(properties ->> 'suburb', 'unknown'),
  COUNT(*)::text
FROM week
WHERE event_name = 'area_context'
GROUP BY 1

UNION ALL
SELECT
  'layer:' || COALESCE(properties ->> 'layer', 'unknown')
    || CASE WHEN (properties ->> 'layer_on') = 'true' THEN ':on' ELSE ':off' END,
  COUNT(*)::text
FROM week
WHERE event_name = 'layer_toggled'
GROUP BY 1

ORDER BY 1;
