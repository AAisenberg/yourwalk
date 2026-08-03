"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_EVIDENCE,
  EVIDENCE_LAYER_DEFS,
  evidencePopupHtml,
  evidenceSuburbFilter,
  resolveEvidenceUrl,
  type EvidenceLayerId,
  type EvidenceState,
} from "@/lib/evidenceLayers";
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
import { segmentsFillPaint, segmentsOutlinePaint } from "@/lib/mapStyle";
import { formatDistance, formatDuration } from "@/lib/routing/geo";
import { planScoredRoutes, sortRoutes } from "@/lib/routing/planRoute";
import type { LngLat, RankMode, ScoredRoute } from "@/lib/routing/types";
import {
  CASEY_BOUNDS,
  CASEY_SCORE_RAMPS,
  SCORE_FIELD_LABELS,
  type ScoreField,
  legendStops,
} from "@/lib/scores";

import {
  BakeoffPanel,
  type BakeoffSelection,
} from "@/components/map/BakeoffPanel";

type LoadPhase = "map" | "segments" | "ready" | "error";
type PickMode = "idle" | "origin" | "destination";

type OdSamplePair = {
  id: string;
  label: string;
  verified?: boolean;
  why?: string;
  origin: { name: string; center: [number, number] };
  destination: { name: string; center: [number, number] };
};

const ROUTE_COLORS = ["#38bdf8", "#c084fc", "#fbbf24"] as const;

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

function displayOrDash(v: number | null): string {
  return v == null ? "—" : v.toFixed(1);
}

