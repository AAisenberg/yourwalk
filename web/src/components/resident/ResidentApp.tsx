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
  IconAbout,
  IconEye,
  IconEyeOff,
  IconLocate,
  IconOuting,
  IconTrip,
} from "@/components/resident/icons";
import { PlaceField } from "@/components/resident/PlaceField";
import { RingedAmenityIcon } from "@/components/resident/RingedAmenityIcon";
import {
  WALK_PIN_FROM,
  WALK_PIN_TO,
  createWalkPinElement,
} from "@/components/resident/WalkPin";
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

const ABOUT_STORAGE_KEY = "yw-resident-about-v1";
const PREFS_STORAGE_KEY = "yw-resident-prefs-v1";
const LAYERS_STORAGE_KEY = "yw-resident-layers-v1";
const LAYERS_TIP_KEY = "yw-resident-layers-tip-v1";

/**
 * Semantic walk colours (17 Aug 2026): a walk keeps its colour by meaning,
 * not list position. "Best for you" is always teal, "Away from roads" is
 * always green; the remaining options (Neighbourhood links, Another loop,
 * Shortest...) take warm ambers so nothing clashes with the teal brand or
 * the blue-grey basemap roads. Night variants are brighter for the dark
 * Standard basemap but stay in the same hue family.
 */
const ROUTE_EXTRA_COLORS_DAY = ["#F59E0B", "#E8654F"] as const;
const ROUTE_EXTRA_COLORS_NIGHT = ["#FFCB1F", "#F6871F"] as const;

function routeColorFor(
  route: ScoredRoute,
  ranked: ScoredRoute[],
  night: boolean,
): string {
  const label = routeCardLabel(route, ranked);
  if (label === "Best for you") return night ? "#2DE0D8" : "#00AAA6";
  if (label === "Away from roads") return night ? "#A3E635" : "#43A047";
  // Other options keep a stable warm colour by their position among peers
  const extras = ranked.filter((r) => {
    const l = routeCardLabel(r, ranked);
    return l !== "Best for you" && l !== "Away from roads";
  });
  const pos = extras.findIndex((r) => r.id === route.id);
  const palette = night ? ROUTE_EXTRA_COLORS_NIGHT : ROUTE_EXTRA_COLORS_DAY;
  return palette[Math.max(0, pos) % palette.length];
}
const SHEET_SNAPS: SheetSnap[] = ["peek", "half", "full"];
const SHEET_SNAP_CLASS: Record<SheetSnap, string> = {
  peek: "h-[22%] max-h-[22%]",
  half: "h-[48%] max-h-[48%]",
  full: "h-[72%] max-h-[72%]",
};
/** Keep in sync with SHEET_SNAP_CLASS — used for camera padding maths. */
const SHEET_SNAP_FRACTION: Record<SheetSnap, number> = {
  peek: 0.22,
  half: 0.48,
  full: 0.72,
};

const YOURWALK_STYLE =
  "mapbox://styles/crowdspot1/cmsve8sql00ak01rgb6vn39pt";
const DAY_BASEMAP = "mapbox://styles/mapbox/streets-v12";
const NIGHT_BASEMAP = "mapbox://styles/mapbox/dark-v11";

function applyStandardLook(map: mapboxgl.Map, preset: LightPreset) {
  try {
    map.setConfigProperty("basemap", "lightPreset", preset);
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
    // Standard paints OSM paths/trails as a neon dotted line at night.
    // That is not Casey T1EAM and only covers part of the network — hide it.
    map.setConfigProperty("basemap", "showPedestrianRoads", false);
  } catch {
    /* classic streets / dark has no Standard basemap config */
  }
}

const T1EAM_UNDERLAY_SRC = "t1eam-underlay";
const T1EAM_PAVEMENT_SRC = "t1eam-pavement";
const T1EAM_UNDERLAY_FILL = "t1eam-underlay-fill";
const T1EAM_UNDERLAY_LINE = "t1eam-underlay-line";
const T1EAM_UNDERLAY_SW = "t1eam-underlay-sidewalks";

function t1eamUnderlayColor(night: boolean): string {
  // Day: light grey-lavender that blends into the Standard basemap
  // (the old dark navy shouted over it — 17 Aug QA). Night unchanged.
  return night ? "#8B8DD9" : "#9BA1C4";
}

