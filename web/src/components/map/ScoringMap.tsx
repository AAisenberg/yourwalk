"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

import {
  defaultLgaBoundaryUrl,
  defaultSegmentsGeoJsonUrl,
  fetchLgaBoundary,
  fetchSegmentsGeoJSON,
} from "@/lib/fetchSegments";
import {
  type PathClassFilter,
  boundsForFilter,
  countMatching,
  listSuburbs,
  segmentsLayerFilter,
} from "@/lib/mapFilters";
import {
  SEGMENTS_FILL_MIN_ZOOM,
  segmentsFillPaint,
  segmentsLinePaint,
} from "@/lib/mapStyle";
import {
  CASEY_BOUNDS,
  CASEY_SCORE_RAMPS,
  SCORE_FIELD_LABELS,
  type ScoreField,
  legendStops,
} from "@/lib/scores";

type LoadPhase = "map" | "segments" | "ready" | "error";

function popupHtml(p: GeoJSON.GeoJsonProperties): string {
  if (!p) return "";
  return `<strong>Segment ${p.segment_id}</strong><br/>
    ${p.suburb ?? ""} · ${p.walk_path_class ?? ""}<br/>
    Day ${p.day_index_score ?? "—"} · Night ${p.night_index_score ?? "—"} · Acc ${p.accessibility_score ?? "—"}<br/>
    Confidence day: ${p.confidence_day ?? "—"} · night: ${p.confidence_night ?? "—"}<br/>
    Spec ${p.scoring_spec_version ?? "—"}`;
}

function resolveGeoJsonUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SEGMENTS_GEOJSON_URL?.trim();
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultSegmentsGeoJsonUrl(supabase);
  throw new Error(
    "Set NEXT_PUBLIC_SEGMENTS_GEOJSON_URL or NEXT_PUBLIC_SUPABASE_URL",
  );
}

function resolveLgaUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_LGA_BOUNDARY_URL?.trim();
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultLgaBoundaryUrl(supabase);
  return null;
}

