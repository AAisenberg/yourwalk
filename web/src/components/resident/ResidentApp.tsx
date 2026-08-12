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
  type ReactNode,
} from "react";

import {
  IconLocate,
  IconOuting,
  IconTrip,
  OVERLAY_ICONS,
  SHAPE_ICONS,
} from "@/components/resident/icons";
import { PlaceField } from "@/components/resident/PlaceField";
import { SegmentedPill } from "@/components/resident/SegmentedPill";
import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
import { MD_UP, useMediaQuery } from "@/hooks/useMediaQuery";
import {
  APP_VERSION,
  BETA_LABEL,
  betaVersionDetail,
  betaVersionTitle,
  SCORING_SPEC_VERSION,
} from "@/lib/beta";
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
  RESIDENT_OUTING_SHAPES,
  clampOutingMinutes,
  type OutingShape,
  planOutingRoutes,
} from "@/lib/routing/planOuting";
import {
  DEFAULT_PREFS_DAY,
  DEFAULT_PREFS_NIGHT,
  PREF_IMPORTANCE_MAX,
  PREF_IMPORTANCE_MIN,
  RESULTS_PREF_RERANK_NOTE,
  type RoutePreferences,
  type WalkMode,
  clampImportance,
  preferenceScore,
  prefSliderDescription,
  routeCardLabel,
  routeCardBlurb,
  routeMatchExplain,
  sortRoutesByPreferences,
  tripRankScore,
} from "@/lib/routing/preferences";
import type { LngLat, ScoredRoute } from "@/lib/routing/types";
import { CASEY_BOUNDS } from "@/lib/scores";

type PickMode = "idle" | "origin" | "destination";
/** Type of walk — trip A→B vs timed outing from a start. */
type WalkIntent = "trip" | "outing";
/** Bottom sheet snap — Google Maps-style peek / half / full. */
type SheetSnap = "peek" | "half" | "full";