/** Fast planar distance in metres — fine at suburb scale. */
function distM(a: [number, number], b: [number, number]): number {
  const dx = (b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (b[1] - a[1]) * 111_320;
  return Math.hypot(dx, dy);
}

/** Initial bearing (degrees clockwise from north) from a to b. */
function bearingDeg(a: [number, number], b: [number, number]): number {
  const p1 = (a[1] * Math.PI) / 180;
  const p2 = (b[1] * Math.PI) / 180;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Pin coords match a route endpoint within this distance = it's the stub. */
const PIN_STUB_SNAP_M = 4;
/** Only draw a connector when the pin sits meaningfully off the network. */
const CONNECTOR_MIN_M = 6;

/**
 * Split the address-pin stubs off a drawn route. The walk line starts and
 * ends on the footpath network; a dotted grey connector covers pin ↔
 * network so the route never appears to cut across houses or front yards.
 */
function splitPinStubs(
  geometry: GeoJSON.LineString,
  originPin: [number, number] | null,
  endPin: [number, number] | null,
): { line: GeoJSON.LineString; connectors: GeoJSON.LineString[] } {
  let coords = geometry.coordinates as [number, number][];
  const connectors: GeoJSON.LineString[] = [];
  if (originPin && coords.length > 2 && distM(coords[0], originPin) <= PIN_STUB_SNAP_M) {
    coords = coords.slice(1);
  }
  if (endPin && coords.length > 2 && distM(coords[coords.length - 1], endPin) <= PIN_STUB_SNAP_M) {
    coords = coords.slice(0, -1);
  }
  if (originPin && coords.length >= 2 && distM(originPin, coords[0]) > CONNECTOR_MIN_M) {
    connectors.push({ type: "LineString", coordinates: [originPin, coords[0]] });
  }
  if (endPin && coords.length >= 2) {
    const last = coords[coords.length - 1];
    if (distM(endPin, last) > CONNECTOR_MIN_M) {
      // Loops: skip a duplicate when both ends leave from the same spot
      const dup =
        connectors.length > 0 &&
        distM(last, connectors[0].coordinates[1] as [number, number]) <
          CONNECTOR_MIN_M;
      if (!dup) {
        connectors.push({ type: "LineString", coordinates: [last, endPin] });
      }
    }
  }
  return { line: { type: "LineString", coordinates: coords }, connectors };
}

/** Guards against stale cached artefacts that still carry sidewalk lines. */
const PATHS_FILTER: mapboxgl.FilterSpecification = [
  "!=",
  ["get", "hw"],
  "sidewalk",
];
/** Street zoom: a single street fills the view, pavement reads as pavement. */
const PAVEMENT_MINZOOM = 15.5;

/**
 * Two-part footpath underlay (17 Aug QA):
 * - Off-road path centrelines (park links, reserves, laneways) from the
 *   `casey_paths_underlay.geojson` artefact — always visible from z12.
 *   Derived sidewalk lines were messy at roundabouts/crossings and are
 *   no longer drawn as lines at any zoom.
 * - T1EAM pavement polygons (already client-side for scoring) as a quiet
 *   outline-free fill from z15.5 — authoritative Council shapes that
 *   wrap roundabouts correctly and never cross carriageways.
 */
function ensureT1eamUnderlay(
  map: mapboxgl.Map,
  lines: GeoJSON.Feature[] | null,
  pavement: GeoJSON.Feature[] | null,
  night: boolean,
) {
  const color = t1eamUnderlayColor(night);
  // Retired layer from earlier sessions/bundles
  if (map.getLayer(T1EAM_UNDERLAY_SW)) map.removeLayer(T1EAM_UNDERLAY_SW);
  // Paths + pavement live in the Standard "bottom" slot: above land and
  // water but below the road ribbons, so paths visually duck under
  // carriageways instead of painting across roundabouts (17 Aug QA).
  // Slot is fixed at creation, so migrate any layer added with the old slot.
  for (const id of [T1EAM_UNDERLAY_LINE, T1EAM_UNDERLAY_FILL]) {
    const layer = map.getLayer(id);
    if (layer && layer.slot !== "bottom") map.removeLayer(id);
  }

  if (lines?.length) {
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: lines,
    };
    const existing = map.getSource(T1EAM_UNDERLAY_SRC);
    if (existing && existing.type === "geojson") {
      existing.setData(data);
    } else {
      map.addSource(T1EAM_UNDERLAY_SRC, {
        type: "geojson",
        data,
        // Underlay only — a little simplify keeps the network cheaper
        tolerance: 0.4,
      });
    }
    const width: mapboxgl.Expression = [
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      1.2,
      14.5,
      2.2,
      17,
      3.6,
    ];
    if (!map.getLayer(T1EAM_UNDERLAY_LINE)) {
      map.addLayer({
        id: T1EAM_UNDERLAY_LINE,
        type: "line",
        source: T1EAM_UNDERLAY_SRC,
        slot: "bottom",
        minzoom: 12,
        filter: PATHS_FILTER,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": color,
          "line-width": width,
          "line-opacity": night ? 0.65 : 0.55,
          "line-emissive-strength": night ? 0.35 : 0,
        },
      });
    } else {
      map.setPaintProperty(T1EAM_UNDERLAY_LINE, "line-color", color);
      map.setPaintProperty(T1EAM_UNDERLAY_LINE, "line-width", width);
      map.setPaintProperty(
        T1EAM_UNDERLAY_LINE,
        "line-opacity",
        night ? 0.65 : 0.55,
      );
      map.setPaintProperty(
        T1EAM_UNDERLAY_LINE,
        "line-emissive-strength",
        night ? 0.35 : 0,
      );
    }
  }

  if (pavement?.length) {
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pavement,
    };
    const existing = map.getSource(T1EAM_PAVEMENT_SRC);
    if (existing && existing.type === "geojson") {
      existing.setData(data);
    } else {
      map.addSource(T1EAM_PAVEMENT_SRC, {
        type: "geojson",
        data,
        tolerance: 0.4,
      });
    }
    const fillOpacity: mapboxgl.Expression = [
      "interpolate",
      ["linear"],
      ["zoom"],
      PAVEMENT_MINZOOM,
      0,
      PAVEMENT_MINZOOM + 0.7,
      night ? 0.3 : 0.24,
    ];
    // Draw the pavement fill under the path lines
    const fillBefore = map.getLayer(T1EAM_UNDERLAY_LINE)
      ? T1EAM_UNDERLAY_LINE
      : undefined;
    if (!map.getLayer(T1EAM_UNDERLAY_FILL)) {
      map.addLayer(
        {
          id: T1EAM_UNDERLAY_FILL,
          type: "fill",
          source: T1EAM_PAVEMENT_SRC,
          slot: "bottom",
          minzoom: PAVEMENT_MINZOOM,
          paint: {
            "fill-color": color,
            "fill-opacity": fillOpacity,
            "fill-emissive-strength": night ? 0.3 : 0,
          },
        },
        fillBefore,
      );
    } else {
      map.setPaintProperty(T1EAM_UNDERLAY_FILL, "fill-color", color);
      map.setPaintProperty(T1EAM_UNDERLAY_FILL, "fill-opacity", fillOpacity);
      map.setPaintProperty(
        T1EAM_UNDERLAY_FILL,
        "fill-emissive-strength",
        night ? 0.3 : 0,
      );
    }
  }
}