export function ScoringMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);

  const [scoreField, setScoreField] = useState<ScoreField>("day_index_score");
  const [suburb, setSuburb] = useState<string>("all");
  const [pathClass, setPathClass] = useState<PathClassFilter>("all");
  const [suburbs, setSuburbs] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const [loadPhase, setLoadPhase] = useState<LoadPhase>("map");
  const [status, setStatus] = useState("Starting map…");
  const [meta, setMeta] = useState<{
    feature_count?: number;
    scoring_spec_version?: string | null;
  }>();
  const [error, setError] = useState<string | null>(null);
  const [lgaLoaded, setLgaLoaded] = useState(false);

  const loading = loadPhase === "map" || loadPhase === "segments";

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Set NEXT_PUBLIC_MAPBOX_TOKEN in web/.env.local");
      setLoadPhase("error");
      setStatus("Mapbox token missing");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    let geoUrl: string;
    try {
      geoUrl = resolveGeoJsonUrl();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadPhase("error");
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      bounds: [
        [CASEY_BOUNDS.west, CASEY_BOUNDS.south],
        [CASEY_BOUNDS.east, CASEY_BOUNDS.north],
      ],
      fitBoundsOptions: { padding: 40 },
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", async () => {
      setLoadPhase("segments");
      setStatus("Fetching scored segments (static GeoJSON)…");
      try {
        const body = await fetchSegmentsGeoJSON(geoUrl);
        const features = body.features ?? [];
        featuresRef.current = features;
        setSuburbs(listSuburbs(features));
        setMeta(body.meta);
        setVisibleCount(features.length);
        setStatus(`Drawing ${features.length.toLocaleString()} segments…`);

        // LGA outline under segments (context — not a score layer)
        const lgaUrl = resolveLgaUrl();
        if (lgaUrl) {
          try {
            const lga = await fetchLgaBoundary(lgaUrl);
            map.addSource("lga-boundary", {
              type: "geojson",
              data: lga,
            });
            map.addLayer({
              id: "lga-boundary-line",
              type: "line",
              source: "lga-boundary",
              paint: {
                "line-color": "#7dd3fc",
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  8,
                  1.5,
                  12,
                  2.5,
                  15,
                  3,
                ],
                "line-opacity": 0.85,
              },
            });
            setLgaLoaded(true);
          } catch (lgaErr) {
            console.warn("LGA boundary not loaded", lgaErr);
          }
        }

        map.addSource("segments", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features,
          },
          tolerance: 0,
          buffer: 128,
        });

        map.addLayer({
          id: "segments-line",
          type: "line",
          source: "segments",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: segmentsLinePaint(scoreField),
        });

        map.addLayer({
          id: "segments-fill",
          type: "fill",
          source: "segments",
          minzoom: SEGMENTS_FILL_MIN_ZOOM,
          paint: segmentsFillPaint(scoreField),
        });

        const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f?.properties) return;
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupHtml(f.properties))
            .addTo(map);
        };

        map.on("click", "segments-line", onClick);
        map.on("click", "segments-fill", onClick);

        for (const layerId of ["segments-line", "segments-fill"] as const) {
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        setStatus(
          `${body.meta?.feature_count?.toLocaleString() ?? features.length.toLocaleString()} segments · spec ${body.meta?.scoring_spec_version ?? "—"}`,
        );
        setLoadPhase("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(
          `${message}. Upload with: python scripts/upload_segment_scores_geojson.py`,
        );
        setStatus("Failed to load segments");
        setLoadPhase("error");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Choropleth field
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("segments-line")) return;

    const linePaint = segmentsLinePaint(scoreField);
    map.setPaintProperty("segments-line", "line-color", linePaint!["line-color"]);
    map.setPaintProperty("segments-line", "line-width", linePaint!["line-width"]);
    map.setPaintProperty(
      "segments-line",
      "line-opacity",
      linePaint!["line-opacity"],
    );

    if (map.getLayer("segments-fill")) {
      const fillPaint = segmentsFillPaint(scoreField);
      map.setPaintProperty(
        "segments-fill",
        "fill-color",
        fillPaint!["fill-color"],
      );
      map.setPaintProperty(
        "segments-fill",
        "fill-opacity",
        fillPaint!["fill-opacity"],
      );
    }
  }, [scoreField]);

  // Suburb / path-class filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("segments-line") || loadPhase !== "ready") return;

    const filter = segmentsLayerFilter(suburb, pathClass);
    map.setFilter("segments-line", filter);
    if (map.getLayer("segments-fill")) {
      map.setFilter("segments-fill", filter);
    }

    const n = countMatching(featuresRef.current, suburb, pathClass);
    setVisibleCount(n);

    const bounds = boundsForFilter(featuresRef.current, suburb, pathClass);
    if (suburb !== "all" && bounds) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 800 });
    } else if (suburb === "all") {
      map.fitBounds(
        [
          [CASEY_BOUNDS.west, CASEY_BOUNDS.south],
          [CASEY_BOUNDS.east, CASEY_BOUNDS.north],
        ],
        { padding: 40, duration: 800 },
      );
    }
  }, [suburb, pathClass, loadPhase]);

  const stops = legendStops(scoreField);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {loading ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-4 max-w-sm rounded-xl border border-slate-600 bg-slate-950/95 px-5 py-4 text-center shadow-xl">
            <div
              className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
              aria-hidden
            />
            <p className="text-sm font-medium text-slate-100">
              {loadPhase === "map"
                ? "Loading map…"
                : "Loading scored segments…"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{status}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              Static GeoJSON from Supabase Storage — one request (CDN-compressed)
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-10 max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/90 p-3 text-sm text-slate-100 shadow-lg backdrop-blur">
        <div className="mb-2 text-base font-semibold tracking-tight">
          YourWalk
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Casey scored footpaths · higher = better conditions · not a safety
          guarantee
        </p>

        <label className="mb-1 block text-xs font-medium text-slate-300">
          Style by
        </label>
        <select
          className="mb-3 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
          value={scoreField}
          onChange={(e) => setScoreField(e.target.value as ScoreField)}
          disabled={loading}
        >
          {(Object.keys(SCORE_FIELD_LABELS) as ScoreField[]).map((key) => (
            <option key={key} value={key}>
              {SCORE_FIELD_LABELS[key]}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-medium text-slate-300">
          Suburb
        </label>
        <select
          className="mb-3 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
          disabled={loading || suburbs.length === 0}
        >
          <option value="all">All Casey ({meta?.feature_count?.toLocaleString() ?? "—"})</option>
          {suburbs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-medium text-slate-300">
          Path class
        </label>
        <select
          className="mb-3 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
          value={pathClass}
          onChange={(e) => setPathClass(e.target.value as PathClassFilter)}
          disabled={loading}
        >
          <option value="all">All paths</option>
          <option value="footpath">Footpath</option>
          <option value="shared_use">Shared use</option>
        </select>

        <div className="mb-1 flex gap-0.5 text-[9px] leading-tight">
          {stops.map(({ value, color }) => (
            <span
              key={value}
              className="flex-1 rounded px-0.5 py-0.5 text-center text-slate-900"
              style={{ background: color }}
            >
              {value}
            </span>
          ))}
        </div>
        <p className="mb-2 text-[10px] text-slate-500">
          {CASEY_SCORE_RAMPS[scoreField].note}
        </p>

        <p className="text-xs text-slate-400">{status}</p>
        {visibleCount != null && loadPhase === "ready" ? (
          <p className="mt-1 text-[11px] text-sky-300/90">
            Showing {visibleCount.toLocaleString()} segments
            {suburb !== "all" || pathClass !== "all" ? " (filtered)" : ""}
          </p>
        ) : null}
        {meta?.scoring_spec_version ? (
          <p className="mt-1 text-[11px] text-slate-500">
            scoring_spec_version {meta.scoring_spec_version} · Storage
            {lgaLoaded ? " · Casey LGA outline" : ""}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-amber-400">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
