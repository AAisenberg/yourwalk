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

import { IconOuting, IconTrip } from "@/components/resident/icons";
import { PlaceField } from "@/components/resident/PlaceField";
import { RingedAmenityIcon } from "@/components/resident/RingedAmenityIcon";
import { SegmentedPill } from "@/components/resident/SegmentedPill";
import { WalkModeSwitch } from "@/components/resident/WalkModeSwitch";
import { MdClose, MdEdit, MdLayers } from "react-icons/md";
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
import {
  plannedLightPreset,
  resolveCaseyWhen,
  whenHintForOverride,
  type LightPreset,
} from "@/lib/caseyWhen";
import { reverseGeocode } from "@/lib/routing/geocode";
import {
  formatDistance,
  formatDuration,
  pointInCaseyBbox,
  toDisplayScore,
} from "@/lib/routing/geo";
import {
  DEFAULT_OVERLAYS,
  OVERLAY_DEFS,
  type OverlayId,
  type OverlayState,
} from "@/lib/overlays";
import {
  ensureOverlayImages,
  overlayIconImageId,
  overlayIconLayerId,
} from "@/lib/overlayMapIcons";
import { planScoredRoutes } from "@/lib/routing/planRoute";
import { OutingDurationSlider } from "@/components/resident/OutingDurationSlider";
import {
  clampOutingMinutes,
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
  isScoreAwareStrategy,
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

/** Beta QA affordance: show which engine drew each card. Flip off for launch. */
const SHOW_ENGINE_BADGE = true;

type PickMode = "idle" | "origin" | "destination";
/** Type of walk — trip A→B vs timed outing from a start. */
type WalkIntent = "trip" | "outing";
/** Bottom sheet snap — Google Maps-style peek / half / full. */
type SheetSnap = "peek" | "half" | "full";

const WELCOME_STORAGE_KEY = "yw-resident-welcome-v2";
const PREFS_STORAGE_KEY = "yw-resident-prefs-v1";
const LAYERS_STORAGE_KEY = "yw-resident-layers-v1";
const LAYERS_TIP_KEY = "yw-resident-layers-tip-v1";

const ROUTE_COLORS_DAY = ["#00AAA6", "#27AAE1", "#8DC63F"] as const;
/** Night: lighting-family yellows so walks pop on the dark Standard basemap. */
const ROUTE_COLORS_NIGHT = ["#FFCB1F", "#F6871F", "#D7DF23"] as const;

function routeColors(night: boolean): readonly [string, string, string] {
  return night ? ROUTE_COLORS_NIGHT : ROUTE_COLORS_DAY;
}
const SHEET_SNAPS: SheetSnap[] = ["peek", "half", "full"];
const SHEET_SNAP_CLASS: Record<SheetSnap, string> = {
  peek: "h-[22%] max-h-[22%]",
  half: "h-[48%] max-h-[48%]",
  full: "h-[72%] max-h-[72%]",
};

const YOURWALK_STYLE =
  "mapbox://styles/crowdspot1/cmsve8sql00ak01rgb6vn39pt";
const DAY_BASEMAP = "mapbox://styles/mapbox/streets-v12";
const NIGHT_BASEMAP = "mapbox://styles/mapbox/dark-v11";

function applyStandardLook(map: mapboxgl.Map, preset: LightPreset) {
  try {
    map.setConfigProperty("basemap", "lightPreset", preset);
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
  } catch {
    /* classic streets / dark has no Standard basemap config */
  }
}

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
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3.5,
        "line-opacity": opts.night ? 0.72 : 0.42,
        "line-emissive-strength": opts.night ? 0.85 : 0.12,
      },
    });
  }
  if (!map.getLayer("routes-selected")) {
    map.addLayer({
      id: "routes-selected",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "selected"], 1],
      slot: "top",
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": ["get", "color"],
        // Round caps + short dashes ≈ dotted circles along the path
        "line-width": 5.5,
        "line-opacity": 1,
        "line-dasharray": [0.12, 1.65],
        "line-emissive-strength": opts.night ? 1 : 0.2,
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
  const basemapStyleRef = useRef<string>(YOURWALK_STYLE);
  const usedClassicBasemapRef = useRef(false);
  const walkModeRef = useRef<WalkMode>("day");

  const [mapReady, setMapReady] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState("Loading footpath network…");
  const [error, setError] = useState<string | null>(null);
  const [walkMode, setWalkMode] = useState<WalkMode>("day");
  const [whenOverridden, setWhenOverridden] = useState(false);
  const [whenHint, setWhenHint] = useState("Day · daylight in Casey now");
  const [whenStale, setWhenStale] = useState(false);
  const [prefs, setPrefs] = useState<RoutePreferences>(DEFAULT_PREFS_DAY);
  const [prefsReady, setPrefsReady] = useState(false);
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
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [showLayersTip, setShowLayersTip] = useState(false);
  const [layersReady, setLayersReady] = useState(false);
  /** True after “Use this route” — map focused on the selected walk. */
  const [routeLocked, setRouteLocked] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const sheetDragRef = useRef<{
    startY: number;
    startSnap: SheetSnap;
  } | null>(null);

  useEffect(() => {
    let storedPrefs: string | null = null;
    try {
      if (window.localStorage.getItem(WELCOME_STORAGE_KEY) !== "1") {
        setShowWelcome(true);
      }
      setShowLayersTip(window.localStorage.getItem(LAYERS_TIP_KEY) !== "1");
      storedPrefs = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (storedPrefs) {
        const parsed = JSON.parse(storedPrefs) as Partial<RoutePreferences>;
        setPrefs((prev) => ({
          ...prev,
          accessibility: clampImportance(
            parsed.accessibility ?? prev.accessibility,
          ),
          shadeHeat: clampImportance(parsed.shadeHeat ?? prev.shadeHeat),
          afterDark: clampImportance(parsed.afterDark ?? prev.afterDark),
          preferSharedPaths: Boolean(
            parsed.preferSharedPaths ?? prev.preferSharedPaths,
          ),
        }));
      }
      const storedLayers = window.localStorage.getItem(LAYERS_STORAGE_KEY);
      if (storedLayers) {
        const parsed = JSON.parse(storedLayers) as Partial<OverlayState>;
        setOverlays({ ...DEFAULT_OVERLAYS, ...parsed });
      }
    } catch {
      setShowWelcome(true);
    }
    const auto = resolveCaseyWhen();
    setWalkMode(auto.walkMode);
    setWhenHint(auto.hint);
    if (auto.walkMode === "night" && !storedPrefs) {
      setPrefs(DEFAULT_PREFS_NIGHT);
    }
    setPrefsReady(true);
    setLayersReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, prefsReady]);

  useEffect(() => {
    if (!layersReady) return;
    try {
      window.localStorage.setItem(
        LAYERS_STORAGE_KEY,
        JSON.stringify(overlays),
      );
    } catch {
      /* ignore */
    }
  }, [overlays, layersReady]);

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
  }, [walkMode]);

  const clearResults = useCallback(() => {
    setRoutes([]);
    setSelectedId(null);
    setRouteError(null);
    setRouteLocked(false);
    setPlanning(false);
    setPickMode("idle");
  }, []);

  const editWalk = useCallback(() => {
    clearResults();
    setWhenStale(false);
    setSheetMode("plan");
    setSheetSnap("full");
  }, [clearResults]);

  const clearWalk = useCallback(() => {
    clearResults();
    setWhenStale(false);
    setOrigin(null);
    setDestination(null);
    setOriginLabel("");
    setDestLabel("");
    setSheetMode("plan");
    setSheetSnap("full");
  }, [clearResults]);

  const onWhenChange = (mode: WalkMode) => {
    setWhenOverridden(true);
    setWalkMode(mode);
    setWhenHint(whenHintForOverride(mode));
    if (sheetMode === "results" && routes.length > 0) {
      clearResults();
      setSheetMode("plan");
      setSheetSnap("full");
      setWhenStale(true);
    }
  };

  const openLayers = () => {
    setLayersOpen((o) => !o);
    if (showLayersTip) {
      setShowLayersTip(false);
      try {
        window.localStorage.setItem(LAYERS_TIP_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  };

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
      const colors = routeColors(walkMode === "night");
      // selected as 0/1 — Mapbox property filters are more reliable than booleans
      src.setData({
        type: "FeatureCollection",
        features: list.map((r, i) => ({
          type: "Feature",
          properties: {
            id: r.id,
            color: colors[i % colors.length],
            selected: r.id === selected ? 1 : 0,
          },
          geometry: r.geometry,
        })),
      });
    },
    [walkMode],
  );

  /** Re-attach amenity overlay layers (needed after basemap style swap). */
  const syncOverlayLayers = useCallback(
    (overlayState: OverlayState = overlays) => {
      const map = mapRef.current;
      if (!map) return;
      void (async () => {
        try {
          await ensureOverlayImages(map);
        } catch {
          return;
        }
        if (mapRef.current !== map) return;
        for (const def of OVERLAY_DEFS) {
          if (!def.available || !def.url) continue;
          const srcId = `overlay-${def.id}`;
          const oldCircleId = `overlay-${def.id}-pts`;
          const layerId = overlayIconLayerId(def.id);
          const on = overlayState[def.id];

          if (map.getLayer(oldCircleId)) map.removeLayer(oldCircleId);

          if (on) {
            if (!map.getSource(srcId)) {
              map.addSource(srcId, { type: "geojson", data: def.url });
            }
            if (!map.getLayer(layerId)) {
              map.addLayer({
                id: layerId,
                type: "symbol",
                source: srcId,
                slot: "top",
                layout: {
                  "icon-image": overlayIconImageId(def.id),
                  "icon-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    12,
                    0.55,
                    16,
                    0.95,
                  ],
                  "icon-allow-overlap": false,
                  "icon-ignore-placement": false,
                  "icon-padding": 4,
                },
                paint: {
                  "icon-opacity": 0.96,
                  "icon-emissive-strength": 0.75,
                },
              });
            } else {
              map.setLayoutProperty(layerId, "visibility", "visible");
            }
          } else if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", "none");
          }
        }
      })();
    },
    [overlays],
  );

  useEffect(() => {
    paintRoutes(routes, selectedId);
  }, [routes, selectedId, walkMode, paintRoutes]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Mapbox token missing — set NEXT_PUBLIC_MAPBOX_TOKEN in web/.env.local");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    basemapStyleRef.current = YOURWALK_STYLE;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: YOURWALK_STYLE,
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

      applyStandardLook(map, resolveCaseyWhen().lightPreset);
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
      const msg = e.error?.message ?? "";
      if (
        !usedClassicBasemapRef.current &&
        basemapStyleRef.current === YOURWALK_STYLE &&
        /style|403|404|not found|failed to fetch/i.test(msg)
      ) {
        usedClassicBasemapRef.current = true;
        const fallback =
          walkModeRef.current === "night" ? NIGHT_BASEMAP : DAY_BASEMAP;
        basemapStyleRef.current = fallback;
        map.setStyle(fallback);
        return;
      }
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

  // Planned When → Standard lightPreset (no full style swap)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const preset = plannedLightPreset(walkMode, whenOverridden);
    if (usedClassicBasemapRef.current) {
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
      return;
    }
    applyStandardLook(map, preset);
    if (map.getLayer("routes-alt")) {
      map.setPaintProperty(
        "routes-alt",
        "line-opacity",
        walkMode === "night" ? 0.72 : 0.42,
      );
      map.setPaintProperty(
        "routes-alt",
        "line-emissive-strength",
        walkMode === "night" ? 0.85 : 0.12,
      );
    }
    if (map.getLayer("routes-selected")) {
      map.setPaintProperty(
        "routes-selected",
        "line-emissive-strength",
        walkMode === "night" ? 1 : 0.2,
      );
    }
    if (map.getLayer("lga-line")) {
      map.setPaintProperty(
        "lga-line",
        "line-color",
        walkMode === "night" ? "#8B8DD9" : "#292984",
      );
    }
  }, [walkMode, whenOverridden, mapReady, paintRoutes, syncOverlayLayers]);

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
          if (!pointInCaseyBbox(point)) {
            setRouteError(
              "That location is outside Casey. Search or drop a pin inside the city.",
            );
            return;
          }
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
    setWhenStale(false);
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
        try {
          ranked = await planOutingRoutes(
            origin,
            outingMinutes,
            featuresRef.current,
            token,
            walkMode,
            prefs,
            { shape: "loop", amenityGoals },
            3,
          );
        } catch (loopErr) {
          try {
            ranked = await planOutingRoutes(
              origin,
              outingMinutes,
              featuresRef.current,
              token,
              walkMode,
              prefs,
              { shape: "out_and_back", amenityGoals },
              3,
            ).then((found) =>
              found.map((r) => ({
                ...r,
                outing_note:
                  r.outing_note ??
                  "Couldn’t find a clean circuit. This walk goes out and back the same way.",
              })),
            );
          } catch {
            throw loopErr;
          }
        }
      } else {
        const scored = await planScoredRoutes(
          origin,
          destination!,
          featuresRef.current,
          token,
          3,
          walkMode,
          prefs,
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
        className={`yw-chrome-transition flex items-center gap-2 border-b px-3 py-2.5 sm:px-4 ${
          isNight
            ? "border-white/10 bg-yw-night-surface"
            : "border-[#E8ECF2] bg-white"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/yourwalk-mark.svg"
          alt=""
          width={36}
          height={28}
          className="h-8 w-auto shrink-0"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
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
            className={`mt-0.5 truncate text-[10px] font-medium ${
              isNight ? "text-white/45" : "text-slate-500"
            }`}
            title={
              whenOverridden
                ? `${whenHint} · app ${APP_VERSION} · scores ${SCORING_SPEC_VERSION}`
                : `Connecting Casey walks · app ${APP_VERSION} · scores ${SCORING_SPEC_VERSION}`
            }
          >
            {whenHint}
          </p>
        </div>
        <div className="w-[138px] shrink-0">
          <WalkModeSwitch
            value={walkMode}
            onChange={onWhenChange}
            isNight={isNight}
            className="mb-0"
          />
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

        <button
          type="button"
          onClick={openLayers}
          className={`absolute z-[8] flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 ${
            isDesktop ? "left-[28.25rem] top-3" : "left-3 top-3"
          } ${
            layersOpen || Object.values(overlays).some(Boolean)
              ? "bg-yw-teal text-white ring-yw-teal/40"
              : isNight
                ? "bg-yw-night-panel text-white ring-white/15"
                : "bg-white text-yw-navy ring-black/10"
          }`}
          aria-expanded={layersOpen}
          aria-label="Map layers"
          title="Layers"
        >
          <MdLayers className="h-5 w-5" />
        </button>

        {showLayersTip && !layersOpen && pickMode === "idle" ? (
          <p
            className={`absolute z-[8] max-w-[13.5rem] rounded-xl px-2.5 py-2 text-[11px] font-semibold leading-snug shadow-sm ${
              isDesktop ? "left-[31.25rem] top-3" : "left-16 top-3"
            } ${
              isNight
                ? "bg-yw-night-panel text-white ring-1 ring-white/15"
                : "bg-white text-yw-navy ring-1 ring-black/10"
            }`}
          >
            Tap Layers to show fountains, benches, toilets, or dog bags.
          </p>
        ) : null}

        {layersOpen ? (
          <div
            className={`absolute z-[9] w-56 rounded-2xl p-2.5 shadow-lg ring-1 ${
              isDesktop ? "left-[28.25rem] top-16" : "left-3 top-16"
            } ${
              isNight
                ? "bg-yw-night-panel ring-white/15"
                : "bg-white ring-black/10"
            }`}
          >
            <p
              className={`mb-1.5 px-1 text-[10px] font-semibold ${
                isNight ? "text-white/50" : "text-slate-500"
              }`}
            >
              Show on the map
              {walkIntent === "outing" ? " · soft bias for Loop" : ""}
            </p>
            {OVERLAY_DEFS.map((def) => {
              const on = overlays[def.id];
              return (
                <button
                  key={def.id}
                  type="button"
                  disabled={!def.available}
                  aria-pressed={on}
                  onClick={() => toggleOverlay(def.id)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[11px] font-semibold disabled:opacity-45 ${
                    on
                      ? isNight
                        ? "bg-white/10 ring-1 ring-white/20"
                        : "bg-[color-mix(in_srgb,var(--yw-teal)_12%,white)] ring-1 ring-yw-teal/35"
                      : isNight
                        ? "text-white/55"
                        : "text-slate-500"
                  }`}
                >
                  <RingedAmenityIcon id={def.id} size="sm" muted={!on} />
                  <span className="min-w-0 flex-1">
                    {def.label}
                    {!def.available ? (
                      <span
                        className={`block text-[9px] font-medium ${
                          isNight ? "text-white/45" : "text-slate-500"
                        }`}
                      >
                        Coming soon
                      </span>
                    ) : null}
                  </span>
                  {on ? (
                    <span
                      className={`text-[10px] font-bold ${
                        isNight ? "text-yw-teal" : "text-yw-teal"
                      }`}
                    >
                      Showing
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

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
                    : "Find your walk"}
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
                    : "Swipe up to plan"}
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
                    ? `${shortLabel(originLabel) || "Start"} · ~${outingMinutes} min loop`
                    : `${shortLabel(originLabel) || "From"} → ${shortLabel(destLabel) || "To"}`}
                </p>
                <p
                  className={`text-[11px] ${
                    isNight ? "text-white/55" : "text-slate-600"
                  }`}
                >
                  {routes.length} option{routes.length === 1 ? "" : "s"} · tap a
                  walk to highlight it on the map
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="Edit walk"
                  aria-label="Edit walk"
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    isNight
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={editWalk}
                >
                  <MdEdit className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  title="Clear walk"
                  aria-label="Clear walk"
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    isNight
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={clearWalk}
                >
                  <MdClose className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}

          {sheetExpanded && !planning && sheetMode === "plan" ? (
            <div key="plan" className="yw-sheet-panel">
              <h1
                className={`mb-1.5 text-lg font-extrabold tracking-tight ${
                  isNight ? "text-white" : "text-yw-navy"
                }`}
              >
                Find your walk
              </h1>
              {whenStale ? (
                <p
                  className={`mb-3 rounded-xl px-3 py-2 text-[11px] leading-snug ${
                    isNight
                      ? "bg-white/[0.06] text-white/70"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  When changed. Find again to re-score.
                </p>
              ) : null}

              {showWelcome ? (
                <div
                  className={`mb-3 rounded-xl px-3 py-2 ${
                    isNight ? "bg-white/10" : "bg-yw-day-surface"
                  }`}
                >
                  <p
                    className={`text-[12px] leading-snug ${
                      isNight ? "text-white/70" : "text-slate-600"
                    }`}
                  >
                    Casey footpaths, ranked for shade, smoother paths, or
                    lighting after dark. Not just the shortest way.
                  </p>
                  <button
                    type="button"
                    onClick={dismissWelcome}
                    className={`mt-1.5 text-[11px] font-semibold ${
                      isNight ? "text-yw-blue" : "text-yw-navy"
                    }`}
                  >
                    Got it
                  </button>
                </div>
              ) : (
                <div className="mb-3" />
              )}

              <section>
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
                  className="mb-3"
                  options={[
                    {
                      id: "trip",
                      label: "A to B",
                      Icon: IconTrip,
                      title: "Start and end places",
                    },
                    {
                      id: "outing",
                      label: "Loop",
                      Icon: IconOuting,
                      title: "A circuit of about N minutes from a start",
                    },
                  ]}
                />

              {walkIntent === "trip" ? (
                <div className="mb-4 space-y-2">
                  <PlaceField
                    label="From"
                    placeholder="Park, school, suburb, or street"
                    dot="#009444"
                    isNight={isNight}
                    valueLabel={shortLabel(originLabel)}
                    pickActive={pickMode === "origin"}
                    onPickToggle={() =>
                      setPickMode((m) => (m === "origin" ? "idle" : "origin"))
                    }
                    showLocate
                    onLocate={() => void useMyLocation()}
                    geoBusy={geoBusy}
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
                    placeholder="Park, school, suburb, or street"
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
                <div className="mb-4 space-y-2">
                  <PlaceField
                    label="Start"
                    placeholder="Park, school, suburb, or street"
                    dot="#009444"
                    isNight={isNight}
                    valueLabel={shortLabel(originLabel)}
                    pickActive={pickMode === "origin"}
                    onPickToggle={() =>
                      setPickMode((m) => (m === "origin" ? "idle" : "origin"))
                    }
                    showLocate
                    onLocate={() => void useMyLocation()}
                    geoBusy={geoBusy}
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
                    className={`text-[10px] leading-snug ${
                      isNight ? "text-white/45" : "text-slate-500"
                    }`}
                  >
                    A circuit from your start that returns on a different path.
                  </p>
                  <p
                    className={`text-[10px] leading-snug ${
                      isNight ? "text-white/45" : "text-slate-500"
                    }`}
                  >
                    Want a fountain or bench on the way? Use Layers.
                  </p>
                </div>
              )}

              {pickMode !== "idle" ? (
                <p className="mb-3 text-xs font-medium text-yw-blue">
                  Tap the map to set{" "}
                  {pickMode === "origin"
                    ? walkIntent === "outing"
                      ? "start"
                      : "from"
                    : "to"}
                </p>
              ) : null}
              </section>

              <section>
                <p
                  className={`mb-1 text-[12px] font-semibold ${
                    isNight ? "text-white/55" : "text-slate-600"
                  }`}
                >
                  What matters most
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
                      title="When you search, include a walk that stays on parks and paths even if it takes longer (up to about 1.6×). Does not change corridor score pills."
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
                  ? "Try another start on the map, or a different duration."
                  : "Try closer points in Casey, or drop a pin to set From/To."}
              </p>
            </div>
          ) : null}
          {sheetExpanded &&
          !planning &&
          sheetMode === "results" &&
          routes.length > 0 ? (
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
                const colors = routeColors(isNight);
                const color = colors[i % colors.length];
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
                            className={`mt-1 text-[11px] ${
                              isNight ? "text-white/55" : "text-slate-600"
                            }`}
                          >
                            {formatDuration(r.duration_s)}
                            <span className="opacity-30"> · </span>
                            {formatDistance(r.distance_m)}
                          </p>
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
                                  isNight
                                    ? "text-amber-200"
                                    : "text-amber-900"
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
                        {SHOW_ENGINE_BADGE ? (
                          <EngineBadge route={r} isNight={isNight} />
                        ) : null}
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
                    ? "Find my loop"
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

/**
 * Beta-only chip naming the routing engine behind a card (QA affordance).
 * "Casey graph" = local challenger on the scored OSM network; "Mapbox" =
 * Mapbox Directions walking. "edge paint" flags a Track 0 sidewalk nudge.
 */
function EngineBadge({
  route,
  isNight,
}: {
  route: ScoredRoute;
  isNight: boolean;
}) {
  const casey = isScoreAwareStrategy(route.strategy);
  const engine = casey ? "Casey graph" : "Mapbox";
  const detail = casey
    ? "Beta: geometry from YourWalk's Casey-scored walking network."
    : route.paint_nudged
      ? "Beta: geometry from Mapbox walking; the drawn line was shifted toward mapped sidewalks / the road edge (distance and time unchanged)."
      : "Beta: geometry from Mapbox walking.";
  return (
    <span
      title={`${detail}${route.strategy ? ` (${route.strategy})` : ""}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        isNight
          ? "border-white/15 text-white/50"
          : "border-slate-300 text-slate-500"
      }`}
    >
      {engine}
      {route.paint_nudged ? (
        <span className="normal-case opacity-70">· edge paint</span>
      ) : null}
    </span>
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
      className={`mb-1.5 rounded-xl border px-3 py-2 ${shells[tone]}`}
      style={{ "--yw-pref-accent": accent } as CSSProperties}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`text-[13px] font-bold ${titles[tone]}`}>{title}</span>
          {description ? (
            <p className={`truncate text-[10px] leading-snug ${descs[tone]}`}>
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
        className={`mt-0.5 flex justify-between text-[9px] font-medium leading-none ${
          isNight ? "text-white/40" : "text-slate-500"
        }`}
      >
        <span>Less important</span>
        <span>More important</span>
      </div>
    </div>
  );
}