const WELCOME_STORAGE_KEY = "yw-resident-welcome-v1";

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
  const isDesktop = useMediaQuery(MD_UP);
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
  /** True after “Use this route” — map focused on the selected walk. */
  const [routeLocked, setRouteLocked] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const sheetDragRef = useRef<{
    startY: number;
    startSnap: SheetSnap;
  } | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(WELCOME_STORAGE_KEY) !== "1") {
        setShowWelcome(true);
      }
    } catch {
      setShowWelcome(true);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try {
      window.localStorage.setItem(WELCOME_STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

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
          setRouteLocked(false);
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
    setRouteLocked(false);
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
  /** Desktop uses a full-height side panel — ignore mobile peek/half snaps. */
  const sheetExpanded = isDesktop || sheetSnap !== "peek";
  const shortLabel = (s: string) =>
    s ? s.split(",").slice(0, 2).join(",").trim() : "";

  useEffect(() => {
    if (!isDesktop) return;
    setSheetSnap("full");
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => map.resize());
  }, [isDesktop]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const t = window.setTimeout(() => map.resize(), 80);
    return () => window.clearTimeout(t);
  }, [sheetSnap, mapReady, isDesktop]);

  const stepSheetSnap = (from: SheetSnap, delta: number): SheetSnap => {
    const i = SHEET_SNAPS.indexOf(from);
    return SHEET_SNAPS[Math.max(0, Math.min(SHEET_SNAPS.length - 1, i + delta))]!;
  };

  const onSheetHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDesktop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetDragRef.current = { startY: e.clientY, startSnap: sheetSnap };
  };

  const onSheetHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDesktop) return;
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
        className={`yw-chrome-transition flex items-center border-b px-4 py-3 ${
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
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={`truncate text-xl font-extrabold leading-none tracking-tight ${
                  isNight ? "text-white" : "text-yw-navy"
                }`}
              >
                YourWalk
              </p>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                  isNight
                    ? "bg-white/10 text-white/80 ring-1 ring-white/20"
                    : "bg-yw-navy/8 text-yw-navy ring-1 ring-yw-navy/15"
                }`}
                title={betaVersionDetail()}
              >
                {BETA_LABEL}
              </span>
            </div>
            <p
              className={`mt-0.5 truncate text-[11px] font-medium ${
                isNight ? "text-white/55" : "text-slate-600"
              }`}
            >
              Connecting Casey walks
              <span className="hidden sm:inline">
                {" "}
                · app {APP_VERSION} · scores {SCORING_SPEC_VERSION}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {!mapReady && !error ? (
          <div
            className={`pointer-events-none absolute top-3 z-[5] flex justify-center ${
              isDesktop ? "inset-x-0 md:left-[27rem] md:right-0" : "inset-x-0"
            }`}
          >
            <p className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white shadow">
              Loading map…
            </p>
          </div>
        ) : null}
        {mapReady && !networkReady && !error ? (
          <div
            className={`pointer-events-none absolute top-3 z-[5] flex justify-center ${
              isDesktop ? "inset-x-0 md:left-[27rem] md:right-0" : "inset-x-0"
            }`}
          >
            <p className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white shadow">
              {networkStatus}
            </p>
          </div>
        ) : null}
        {error ? (
          <div
            className={`absolute top-3 z-[5] flex justify-center px-3 ${
              isDesktop ? "inset-x-0 md:left-[27rem] md:right-0" : "inset-x-0"
            }`}
          >
            <div
              className={`max-w-md rounded-2xl border px-3.5 py-3 text-xs leading-snug shadow-lg ${
                isNight
                  ? "border-amber-400/40 bg-yw-night-panel text-amber-100"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
              role="alert"
            >
              <p className="font-semibold">Couldn’t load map data</p>
              <p className="mt-0.5 opacity-90">{error}</p>
              <p className="mt-1.5 opacity-80">
                Hard-refresh the page. If it persists, the footpath network may
                still be downloading — try again in a minute.
              </p>
            </div>
          </div>
        ) : null}
        {planning ? (
          <div
            className={`pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-black/20 ${
              isDesktop ? "md:left-[27rem]" : ""
            }`}
          >
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

        {/* Locate FAB — above sheet on mobile; map corner on desktop */}
        <button
          type="button"
          disabled={geoBusy || !mapReady}
          onClick={() => void useMyLocation()}
          className={`absolute z-[7] flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 transition disabled:opacity-40 ${
            isDesktop
              ? "bottom-5 right-5"
              : sheetSnap === "peek"
                ? "bottom-[calc(22%+12px)] right-3"
                : sheetSnap === "half"
                  ? "bottom-[calc(48%+12px)] right-3"
                  : "bottom-[calc(72%+12px)] right-3"
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
          className={`yw-chrome-transition absolute z-10 flex flex-col overflow-hidden shadow-2xl ${
            isDesktop
              ? "inset-y-3 left-3 w-[min(26rem,calc(100%-1.5rem))] rounded-2xl"
              : `inset-x-0 bottom-0 rounded-t-2xl ${SHEET_SNAP_CLASS[sheetSnap]}`
          } ${
            isNight
              ? "bg-yw-night-panel/95 backdrop-blur"
              : "bg-white/95 backdrop-blur"
          }`}
        >
          {!isDesktop ? (
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
          ) : (
            <div className="shrink-0 px-4 pb-1 pt-3" aria-hidden />
          )}

          <div
            className={`yw-sheet-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 ${
              isNight ? "yw-sheet-scroll-night" : ""
            }`}
          >
          {!isDesktop && sheetSnap === "peek" && !planning ? (
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
                    ? routeLocked
                      ? "Selected on the map · swipe up to compare"
                      : `${routes.length} option${routes.length === 1 ? "" : "s"} · tap to expand`
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

          {sheetExpanded && planning ? (
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

          {sheetExpanded &&
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
                        outingShape === "out_and_back"
                          ? "there and back"
                          : "loop"
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
                  setRouteLocked(false);
                  setSheetMode("plan");
                  setSheetSnap("full");
                }}
              >
                Edit walk
              </button>
            </div>
          ) : null}

          {sheetExpanded &&
          !planning &&
          sheetMode === "results" &&
          routes.length > 0 ? (
            <p
              className={`mb-3 rounded-xl px-3 py-2 text-[11px] leading-snug ${
                isNight
                  ? "bg-white/[0.06] text-white/70"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {RESULTS_PREF_RERANK_NOTE}
            </p>
          ) : null}

          {sheetExpanded && !planning && sheetMode === "plan" ? (
            <div key="plan" className="yw-sheet-panel">
              <h1
                className={`mb-4 text-lg font-extrabold tracking-tight ${
                  isNight ? "text-white" : "text-yw-navy"
                }`}
              >
                Tell us about your walk
              </h1>

              {showWelcome ? (
                <div
                  className={`mb-4 rounded-2xl border px-3.5 py-3 ${
                    isNight
                      ? "border-white/15 bg-white/[0.06]"
                      : "border-yw-teal/30 bg-[color-mix(in_srgb,var(--yw-teal)_8%,white)]"
                  }`}
                >
                  <p
                    className={`text-[12px] font-semibold leading-snug ${
                      isNight ? "text-white" : "text-yw-navy"
                    }`}
                  >
                    YourWalk finds routes that suit you, not just the shortest
                    one.
                  </p>
                  <p
                    className={`mt-1.5 text-[11px] leading-snug ${
                      isNight ? "text-white/65" : "text-slate-700"
                    }`}
                  >
                    Mark what matters — smoother paths, shade, or lighting after
                    dark — and we rank the best options we can find. This pilot
                    plans walks; it does not give turn-by-turn navigation yet.
                  </p>
                  <button
                    type="button"
                    onClick={dismissWelcome}
                    className={`mt-2.5 text-[11px] font-bold ${
                      isNight ? "text-yw-teal" : "text-yw-teal"
                    }`}
                  >
                    Got it
                  </button>
                </div>
              ) : null}

              <section>
                <p
                  className={`mb-2 text-[13px] font-semibold ${
                    isNight ? "text-white/70" : "text-slate-700"
                  }`}
                >
                  When
                </p>
                <WalkModeSwitch
                  value={walkMode}
                  onChange={setWalkMode}
                  isNight={isNight}
                />
                <p
                  className={`mb-1 text-[12px] font-semibold ${
                    isNight ? "text-white/55" : "text-slate-600"
                  }`}
                >
                  What matters most
                </p>
                <p
                  className={`mb-2 text-[10px] leading-snug ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  Sliders set how important each factor is when we rank options
                  — not whether you want worse paths.
                </p>
                <PrefSlider
                  title="Accessible footpaths"
                  description={prefSliderDescription(
                    "accessibility",
                    prefs.accessibility,
                  )}
                  value={prefs.accessibility}
                  isNight={isNight}
                  accent="#27AAE1"
                  tone="blue"
                  onChange={(accessibility) =>
                    setPrefs((p) => ({ ...p, accessibility }))
                  }
                  headerAccessory={
                    <label
                      className={`flex shrink-0 cursor-pointer items-start gap-1 rounded-lg px-1 py-0.5 ${
                        prefs.preferSharedPaths
                          ? isNight
                            ? "bg-yw-blue/20"
                            : "bg-[color-mix(in_srgb,var(--yw-blue)_14%,white)]"
                          : ""
                      }`}
                      title="Soft preference: rank walks higher when they use more Casey shared-use paths (trails and wider paths), not only roadside footpaths. Does not change corridor score pills."
                      style={
                        {
                          "--yw-check-accent": "#0B5F8A",
                          "--yw-check-border": isNight
                            ? "rgba(255,255,255,0.35)"
                            : "#7EB8D4",
                          "--yw-check-bg": isNight
                            ? "rgba(255,255,255,0.06)"
                            : "#fff",
                        } as CSSProperties
                      }
                    >
                      <input
                        type="checkbox"
                        className="yw-check yw-check-sm mt-0.5"
                        checked={prefs.preferSharedPaths}
                        onChange={(e) =>
                          setPrefs((p) => ({
                            ...p,
                            preferSharedPaths: e.target.checked,
                          }))
                        }
                        aria-label="Prefer away from roads"
                      />
                      <span
                        className={`max-w-[5.5rem] text-[10px] font-semibold leading-tight ${
                          isNight ? "text-white/80" : "text-[#0B5F8A]"
                        }`}
                      >
                        Prefer away from roads
                      </span>
                    </label>
                  }
                />
                {isNight ? (
                  <PrefSlider
                    title="Lighting after dark"
                    description={prefSliderDescription(
                      "afterDark",
                      prefs.afterDark,
                    )}
                    value={prefs.afterDark}
                    isNight={isNight}
                    accent="#FFCB1F"
                    tone="amber"
                    onChange={(afterDark) =>
                      setPrefs((p) => ({ ...p, afterDark }))
                    }
                  />
                ) : (
                  <PrefSlider
                    title="Heat & Shade"
                    description={prefSliderDescription(
                      "shadeHeat",
                      prefs.shadeHeat,
                    )}
                    value={prefs.shadeHeat}
                    isNight={isNight}
                    accent="#8DC63F"
                    tone="lime"
                    onChange={(shadeHeat) =>
                      setPrefs((p) => ({ ...p, shadeHeat }))
                    }
                  />
                )}
              </section>

              <section
                className={`mt-4 border-t pt-4 ${
                  isNight ? "border-white/10" : "border-[#E8ECF2]"
                }`}
              >
                <p
                  className={`mb-2 text-[13px] font-semibold ${
                    isNight ? "text-white/70" : "text-slate-700"
                  }`}
                >
                  Type of walk
                </p>
                <SegmentedPill
                  value={walkIntent}
                  onChange={setWalkIntent}
                  isNight={isNight}
                  ariaLabel="Type of walk"
                  className="mb-1.5"
                  options={[
                    {
                      id: "trip",
                      label: "A to B",
                      Icon: IconTrip,
                      title: "Start and end places",
                    },
                    {
                      id: "outing",
                      label: "Around here",
                      Icon: IconOuting,
                      title: "About N minutes from a start",
                    },
                  ]}
                />
                <p
                  className={`mb-3 text-[10px] leading-snug ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  {walkIntent === "trip"
                    ? "Set a start and end in Casey."
                    : "Timed walk from a start — loop or there and back."}
                </p>

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
                    className={`mt-3 mb-1.5 text-[12px] font-semibold ${
                      isNight ? "text-white/60" : "text-slate-600"
                    }`}
                  >
                    Shape
                  </p>
                  <SegmentedPill
                    value={outingShape === "one_way" ? "loop" : outingShape}
                    onChange={setOutingShape}
                    isNight={isNight}
                    ariaLabel="Outing shape"
                    options={RESIDENT_OUTING_SHAPES.map((s) => ({
                      id: s.id,
                      label:
                        s.id === "out_and_back" ? "There & back" : "Loop",
                      Icon: SHAPE_ICONS[s.id],
                      title: s.hint,
                    }))}
                  />
                  <p
                    className={`mt-1.5 text-[10px] leading-snug ${
                      isNight ? "text-white/45" : "text-slate-500"
                    }`}
                  >
                    {
                      RESIDENT_OUTING_SHAPES.find((s) => s.id === outingShape)
                        ?.hint
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
              </section>

              <section
                className={`mt-4 border-t pt-4 ${
                  isNight ? "border-white/10" : "border-[#E8ECF2]"
                }`}
              >
                <p
                  className={`mb-1.5 text-[13px] font-semibold ${
                    isNight ? "text-white/70" : "text-slate-700"
                  }`}
                >
                  Along the way
                </p>
                <p
                  className={`mb-2 text-[10px] leading-snug ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  Show on the map
                  {walkIntent === "outing" ? "; soft bias for Around here" : ""}
                  . Not in the walk score.
                </p>
                <div className="mb-1 grid grid-cols-2 gap-1.5">
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
                              ? isNight
                                ? "border-white/25 bg-white/[0.06]"
                                : "border-yw-navy/25 bg-yw-navy/[0.04]"
                              : isNight
                                ? "border-white/15"
                                : "border-[#E8ECF2]"
                        }`}
                        title={def.hint}
                        style={
                          {
                            "--yw-check-accent": isNight
                              ? "#8B8DD9"
                              : "#292984",
                            "--yw-check-border": isNight
                              ? "rgba(255,255,255,0.35)"
                              : "#CBD5E1",
                            "--yw-check-bg": isNight
                              ? "rgba(255,255,255,0.06)"
                              : "#fff",
                          } as CSSProperties
                        }
                      >
                        <input
                          type="checkbox"
                          className="yw-check"
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
              </section>
            </div>
          ) : null}

          {sheetExpanded && routeError ? (
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
                {walkIntent === "outing"
                  ? "Try another start on the map, There and back, or a different duration."
                  : "Try closer points in Casey, or tap Map to set From/To on the streets."}
              </p>
            </div>
          ) : null}
          {sheetExpanded && !planning && routes.length > 0 ? (
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
                      onClick={() => {
                        setRouteLocked(false);
                        setSelectedId(r.id);
                      }}
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
                          {(() => {
                            const matchNote = routeMatchExplain(
                              display,
                              r,
                              routes,
                            );
                            if (!matchNote) return null;
                            return (
                              <p
                                className={`mt-1 text-[10px] leading-snug ${
                                  isNight ? "text-amber-200" : "text-amber-900"
                                }`}
                              >
                                {matchNote}
                              </p>
                            );
                          })()}
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
                                ? "Uses more paths away from the road"
                                : "Uses some paths away from the road"}
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
                          title="Match is mostly Footpaths + Heat & Shade (or Lighting) from your importance ratings. Around here, time only gently ranks options already within about 5 minutes of your ask. Pills are corridor stream scores (/10)."
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
                        <ScorePill
                          label="Footpaths"
                          value={r.score.accessibility_display}
                          tone="blue"
                          isNight={isNight}
                        />
                        {isNight ? (
                          <ScorePill
                            label="Lighting"
                            value={
                              r.score.lighting_display ?? r.score.night_display
                            }
                            tone="amber"
                            isNight={isNight}
                          />
                        ) : (
                          <ScorePill
                            label="Heat & Shade"
                            value={
                              r.score.heat_shade_display ?? r.score.day_display
                            }
                            tone="lime"
                            isNight={isNight}
                          />
                        )}
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

          {sheetExpanded &&
          !planning &&
          sheetMode === "results" &&
          routes.length > 0 ? (
            <button
              type="button"
              className={`mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white ${
                routeLocked
                  ? "bg-[color-mix(in_srgb,var(--yw-teal)_70%,#0f766e)]"
                  : "bg-yw-teal"
              }`}
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
                setRouteLocked(true);
                if (!isDesktop) setSheetSnap("peek");
              }}
            >
              {routeLocked ? "Looking at this walk" : "Use this route"}
            </button>
          ) : null}

          {sheetExpanded ? (
            <p
              className={`mt-3 text-[10px] leading-snug ${
                isNight ? "text-white/45" : "text-slate-500"
              }`}
            >
              Trip mode (pilot): Mapbox walks plus neighbourhood score-aware
              links, ranked by Casey scores plus time and distance. Not a
              safety guarantee. {betaVersionTitle()} · {betaVersionDetail()}.
            </p>
          ) : null}
          </div>

          {sheetExpanded && !planning && sheetMode === "plan" ? (
            <div
              className={`shrink-0 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 ${
                isNight ? "border-white/10" : "border-[#E8ECF2]"
              }`}
            >
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
                className={`flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white disabled:opacity-40 ${
                  isNight ? "bg-yw-blue" : "bg-yw-navy"
                }`}
              >
                {!networkReady
                  ? "Loading network…"
                  : walkIntent === "outing"
                    ? "Find my walk"
                    : "Find my route"}
              </button>
              {mapReady ? (
                <p
                  className={`mt-1.5 text-center text-[10px] ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  {networkStatus}
                </p>
              ) : null}
            </div>
          ) : null}
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
      text: "No Casey scored footpath under this path — Footpaths and comfort scores unavailable",
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
  headerAccessory,
}: {
  title: string;
  description?: string;
  value: number;
  isNight: boolean;
  accent: string;
  tone: "amber" | "blue" | "lime";
  onChange: (v: number) => void;
  /** Compact control in the title row (e.g. Shared paths). */
  headerAccessory?: ReactNode;
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
    <div
      className={`mb-2.5 rounded-2xl border px-3.5 py-3 ${shells[tone]}`}
      style={{ "--yw-pref-accent": accent } as CSSProperties}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`text-[15px] font-bold ${titles[tone]}`}>{title}</span>
          {description ? (
            <p className={`mt-0.5 text-[12px] leading-snug ${descs[tone]}`}>
              {description}
            </p>
          ) : null}
        </div>
        {headerAccessory}
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
        <span>Less important</span>
        <span>More important</span>
      </div>
    </div>
  );
}