/** Install route + optional LGA / T1EAM layers after load or basemap style switch. */
function installMapChrome(
  map: mapboxgl.Map,
  opts: {
    lga?: GeoJSON.FeatureCollection | null;
    t1eam?: GeoJSON.Feature[];
    pavement?: GeoJSON.Feature[];
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
  if (!map.getSource("route-connectors")) {
    map.addSource("route-connectors", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("route-connectors-line")) {
    // Quiet dotted grey pin ↔ network connector (not part of the walk)
    map.addLayer({
      id: "route-connectors-line",
      type: "line",
      source: "route-connectors",
      slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": opts.night ? "#cbd5e1" : "#64748b",
        "line-width": 2.4,
        "line-opacity": 0.85,
        "line-dasharray": [0.1, 1.9],
        "line-emissive-strength": opts.night ? 0.9 : 0.1,
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

  if (opts.t1eam?.length || opts.pavement?.length) {
    ensureT1eamUnderlay(
      map,
      opts.t1eam ?? null,
      opts.pavement ?? null,
      opts.night,
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

/** Walkable-network centrelines (sibling artefact of the segments file). */
function resolveUnderlayUrl(): string {
  const segments = resolveGeoJsonUrl();
  const cut = segments.lastIndexOf("/");
  const dir = cut >= 0 ? segments.slice(0, cut) : "/api/map-data";
  return `${dir}/casey_paths_underlay.geojson`;
}

export function ResidentApp() {
  const isDesktop = useMediaQuery(MD_UP);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);
  /** Centreline underlay artefact; layer stays off until it loads. */
  const underlayRef = useRef<GeoJSON.Feature[] | null>(null);
  /** T1EAM segments already drawn as path lines — skipped by the fill. */
  const pathCoveredIdsRef = useRef<Set<string | number> | null>(null);
  /** Floating time/distance chips, one per walk (HTML markers). */
  const routeChipsRef = useRef<mapboxgl.Marker[]>([]);
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
  // NEXT_PUBLIC_ env is inlined at build time, identical on server + client
  const [error, setError] = useState<string | null>(() =>
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      ? null
      : "Mapbox token missing — set NEXT_PUBLIC_MAPBOX_TOKEN in web/.env.local",
  );
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
  /** Locked camera: street-level commence view or whole-walk overview. */
  const [lockedView, setLockedView] = useState<"commence" | "overview">(
    "commence",
  );
  const [geoBusy, setGeoBusy] = useState(false);
  /** About / welcome modal — auto-opens once per device, then via header. */
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutDialogRef = useRef<HTMLDialogElement | null>(null);
  /** Pulsing "you are here" dot for the one-shot location check-in. */
  const locateMarkerRef = useRef<mapboxgl.Marker | null>(null);
  /** Dismissible notice shown beside the check-in button (e.g. outside Casey). */
  const [locateNotice, setLocateNotice] = useState<string | null>(null);
  const sheetDragRef = useRef<{
    startY: number;
    startSnap: SheetSnap;
  } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time client
     hydration from localStorage; cannot be lazy-initialised under SSR */
  useEffect(() => {
    let storedPrefs: string | null = null;
    try {
      if (window.localStorage.getItem(ABOUT_STORAGE_KEY) !== "1") {
        setAboutOpen(true);
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
      setAboutOpen(true);
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
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const closeAbout = useCallback(() => {
    setAboutOpen(false);
    try {
      window.localStorage.setItem(ABOUT_STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  // Native <dialog> gives focus trap + Escape for free (WCAG 2.1 AA).
  useEffect(() => {
    const dialog = aboutDialogRef.current;
    if (!dialog) return;
    if (aboutOpen && !dialog.open) dialog.showModal();
    if (!aboutOpen && dialog.open) dialog.close();
  }, [aboutOpen]);

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  useEffect(() => {
    walkModeRef.current = walkMode;
  }, [walkMode]);

  // Leaving the locked walk: flatten the commence-view camera tilt.
  // lockedView needs no reset — every lock click sets it explicitly.
  useEffect(() => {
    if (routeLocked) return;
    const map = mapRef.current;
    if (map && map.getPitch() > 0) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    }
  }, [routeLocked]);

  const clearResults = useCallback(() => {
    setRoutes([]);
    setSelectedId(null);
    setRouteError(null);
    setRouteLocked(false);
    setPlanning(false);
    setPickMode("idle");
  }, []);

  /**
   * Camera padding that keeps walks clear of the chrome: the 27rem results
   * panel on desktop; on mobile the bottom sheet at its *current* expansion
   * (peek/half/full), so a fitted walk never hides behind the sheet.
   * `snapOverride` covers callers that change the snap in the same tick.
   */
  const walkCameraPadding = useCallback(
    (snapOverride?: SheetSnap) => {
      if (isDesktop) return { top: 80, bottom: 80, left: 432 + 48, right: 80 };
      const mapH =
        mapRef.current?.getContainer().clientHeight ?? window.innerHeight;
      const frac = SHEET_SNAP_FRACTION[snapOverride ?? sheetSnap];
      // Never let padding swallow the map — Mapbox rejects oversized padding.
      const bottom = Math.max(
        120,
        Math.min(Math.round(mapH * frac) + 24, mapH - 70 - 90),
      );
      return { top: 70, bottom, left: 40, right: 40 };
    },
    [isDesktop, sheetSnap],
  );

  /**
   * flyTo offset that lands a point in the middle of the *visible* map area:
   * right of the desktop panel, above the mobile sheet at its current snap.
   */
  const visibleCenterOffset = useCallback((): [number, number] => {
    if (isDesktop) return [216, 0]; // half the 27rem side panel
    const mapH =
      mapRef.current?.getContainer().clientHeight ?? window.innerHeight;
    return [0, -Math.round((mapH * SHEET_SNAP_FRACTION[sheetSnap]) / 2)];
  }, [isDesktop, sheetSnap]);

  /**
   * One-shot "where am I?" check-in: drops a pulsing brand dot (not an
   * endpoint pin) at the device position and eases the camera to it. No
   * tracking — the fix never leaves the device (ADR-004 stance).
   */
  const checkInLocation = useCallback(() => {
    setLocateNotice(null);
    if (!navigator.geolocation) {
      setLocateNotice("Location isn’t available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const lngLat: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        // Outside the pilot area: leave the map where it is, no dot
        if (!pointInCaseyBbox({ lng: lngLat[0], lat: lngLat[1] })) {
          setLocateNotice(
            "Looks like you’re outside the City of Casey, so we’ve left the map where it is.",
          );
          return;
        }
        if (!locateMarkerRef.current) {
          const el = document.createElement("div");
          el.className = "yw-locate-dot";
          el.setAttribute("aria-label", "Your current location");
          locateMarkerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(map);
        } else {
          locateMarkerRef.current.setLngLat(lngLat);
        }
        map.easeTo({
          center: lngLat,
          zoom: Math.min(Math.max(map.getZoom(), 15.5), 17),
          offset: visibleCenterOffset(),
          duration: 800,
        });
      },
      () =>
        setLocateNotice(
          "Couldn’t get your location. Allow location access to check in.",
        ),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [visibleCenterOffset]);

  /** Fit the camera to one walk (whole-walk view, flat). */
  const focusWholeWalk = useCallback(
    (r: ScoredRoute) => {
      const map = mapRef.current;
      if (!map || r.geometry.coordinates.length < 2) return;
      const bounds = new mapboxgl.LngLatBounds();
      for (const c of r.geometry.coordinates) {
        bounds.extend(c as [number, number]);
      }
      map.fitBounds(bounds, {
        padding: walkCameraPadding(),
        maxZoom: 16,
        duration: 800,
        pitch: 0,
        bearing: 0,
      });
    },
    [walkCameraPadding],
  );

  /** Selection made by re-ranking, not the resident — skip the camera move. */
  const quietSelectRef = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);

  // Picking a different walk (card, chip, or line tap) zooms to that whole
  // walk. Skips the first auto-selection after Find (results fit all walks).
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    if (quietSelectRef.current) {
      quietSelectRef.current = false;
      return;
    }
    if (!selectedId || prev === null || prev === selectedId) return;
    const r = routes.find((x) => x.id === selectedId);
    if (r) focusWholeWalk(r);
  }, [selectedId, routes, focusWholeWalk]);

  /** Pavement fill features: skip polygons a path line already draws. */
  const pavementFeatures = useCallback(() => {
    const ids = pathCoveredIdsRef.current;
    const feats = featuresRef.current;
    if (!ids) return feats;
    return feats.filter((f) => {
      const id = (f.properties as { segment_id?: string | number } | null)
        ?.segment_id;
      return id === undefined || !ids.has(id);
    });
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

  /** Loops have no destination — clear it when switching to outing mode. */
  const onWalkIntentChange = useCallback((intent: WalkIntent) => {
    setWalkIntent(intent);
    if (intent === "outing") {
      setDestination(null);
      setDestLabel("");
      setPickMode((m) => (m === "destination" ? "idle" : m));
    }
  }, []);

  const paintRoutes = useCallback(
    (list: ScoredRoute[], selected: string | null) => {
      const map = mapRef.current;
      const src = map?.getSource("routes") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      const night = walkMode === "night";
      const originPin: [number, number] | null = origin
        ? [origin.lng, origin.lat]
        : null;
      const end = destination ?? origin; // loops end back at the start pin
      const endPin: [number, number] | null = end ? [end.lng, end.lat] : null;
      const connectorFeatures: GeoJSON.Feature[] = [];
      // selected as 0/1 — Mapbox property filters are more reliable than booleans
      src.setData({
        type: "FeatureCollection",
        features: list.map((r) => {
          const { line, connectors } = splitPinStubs(
            r.geometry,
            originPin,
            endPin,
          );
          if (r.id === selected) {
            for (const c of connectors) {
              connectorFeatures.push({
                type: "Feature",
                properties: {},
                geometry: c,
              });
            }
          }
          return {
            type: "Feature",
            properties: {
              id: r.id,
              color: routeColorFor(r, list, night),
              selected: r.id === selected ? 1 : 0,
            },
            geometry: line,
          };
        }),
      });
      const connSrc = map?.getSource("route-connectors") as
        | mapboxgl.GeoJSONSource
        | undefined;
      connSrc?.setData({
        type: "FeatureCollection",
        features: connectorFeatures,
      });
    },
    [walkMode, origin, destination],
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

  // Google-style info chips: time + distance floated on each walk line.
  // Tapping a chip selects that walk.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const m of routeChipsRef.current) m.remove();
    routeChipsRef.current = [];
    if (!routes.length) return;
    const night = walkMode === "night";
    routes.forEach((r, i) => {
      const coords = r.geometry.coordinates as [number, number][];
      if (coords.length < 2) return;
      // Stagger anchors (~1/3, 1/2, 2/3 along the walk) so chips don't stack
      const frac = 0.32 + 0.18 * (i % 3);
      const cum: number[] = [0];
      let total = 0;
      for (let k = 1; k < coords.length; k++) {
        total += distM(coords[k - 1], coords[k]);
        cum.push(total);
      }
      let idx = cum.findIndex((d) => d >= total * frac);
      if (idx < 0) idx = coords.length - 1;

      const selected = r.id === selectedId;
      const color = routeColorFor(r, routes, night);
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = `${Math.max(1, Math.round(r.duration_s / 60))} min · ${(
        r.distance_m / 1000
      ).toFixed(1)} km`;
      Object.assign(el.style, {
        font: "700 11px/1 var(--font-sans, system-ui)",
        whiteSpace: "nowrap",
        padding: "5px 9px",
        borderRadius: "999px",
        cursor: "pointer",
        border: "none",
        boxShadow: "0 1px 4px rgba(15,23,42,0.3)",
        background: selected
          ? color
          : night
            ? "rgba(15,23,42,0.92)"
            : "rgba(255,255,255,0.95)",
        color: selected ? "#ffffff" : night ? "#e2e8f0" : "#334155",
        outline: selected ? "none" : `1.5px solid ${color}`,
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setRouteLocked(false);
        setSelectedId(r.id);
      });
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, -8],
      })
        .setLngLat(coords[Math.min(idx, coords.length - 1)])
        .addTo(map);
      routeChipsRef.current.push(marker);
    });
  }, [routes, selectedId, walkMode, mapReady]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return; // `error` state is pre-set at initialisation
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
        // Off-road path centrelines (always-visible underlay layer)
        try {
          const res = await fetch(resolveUnderlayUrl());
          if (res.ok) {
            const fc = (await res.json()) as GeoJSON.FeatureCollection & {
              path_covered_segment_ids?: (string | number)[];
            };
            if (fc.features?.length && mapRef.current) {
              underlayRef.current = fc.features;
              if (fc.path_covered_segment_ids?.length) {
                pathCoveredIdsRef.current = new Set(
                  fc.path_covered_segment_ids,
                );
              }
              ensureT1eamUnderlay(
                map,
                fc.features,
                pavementFeatures(),
                walkModeRef.current === "night",
              );
            }
          }
        } catch {
          /* optional */
        }
      })();

      void (async () => {
        const lgaUrl = resolveLgaUrl();
        if (lgaUrl) {
          try {
            const lga = await fetchLgaBoundary(lgaUrl);
            if (!mapRef.current) return;
            lgaDataRef.current = lga;
            installMapChrome(map, {
              lga,
              t1eam: underlayRef.current ?? undefined,
              pavement: pavementFeatures(),
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
          // Street-zoom pavement fill uses these same polygons
          ensureT1eamUnderlay(
            map,
            underlayRef.current,
            pavementFeatures(),
            walkModeRef.current === "night",
          );
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
      locateMarkerRef.current?.remove();
      locateMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pavementFeatures is a stable ref-only callback; the map must init exactly once
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
          t1eam: underlayRef.current ?? undefined,
          pavement: pavementFeatures(),
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
    if (underlayRef.current || featuresRef.current.length) {
      ensureT1eamUnderlay(
        map,
        underlayRef.current,
        pavementFeatures(),
        walkMode === "night",
      );
    }
  }, [
    walkMode,
    whenOverridden,
    mapReady,
    paintRoutes,
    syncOverlayLayers,
    pavementFeatures,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (origin) {
      if (!originMarkerRef.current) {
        originMarkerRef.current = new mapboxgl.Marker({
          element: createWalkPinElement(WALK_PIN_FROM, "From"),
          anchor: "center",
        })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map);
      } else originMarkerRef.current.setLngLat([origin.lng, origin.lat]);
    } else {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
    }
    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new mapboxgl.Marker({
          element: createWalkPinElement(WALK_PIN_TO, "To"),
          anchor: "center",
        })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map);
      } else destMarkerRef.current.setLngLat([destination.lng, destination.lat]);
    } else {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
    }
  }, [origin, destination]);

  // Once both endpoints are set (second pin dropped, address typed, or a pin
  // moved), pull the camera out so origin and destination are both in view
  // for tweaking before "Find my route".
  useEffect(() => {
    if (!origin || !destination) return;
    const map = mapRef.current;
    if (!map) return;
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([origin.lng, origin.lat]);
    bounds.extend([destination.lng, destination.lat]);
    map.fitBounds(bounds, {
      padding: walkCameraPadding(),
      maxZoom: 15.5,
      duration: 700,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endpoints only; a sheet-snap change must not re-trigger the fit
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
  /* eslint-disable react-hooks/set-state-in-effect -- re-ranks stored results
     in place when preferences change; sliders fire many events mid-drag so
     ranking in render would thrash */
  useEffect(() => {
    if (!routes.length || sheetMode !== "results") return;
    const ranked = sortRoutesByPreferences(routes, prefs, walkMode);
    setRoutes(ranked);
    const nextId = ranked[0]?.id ?? null;
    // Quiet only when the id actually changes, or the flag would swallow
    // the camera move of the resident's next real pick
    if (nextId !== prevSelectedRef.current) quietSelectRef.current = true;
    setSelectedId(nextId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-rank in place when prefs change
  }, [prefs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Named without a `use` prefix: this is a plain callback, not a hook
  const locateMe = useCallback(async () => {
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
          // Destination already set (marker exists) → fit-both effect frames
          if (!destMarkerRef.current) {
            mapRef.current?.flyTo({
              center: [point.lng, point.lat],
              zoom: 14,
              offset: visibleCenterOffset(),
              duration: 600,
            });
          }
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
  }, [visibleCenterOffset]);

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
        map.fitBounds(bounds, {
          // Snap was just set to "half" above; state hasn't re-rendered yet
          padding: walkCameraPadding("half"),
          maxZoom: 15,
          duration: 700,
        });
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
  /** "66 Cupples Cr, Berwick Victoria 3806, Australia" → "66 Cupples Cr, Berwick" */
  const shortLabel = (s: string) => {
    if (!s) return "";
    const parts = s.split(",").map((p) => p.trim());
    const street = parts[0] ?? "";
    const locality = (parts[1] ?? "")
      .replace(/\s*(Victoria|VIC)(\s+\d{4})?\s*$/i, "")
      .trim();
    return locality ? `${street}, ${locality}` : street;
  };

  /** Trip heading with both endpoints; a shared suburb is said only once. */
  const tripHeading = () => {
    const a = shortLabel(originLabel) || "From";
    const b = shortLabel(destLabel) || "To";
    const aLoc = a.split(", ")[1];
    const bLoc = b.split(", ")[1];
    return aLoc && aLoc === bLoc
      ? `${a.split(", ")[0]} → ${b}`
      : `${a} → ${b}`;
  };

  // Desktop swaps the sheet for a side panel; snap is ignored there and the
  // resident's last mobile snap is kept for when the viewport shrinks back.
  useEffect(() => {
    if (!isDesktop) return;
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
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          aria-label="About YourWalk"
          title="About YourWalk"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            isNight
              ? "text-white/70 ring-1 ring-white/20 hover:bg-white/10"
              : "text-yw-navy/70 ring-1 ring-yw-navy/15 hover:bg-yw-navy/5"
          }`}
        >
          <IconAbout className="h-[18px] w-[18px]" aria-hidden />
        </button>
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

        <button
          type="button"
          onClick={checkInLocation}
          className={`absolute z-[8] flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 ${
            isDesktop ? "left-[28.25rem] top-16" : "left-3 top-16"
          } ${
            isNight
              ? "bg-yw-night-panel text-white ring-white/15"
              : "bg-white text-yw-navy ring-black/10"
          }`}
          aria-label="Show my location on the map"
          title="Where am I?"
        >
          <IconLocate className="h-5 w-5" />
        </button>

        {locateNotice ? (
          <div
            role="status"
            className={`absolute z-[8] flex max-w-[15.5rem] items-start gap-1.5 rounded-xl py-2 pl-2.5 pr-1.5 text-[11px] font-semibold leading-snug shadow-lg ring-1 ${
              isDesktop ? "left-[31.5rem] top-16" : "left-16 top-16"
            } ${
              isNight
                ? "bg-yw-night-panel text-white ring-white/15"
                : "bg-white text-yw-navy ring-black/10"
            }`}
          >
            <span className="min-w-0 pt-px">{locateNotice}</span>
            <button
              type="button"
              onClick={() => setLocateNotice(null)}
              aria-label="Dismiss"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isNight
                  ? "text-white/60 hover:bg-white/10"
                  : "text-slate-400 hover:bg-slate-100"
              }`}
            >
              <MdClose className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

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
            <div className="flex flex-col gap-1">
            {OVERLAY_DEFS.map((def) => {
              const on = overlays[def.id];
              return (
                <button
                  key={def.id}
                  type="button"
                  disabled={!def.available}
                  aria-pressed={on}
                  aria-label={
                    def.available
                      ? on
                        ? `Hide ${def.label}`
                        : `Show ${def.label}`
                      : `${def.label}, coming soon`
                  }
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
                  {def.available ? (
                    on ? (
                      <IconEye
                        className="h-4 w-4 shrink-0 text-yw-teal"
                        aria-hidden
                      />
                    ) : (
                      <IconEyeOff
                        className={`h-4 w-4 shrink-0 ${
                          isNight ? "text-white/35" : "text-slate-400"
                        }`}
                        aria-hidden
                      />
                    )
                  ) : null}
                </button>
              );
            })}
            </div>
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
                <p className="text-sm font-semibold leading-snug">
                  {walkIntent === "outing"
                    ? `${shortLabel(originLabel) || "Start"} · ~${outingMinutes} min loop`
                    : tripHeading()}
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

              {/* Intro copy lives in the About modal (header info button). */}
              <div className="mb-3" />

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
                  onChange={onWalkIntentChange}
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
                    dot={WALK_PIN_FROM}
                    isNight={isNight}
                    valueLabel={shortLabel(originLabel)}
                    pickActive={pickMode === "origin"}
                    onPickToggle={() =>
                      setPickMode((m) => (m === "origin" ? "idle" : "origin"))
                    }
                    showLocate
                    onLocate={() => void locateMe()}
                    geoBusy={geoBusy}
                    onPlace={({ center, label }) => {
                      setOrigin(center);
                      setOriginLabel(label);
                      setPickMode("idle");
                      // With both endpoints set, the fit-both effect frames them
                      if (!destination) {
                        mapRef.current?.flyTo({
                          center: [center.lng, center.lat],
                          zoom: 14,
                          offset: visibleCenterOffset(),
                          duration: 600,
                        });
                      }
                    }}
                  />
                  <PlaceField
                    label="To"
                    placeholder="Park, school, suburb, or street"
                    dot={WALK_PIN_TO}
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
                      // With both endpoints set, the fit-both effect frames them
                      if (!origin) {
                        mapRef.current?.flyTo({
                          center: [center.lng, center.lat],
                          zoom: 14,
                          offset: visibleCenterOffset(),
                          duration: 600,
                        });
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="mb-4 space-y-2">
                  <PlaceField
                    label="Start"
                    placeholder="Park, school, suburb, or street"
                    dot={WALK_PIN_FROM}
                    isNight={isNight}
                    valueLabel={shortLabel(originLabel)}
                    pickActive={pickMode === "origin"}
                    onPickToggle={() =>
                      setPickMode((m) => (m === "origin" ? "idle" : "origin"))
                    }
                    showLocate
                    onLocate={() => void locateMe()}
                    geoBusy={geoBusy}
                    onPlace={({ center, label }) => {
                      setOrigin(center);
                      setOriginLabel(label);
                      setPickMode("idle");
                      mapRef.current?.flyTo({
                        center: [center.lng, center.lat],
                        zoom: 14,
                        offset: visibleCenterOffset(),
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
                const color = routeColorFor(r, routes, isNight);
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
                if (!routeLocked || lockedView === "overview") {
                  // Commence view: stand at the start, facing down the
                  // first leg — like turning to face the way you'll walk.
                  const coords = r.geometry.coordinates as [number, number][];
                  const start: [number, number] = origin
                    ? [origin.lng, origin.lat]
                    : coords[0];
                  let acc = 0;
                  let i = 0;
                  while (i < coords.length - 1 && acc < 30) {
                    acc += distM(coords[i], coords[i + 1]);
                    i += 1;
                  }
                  const ahead = coords[Math.min(i, coords.length - 1)];
                  map.flyTo({
                    center: start,
                    zoom: 16.75,
                    pitch: 55,
                    bearing: bearingDeg(start, ahead),
                    duration: 1800,
                    essential: true,
                  });
                  setLockedView("commence");
                } else {
                  const bounds = new mapboxgl.LngLatBounds();
                  for (const c of r.geometry.coordinates) {
                    bounds.extend(c as [number, number]);
                  }
                  map.fitBounds(bounds, {
                    // Sheet collapses to "peek" below, in this same click
                    padding: walkCameraPadding("peek"),
                    maxZoom: 16,
                    duration: 900,
                    pitch: 0,
                    bearing: 0,
                  });
                  setLockedView("overview");
                }
                setRouteLocked(true);
                if (!isDesktop) setSheetSnap("peek");
              }}
            >
              {!routeLocked
                ? "Use this route"
                : lockedView === "commence"
                  ? "See the whole walk"
                  : "Back to the start"}
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

      {/* About / welcome modal — native <dialog> for focus trap + Escape */}
      <dialog
        ref={aboutDialogRef}
        onClose={closeAbout}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself) closes
          if (e.target === aboutDialogRef.current) closeAbout();
        }}
        aria-labelledby="yw-about-title"
        className={`m-auto w-[min(92vw,26rem)] rounded-2xl border-0 p-0 shadow-2xl backdrop:bg-slate-900/60 sm:w-[min(88vw,34rem)] ${
          isNight ? "bg-yw-night-surface text-white" : "bg-white text-slate-900"
        }`}
      >
        <div className="max-h-[84dvh] overflow-y-auto px-5 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-6">
          <div className="mb-3 flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/yourwalk-mark.svg"
              alt=""
              width={36}
              height={28}
              className="h-8 w-auto shrink-0"
              aria-hidden
            />
            <h2
              id="yw-about-title"
              className={`min-w-0 flex-1 text-lg font-extrabold tracking-tight sm:text-2xl ${
                isNight ? "text-white" : "text-yw-navy"
              }`}
            >
              Welcome to YourWalk
            </h2>
            <button
              type="button"
              onClick={closeAbout}
              aria-label="Close"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isNight
                  ? "text-white/70 hover:bg-white/10"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <MdClose className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <p
            className={`text-[13px] leading-relaxed sm:text-[15px] ${
              isNight ? "text-white/80" : "text-slate-700"
            }`}
          >
            YourWalk helps Casey residents find walking routes that fit what
            matters to you: smoother footpaths, more shade on hot days, or
            better-lit streets after dark. Not just the shortest way.
          </p>

          <h3
            className={`mb-1.5 mt-4 text-[13px] font-bold sm:mt-5 sm:text-[15px] ${
              isNight ? "text-white/90" : "text-yw-navy"
            }`}
          >
            How it works
          </h3>
          <ul
            className={`list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed sm:text-[14px] ${
              isNight ? "text-white/75" : "text-slate-600"
            }`}
          >
            <li>
              Casey&apos;s footpaths are scored street by street from Council
              asset data and OpenStreetMap: surface, continuity, tree canopy,
              lighting and more.
            </li>
            <li>
              Plan an A to B walk or a loop from home, set what matters most,
              and YourWalk ranks the options for day or night walking.
            </li>
            <li>
              Scores describe conditions in the data, with more Council
              datasets on the way. They are not a safety guarantee.
            </li>
          </ul>

          <h3
            className={`mb-1.5 mt-4 text-[13px] font-bold sm:mt-5 sm:text-[15px] ${
              isNight ? "text-white/90" : "text-yw-navy"
            }`}
          >
            Who&apos;s behind it
          </h3>
          <p
            className={`text-[12px] leading-relaxed sm:text-[14px] ${
              isNight ? "text-white/75" : "text-slate-600"
            }`}
          >
            YourWalk is a City of Casey Connecting Grant pilot, built by
            CrowdLab in partnership with Monash University&apos;s XYX Lab.
          </p>

          <h3
            className={`mb-1.5 mt-4 text-[13px] font-bold sm:mt-5 sm:text-[15px] ${
              isNight ? "text-white/90" : "text-yw-navy"
            }`}
          >
            Your privacy
          </h3>
          <p
            className={`text-[12px] leading-relaxed sm:text-[14px] ${
              isNight ? "text-white/75" : "text-slate-600"
            }`}
          >
            Anonymous by default: no account, no sign-in, no tracking. If you
            use the locate button, your position stays on your device.
          </p>

          <button
            type="button"
            onClick={closeAbout}
            className={`mt-5 flex min-h-11 w-full items-center justify-center rounded-2xl text-sm font-bold text-white sm:min-h-12 sm:text-[15px] ${
              isNight ? "bg-yw-blue" : "bg-yw-teal"
            }`}
          >
            Start exploring
          </button>
          <p
            className={`mt-2.5 text-center text-[10px] sm:text-[11px] ${
              isNight ? "text-white/40" : "text-slate-400"
            }`}
          >
            {betaVersionTitle()} · {betaVersionDetail()}
          </p>
        </div>
      </dialog>
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
