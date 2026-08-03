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
import {
  DEFAULT_OVERLAYS,
  OVERLAY_DEFS,
  type OverlayId,
  type OverlayState,
} from "@/lib/overlays";
import { planScoredRoutes } from "@/lib/routing/planRoute";
import { OutingDurationSlider } from "@/components/resident/OutingDurationSlider";
import {
  OUTING_SHAPES,
  clampOutingMinutes,
  type OutingShape,
  planOutingRoutes,
} from "@/lib/routing/planOuting";
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
/** How are you walking? — trip A→B vs timed outing from a start. */
type WalkIntent = "trip" | "outing";

const ROUTE_COLORS = ["#00AAA6", "#27AAE1", "#8DC63F"] as const;

const DAY_BASEMAP = "mapbox://styles/mapbox/streets-v12";
const NIGHT_BASEMAP = "mapbox://styles/mapbox/dark-v11";

/** Install route + optional LGA layers after load or basemap style switch. */
function installMapChrome(
  map: mapboxgl.Map,
  opts: {
    lga?: GeoJSON.FeatureCollection | null;
    night: boolean;
  },
) {
  if (!map.getSource("routes")) {
    map.addSource("routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("routes-alt")) {
    map.addLayer({
      id: "routes-alt",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "selected"], 0],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3.5,
        "line-opacity": opts.night ? 0.45 : 0.38,
      },
    });
  }
  if (!map.getLayer("routes-selected")) {
    map.addLayer({
      id: "routes-selected",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "selected"], 1],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": ["get", "color"],
        // Round caps + short dashes ≈ dotted circles along the path
        "line-width": 5,
        "line-opacity": 0.98,
        "line-dasharray": [0.12, 1.65],
      },
    });
  }

  if (opts.lga) {
    if (map.getLayer("lga-line")) map.removeLayer("lga-line");
    if (map.getSource("lga")) map.removeSource("lga");
    map.addSource("lga", { type: "geojson", data: opts.lga });
    map.addLayer(
      {
        id: "lga-line",
        type: "line",
        source: "lga",
        paint: {
          "line-color": opts.night ? "#8B8DD9" : "#292984",
          "line-width": 2,
          "line-opacity": opts.night ? 0.55 : 0.45,
        },
      },
      "routes-alt",
    );
  }
}

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
  const lgaDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const routesRef = useRef<ScoredRoute[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const basemapStyleRef = useRef<string>(DAY_BASEMAP);
  const walkModeRef = useRef<WalkMode>("day");

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
  const [walkIntent, setWalkIntent] = useState<WalkIntent>("trip");
  const [outingMinutes, setOutingMinutes] = useState(25);
  const [outingShape, setOutingShape] = useState<OutingShape>("loop");
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS);
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  useEffect(() => {
    walkModeRef.current = walkMode;
    setPrefs((prev) => ({
      ...(walkMode === "day" ? DEFAULT_PREFS_DAY : DEFAULT_PREFS_NIGHT),
      preferSharedPaths: prev.preferSharedPaths,
    }));
    // Day ↔ Night needs a fresh plan (scores / loops differ). Back to edit;
    // keep start, duration, shape, overlays, shared-path preference.
    setRoutes([]);
    setSelectedId(null);
    setRouteError(null);
    setSheetMode("plan");
    setPlanning(false);
  }, [walkMode]);

  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (walkIntent === "outing") {
      setDestination(null);
      setDestLabel("");
      setPickMode((m) => (m === "destination" ? "idle" : m));
    }
  }, [walkIntent]);

  const paintRoutes = useCallback(
    (list: ScoredRoute[], selected: string | null) => {
      const map = mapRef.current;
      const src = map?.getSource("routes") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      // selected as 0/1 — Mapbox property filters are more reliable than booleans
      src.setData({
        type: "FeatureCollection",
        features: list.map((r, i) => ({
          type: "Feature",
          properties: {
            id: r.id,
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            selected: r.id === selected ? 1 : 0,
          },
          geometry: r.geometry,
        })),
      });
    },
    [],
  );

  /** Re-attach amenity overlay layers (needed after basemap style swap). */
  const syncOverlayLayers = useCallback(
    (overlayState: OverlayState = overlays) => {
      const map = mapRef.current;
      if (!map) return;
      for (const def of OVERLAY_DEFS) {
        if (!def.available || !def.url) continue;
        const srcId = `overlay-${def.id}`;
        const layerId = `overlay-${def.id}-pts`;
        const on = overlayState[def.id];

        if (on) {
          if (!map.getSource(srcId)) {
            map.addSource(srcId, { type: "geojson", data: def.url });
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
                  3,
                  15,
                  5,
                ],
                "circle-color": def.color,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.9,
              },
            });
          } else if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", "visible");
          }
        } else if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", "none");
        }
      }
    },
    [overlays],
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
    const initialStyle =
      walkModeRef.current === "night" ? NIGHT_BASEMAP : DAY_BASEMAP;
    basemapStyleRef.current = initialStyle;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: initialStyle,
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
      requestAnimationFrame(() => map.resize());
      window.setTimeout(() => map.resize(), 250);

      installMapChrome(map, {
        lga: lgaDataRef.current,
        night: walkModeRef.current === "night",
      });

      // Single click handler survives style reloads (queries live layer ids)
      map.on("click", async (e) => {
        const routeHit = map.queryRenderedFeatures(e.point, {
          layers: ["routes-alt", "routes-selected"].filter((id) =>
            Boolean(map.getLayer(id)),
          ),
        });
        const routeId = routeHit[0]?.properties?.id;
        if (typeof routeId === "string") {
          setSelectedId(routeId);
          return;
        }

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

      map.on("mousemove", (e) => {
        if (pickModeRef.current !== "idle") return;
        const layers = ["routes-alt", "routes-selected"].filter((id) =>
          Boolean(map.getLayer(id)),
        );
        if (!layers.length) return;
        const hit = map.queryRenderedFeatures(e.point, { layers });
        map.getCanvas().style.cursor = hit.length ? "pointer" : "";
      });

      setMapReady(true);

      void (async () => {
        const lgaUrl = resolveLgaUrl();
        if (lgaUrl) {
          try {
            const lga = await fetchLgaBoundary(lgaUrl);
            if (!mapRef.current) return;
            lgaDataRef.current = lga;
            installMapChrome(map, {
              lga,
              night: walkModeRef.current === "night",
            });
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

  // Day streets ↔ Night dark basemap (style swap clears custom layers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const next = walkMode === "night" ? NIGHT_BASEMAP : DAY_BASEMAP;
    if (basemapStyleRef.current === next) return;
    basemapStyleRef.current = next;

    map.setStyle(next);
    map.once("style.load", () => {
      installMapChrome(map, {
        lga: lgaDataRef.current,
        night: walkMode === "night",
      });
      paintRoutes(routesRef.current, selectedIdRef.current);
      syncOverlayLayers();
    });
  }, [walkMode, mapReady, paintRoutes, syncOverlayLayers]);

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

  // Along-the-way amenity overlays (visibility only)
  useEffect(() => {
    if (!mapReady) return;
    syncOverlayLayers(overlays);
  }, [overlays, mapReady, syncOverlayLayers]);

  // Importance sliders only — same geometries, new ranking (not Day/Night flip)
  useEffect(() => {
    if (!routes.length || sheetMode !== "results") return;
    const ranked = sortRoutesByPreferences(routes, prefs, walkMode);
    setRoutes(ranked);
    setSelectedId(ranked[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-rank in place when prefs change
  }, [prefs]);

  const useMyLocation = useCallback(async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    if (!navigator.geolocation) {
      setRouteError("Location isn’t available in this browser.");
      return;
    }
    setGeoBusy(true);
    setRouteError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const point = {
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
          };
          const label = await reverseGeocode(point, token);
          setOrigin(point);
          setOriginLabel(label || "Current location");
          setPickMode("idle");
          mapRef.current?.flyTo({
            center: [point.lng, point.lat],
            zoom: 14,
            duration: 600,
          });
        } catch (err) {
          setRouteError(
            err instanceof Error ? err.message : "Couldn’t label this location",
          );
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        setGeoBusy(false);
        setRouteError(
          "Couldn’t get your location. Allow location access, or search / drop a pin.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  const onFindWalk = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !origin) return;
    if (walkIntent === "trip" && !destination) return;
    if (!networkReady || featuresRef.current.length === 0) {
      setRouteError("Footpath network is still loading — try again in a moment.");
      return;
    }
    setPlanning(true);
    setRouteError(null);
    setRoutes([]);
    setSelectedId(null);
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    try {
      let ranked: ScoredRoute[];
      if (walkIntent === "outing") {
        const amenityGoals = (Object.keys(overlays) as OverlayId[]).filter(
          (id) =>
            overlays[id] &&
            OVERLAY_DEFS.some((d) => d.id === id && d.available),
        );
        ranked = await planOutingRoutes(
          origin,
          outingMinutes,
          featuresRef.current,
          token,
          walkMode,
          prefs,
          { shape: outingShape, amenityGoals },
          3,
        );
      } else {
        const scored = await planScoredRoutes(
          origin,
          destination!,
          featuresRef.current,
          token,
          3,
          walkMode,
        );
        ranked = sortRoutesByPreferences(scored, prefs, walkMode);
      }
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
        if (destination) bounds.extend([destination.lng, destination.lat]);
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

  const toggleOverlay = (id: OverlayId) => {
    const def = OVERLAY_DEFS.find((d) => d.id === id);
    if (!def?.available) return;
    setOverlays((prev) => ({ ...prev, [id]: !prev[id] }));
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
                  {walkIntent === "outing"
                    ? `${shortLabel(originLabel) || "Start"} · ~${outingMinutes} min ${
                        outingShape === "loop"
                          ? "loop"
                          : outingShape === "out_and_back"
                            ? "there and back"
                            : "one way"
                      }`
                    : `${shortLabel(originLabel) || "Origin"} → ${shortLabel(destLabel) || "Destination"}`}
                </p>
                <p
                  className={`text-[11px] ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  {walkIntent === "outing"
                    ? `${routes.length} walk${routes.length === 1 ? "" : "s"} from your start · ranked by what matters, time${
                        Object.values(overlays).some(Boolean)
                          ? ", and amenity proximity"
                          : ""
                      } · tap a path on the map to select`
                    : routes.length === 1
                      ? "1 trip option · lower importance favours a quicker walk"
                      : `${routes.length} trip options · tap a path on the map to select`}
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
              <h1
                className={`mb-3 text-base font-extrabold tracking-tight ${
                  isNight ? "text-white" : "text-[#292984]"
                }`}
              >
                Tell us about your walk
              </h1>

              <p
                className={`mb-2 text-xs font-semibold ${
                  isNight ? "text-white/50" : "text-slate-500"
                }`}
              >
                Set your walking preferences
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
              <label
                className={`mb-2 flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  prefs.preferSharedPaths
                    ? "border-[#00AAA6]/45 bg-[#00AAA6]/10"
                    : isNight
                      ? "border-white/12"
                      : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 accent-[#00AAA6]"
                  checked={prefs.preferSharedPaths}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      preferSharedPaths: e.target.checked,
                    }))
                  }
                />
                <span
                  className={`text-[12px] font-medium ${
                    isNight ? "text-white/85" : "text-slate-700"
                  }`}
                >
                  Prefer shared paths
                </span>
              </label>
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

              <p
                className={`mb-1.5 mt-3 text-xs font-semibold ${
                  isNight ? "text-white/50" : "text-slate-500"
                }`}
              >
                How are you walking?
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ["trip", "A to B", "Start and end places"],
                    ["outing", "Around here", "About N minutes from a start"],
                  ] as const
                ).map(([id, title, blurb]) => {
                  const on = walkIntent === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWalkIntent(id)}
                      className={`rounded-xl border px-2.5 py-2.5 text-left ${
                        on
                          ? "border-[#00AAA6] bg-[#00AAA6]/15"
                          : isNight
                            ? "border-white/15 bg-white/[0.03]"
                            : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="text-[13px] font-bold">{title}</div>
                      <div
                        className={`mt-0.5 text-[10px] leading-snug ${
                          isNight ? "text-white/45" : "text-slate-500"
                        }`}
                      >
                        {blurb}
                      </div>
                    </button>
                  );
                })}
              </div>

              {walkIntent === "trip" ? (
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
              ) : (
                <div className="mb-3 space-y-2">
                  <PlaceField
                    label="Start"
                    placeholder="Where will you begin?"
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
                  <button
                    type="button"
                    disabled={geoBusy || !mapReady}
                    onClick={() => void useMyLocation()}
                    className={`w-full rounded-lg border px-2 py-2 text-xs font-semibold disabled:opacity-40 ${
                      isNight
                        ? "border-white/20 text-white/80"
                        : "border-slate-200 text-slate-700"
                    }`}
                  >
                    {geoBusy ? "Getting location…" : "Use my location"}
                  </button>
                  <OutingDurationSlider
                    value={outingMinutes}
                    onChange={(m) => setOutingMinutes(clampOutingMinutes(m))}
                    isNight={isNight}
                  />
                  <p
                    className={`mt-3 text-[10px] ${
                      isNight ? "text-white/40" : "text-slate-400"
                    }`}
                  >
                    Shape
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {OUTING_SHAPES.map((s) => {
                      const on = outingShape === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          title={s.hint}
                          onClick={() => setOutingShape(s.id)}
                          className={`rounded-lg border px-1.5 py-2 text-center text-[11px] font-bold leading-tight ${
                            on
                              ? "border-[#00AAA6] bg-[#00AAA6]/15 text-[#00AAA6]"
                              : isNight
                                ? "border-white/15 text-white/70"
                                : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className={`text-[10px] leading-snug ${
                      isNight ? "text-white/35" : "text-slate-400"
                    }`}
                  >
                    {
                      OUTING_SHAPES.find((s) => s.id === outingShape)?.hint
                    }
                    {outingShape === "loop"
                      ? " We’ll offer a few different circuits when we can — not there-and-backs mixed in."
                      : ""}
                  </p>
                </div>
              )}

              {pickMode !== "idle" ? (
                <p className="mb-2 text-xs text-[#27AAE1]">
                  Tap the map to set{" "}
                  {pickMode === "origin"
                    ? walkIntent === "outing"
                      ? "start"
                      : "origin"
                    : "destination"}
                </p>
              ) : null}

              <p
                className={`mb-1.5 text-xs font-semibold ${
                  isNight ? "text-white/50" : "text-slate-500"
                }`}
              >
                Along the way
              </p>
              <p
                className={`mb-2 text-[10px] leading-snug ${
                  isNight ? "text-white/40" : "text-slate-400"
                }`}
              >
                {walkIntent === "outing"
                  ? "Show on the map. On Around here, also soft-prefer walks near checked types when data exists — does not change corridor score pills."
                  : "Show on the map only — does not change walk scores."}
              </p>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {OVERLAY_DEFS.map((def) => {
                  const checked = overlays[def.id];
                  return (
                    <label
                      key={def.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-2 text-[11px] ${
                        !def.available
                          ? isNight
                            ? "border-white/10 opacity-45"
                            : "border-slate-100 opacity-50"
                          : checked
                            ? "border-[#00AAA6]/50 bg-[#00AAA6]/10"
                            : isNight
                              ? "border-white/15"
                              : "border-slate-200"
                      }`}
                      title={def.hint}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={!def.available}
                        checked={checked}
                        onChange={() => toggleOverlay(def.id)}
                      />
                      <span>
                        <span className="font-semibold">{def.label}</span>
                        {!def.available ? (
                          <span
                            className={`block text-[9px] ${
                              isNight ? "text-white/35" : "text-slate-400"
                            }`}
                          >
                            Coming soon
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={
                  !mapReady ||
                  !networkReady ||
                  planning ||
                  !origin ||
                  (walkIntent === "trip" && !destination)
                }
                onClick={() => void onFindWalk()}
                className="mt-1 w-full rounded-xl bg-[#27AAE1] py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {planning
                  ? "Finding walks…"
                  : !networkReady
                    ? "Loading network…"
                    : walkIntent === "outing"
                      ? "Find my walk"
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
                // Prefer match_score from outing planner when set — must match card order
                const ranked =
                  r.match_score ??
                  tripRankScore(r, prefs, shortestDur, walkMode);
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
                          {r.amenity_note ? (
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                isNight ? "text-[#8DC63F]/90" : "text-[#5a8f1f]"
                              }`}
                            >
                              {r.amenity_note}
                            </p>
                          ) : null}
                          {prefs.preferSharedPaths &&
                          (r.score.shared_use_ratio ?? 0) >= 0.2 ? (
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                isNight ? "text-[#27AAE1]/90" : "text-[#1a7a9e]"
                              }`}
                            >
                              {(r.score.shared_use_ratio ?? 0) >= 0.45
                                ? "Uses a good share of Casey’s shared path network"
                                : "Uses some of Casey’s shared path network"}
                            </p>
                          ) : null}
                          {r.outing_note ? (
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                isNight ? "text-amber-300/85" : "text-amber-800"
                              }`}
                            >
                              {r.outing_note}
                            </p>
                          ) : null}
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

                      {(() => {
                        const note = scoreCoverageNote(r.score);
                        if (!note) return null;
                        return (
                          <p
                            className={`mt-1.5 text-[10px] leading-snug ${
                              note.tone === "warn"
                                ? isNight
                                  ? "text-amber-300/85"
                                  : "text-amber-800"
                                : isNight
                                  ? "text-white/45"
                                  : "text-slate-500"
                            }`}
                            title={note.detail}
                          >
                            {note.text}
                          </p>
                        );
                      })()}

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

/**
 * Honest copy when Mapbox geometry and Casey T1EAM scored polygons diverge.
 * Pills are length-weighted means within ~20 m of the route — nearby streets
 * can fill scores even when the trail itself has no scoring segment.
 */
function scoreCoverageNote(score: {
  coverage_ratio: number;
  segment_count: number;
  matched_length_m: number;
}): { text: string; detail: string; tone: "warn" | "soft" } | null {
  const pct = Math.round(Math.max(0, Math.min(1, score.coverage_ratio)) * 100);
  const segs = score.segment_count;
  const detail = `${segs} scored segment${segs === 1 ? "" : "s"} · ~${Math.round(score.matched_length_m)} m matched · ${pct}% of path`;

  if (segs === 0 || score.coverage_ratio <= 0) {
    return {
      text: "No Casey scored footpath under this path — index pills unavailable",
      detail,
      tone: "warn",
    };
  }
  if (score.coverage_ratio < 0.35) {
    return {
      text: `Limited score coverage (${pct}% of path) — pills may reflect nearby streets, not this trail`,
      detail,
      tone: "warn",
    };
  }
  if (score.coverage_ratio < 0.85) {
    return {
      text: `Partial score coverage (${pct}% of path) — some stretches may use nearby footpath scores`,
      detail,
      tone: "soft",
    };
  }
  // High coverage: no extra chrome
  return null;
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
    <label className="mb-2.5 block">
      <div className="mb-0.5 text-[12px] font-medium">
        <span className={isNight ? "text-white/85" : "text-slate-700"}>
          {title}
        </span>
      </div>
      <input
        type="range"
        min={PREF_IMPORTANCE_MIN}
        max={PREF_IMPORTANCE_MAX}
        value={clamped}
        onChange={(e) => onChange(clampImportance(Number(e.target.value)))}
        className="h-6 w-full"
        style={{ accentColor: accent }}
        aria-valuemin={PREF_IMPORTANCE_MIN}
        aria-valuemax={PREF_IMPORTANCE_MAX}
        aria-valuenow={clamped}
        aria-label={`${title} importance`}
      />
      <div
        className={`-mt-0.5 flex justify-between text-[9px] leading-none ${
          isNight ? "text-white/35" : "text-slate-400"
        }`}
      >
        <span>Less</span>
        <span>More</span>
      </div>
    </label>
  );
}
