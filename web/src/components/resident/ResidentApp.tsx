"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";

import { PlaceField } from "@/components/resident/PlaceField";
import {
  defaultLgaBoundaryUrl,
  defaultSegmentsGeoJsonUrl,
  fetchLgaBoundary,
  fetchSegmentsGeoJSON,
} from "@/lib/fetchSegments";
import { reverseGeocode } from "@/lib/routing/geocode";
import {
  formatDistance,
  formatDuration,
  toDisplayScore,
} from "@/lib/routing/geo";
import { planScoredRoutes } from "@/lib/routing/planRoute";
import {
  DEFAULT_PREFS_DAY,
  DEFAULT_PREFS_NIGHT,
  PREF_IMPORTANCE_MAX,
  PREF_IMPORTANCE_MIN,
  type RoutePreferences,
  type WalkMode,
  clampImportance,
  preferenceScore,
  routeCardLabel,
  routeCardBlurb,
  sortRoutesByPreferences,
  tripRankScore,
} from "@/lib/routing/preferences";
import type { LngLat, ScoredRoute } from "@/lib/routing/types";
import { CASEY_BOUNDS } from "@/lib/scores";

type PickMode = "idle" | "origin" | "destination";

const ROUTE_COLORS = ["#00AAA6", "#27AAE1", "#8DC63F"] as const;

function resolveGeoJsonUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SEGMENTS_GEOJSON_URL?.trim();
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultSegmentsGeoJsonUrl(supabase);
  throw new Error("Missing segments GeoJSON URL");
}

function resolveLgaUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_LGA_BOUNDARY_URL?.trim();
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultLgaBoundaryUrl(supabase);
  return null;
}

