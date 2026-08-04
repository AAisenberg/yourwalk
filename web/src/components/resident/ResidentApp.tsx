"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  IconLocate,
  IconOuting,
  IconTrip,
  OVERLAY_ICONS,
  SHAPE_ICONS,
} from "@/components/resident/icons";
import { PlaceField } from "@/components/resident/PlaceField";
import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
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
/** Bottom sheet snap — Google Maps-style peek / half / full. */
type SheetSnap = "peek" | "half" | "full";

const ROUTE_COLORS = ["#00AAA6", "#27AAE1", "#8DC63F"] as const;
const SHEET_SNAPS: SheetSnap[] = ["peek", "half", "full"];
const SHEET_SNAP_CLASS: Record<SheetSnap, string> = {
  peek: "h-[22%] max-h-[22%]",
  half: "h-[48%] max-h-[48%]",
  full: "h-[72%] max-h-[72%]",
};

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
  // Same-origin proxy (GitHub release) — avoids dead Supabase + CORS
  if (typeof window !== "undefined") {
    return "/api/map-data/segment_scores.geojson";
  }
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultSegmentsGeoJsonUrl(supabase);
  return "/api/map-data/segment_scores.geojson";
}

function resolveLgaUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_LGA_BOUNDARY_URL?.trim();
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    return "/api/map-data/casey_lga_boundary.geojson";
  }
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultLgaBoundaryUrl(supabase);
  return "/api/map-data/casey_lga_boundary.geojson";
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
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("half");
  const [walkIntent, setWalkIntent] = useState<WalkIntent>("trip");
  const [outingMinutes, setOutingMinutes] = useState(25);
  const [outingShape, setOutingShape] = useState<OutingShape>("loop");
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS);
  const [geoBusy, setGeoBusy] = useState(false);
  const sheetDragRef = useRef<{
    startY: number;
    startSnap: SheetSnap;
  } | null>(null);

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
    setSheetSnap("half");
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
    setSheetSnap((s) => (s === "peek" ? "half" : s));
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
      setSheetSnap("half");

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

  const stepSheetSnap = (from: SheetSnap, delta: number): SheetSnap => {
    const i = SHEET_SNAPS.indexOf(from);
    return SHEET_SNAPS[Math.max(0, Math.min(SHEET_SNAPS.length - 1, i + delta))]!;
  };

  const onSheetHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetDragRef.current = { startY: e.clientY, startSnap: sheetSnap };
  };

  const onSheetHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (dy > 48) setSheetSnap(stepSheetSnap(drag.startSnap, -1));
    else if (dy < -48) setSheetSnap(stepSheetSnap(drag.startSnap, 1));
  };

  return (
    <div
      className={`yw-chrome-transition relative flex h-dvh w-full flex-col ${
        isNight
          ? "bg-yw-night-surface text-white"
          : "bg-yw-day-surface text-slate-900"
      }`}
    >
      <header
        className={`yw-chrome-transition flex items-center justify-between border-b px-4 py-3 ${
          isNight
            ? "border-white/10 bg-yw-night-surface"
            : "border-[#E8ECF2] bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/yourwalk-mark.svg"
            alt=""
            width={36}
            height={28}
            className="h-8 w-auto shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <p
              className={`text-xl font-extrabold leading-none tracking-tight ${
                isNight ? "text-white" : "text-yw-navy"
              }`}
            >
              YourWalk
            </p>
            <p
              className={`mt-0.5 truncate text-[11px] font-medium ${
                isNight ? "text-white/55" : "text-slate-600"
              }`}
            >
              Connecting Casey walks
            </p>
          </div>
        </div>
        <WalkModeSwitch
          value={walkMode}
          onChange={setWalkMode}
          isNight={isNight}
        />
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
          <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-black/20">
            <div
              className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm ${
                isNight
                  ? "bg-yw-night-panel/95 text-white"
                  : "bg-white/95 text-slate-800"
              }`}
            >
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-yw-teal border-t-transparent"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold">Calculating your walks…</p>
                <p
                  className={`text-[11px] ${
                    isNight ? "text-white/55" : "text-slate-600"
                  }`}
                >
                  Finding routes and scoring Casey footpaths
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Locate FAB — above sheet, Maps-style (sets start / From) */}
        <button
          type="button"
          disabled={geoBusy || !mapReady}
          onClick={() => void useMyLocation()}
          className={`absolute right-3 z-[7] flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 transition disabled:opacity-40 ${
            sheetSnap === "peek"
              ? "bottom-[calc(22%+12px)]"
              : sheetSnap === "half"
                ? "bottom-[calc(48%+12px)]"
                : "bottom-[calc(72%+12px)]"
          } ${
            isNight
              ? "bg-yw-night-panel text-yw-blue ring-white/15"
              : "bg-white text-yw-navy ring-black/10"
          }`}
          aria-label={geoBusy ? "Getting location" : "Use my location"}
          title="Use my location"
        >
          {geoBusy ? (
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-yw-teal border-t-transparent"
              aria-hidden
            />
          ) : (
            <IconLocate className="h-6 w-6" aria-hidden />
          )}
        </button>

        <div
          className={`yw-chrome-transition absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:rounded-2xl ${
            SHEET_SNAP_CLASS[sheetSnap]
          } ${
            isNight
              ? "bg-yw-night-panel/95 backdrop-blur"
              : "bg-white/95 backdrop-blur"
          }`}
        >
          <div
            className="flex shrink-0 cursor-grab touch-none flex-col items-center px-4 pb-1 pt-2 active:cursor-grabbing"
            onPointerDown={onSheetHandlePointerDown}
            onPointerUp={onSheetHandlePointerUp}
            onPointerCancel={() => {
              sheetDragRef.current = null;
            }}
            onDoubleClick={() =>
              setSheetSnap((s) => stepSheetSnap(s, s === "full" ? -1 : 1))
            }
            role="slider"
            aria-label="Sheet height"
            aria-valuetext={
              sheetSnap === "peek"
                ? "Collapsed"
                : sheetSnap === "half"
                  ? "Half height"
                  : "Expanded"
            }
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={SHEET_SNAPS.indexOf(sheetSnap)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSheetSnap((s) => stepSheetSnap(s, 1));
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSheetSnap((s) => stepSheetSnap(s, -1));
              }
            }}
          >
            <div
              className={`h-1 w-10 rounded-full ${
                isNight ? "bg-white/25" : "bg-slate-300"
              }`}
              aria-hidden
            />
            <p
              className={`mt-1 text-[9px] font-medium ${
                isNight ? "text-white/35" : "text-slate-400"
              }`}
            >
              {sheetSnap === "peek"
                ? "Swipe up for more"
                : sheetSnap === "half"
                  ? "Swipe for map or more"
                  : "Swipe down to shrink"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1">
          {sheetSnap === "peek" && !planning ? (
            <div className="yw-sheet-panel flex items-center justify-between gap-3 py-1">
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-bold ${
                    isNight ? "text-white" : "text-yw-navy"
                  }`}
                >
                  {sheetMode === "results" && routes.length > 0
                    ? shortLabel(originLabel) || "Your walk"
                    : "Tell us about your walk"}
                </p>
                <p
                  className={`truncate text-[11px] ${
                    isNight ? "text-white/55" : "text-slate-600"
                  }`}
                >
                  {sheetMode === "results" && routes.length > 0
                    ? `${routes.length} option${routes.length === 1 ? "" : "s"} · tap to expand`
                    : "Swipe up to set preferences"}
                </p>
              </div>
              <button
                type="button"
                className="flex min-h-11 shrink-0 items-center rounded-xl bg-yw-teal px-3 text-xs font-bold text-white"
                onClick={() => setSheetSnap("half")}
              >
                Expand
              </button>
            </div>
          ) : null}

          {sheetSnap !== "peek" && planning ? (
            <div
              key="calculating"
              className="yw-sheet-panel mb-4 flex flex-col items-center py-6 text-center"
            >
              <span
                className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-yw-teal border-t-transparent"
                aria-hidden
              />
              <p className="text-sm font-semibold">Calculating your walks…</p>
              <p
                className={`mt-1 max-w-[16rem] text-[11px] leading-snug ${
                  isNight ? "text-white/55" : "text-slate-600"
                }`}
              >
                Longer trips take a moment — we ask Mapbox, check neighbourhood
                links, then score each option.
              </p>
            </div>
          ) : null}

          {sheetSnap !== "peek" &&
          !planning &&
          sheetMode === "results" &&
          routes.length > 0 ? (
            <div
              key="results-head"
              className="yw-sheet-panel mb-3 flex items-center justify-between gap-2"
            >
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
                    isNight ? "text-white/55" : "text-slate-600"
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
                className={`flex min-h-11 shrink-0 items-center rounded-xl px-3 text-xs font-semibold ${
                  isNight
                    ? "bg-white/10 text-white/85"
                    : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => {
                  setSheetMode("plan");
                  setSheetSnap("full");
                }}
              >
                Edit walk
              </button>
            </div>
          ) : null}

          {sheetSnap !== "peek" && !planning && sheetMode === "plan" ? (
            <div key="plan" className="yw-sheet-panel">
              <h1
                className={`mb-1 text-lg font-extrabold tracking-tight ${
                  isNight ? "text-white" : "text-yw-navy"
                }`}
              >
                Tell us about your walk
              </h1>
              <p
                className={`mb-4 text-[12px] leading-snug ${
                  isNight ? "text-white/55" : "text-slate-600"
                }`}
              >
                When you walk, how you walk, and what helps along the way.
              </p>

              <p
                className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${
                  isNight ? "text-white/45" : "text-slate-500"
                }`}
              >
                When
              </p>
              {isNight ? (
                <PrefSlider
                  title="After dark"
                  description="Favour better-lit streets and paths"
                  value={prefs.afterDark}
                  isNight={isNight}
                  accent="#FFCB1F"
                  tone="amber"
                  onChange={(afterDark) =>
                    setPrefs((p) => ({ ...p, afterDark }))
                  }
                />
              ) : null}
              <PrefSlider
                title="Accessible footpaths"
                description="Smooth surfaces, continuity, crossings"
                value={prefs.accessibility}
                isNight={isNight}
                accent="#27AAE1"
                tone="blue"
                onChange={(accessibility) =>
                  setPrefs((p) => ({ ...p, accessibility }))
                }
              />
              <label
                className={`mb-2 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
                  prefs.preferSharedPaths
                    ? "border-[color-mix(in_srgb,var(--yw-teal)_45%,transparent)] bg-[color-mix(in_srgb,var(--yw-teal)_10%,transparent)]"
                    : isNight
                      ? "border-white/12 bg-white/[0.03]"
                      : "border-[#E8ECF2] bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[var(--yw-teal)]"
                  checked={prefs.preferSharedPaths}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      preferSharedPaths: e.target.checked,
                    }))
                  }
                />
                <span
                  className={`text-[13px] font-medium ${
                    isNight ? "text-white/90" : "text-slate-700"
                  }`}
                >
                  Prefer shared paths
                </span>
              </label>
              {!isNight ? (
                <PrefSlider
                  title="Shade & heat comfort"
                  description="Tree cover, cooler surfaces, less sun"
                  value={prefs.shadeHeat}
                  isNight={isNight}
                  accent="#8DC63F"
                  tone="lime"
                  onChange={(shadeHeat) =>
                    setPrefs((p) => ({ ...p, shadeHeat }))
                  }
                />
              ) : null}

              <p
                className={`mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide ${
                  isNight ? "text-white/45" : "text-slate-500"
                }`}
              >
                How
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ["trip", "A to B", "Start and end places", IconTrip],
                    [
                      "outing",
                      "Around here",
                      "About N minutes from a start",
                      IconOuting,
                    ],
                  ] as const
                ).map(([id, title, blurb, Icon]) => {
                  const on = walkIntent === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWalkIntent(id)}
                      className={`min-h-11 rounded-2xl border px-3 py-2.5 text-left ${
                        on
                          ? "border-yw-teal bg-[color-mix(in_srgb,var(--yw-teal)_15%,transparent)]"
                          : isNight
                            ? "border-white/15 bg-white/[0.03]"
                            : "border-[#E8ECF2] bg-yw-day-surface"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            on
                              ? "text-yw-teal"
                              : isNight
                                ? "text-white/55"
                                : "text-slate-500"
                          }`}
                          aria-hidden
                        />
                        <span className="text-[13px] font-bold">{title}</span>
                      </div>
                      <div
                        className={`mt-0.5 text-[10px] leading-snug ${
                          isNight ? "text-white/55" : "text-slate-600"
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
                  <OutingDurationSlider
                    value={outingMinutes}
                    onChange={(m) => setOutingMinutes(clampOutingMinutes(m))}
                    isNight={isNight}
                  />
                  <p
                    className={`mt-3 text-[11px] font-bold uppercase tracking-wide ${
                      isNight ? "text-white/45" : "text-slate-500"
                    }`}
                  >
                    Shape
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {OUTING_SHAPES.map((s) => {
                      const on = outingShape === s.id;
                      const ShapeIcon = SHAPE_ICONS[s.id];
                      return (
                        <button
                          key={s.id}
                          type="button"
                          title={s.hint}
                          onClick={() => setOutingShape(s.id)}
                          className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 text-center text-[11px] font-bold leading-tight ${
                            on
                              ? "border-yw-teal bg-[color-mix(in_srgb,var(--yw-teal)_15%,transparent)] text-yw-teal"
                              : isNight
                                ? "border-white/15 text-white/75"
                                : "border-[#E8ECF2] text-slate-600"
                          }`}
                        >
                          <ShapeIcon className="h-4 w-4" aria-hidden />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className={`text-[10px] leading-snug ${
                      isNight ? "text-white/45" : "text-slate-500"
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
                <p className="mb-2 text-xs font-medium text-yw-blue">
                  Tap the map to set{" "}
                  {pickMode === "origin"
                    ? walkIntent === "outing"
                      ? "start"
                      : "origin"
                    : "destination"}
                </p>
              ) : null}

              <p
                className={`mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wide ${
                  isNight ? "text-white/45" : "text-slate-500"
                }`}
              >
                Along the way
              </p>
              <p
                className={`mb-2 text-[10px] leading-snug ${
                  isNight ? "text-white/45" : "text-slate-500"
                }`}
              >
                {walkIntent === "outing"
                  ? "Show on the map. On Around here, also soft-prefer walks near checked types when data exists — does not change corridor score pills."
                  : "Show on the map only — does not change walk scores."}
              </p>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {OVERLAY_DEFS.map((def) => {
                  const checked = overlays[def.id];
                  const OverlayIcon = OVERLAY_ICONS[def.id];
                  return (
                    <label
                      key={def.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] ${
                        !def.available
                          ? isNight
                            ? "border-white/10 opacity-45"
                            : "border-slate-100 opacity-50"
                          : checked
                            ? "border-[color-mix(in_srgb,var(--yw-teal)_50%,transparent)] bg-[color-mix(in_srgb,var(--yw-teal)_10%,transparent)]"
                            : isNight
                              ? "border-white/15"
                              : "border-[#E8ECF2]"
                      }`}
                      title={def.hint}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-[var(--yw-teal)]"
                        disabled={!def.available}
                        checked={checked}
                        onChange={() => toggleOverlay(def.id)}
                      />
                      <OverlayIcon
                        className="h-4 w-4 shrink-0"
                        style={{ color: def.color }}
                        aria-hidden
                      />
                      <span>
                        <span className="font-semibold">{def.label}</span>
                        {!def.available ? (
                          <span
                            className={`block text-[9px] ${
                              isNight ? "text-white/45" : "text-slate-500"
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
                className={`mt-1 flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white disabled:opacity-40 ${
                  isNight ? "bg-yw-blue" : "bg-yw-navy"
                }`}
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
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  {networkStatus}
                </p>
              ) : null}
            </div>
          ) : null}

          {sheetSnap !== "peek" && routeError ? (
            <div
              className={`mt-2 rounded-2xl border px-3.5 py-3 text-xs leading-snug ${
                isNight
                  ? "border-[color-mix(in_srgb,var(--yw-amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--yw-amber)_10%,transparent)] text-amber-100"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              <p className="font-semibold">Couldn’t find a walk</p>
              <p className="mt-0.5 opacity-90">{routeError}</p>
              <p className="mt-1.5 opacity-80">
                Try closer points in Casey, or tap Map to set From/To on the
                streets.
              </p>
            </div>
          ) : null}
          {error ? (
            <p className="mt-2 text-xs text-amber-500">{error}</p>
          ) : null}

          {sheetSnap !== "peek" && !planning && routes.length > 0 ? (
            <ul key="results-list" className="yw-sheet-panel mt-3 space-y-2.5">
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
                      className={`relative w-full rounded-2xl border px-3.5 py-3.5 text-left transition-colors ${
                        active
                          ? `yw-card-selected-pulse border-[color-mix(in_srgb,var(--yw-teal)_55%,transparent)] bg-[color-mix(in_srgb,var(--yw-teal)_10%,transparent)]`
                          : isNight
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-[#E8ECF2] bg-yw-day-surface"
                      }`}
                    >
                      {i === 0 ? (
                        <span className="absolute right-3 top-0 rounded-b-md bg-yw-teal px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
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
                              isNight ? "text-white/55" : "text-slate-600"
                            }`}
                          >
                            {routeCardBlurb(r, routes)}
                          </p>
                          {r.amenity_note ? (
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                isNight ? "text-yw-lime" : "text-[#2D6A1A]"
                              }`}
                            >
                              {r.amenity_note}
                            </p>
                          ) : null}
                          {prefs.preferSharedPaths &&
                          (r.score.shared_use_ratio ?? 0) >= 0.2 ? (
                            <p
                              className={`mt-1 text-[10px] leading-snug ${
                                isNight ? "text-yw-blue" : "text-[#0B5F8A]"
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
                                isNight ? "text-amber-200" : "text-amber-900"
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
                                  ? "text-amber-200"
                                  : "text-amber-900"
                                : isNight
                                  ? "text-white/55"
                                  : "text-slate-600"
                            }`}
                            title={note.detail}
                          >
                            {note.text}
                          </p>
                        );
                      })()}

                      <div
                        className={`mt-2 flex gap-3 text-xs ${
                          isNight ? "text-white/60" : "text-slate-600"
                        }`}
                      >
                        <span>
                          <strong
                            className={isNight ? "text-white/90" : "text-slate-800"}
                          >
                            {formatDuration(r.duration_s)}
                          </strong>
                        </span>
                        <span className="opacity-30">·</span>
                        <span>
                          <strong
                            className={isNight ? "text-white/90" : "text-slate-800"}
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

          {sheetSnap !== "peek" &&
          !planning &&
          sheetMode === "results" &&
          routes.length > 0 ? (
            <button
              type="button"
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-yw-teal text-sm font-bold text-white"
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

          {sheetSnap !== "peek" ? (
            <p
              className={`mt-3 text-[10px] leading-snug ${
                isNight ? "text-white/45" : "text-slate-500"
              }`}
            >
              Trip mode (pilot): Mapbox walks plus neighbourhood score-aware
              links, ranked by Casey scores plus time and distance. Not a safety
              guarantee.
            </p>
          ) : null}
          </div>
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
      ? "bg-[color-mix(in_srgb,var(--yw-amber)_14%,transparent)] text-yw-amber"
      : "bg-[color-mix(in_srgb,var(--yw-amber)_16%,white)] text-[#92720A]",
    blue: isNight
      ? "bg-[color-mix(in_srgb,var(--yw-blue)_14%,transparent)] text-yw-blue"
      : "bg-[color-mix(in_srgb,var(--yw-blue)_12%,white)] text-[#0B5F8A]",
    lime: isNight
      ? "bg-[color-mix(in_srgb,var(--yw-lime)_14%,transparent)] text-yw-lime"
      : "bg-[color-mix(in_srgb,var(--yw-lime)_14%,white)] text-[#2D6A1A]",
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
  description,
  value,
  isNight,
  accent,
  tone,
  onChange,
}: {
  title: string;
  description?: string;
  value: number;
  isNight: boolean;
  accent: string;
  tone: "amber" | "blue" | "lime";
  onChange: (v: number) => void;
}) {
  const clamped = Math.min(
    PREF_IMPORTANCE_MAX,
    Math.max(PREF_IMPORTANCE_MIN, value),
  );
  const shells = {
    amber: isNight
      ? "border-[color-mix(in_srgb,var(--yw-amber)_22%,transparent)] bg-[color-mix(in_srgb,var(--yw-amber)_8%,transparent)]"
      : "border-[color-mix(in_srgb,var(--yw-amber)_28%,transparent)] bg-[color-mix(in_srgb,var(--yw-amber)_12%,white)]",
    blue: isNight
      ? "border-[color-mix(in_srgb,var(--yw-blue)_20%,transparent)] bg-[color-mix(in_srgb,var(--yw-blue)_7%,transparent)]"
      : "border-[color-mix(in_srgb,var(--yw-blue)_22%,transparent)] bg-[color-mix(in_srgb,var(--yw-blue)_10%,white)]",
    lime: isNight
      ? "border-[color-mix(in_srgb,var(--yw-lime)_20%,transparent)] bg-[color-mix(in_srgb,var(--yw-lime)_7%,transparent)]"
      : "border-[color-mix(in_srgb,var(--yw-lime)_22%,transparent)] bg-[color-mix(in_srgb,var(--yw-lime)_10%,white)]",
  };
  const titles = {
    amber: isNight ? "text-yw-amber" : "text-[#92720A]",
    blue: isNight ? "text-yw-blue" : "text-[#0B5F8A]",
    lime: isNight ? "text-yw-lime" : "text-[#2D6A1A]",
  };
  const descs = {
    amber: isNight ? "text-[color-mix(in_srgb,var(--yw-amber)_70%,transparent)]" : "text-[#A07800]",
    blue: isNight ? "text-[color-mix(in_srgb,var(--yw-blue)_70%,transparent)]" : "text-[#146B96]",
    lime: isNight ? "text-[color-mix(in_srgb,var(--yw-lime)_70%,transparent)]" : "text-[#3A7A22]",
  };
  return (
    <label
      className={`mb-2.5 block rounded-2xl border px-3.5 py-3 ${shells[tone]}`}
      style={{ "--yw-pref-accent": accent } as CSSProperties}
    >
      <div className="mb-2">
        <span className={`text-[15px] font-bold ${titles[tone]}`}>{title}</span>
        {description ? (
          <p className={`mt-0.5 text-[12px] leading-snug ${descs[tone]}`}>
            {description}
          </p>
        ) : null}
      </div>
      <input
        type="range"
        min={PREF_IMPORTANCE_MIN}
        max={PREF_IMPORTANCE_MAX}
        value={clamped}
        onChange={(e) => onChange(clampImportance(Number(e.target.value)))}
        className="yw-pref-range"
        aria-valuemin={PREF_IMPORTANCE_MIN}
        aria-valuemax={PREF_IMPORTANCE_MAX}
        aria-valuenow={clamped}
        aria-label={`${title} importance`}
      />
      <div
        className={`mt-0.5 flex justify-between text-[10px] font-semibold leading-none ${descs[tone]}`}
      >
        <span>Less</span>
        <span>More</span>
      </div>
    </label>
  );
}