export function ScoringMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);
  const pickModeRef = useRef<PickMode>("idle");
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);

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

  const [pickMode, setPickMode] = useState<PickMode>("idle");
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [destination, setDestination] = useState<LngLat | null>(null);
  const [routes, setRoutes] = useState<ScoredRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [rankMode, setRankMode] = useState<RankMode>("day");
  const [planning, setPlanning] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [bakeoffOpen, setBakeoffOpen] = useState(false);
  const pendingBakeoffRef = useRef<BakeoffSelection | null>(null);
  const [odSample, setOdSample] = useState<OdSamplePair[]>([]);
  const [odSampleId, setOdSampleId] = useState<string>("");
  const [evidence, setEvidence] = useState<EvidenceState>(DEFAULT_EVIDENCE);
  const [evidenceLoading, setEvidenceLoading] =
    useState<EvidenceLayerId | null>(null);
  const evidenceHandlersRef = useRef<Set<string>>(new Set());

  const loading = loadPhase === "map" || loadPhase === "segments";

  useEffect(() => {
    let cancelled = false;
    fetch("/bakeoff/od_sample.json")
      .then((r) => {
        if (!r.ok) throw new Error(`od_sample.json ${r.status}`);
        return r.json();
      })
      .then((j: { pairs?: OdSamplePair[] }) => {
        if (cancelled) return;
        setOdSample(j.pairs ?? []);
      })
      .catch(() => {
        if (!cancelled) setOdSample([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  /** Returns false if style is not ready yet (do not add sources/layers). */
  const ensureRouteLayers = useCallback((map: mapboxgl.Map): boolean => {
    if (!map.isStyleLoaded()) return false;

    if (!map.getSource("routes")) {
      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "case",
            ["boolean", ["get", "selected"], false],
            7.5,
            4.5,
          ],
          "line-opacity": 0.92,
        },
      });
      map.on("click", "routes-line", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") setSelectedRouteId(id);
      });
      map.on("mouseenter", "routes-line", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "routes-line", () => {
        if (pickModeRef.current === "idle") {
          map.getCanvas().style.cursor = "";
        }
      });
    }
    if (!map.getSource("bakeoff-routes")) {
      map.addSource("bakeoff-routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "bakeoff-routes-line",
        type: "line",
        source: "bakeoff-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "case",
            ["==", ["get", "engine"], "challenger"],
            6.5,
            4.5,
          ],
          "line-opacity": 0.9,
        },
      });
    }
    return true;
  }, []);

  const applyBakeoffSelection = useCallback(
    (sel: BakeoffSelection | null) => {
      const map = mapRef.current;
      if (!map) return;
      if (!ensureRouteLayers(map)) {
        pendingBakeoffRef.current = sel;
        return;
      }
      pendingBakeoffRef.current = null;
      const src = map.getSource(
        "bakeoff-routes",
      ) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      if (!sel || !sel.features.length) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      src.setData({ type: "FeatureCollection", features: sel.features });
      const bounds = new mapboxgl.LngLatBounds();
      for (const f of sel.features) {
        const g = f.geometry;
        if (g?.type === "LineString") {
          for (const c of g.coordinates) bounds.extend(c as [number, number]);
        }
      }
      if (sel.origin) bounds.extend(sel.origin);
      if (sel.destination) bounds.extend(sel.destination);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 700 });
      }
      if (sel.mode === "day") setScoreField("day_index_score");
      if (sel.mode === "night") setScoreField("night_index_score");
    },
    [ensureRouteLayers],
  );

  const onBakeoffSelection = useCallback(
    (sel: BakeoffSelection | null) => {
      applyBakeoffSelection(sel);
    },
    [applyBakeoffSelection],
  );

  // Apply bake-off overlay once map + segments are ready (style loaded)
  useEffect(() => {
    if (loadPhase !== "ready") return;
    const map = mapRef.current;
    if (!map) return;
    const flush = () => {
      if (pendingBakeoffRef.current) {
        applyBakeoffSelection(pendingBakeoffRef.current);
      } else {
        ensureRouteLayers(map);
      }
    };
    if (map.isStyleLoaded()) {
      flush();
    } else {
      map.once("load", flush);
      map.once("idle", flush);
    }
  }, [loadPhase, applyBakeoffSelection, ensureRouteLayers]);

  const paintRoutes = useCallback(
    (list: ScoredRoute[], selectedId: string | null) => {
      const map = mapRef.current;
      if (!map?.getSource("routes")) return;
      const features: GeoJSON.Feature[] = list.map((r, i) => ({
        type: "Feature",
        properties: {
          id: r.id,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
          selected: r.id === selectedId,
        },
        geometry: r.geometry,
      }));
      (map.getSource("routes") as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features,
      });
    },
    [],
  );

  useEffect(() => {
    paintRoutes(routes, selectedRouteId);
  }, [routes, selectedRouteId, paintRoutes]);

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

        // Leaflet QA style: filled polygons + hairline outline (not line-on-ring)
        map.addLayer({
          id: "segments-fill",
          type: "fill",
          source: "segments",
          paint: segmentsFillPaint(scoreField),
        });
        map.addLayer({
          id: "segments-outline",
          type: "line",
          source: "segments",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: segmentsOutlinePaint(scoreField),
        });

        ensureRouteLayers(map);

        const onSegmentClick = (e: mapboxgl.MapLayerMouseEvent) => {
          if (pickModeRef.current !== "idle") return;
          const f = e.features?.[0];
          if (!f?.properties) return;
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupHtml(f.properties))
            .addTo(map);
        };

        for (const layerId of ["segments-fill", "segments-outline"] as const) {
          map.on("click", layerId, onSegmentClick);
          map.on("mouseenter", layerId, () => {
            if (pickModeRef.current === "idle") {
              map.getCanvas().style.cursor = "pointer";
            }
          });
          map.on("mouseleave", layerId, () => {
            if (pickModeRef.current === "idle") {
              map.getCanvas().style.cursor = "";
            }
          });
        }

        map.on("click", (e) => {
          const mode = pickModeRef.current;
          if (mode === "idle") return;
          const point: LngLat = { lng: e.lngLat.lng, lat: e.lngLat.lat };
          if (mode === "origin") {
            setOrigin(point);
            setPickMode("idle");
          } else {
            setDestination(point);
            setPickMode("idle");
          }
        });

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
      originMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Origin / destination markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (origin) {
      if (!originMarkerRef.current) {
        originMarkerRef.current = new mapboxgl.Marker({ color: "#22c55e" })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map);
      } else {
        originMarkerRef.current.setLngLat([origin.lng, origin.lat]);
      }
    } else {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    }

    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new mapboxgl.Marker({ color: "#ef4444" })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map);
      } else {
        destMarkerRef.current.setLngLat([destination.lng, destination.lat]);
      }
    } else {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
    }
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor =
      pickMode === "idle" ? "" : "crosshair";
  }, [pickMode]);

  // Choropleth field
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("segments-fill")) return;

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

    if (map.getLayer("segments-outline")) {
      const outline = segmentsOutlinePaint(scoreField);
      map.setPaintProperty(
        "segments-outline",
        "line-color",
        outline!["line-color"],
      );
      map.setPaintProperty(
        "segments-outline",
        "line-width",
        outline!["line-width"],
      );
      map.setPaintProperty(
        "segments-outline",
        "line-opacity",
        outline!["line-opacity"],
      );
    }
  }, [scoreField]);

  /** Lazy-load evidence point layers (street / park lights) on first toggle. */
  const syncEvidenceLayers = useCallback(
    (state: EvidenceState) => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded() || loadPhase !== "ready") return;

      for (const def of EVIDENCE_LAYER_DEFS) {
        const srcId = `evidence-${def.id}`;
        const layerId = `evidence-${def.id}-pts`;
        const on = state[def.id];
        const url = resolveEvidenceUrl(def);

        if (on) {
          if (!map.getSource(srcId)) {
            setEvidenceLoading(def.id);
            map.addSource(srcId, { type: "geojson", data: url });
            map.addLayer({
              id: layerId,
              type: "circle",
              source: srcId,
              paint: {
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  11,
                  def.radius[0],
                  15,
                  def.radius[1],
                ],
                "circle-color": def.color,
                "circle-stroke-width": 0.5,
                "circle-stroke-color": "#1e293b",
                "circle-opacity": 0.85,
              },
            });

            const suburbFilter = evidenceSuburbFilter(suburb);
            map.setFilter(layerId, suburbFilter);

            if (!evidenceHandlersRef.current.has(layerId)) {
              evidenceHandlersRef.current.add(layerId);
              const layerEvidenceId = def.id;
              map.on("click", layerId, (e) => {
                const f = e.features?.[0];
                if (!f?.properties) return;
                new mapboxgl.Popup()
                  .setLngLat(e.lngLat)
                  .setHTML(evidencePopupHtml(layerEvidenceId, f.properties))
                  .addTo(map);
              });
              map.on("mouseenter", layerId, () => {
                map.getCanvas().style.cursor = "pointer";
              });
              map.on("mouseleave", layerId, () => {
                map.getCanvas().style.cursor = "";
              });
            }

            const onSource = (ev: mapboxgl.MapSourceDataEvent) => {
              if (ev.sourceId === srcId && ev.isSourceLoaded) {
                setEvidenceLoading((cur) => (cur === def.id ? null : cur));
                map.off("sourcedata", onSource);
              }
            };
            map.on("sourcedata", onSource);
          } else if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", "visible");
          }
        } else if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", "none");
          setEvidenceLoading((cur) => (cur === def.id ? null : cur));
        }
      }
    },
    [loadPhase, suburb],
  );

  useEffect(() => {
    if (loadPhase !== "ready") return;
    syncEvidenceLayers(evidence);
  }, [evidence, loadPhase, syncEvidenceLayers]);

  // Suburb / path-class filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("segments-fill") || loadPhase !== "ready") return;

    const filter = segmentsLayerFilter(suburb, pathClass);
    map.setFilter("segments-fill", filter);
    if (map.getLayer("segments-outline")) {
      map.setFilter("segments-outline", filter);
    }

    const lightFilter = evidenceSuburbFilter(suburb);
    for (const def of EVIDENCE_LAYER_DEFS) {
      const layerId = `evidence-${def.id}-pts`;
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, lightFilter);
      }
    }

    const n = countMatching(featuresRef.current, suburb, pathClass);
    setVisibleCount(n);

    const bounds = boundsForFilter(featuresRef.current, suburb, pathClass);
    if (suburb !== "all" && bounds) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 800 });
    } else if (suburb === "all" && routes.length === 0) {
      map.fitBounds(
        [
          [CASEY_BOUNDS.west, CASEY_BOUNDS.south],
          [CASEY_BOUNDS.east, CASEY_BOUNDS.north],
        ],
        { padding: 40, duration: 800 },
      );
    }
  }, [suburb, pathClass, loadPhase, routes.length]);

  const onPlanRoute = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !origin || !destination) return;

    setPlanning(true);
    setRouteError(null);
    try {
      const scored = await planScoredRoutes(
        origin,
        destination,
        featuresRef.current,
        token,
        3,
        rankMode === "night" ? "night" : "day",
      );
      const ordered = sortRoutes(scored, rankMode);
      setRoutes(ordered);
      setSelectedRouteId(ordered[0]?.id ?? null);

      const map = mapRef.current;
      if (map && ordered.length) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const r of ordered) {
          for (const c of r.geometry.coordinates) {
            bounds.extend(c as [number, number]);
          }
        }
        bounds.extend([origin.lng, origin.lat]);
        bounds.extend([destination.lng, destination.lat]);
        map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 700 });
      }
    } catch (err) {
      setRoutes([]);
      setSelectedRouteId(null);
      setRouteError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  };

  // Re-sort when rank mode changes
  useEffect(() => {
    if (!routes.length) return;
    setRoutes((prev) => sortRoutes(prev, rankMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankMode]);

  const clearRoute = () => {
    setRoutes([]);
    setSelectedRouteId(null);
    setRouteError(null);
    setOrigin(null);
    setDestination(null);
    setPickMode("idle");
  };

  const stops = legendStops(scoreField);
  const selected = routes.find((r) => r.id === selectedRouteId) ?? null;

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
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <div className="text-base font-semibold tracking-tight">
            YourWalk lab
          </div>
          <a
            href="/"
            className="text-[11px] text-sky-400 underline-offset-2 hover:underline"
          >
            Resident app
          </a>
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Internal scored-network workbench · T1EAM polygons (Leaflet-style fill)
          · not the community UI
        </p>

        <div className="mb-3 rounded border border-violet-800/40 bg-violet-950/20 p-2">
          <button
            type="button"
            className="mb-2 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-violet-300"
            onClick={() => setBakeoffOpen((v) => !v)}
          >
            Score-aware bake-off
            <span className="font-normal normal-case text-slate-500">
              {bakeoffOpen ? "Hide" : "Show"}
            </span>
          </button>
          {bakeoffOpen ? <BakeoffPanel onSelection={onBakeoffSelection} /> : null}
        </div>

        <div className="mb-3 rounded border border-slate-700 bg-slate-900/60 p-2">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
            Plan a walk
          </div>
          <p className="mb-2 text-[11px] text-slate-400">
            Load an OD sample, or click Set origin / Set destination on the map
            (Casey bbox).
          </p>
          {odSample.length > 0 ? (
            <div className="mb-2 space-y-1">
              <label className="block text-[11px] text-slate-400">
                OD sample
                <select
                  className="mt-0.5 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                  value={odSampleId}
                  disabled={loading}
                  onChange={(e) => {
                    const id = e.target.value;
                    setOdSampleId(id);
                    const pair = odSample.find((p) => p.id === id);
                    if (!pair) return;
                    const o: LngLat = {
                      lng: pair.origin.center[0],
                      lat: pair.origin.center[1],
                    };
                    const d: LngLat = {
                      lng: pair.destination.center[0],
                      lat: pair.destination.center[1],
                    };
                    setOrigin(o);
                    setDestination(d);
                    setPickMode("idle");
                    setRoutes([]);
                    setSelectedRouteId(null);
                    setRouteError(null);
                    const map = mapRef.current;
                    if (map) {
                      const bounds = new mapboxgl.LngLatBounds();
                      bounds.extend([o.lng, o.lat]);
                      bounds.extend([d.lng, d.lat]);
                      map.fitBounds(bounds, {
                        padding: 80,
                        maxZoom: 16,
                        duration: 700,
                      });
                    }
                  }}
                >
                  <option value="">Choose OD-01 … OD-12</option>
                  {odSample.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}
                      {p.verified ? " ✓" : ""} — {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {odSampleId
                ? (() => {
                    const pair = odSample.find((p) => p.id === odSampleId);
                    return pair?.why ? (
                      <p className="text-[10px] leading-snug text-slate-500">
                        {pair.why}
                      </p>
                    ) : null;
                  })()
                : null}
            </div>
          ) : null}
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded border px-2 py-1.5 text-xs ${
                pickMode === "origin"
                  ? "border-green-400 bg-green-900/40 text-green-100"
                  : "border-slate-600 bg-slate-900 text-slate-200"
              }`}
              onClick={() =>
                setPickMode((m) => (m === "origin" ? "idle" : "origin"))
              }
              disabled={loading}
            >
              {origin ? "Origin set" : "Set origin"}
            </button>
            <button
              type="button"
              className={`flex-1 rounded border px-2 py-1.5 text-xs ${
                pickMode === "destination"
                  ? "border-red-400 bg-red-900/40 text-red-100"
                  : "border-slate-600 bg-slate-900 text-slate-200"
              }`}
              onClick={() =>
                setPickMode((m) =>
                  m === "destination" ? "idle" : "destination",
                )
              }
              disabled={loading}
            >
              {destination ? "Destination set" : "Set destination"}
            </button>
          </div>
          <div className="mb-2 flex gap-1">
            {(
              [
                ["day", "Day"],
                ["night", "Night"],
                ["accessibility", "Acc"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`flex-1 rounded border px-1 py-1 text-[11px] ${
                  rankMode === mode
                    ? "border-sky-400 bg-sky-950 text-sky-100"
                    : "border-slate-600 bg-slate-900 text-slate-300"
                }`}
                onClick={() => {
                  setRankMode(mode);
                  if (mode === "day") setScoreField("day_index_score");
                  if (mode === "night") setScoreField("night_index_score");
                  if (mode === "accessibility")
                    setScoreField("accessibility_score");
                }}
              >
                Rank {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded bg-sky-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              onClick={onPlanRoute}
              disabled={loading || planning || !origin || !destination}
            >
              {planning ? "Planning…" : "Plan route"}
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-300"
              onClick={clearRoute}
              disabled={planning}
            >
              Clear
            </button>
          </div>
          {routeError ? (
            <p className="mt-2 text-[11px] text-amber-400">{routeError}</p>
          ) : null}

          {routes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {routes.map((r, i) => {
                const active = r.id === selectedRouteId;
                const score =
                  rankMode === "day"
                    ? r.score.day_display
                    : rankMode === "night"
                      ? r.score.night_display
                      : r.score.accessibility_display;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRouteId(r.id)}
                      className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                        active
                          ? "border-sky-400 bg-slate-800"
                          : "border-slate-700 bg-slate-950/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full"
                            style={{
                              background: ROUTE_COLORS[i % ROUTE_COLORS.length],
                            }}
                          />
                          Route {i + 1}
                        </span>
                        <span className="text-sky-200">
                          {displayOrDash(score)} / 10
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {formatDistance(r.distance_m)} ·{" "}
                        {formatDuration(r.duration_s)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {selected ? (
            <div className="mt-2 rounded border border-slate-700 bg-slate-950/70 p-2 text-[11px] text-slate-300">
              <div className="font-medium text-slate-100">Selected breakdown</div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="text-slate-500">Day</div>
                  <div>{displayOrDash(selected.score.day_display)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Night</div>
                  <div>{displayOrDash(selected.score.night_display)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Acc</div>
                  <div>
                    {displayOrDash(selected.score.accessibility_display)}
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-slate-500">
                Confidence day {selected.score.confidence_day} · night{" "}
                {selected.score.confidence_night} · {selected.score.segment_count}{" "}
                segments · coverage{" "}
                {(selected.score.coverage_ratio * 100).toFixed(0)}%
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                Length-weighted mean · {selected.score.source} · not a safety
                guarantee
              </p>
            </div>
          ) : null}
        </div>

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
          <option value="all">
            All Casey ({meta?.feature_count?.toLocaleString() ?? "—"})
          </option>
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

        <div className="mb-3 border-t border-slate-700 pt-3">
          <div className="mb-1 text-xs font-medium text-slate-300">
            Evidence layers
          </div>
          <p className="mb-2 text-[10px] text-slate-500">
            Night Index inputs under the score — not amenity overlays
          </p>
          <ul className="space-y-1.5">
            {EVIDENCE_LAYER_DEFS.map((def) => (
              <li key={def.id}>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={evidence[def.id]}
                    disabled={loading || loadPhase !== "ready"}
                    onChange={(e) =>
                      setEvidence((prev) => ({
                        ...prev,
                        [def.id]: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ background: def.color }}
                      aria-hidden
                    />
                    {def.label}
                    {evidenceLoading === def.id ? (
                      <span className="ml-1 text-sky-300">Loading…</span>
                    ) : null}
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {def.hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

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