export function ResidentApp() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);
  const pickModeRef = useRef<PickMode>("idle");
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState("Loading footpath network…");
  const [error, setError] = useState<string | null>(null);
  const [walkMode, setWalkMode] = useState<WalkMode>("day");
  const [prefs, setPrefs] = useState<RoutePreferences>(DEFAULT_PREFS_DAY);
  const [pickMode, setPickMode] = useState<PickMode>("idle");
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [destination, setDestination] = useState<LngLat | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [routes, setRoutes] = useState<ScoredRoute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<"plan" | "results">("plan");

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  useEffect(() => {
    setPrefs(walkMode === "day" ? DEFAULT_PREFS_DAY : DEFAULT_PREFS_NIGHT);
  }, [walkMode]);

  const paintRoutes = useCallback(
    (list: ScoredRoute[], selected: string | null) => {
      const map = mapRef.current;
      const src = map?.getSource("routes") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: list.map((r, i) => ({
          type: "Feature",
          properties: {
            id: r.id,
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            selected: r.id === selected,
          },
          geometry: r.geometry,
        })),
      });
    },
    [],
  );

  useEffect(() => {
    paintRoutes(routes, selectedId);
  }, [routes, selectedId, paintRoutes]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Mapbox token missing — set NEXT_PUBLIC_MAPBOX_TOKEN in web/.env.local");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      // Streets basemap so roads/labels read clearly under the link network
      style: "mapbox://styles/mapbox/streets-v12",
      bounds: [
        [CASEY_BOUNDS.west, CASEY_BOUNDS.south],
        [CASEY_BOUNDS.east, CASEY_BOUNDS.north],
      ],
      fitBoundsOptions: { padding: 48 },
      attributionControl: true,
    });
    mapRef.current = map;

    // Basemap first — do not block on the segment GeoJSON download
    map.on("load", () => {
      map.resize();
      // Second resize after layout (bottom sheet / flex) settles
      requestAnimationFrame(() => map.resize());
      window.setTimeout(() => map.resize(), 250);

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
            7,
            4.5,
          ],
          "line-opacity": 0.95,
        },
      });

      map.on("click", "routes-line", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") setSelectedId(id);
      });

      map.on("click", async (e) => {
        const mode = pickModeRef.current;
        if (mode === "idle") return;
        const point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        const label = await reverseGeocode(point, token);
        if (mode === "origin") {
          setOrigin(point);
          setOriginLabel(label);
        } else {
          setDestination(point);
          setDestLabel(label);
        }
        setPickMode("idle");
      });

      setMapReady(true);

      // LGA context only on the map. Segment scores load in memory for route
      // ranking — no scored-network choropleth on the resident surface.
      void (async () => {
        const lgaUrl = resolveLgaUrl();
        if (lgaUrl) {
          try {
            const lga = await fetchLgaBoundary(lgaUrl);
            if (!mapRef.current) return;
            map.addSource("lga", { type: "geojson", data: lga });
            map.addLayer(
              {
                id: "lga-line",
                type: "line",
                source: "lga",
                paint: {
                  "line-color": "#292984",
                  "line-width": 2,
                  "line-opacity": 0.45,
                },
              },
              "routes-line",
            );
          } catch {
            /* optional */
          }
        }

        try {
          setNetworkStatus("Preparing route scoring…");
          const body = await fetchSegmentsGeoJSON(resolveGeoJsonUrl());
          if (!mapRef.current) return;
          featuresRef.current = body.features ?? [];
          setNetworkReady(true);
          setNetworkStatus("Ready to plan a walk");
        } catch (err) {
          setNetworkStatus("Route scoring data failed to load");
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
    });

    map.on("error", (e) => {
      console.error("Mapbox error", e.error);
      setError(e.error?.message ?? "Map failed to load");
    });

    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      originMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (origin) {
      if (!originMarkerRef.current) {
        originMarkerRef.current = new mapboxgl.Marker({ color: "#009444" })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map);
      } else originMarkerRef.current.setLngLat([origin.lng, origin.lat]);
    } else {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    }
    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new mapboxgl.Marker({ color: "#EC008C" })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map);
      } else destMarkerRef.current.setLngLat([destination.lng, destination.lat]);
    } else {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
    }
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode === "idle" ? "" : "crosshair";
  }, [pickMode]);

  useEffect(() => {
    if (!routes.length) return;
    const ranked = sortRoutesByPreferences(routes, prefs, walkMode);
    setRoutes(ranked);
    setSelectedId(ranked[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-rank when prefs or mode change
  }, [prefs, walkMode]);

  const onFindRoute = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !origin || !destination) return;
    if (!networkReady || featuresRef.current.length === 0) {
      setRouteError("Footpath network is still loading — try again in a moment.");
      return;
    }
    setPlanning(true);
    setRouteError(null);
    setRoutes([]);
    setSelectedId(null);
    // Two frames so “Calculating your walks…” paints before heavy work
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    try {
      const scored = await planScoredRoutes(
        origin,
        destination,
        featuresRef.current,
        token,
        3,
        walkMode,
      );
      const ranked = sortRoutesByPreferences(scored, prefs, walkMode);
      setRoutes(ranked);
      setSelectedId(ranked[0]?.id ?? null);
      setSheetMode("results");

      const map = mapRef.current;
      if (map && ranked.length) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const r of ranked) {
          for (const c of r.geometry.coordinates) {
            bounds.extend(c as [number, number]);
          }
        }
        bounds.extend([origin.lng, origin.lat]);
        bounds.extend([destination.lng, destination.lat]);
        map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 700 });
      }
    } catch (err) {
      setRoutes([]);
      setSelectedId(null);
      setRouteError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  };

  const isNight = walkMode === "night";
  const shortLabel = (s: string) =>
    s ? s.split(",").slice(0, 2).join(",").trim() : "";

  return (
    <div
      className={`relative flex h-dvh w-full flex-col ${
        isNight ? "bg-[#0B0C1A] text-white" : "bg-[#F5F7FA] text-slate-900"
      }`}
    >
      <header
        className={`flex items-center justify-between border-b px-4 py-3 ${
          isNight
            ? "border-white/10 bg-[#0B0C1A]"
            : "border-slate-200 bg-white"
        }`}
      >
        <div
          className={`text-lg font-extrabold tracking-tight ${
            isNight ? "text-white" : "text-[#292984]"
          }`}
        >
          YourWalk
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWalkMode(walkMode === "day" ? "night" : "day")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isNight
                ? "bg-[#14152A] text-sky-300 ring-1 ring-sky-500/30"
                : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
            }`}
          >
            {isNight ? "Night walk" : "Day walk"}
          </button>
          <a
            href="/lab"
            className={`text-[11px] ${isNight ? "text-slate-500" : "text-slate-400"}`}
          >
            Lab
          </a>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {!mapReady && !error ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[5] flex justify-center">
            <p className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white shadow">
              Loading map…
            </p>
          </div>
        ) : null}
        {mapReady && !networkReady && !error ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[5] flex justify-center">
            <p className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white shadow">
              {networkStatus}
            </p>
          </div>
        ) : null}
        {planning ? (
          <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-black/25">
            <div
              className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-lg ${
                isNight ? "bg-[#14152A]/95 text-white" : "bg-white/95 text-slate-800"
              }`}
            >
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#00AAA6] border-t-transparent"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold">Calculating your walks…</p>
                <p
                  className={`text-[11px] ${
                    isNight ? "text-white/50" : "text-slate-500"
                  }`}
                >
                  Finding routes and scoring Casey footpaths
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`absolute inset-x-0 bottom-0 z-10 max-h-[62%] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-3 shadow-2xl ${
            isNight
              ? "bg-[#14152A]/95 backdrop-blur"
              : "bg-white/95 backdrop-blur"
          }`}
        >
          <div
            className={`mx-auto mb-3 h-1 w-10 rounded-full ${
              isNight ? "bg-white/20" : "bg-slate-300"
            }`}
          />

          {planning ? (
            <div className="mb-4 flex flex-col items-center py-6 text-center">
              <span
                className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-[#00AAA6] border-t-transparent"
                aria-hidden
              />
              <p className="text-sm font-semibold">Calculating your walks…</p>
              <p
                className={`mt-1 max-w-[16rem] text-[11px] leading-snug ${
                  isNight ? "text-white/45" : "text-slate-500"
                }`}
              >
                Longer trips take a moment — we ask Mapbox, check neighbourhood
                links, then score each option.
              </p>
            </div>
          ) : null}

          {!planning && sheetMode === "results" && routes.length > 0 ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {shortLabel(originLabel) || "Origin"} →{" "}
                  {shortLabel(destLabel) || "Destination"}
                </p>
                <p
                  className={`text-[11px] ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  {routes.length === 1
                    ? "1 trip option · lower importance favours a quicker walk"
                    : `${routes.length} trip options · raise importance to favour better footpaths / after dark`}
                </p>
              </div>
              <button
                type="button"
                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                  isNight
                    ? "bg-white/10 text-white/80"
                    : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setSheetMode("plan")}
              >
                Edit
              </button>
            </div>
          ) : null}

          {!planning && sheetMode === "plan" ? (
            <>
              <div className="mb-3 space-y-2">
                <PlaceField
                  label="From"
                  placeholder="Suburb, address, or place"
                  dot="#009444"
                  isNight={isNight}
                  valueLabel={shortLabel(originLabel)}
                  pickActive={pickMode === "origin"}
                  onPickToggle={() =>
                    setPickMode((m) => (m === "origin" ? "idle" : "origin"))
                  }
                  onPlace={({ center, label }) => {
                    setOrigin(center);
                    setOriginLabel(label);
                    setPickMode("idle");
                    mapRef.current?.flyTo({
                      center: [center.lng, center.lat],
                      zoom: 14,
                      duration: 600,
                    });
                  }}
                />
                <PlaceField
                  label="To"
                  placeholder="Where are you walking to?"
                  dot="#EC008C"
                  isNight={isNight}
                  valueLabel={shortLabel(destLabel)}
                  pickActive={pickMode === "destination"}
                  onPickToggle={() =>
                    setPickMode((m) =>
                      m === "destination" ? "idle" : "destination",
                    )
                  }
                  onPlace={({ center, label }) => {
                    setDestination(center);
                    setDestLabel(label);
                    setPickMode("idle");
                    mapRef.current?.flyTo({
                      center: [center.lng, center.lat],
                      zoom: 14,
                      duration: 600,
                    });
                  }}
                />
              </div>

              {pickMode !== "idle" ? (
                <p className="mb-2 text-xs text-[#27AAE1]">
                  Tap the map to set{" "}
                  {pickMode === "origin" ? "origin" : "destination"}
                </p>
              ) : !origin || !destination ? (
                <p
                  className={`mb-2 text-xs ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  Set From and To (search or Map), then choose what matters and
                  find your walk.
                </p>
              ) : null}

              <p
                className={`mb-2 text-xs font-semibold ${
                  isNight ? "text-white/50" : "text-slate-500"
                }`}
              >
                How important is each to you?
              </p>
              <p
                className={`mb-2 text-[10px] leading-snug ${
                  isNight ? "text-white/40" : "text-slate-400"
                }`}
              >
                {isNight
                  ? "Importance ratings, not scores. Turn both down and we favour a quicker walk; turn them up and better after-dark / footpath corridors win."
                  : "Importance ratings, not scores. Turn both down and we favour a quicker walk; turn them up and better shade / footpath corridors win."}
              </p>
              {isNight ? (
                <PrefSlider
                  title="Safety after dark"
                  value={prefs.afterDark}
                  isNight={isNight}
                  accent="#27AAE1"
                  onChange={(afterDark) =>
                    setPrefs((p) => ({ ...p, afterDark }))
                  }
                />
              ) : null}
              <PrefSlider
                title="Accessible footpaths"
                value={prefs.accessibility}
                isNight={isNight}
                accent="#8DC63F"
                onChange={(accessibility) =>
                  setPrefs((p) => ({ ...p, accessibility }))
                }
              />
              {!isNight ? (
                <PrefSlider
                  title="Shade & heat comfort"
                  value={prefs.shadeHeat}
                  isNight={isNight}
                  accent="#F6871F"
                  onChange={(shadeHeat) =>
                    setPrefs((p) => ({ ...p, shadeHeat }))
                  }
                />
              ) : null}

              <button
                type="button"
                disabled={
                  !mapReady ||
                  !networkReady ||
                  planning ||
                  !origin ||
                  !destination
                }
                onClick={onFindRoute}
                className="mt-3 w-full rounded-xl bg-[#27AAE1] py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {planning
                  ? "Finding routes…"
                  : !networkReady
                    ? "Loading network…"
                    : "Find my route"}
              </button>
              {mapReady ? (
                <p
                  className={`mt-1.5 text-[10px] ${
                    isNight ? "text-white/35" : "text-slate-400"
                  }`}
                >
                  {networkStatus}
                </p>
              ) : null}
            </>
          ) : null}

          {routeError ? (
            <div
              className={`mt-2 rounded-xl border px-3 py-2.5 text-xs leading-snug ${
                isNight
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-semibold">Couldn’t find a walk</p>
              <p className="mt-0.5 opacity-90">{routeError}</p>
              <p className="mt-1.5 opacity-75">
                Try closer points in Casey, or tap Map to set From/To on the
                streets.
              </p>
            </div>
          ) : null}
          {error ? (
            <p className="mt-2 text-xs text-amber-500">{error}</p>
          ) : null}

          {!planning && routes.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {routes.map((r, i) => {
                const active = r.id === selectedId;
                const shortestDur = Math.min(
                  ...routes.map((x) => x.duration_s),
                );
                const ranked = tripRankScore(r, prefs, shortestDur, walkMode);
                const display = toDisplayScore(
                  ranked ?? preferenceScore(r, prefs, walkMode),
                );
                const label = routeCardLabel(r, routes);
                const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`relative w-full rounded-2xl border px-3.5 py-3 text-left ${
                        active
                          ? "border-[#00AAA6]/50 bg-[#00AAA6]/10"
                          : isNight
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {i === 0 ? (
                        <span className="absolute right-3 top-0 rounded-b-md bg-[#00AAA6] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                          Recommended
                        </span>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pt-1">
                          <div className="flex items-center gap-2 text-[15px] font-bold">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: color }}
                            />
                            {label}
                          </div>
                          <p
                            className={`mt-1 text-[11px] leading-snug ${
                              isNight ? "text-white/45" : "text-slate-500"
                            }`}
                          >
                            {routeCardBlurb(r, routes)}
                          </p>
                        </div>
                        <div
                          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2"
                          style={{ borderColor: color, color }}
                          title="Match score used for Recommended. Pills are Casey corridor scores; tiebreaks use your highest importance (e.g. After dark)."
                        >
                          <span className="text-base font-extrabold leading-none">
                            {display == null ? "—" : display.toFixed(1)}
                          </span>
                          <span className="text-[8px] font-semibold opacity-70">
                            match
                          </span>
                        </div>
                      </div>

                      {(r.score.confidence_day === "reduced" ||
                        r.score.confidence_night === "reduced" ||
                        r.score.coverage_ratio < 0.35) && (
                        <p
                          className={`mt-1.5 text-[10px] ${
                            isNight ? "text-amber-300/80" : "text-amber-700"
                          }`}
                        >
                          Reduced confidence - limited footpath score coverage
                          along this path
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {isNight ? (
                          <ScorePill
                            label="After dark"
                            value={r.score.night_display}
                            tone="amber"
                            isNight={isNight}
                          />
                        ) : (
                          <ScorePill
                            label="Shade"
                            value={r.score.day_display}
                            tone="lime"
                            isNight={isNight}
                          />
                        )}
                        <ScorePill
                          label="Footpaths"
                          value={r.score.accessibility_display}
                          tone="blue"
                          isNight={isNight}
                        />
                      </div>

                      <div
                        className={`mt-2 flex gap-3 text-xs ${
                          isNight ? "text-white/55" : "text-slate-600"
                        }`}
                      >
                        <span>
                          <strong
                            className={isNight ? "text-white/85" : "text-slate-800"}
                          >
                            {formatDuration(r.duration_s)}
                          </strong>
                        </span>
                        <span className="opacity-30">·</span>
                        <span>
                          <strong
                            className={isNight ? "text-white/85" : "text-slate-800"}
                          >
                            {formatDistance(r.distance_m)}
                          </strong>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!planning && sheetMode === "results" && routes.length > 0 ? (
            <button
              type="button"
              className="mt-3 w-full rounded-xl bg-[#00AAA6] py-3 text-sm font-bold text-white"
              onClick={() => {
                const r = routes.find((x) => x.id === selectedId);
                const map = mapRef.current;
                if (!r || !map) return;
                const bounds = new mapboxgl.LngLatBounds();
                for (const c of r.geometry.coordinates) {
                  bounds.extend(c as [number, number]);
                }
                map.fitBounds(bounds, {
                  padding: 80,
                  maxZoom: 16,
                  duration: 600,
                });
              }}
            >
              Use this route
            </button>
          ) : null}

          <p
            className={`mt-3 text-[10px] leading-snug ${
              isNight ? "text-white/35" : "text-slate-400"
            }`}
          >
            Trip mode (pilot): Mapbox walks plus neighbourhood score-aware
            links, ranked by Casey scores plus time and distance. Not a safety
            guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}

function ScorePill({
  label,
  value,
  tone,
  isNight,
}: {
  label: string;
  value: number | null;
  tone: "amber" | "blue" | "lime";
  isNight: boolean;
}) {
  const tones = {
    amber: isNight
      ? "bg-amber-400/10 text-amber-300"
      : "bg-amber-50 text-amber-700",
    blue: isNight ? "bg-sky-400/10 text-sky-300" : "bg-sky-50 text-sky-700",
    lime: isNight
      ? "bg-lime-400/10 text-lime-300"
      : "bg-lime-50 text-lime-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}
    >
      {label} {value == null ? "—" : value.toFixed(1)}
    </span>
  );
}

function PrefSlider({
  title,
  value,
  isNight,
  accent,
  onChange,
}: {
  title: string;
  value: number;
  isNight: boolean;
  accent: string;
  onChange: (v: number) => void;
}) {
  const clamped = Math.min(
    PREF_IMPORTANCE_MAX,
    Math.max(PREF_IMPORTANCE_MIN, value),
  );
  return (
    <label className="mb-2 block">
      <div className="mb-1 flex justify-between text-xs">
        <span className={isNight ? "text-white/80" : "text-slate-700"}>
          {title}
        </span>
        <span className={isNight ? "text-white/40" : "text-slate-400"}>
          Importance
        </span>
      </div>
      <input
        type="range"
        min={PREF_IMPORTANCE_MIN}
        max={PREF_IMPORTANCE_MAX}
        value={clamped}
        onChange={(e) => onChange(clampImportance(Number(e.target.value)))}
        className="w-full"
        style={{ accentColor: accent }}
        aria-valuemin={PREF_IMPORTANCE_MIN}
        aria-valuemax={PREF_IMPORTANCE_MAX}
        aria-valuenow={clamped}
        aria-label={`${title} importance`}
      />
      <div
        className={`mt-0.5 flex justify-between text-[10px] ${
          isNight ? "text-white/35" : "text-slate-400"
        }`}
      >
        <span>Less important</span>
        <span>More important</span>
      </div>
    </label>
  );
}
