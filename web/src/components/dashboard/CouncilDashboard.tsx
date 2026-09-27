"use client";

import { bbox } from "@turf/bbox";
import { convex } from "@turf/convex";
import mapboxgl, { type ExpressionSpecification } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdClose,
  MdExpandMore,
  MdInfoOutline,
  MdLayers,
  MdMap,
  MdOpenInNew,
  MdSatelliteAlt,
} from "react-icons/md";

import { IconLocate, IconMoon, IconSun } from "@/components/resident/icons";
import { SegmentedPill } from "@/components/resident/SegmentedPill";
import { BETA_LABEL, SCORING_SPEC_VERSION } from "@/lib/beta";
import {
  areaValue,
  breakdown,
  featuresInArea,
  heldBackBy,
  rankAreas,
  rollUpAreas,
  summariseCasey,
  viewName,
  type AreaStats,
  type AreaUnit,
  type BreakdownPart,
  type CaseySummary,
  type HeldBack,
  type IndexMode,
  type ScoreView,
} from "@/lib/dashboard/areas";
import { DASHBOARD_RAMP, colorExpression, fieldFor, rampColors } from "@/lib/dashboard/paint";
import {
  DASHBOARD_LAYERS,
  DEFAULT_DASHBOARD_LAYERS,
  LAYER_GROUPS,
  SATELLITE_TILES,
  YOURWALK_STANDARD_STYLE,
  type Basemap,
  type DashboardLayerDef,
  type DashboardLayerId,
  type DashboardLayerState,
  type LegendKey,
  type PathMode,
} from "@/lib/dashboard/layers";
import { DASHBOARD_SOURCES, PENDING_DATA_NOTE } from "@/lib/dashboard/sources";
import {
  defaultLgaBoundaryUrl,
  defaultSegmentsGeoJsonUrl,
  fetchLgaBoundary,
  fetchSegmentsGeoJSON,
  type SegmentsMeta,
} from "@/lib/fetchSegments";
import { DashboardPopup, type PopupInfo } from "@/components/dashboard/DashboardPopup";
import { CASEY_BOUNDS } from "@/lib/scores";

const INTRO_KEY = "yw-dashboard-intro-v2";

const SEG_SRC = "dash-segments";
/**
 * Two copies of the score paint (A and B) on one source. A colour change is
 * drawn on the hidden copy, then the copies crossfade: Mapbox cannot tween a
 * data-driven colour, but it can tween a plain opacity.
 */
const SEG_SETS = {
  A: { fill: "dash-segments-fill-a", line: "dash-segments-line-a" },
  B: { fill: "dash-segments-fill-b", line: "dash-segments-line-b" },
} as const;
type SegSet = keyof typeof SEG_SETS;
const FADE_MS = 280;
// Hover and selected outlines on the scored paths (feature-state, keyed by segment_id)
const SEG_HOVER = "dash-segments-hover";
const SEG_SEL_CASING = "dash-segments-selected-casing";
const SEG_SEL = "dash-segments-selected";
const POINT_SEL_SRC = "dash-point-selected";
const POINT_SEL = "dash-point-selected-ring";
const AREA_SRC = "dash-area";
const AREA_LINE = "dash-area-line";
const MASK_SRC = "dash-mask";
const MASK_FILL = "dash-mask-fill";
const LGA_SRC = "dash-lga";
const LGA_LINE = "dash-lga-line";
const SAT_SRC = "dash-satellite";
const SAT_LAYER = "dash-satellite-raster";

const layerSrc = (id: DashboardLayerId) => `dash-ov-${id}`;
const layerDraw = (id: DashboardLayerId) => `dash-ov-${id}-draw`;

const WORLD_RING: GeoJSON.Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Phase = "loading" | "ready" | "error";

const MODE_OPTIONS = [
  { id: "day" as const, label: "Day", Icon: IconSun, title: "Day walking conditions" },
  { id: "night" as const, label: "Night", Icon: IconMoon, title: "Night walking conditions" },
];

const UNIT_OPTIONS = [
  { id: "suburb" as const, label: "Suburb" },
  { id: "ward" as const, label: "Ward" },
];

const UNIT_WORD: Record<AreaUnit, { one: string; many: string }> = {
  suburb: { one: "suburb", many: "suburbs" },
  ward: { one: "ward", many: "wards" },
};

const PATH_MODES: { id: PathMode; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "faint", label: "Faint" },
  { id: "off", label: "Off" },
];

type SortOrder = "low" | "high" | "az";

const SORT_OPTIONS: { id: SortOrder; label: string; title: string }[] = [
  { id: "low", label: "Lowest", title: "Lowest score first" },
  { id: "high", label: "Highest", title: "Highest score first" },
  { id: "az", label: "A–Z", title: "Alphabetical" },
];

function sortLabel(s: SortOrder): string {
  return SORT_OPTIONS.find((o) => o.id === s)?.title.toLowerCase() ?? "";
}

/** Low-first ranking from rankAreas, flipped or alphabetised; unscored stay last. */
function sortAreas(ranked: AreaStats[], mode: IndexMode, view: ScoreView, sort: SortOrder): AreaStats[] {
  if (sort === "low") return ranked;
  if (sort === "az") return [...ranked].sort((a, b) => a.name.localeCompare(b.name));
  const scored = ranked.filter((a) => areaValue(a, mode, view) != null).reverse();
  return [...scored, ...ranked.filter((a) => areaValue(a, mode, view) == null)];
}

/** Count between values over ~400 ms (the CrashDash ticker feel). */
function AnimatedNumber({ value, className }: { value: number | null; className?: string }) {
  const [shown, setShown] = useState<number | null>(value);
  const fromRef = useRef<number | null>(value);
  useEffect(() => {
    let raf = 0;
    const from = fromRef.current;
    if (value == null || from == null || prefersReducedMotion()) {
      raf = requestAnimationFrame(() => setShown(value));
      fromRef.current = value;
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (value - from) * eased;
      setShown(t < 1 ? next : value);
      fromRef.current = t < 1 ? next : value;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`tabular-nums ${className ?? ""}`}>{fmt10(shown)}</span>;
}

const LEGEND_MAX_ROWS = 3;

function LegendKeyView({ legend }: { legend: LegendKey }) {
  if (legend.kind === "dot") {
    return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: legend.color }} />;
  }
  if (legend.kind === "gradient") {
    return (
      <span className="mt-1 block w-full">
        <span
          aria-hidden
          className="block h-2 rounded-full"
          style={{ background: `linear-gradient(90deg, ${legend.colors.join(", ")})` }}
        />
        <span className="mt-0.5 flex justify-between text-[11px] text-slate-500">
          <span>{legend.low}</span>
          <span>{legend.high}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
      {legend.items.map((it) => (
        <span key={it.label} className="flex items-center gap-1 text-[11px] text-slate-600">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm ring-1 ring-black/10" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </span>
  );
}

/**
 * Score key plus one row per layer that is on, in map order, so a screenshot
 * explains itself. Beyond three layers the extra rows fold away.
 */
function MapLegend({
  title,
  singleStreamNote,
  pathMode,
  fadingLabel,
  selectedName,
  layers,
}: {
  title: string;
  singleStreamNote: string | null;
  pathMode: PathMode;
  fadingLabel: string | null;
  selectedName: string | null;
  layers: DashboardLayerDef[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? layers : layers.slice(0, LEGEND_MAX_ROWS);
  const more = layers.length - shown.length;
  return (
    <div className="yw-sheet-scroll absolute bottom-3 left-3 z-10 max-h-[60%] w-64 overflow-y-auto rounded-lg bg-white p-3 shadow-md ring-1 ring-[#E8ECF2]">
      <p className="text-[12px] font-extrabold text-yw-navy">{title}</p>
      {pathMode === "off" ? (
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          Score colours hidden. Scores still show in the card and list.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[12px] leading-snug text-slate-600">
            Higher = better walking conditions. Colours are stretched across Casey.
            {singleStreamNote ? ` ${singleStreamNote}` : ""}
          </p>
          <div
            className={`mt-2 h-2 rounded-full ${pathMode === "faint" ? "opacity-50" : ""}`}
            aria-hidden
            style={{ background: `linear-gradient(90deg, ${rampColors(DASHBOARD_RAMP).join(", ")})` }}
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>Lower</span>
            <span>Higher</span>
          </div>
          {pathMode === "faint" ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Paths faint{fadingLabel ? ` while ${fadingLabel.toLowerCase()} is on` : ""}.
            </p>
          ) : null}
        </>
      )}
      {selectedName ? (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Dashed outline is the extent of scored footpaths in {selectedName}, not the official boundary.
        </p>
      ) : null}
      {shown.length ? (
        <ul className="mt-2 space-y-1.5 border-t border-[#E8ECF2] pt-2">
          {shown.map((def) => (
            <li key={def.id}>
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                {def.legend.kind === "dot" ? <LegendKeyView legend={def.legend} /> : null}
                <span className="min-w-0 flex-1">{def.label}</span>
                <span className="text-[11px] font-medium text-slate-500">{def.group === "score" ? "in the score" : "context"}</span>
              </p>
              {def.legend.kind !== "dot" ? <LegendKeyView legend={def.legend} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {more > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 text-[11px] font-bold text-yw-navy hover:underline"
        >
          {expanded ? "Show fewer" : `+${more} more`}
        </button>
      ) : null}
    </div>
  );
}

/** Rows glide to new positions when the order changes (FLIP). */
function useFlip(listRef: React.RefObject<HTMLOListElement | null>, key: string) {
  const tops = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>("[data-flip-id]")];
    const next = new Map<string, number>();
    // offsetTop, not viewport position, so list scrolling is not read as movement
    for (const el of items) next.set(el.dataset.flipId ?? "", el.offsetTop);
    if (!prefersReducedMotion()) {
      for (const el of items) {
        const before = tops.current.get(el.dataset.flipId ?? "");
        const after = next.get(el.dataset.flipId ?? "");
        if (before == null || after == null || before === after) continue;
        el.style.transition = "none";
        el.style.transform = `translateY(${before - after}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
          el.style.transform = "";
        });
      }
    }
    tops.current = next;
  }, [listRef, key]);
}

const STREAM_COLOR = {
  Footpaths: "#27AAE1",
  "Heat and shade": "#F6871F",
  "Night lighting": "#E0A800",
} as const;

/** One line on what goes into each part (scoring spec v1.1.3). */
const STREAM_HELP = {
  Footpaths:
    "Path width and surface, speed of traffic alongside, graffiti, and school crossings. Counts for 60% of both Day and Night.",
  "Heat and shade":
    "Urban heat (2018 data), tree canopy, drinking fountains and seats. Counts for 40% of the Day score only.",
  "Night lighting":
    "Street and park lights along the path, and pedestrian crashes at night. Counts for 40% of the Night score only.",
} as const;

/**
 * Card part switches: both on shows the full score; one off shows the other
 * part only. The last part that is on cannot be switched off.
 */
function nextView(view: ScoreView, part: "footpaths" | "stream"): ScoreView {
  const other = part === "footpaths" ? "stream" : "footpaths";
  if (view === "index") return other;
  if (view === part) return view;
  return "index";
}

function confidenceNote(c: string | null): string | null {
  if (c === "low") return "Lower confidence here: some inputs are thin, and crossings and kerb ramps are not in the data yet.";
  if (c === "medium") return "Indicative: crossings and kerb ramps are not in the data yet.";
  if (c === "high") return "Crossings and kerb ramps are not in the data yet.";
  return null;
}

function heldBackText(h: HeldBack): string | null {
  if (!h) return null;
  if (h.kind === "above") return "At or near the Casey average on both parts.";
  return `Held back mainly by ${h.name.toLowerCase()} (${h.score.toFixed(1)}, Casey ${h.casey.toFixed(1)}).`;
}

function resolveSegmentsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SEGMENTS_GEOJSON_URL?.trim();
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultSegmentsGeoJsonUrl(supabase);
  return "/api/map-data/segment_scores.geojson";
}

function resolveLgaUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_LGA_BOUNDARY_URL?.trim();
  if (explicit) return explicit;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabase) return defaultLgaBoundaryUrl(supabase);
  return "/api/map-data/casey_lga_boundary.geojson";
}

function applyLook(map: mapboxgl.Map, mode: IndexMode) {
  try {
    map.setConfigProperty("basemap", "lightPreset", mode === "day" ? "day" : "dusk");
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
    map.setConfigProperty("basemap", "showPedestrianRoads", false);
  } catch {
    /* style without Standard config */
  }
}

function formatScoredAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmt10(v: number | null): string {
  return v == null ? "–" : v.toFixed(1);
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function hullFor(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  if (!features.length) return EMPTY_FC;
  const hull = convex({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection);
  return hull ? { type: "FeatureCollection", features: [hull] } : EMPTY_FC;
}

/** Soft boundary fade: veil the world with a hole cut for the selected area. */
function maskFor(hull: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const poly = hull.features[0]?.geometry;
  if (!poly || poly.type !== "Polygon") return EMPTY_FC;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [WORLD_RING, poly.coordinates[0]] },
      },
    ],
  };
}

type MapState = {
  mode: IndexMode;
  view: ScoreView;
  unit: AreaUnit;
  selectedName: string | null;
  basemap: Basemap;
  layers: DashboardLayerState;
  pathMode: PathMode;
};

export function CouncilDashboard() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);
  const lgaRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const hullRef = useRef<GeoJSON.FeatureCollection>(EMPTY_FC);
  const stateRef = useRef<MapState | null>(null);
  const activeSetRef = useRef<SegSet>("A");
  const paintKeyRef = useRef<string | null>(null);
  const handlersRef = useRef(false);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const clearSelectionRef = useRef<() => void>(() => {});
  const selectedSegRef = useRef<string | null>(null);
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);
  // Mapbox owns the popup DOM; React renders into it through a portal
  const [popupNode] = useState<HTMLDivElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  const locateMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const layersRef = useRef<HTMLDivElement | null>(null);

  // NEXT_PUBLIC_ env is inlined at build time, identical on server + client
  const tokenMissing = !process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [phase, setPhase] = useState<Phase>(tokenMissing ? "error" : "loading");
  const [error, setError] = useState<string | null>(
    tokenMissing ? "Set NEXT_PUBLIC_MAPBOX_TOKEN in web/.env.local" : null,
  );
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([]);
  const [meta, setMeta] = useState<SegmentsMeta | undefined>();
  const [mode, setMode] = useState<IndexMode>("day");
  const [view, setView] = useState<ScoreView>("index");
  const [unit, setUnit] = useState<AreaUnit>("suburb");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("standard");
  const [layers, setLayers] = useState<DashboardLayerState>(DEFAULT_DASHBOARD_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [introOpen, setIntroOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** null = automatic: faint while a layer that covers the paths is on. */
  const [userPathMode, setUserPathMode] = useState<PathMode | null>(null);
  const areaLayerOn = DASHBOARD_LAYERS.some((d) => d.fadesPaths && layers[d.id]);
  const pathMode: PathMode = userPathMode ?? (areaLayerOn ? "faint" : "full");
  const fadingLayer = DASHBOARD_LAYERS.find((d) => d.fadesPaths && layers[d.id]) ?? null;
  const [sort, setSort] = useState<SortOrder>("low");
  const [onDashboardHost, setOnDashboardHost] = useState(false);

  const signOut = async () => {
    await fetch("/api/dashboard-session", { method: "DELETE" }).catch(() => undefined);
    window.location.assign("/dashboard/sign-in");
  };

  const areasByUnit = useMemo(
    () => ({
      suburb: rollUpAreas(features, "suburb"),
      ward: rollUpAreas(features, "ward"),
    }),
    [features],
  );
  const casey = useMemo(() => summariseCasey(features), [features]);
  const ranked = useMemo(
    () => rankAreas(areasByUnit[unit], mode, view),
    [areasByUnit, unit, mode, view],
  );
  const listed = useMemo(() => sortAreas(ranked, mode, view, sort), [ranked, mode, view, sort]);
  const listRef = useRef<HTMLOListElement | null>(null);
  useFlip(listRef, listed.map((a) => a.id).join("|"));
  const selected = useMemo(
    () => areasByUnit[unit].find((a) => a.id === selectedId) ?? null,
    [areasByUnit, unit, selectedId],
  );
  const hasWard = areasByUnit.ward.length > 0;
  const layersOnCount = Object.values(layers).filter(Boolean).length;

  const selectedName = selected?.name ?? null;
  // Layout effect so map effects below always read the current state.
  useLayoutEffect(() => {
    stateRef.current = { mode, view, unit, selectedName, basemap, layers, pathMode };
  }, [mode, view, unit, selectedName, basemap, layers, pathMode]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time client
     read from localStorage and the URL; cannot be lazy-initialised under SSR */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(INTRO_KEY) !== "1") setIntroOpen(true);
    } catch {
      setIntroOpen(true);
    }
    setOnDashboardHost(window.location.hostname.startsWith("dashboard."));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Toggle a layer; area layers that share ground cannot both be on. */
  const toggleLayer = (def: DashboardLayerDef, on: boolean) => {
    setLayers((prev) => {
      const next = { ...prev, [def.id]: on };
      if (on && def.exclusive) {
        for (const other of DASHBOARD_LAYERS) {
          if (other.id !== def.id && other.exclusive === def.exclusive) next[other.id] = false;
        }
      }
      // Back to automatic path strength once nothing covers the paths
      if (!DASHBOARD_LAYERS.some((d) => d.fadesPaths && next[d.id])) setUserPathMode(null);
      return next;
    });
  };

  const closeIntro = () => {
    setIntroOpen(false);
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* private mode */
    }
  };

  /**
   * Paint that depends on Day/Night, the part shown, selection and basemap.
   * With `animate`, a colour change crossfades between the A and B copies.
   */
  const applyPaint = useCallback((map: mapboxgl.Map, animate = false) => {
    const s = stateRef.current;
    if (!s || !map.getLayer(SEG_SETS.A.fill)) return;
    const sat = s.basemap === "satellite";
    const field = fieldFor(s.mode, s.view);
    const key = `${field}:${DASHBOARD_RAMP}`;
    const faint = s.pathMode === "faint";
    const pathsOff = s.pathMode === "off";
    const fillOn = pathsOff ? 0 : faint ? 0.12 : sat ? 0.62 : 0.8;
    const lineOn = pathsOff ? 0 : faint ? 0.4 : sat ? 0.8 : 0.95;
    const w = faint ? 0.6 : 1;
    const width: ExpressionSpecification = [
      "interpolate",
      ["linear"],
      ["zoom"],
      9,
      (sat ? 0.8 : 1.1) * w,
      13,
      (sat ? 1.2 : 1.6) * w,
      16,
      (sat ? 1.6 : 2.4) * w,
    ];
    const setOpacity = (set: SegSet, on: boolean) => {
      map.setPaintProperty(SEG_SETS[set].fill, "fill-opacity", on ? fillOn : 0);
      map.setPaintProperty(SEG_SETS[set].line, "line-opacity", on ? lineOn : 0);
    };
    const setColor = (set: SegSet) => {
      const color = colorExpression(field, DASHBOARD_RAMP);
      map.setPaintProperty(SEG_SETS[set].fill, "fill-color", color);
      map.setPaintProperty(SEG_SETS[set].line, "line-color", color);
    };
    for (const set of ["A", "B"] as const) map.setPaintProperty(SEG_SETS[set].line, "line-width", width);

    const active = activeSetRef.current;
    const hidden: SegSet = active === "A" ? "B" : "A";
    if (paintKeyRef.current !== key) {
      if (animate && paintKeyRef.current != null && !prefersReducedMotion()) {
        setColor(hidden);
        setOpacity(hidden, true);
        setOpacity(active, false);
        activeSetRef.current = hidden;
      } else {
        setColor(active);
        setOpacity(active, true);
        setOpacity(hidden, false);
      }
      paintKeyRef.current = key;
    } else {
      setOpacity(activeSetRef.current, true);
    }

    (map.getSource(AREA_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(hullRef.current);
    (map.getSource(MASK_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData(maskFor(hullRef.current));
    if (map.getLayer(MASK_FILL)) {
      const veil = sat ? "#0B0C1A" : s.mode === "night" ? "#14152A" : "#F5F7FA";
      map.setPaintProperty(MASK_FILL, "fill-color", veil);
      map.setPaintProperty(MASK_FILL, "fill-opacity", sat ? 0.45 : s.mode === "night" ? 0.5 : 0.62);
    }
    if (map.getLayer(LGA_LINE)) {
      map.setPaintProperty(LGA_LINE, "line-color", sat ? "#ffffff" : "#292984");
    }
    if (map.getLayer(SAT_LAYER)) {
      map.setLayoutProperty(SAT_LAYER, "visibility", sat ? "visible" : "none");
    }
  }, []);

  const ensureOverlay = useCallback((map: mapboxgl.Map, def: DashboardLayerDef, visible: boolean) => {
    const src = layerSrc(def.id);
    const lyr = layerDraw(def.id);
    if (!visible) {
      if (map.getLayer(lyr)) map.setLayoutProperty(lyr, "visibility", "none");
      return;
    }
    if (!map.getSource(src)) {
      map.addSource(src, { type: "geojson", data: def.url() });
    }
    if (!map.getLayer(lyr)) {
      // Area layers sit under the score paint so paths stay on top
      const before = def.under && map.getLayer(SEG_SETS.A.fill) ? SEG_SETS.A.fill : undefined;
      const d = def.draw;
      if (d.type === "circle") {
        map.addLayer({
          id: lyr,
          type: "circle",
          source: src,
          paint: {
            "circle-color": d.color,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, d.radius[0], 16, d.radius[1]],
            "circle-stroke-color": d.stroke === "dark" ? "rgba(15,23,42,0.45)" : "#ffffff",
            "circle-stroke-width": d.stroke === "dark" ? 0.5 : 1.4,
            "circle-opacity": 0.95,
            "circle-emissive-strength": 1,
          },
        });
      } else if (d.type === "fill") {
        map.addLayer(
          {
            id: lyr,
            type: "fill",
            source: src,
            paint: { "fill-color": d.color, "fill-opacity": d.opacity, "fill-emissive-strength": 1 },
          },
          before,
        );
      } else {
        map.addLayer(
          {
            id: lyr,
            type: "line",
            source: src,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": d.color,
              "line-width": ["interpolate", ["linear"], ["zoom"], 11, d.width[0], 16, d.width[1]],
              "line-opacity": 0.85,
              "line-emissive-strength": 1,
            },
          },
          before,
        );
      }
    }
    map.setLayoutProperty(lyr, "visibility", "visible");
  }, []);

  /** (Re)install every YourWalk source and layer after a style load. */
  const installAll = useCallback(
    (map: mapboxgl.Map) => {
      const s = stateRef.current;
      if (!s) return;
      applyLook(map, s.mode);
      if (!map.getSource(SAT_SRC)) {
        map.addSource(SAT_SRC, { type: "raster", url: SATELLITE_TILES, tileSize: 256 });
        map.addLayer({
          id: SAT_LAYER,
          type: "raster",
          source: SAT_SRC,
          slot: "middle",
          layout: { visibility: "none" },
          // Keep imagery readable when the Night light preset is on
          paint: { "raster-emissive-strength": 1 },
        });
      }
      if (lgaRef.current && !map.getSource(LGA_SRC)) {
        map.addSource(LGA_SRC, { type: "geojson", data: lgaRef.current });
        map.addLayer({
          id: LGA_LINE,
          type: "line",
          source: LGA_SRC,
          paint: {
            "line-color": "#292984",
            "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.5, 14, 3],
            "line-opacity": 0.7,
            "line-emissive-strength": 1,
          },
        });
      }
      if (!map.getSource(SEG_SRC)) {
        map.addSource(SEG_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: featuresRef.current },
          tolerance: 0,
          buffer: 128,
          promoteId: "segment_id",
        });
        const fade = { duration: prefersReducedMotion() ? 0 : FADE_MS, delay: 0 };
        for (const set of ["A", "B"] as const) {
          // Emissive so Standard's dusk light preset does not dim the evidence
          map.addLayer({
            id: SEG_SETS[set].fill,
            type: "fill",
            source: SEG_SRC,
            paint: { "fill-emissive-strength": 1, "fill-opacity": 0, "fill-opacity-transition": fade },
          });
          map.addLayer({
            id: SEG_SETS[set].line,
            type: "line",
            source: SEG_SRC,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-emissive-strength": 1, "line-opacity": 0, "line-opacity-transition": fade },
          });
        }
        activeSetRef.current = "A";
        paintKeyRef.current = null;
      }
      if (!map.getSource(MASK_SRC)) {
        map.addSource(MASK_SRC, { type: "geojson", data: maskFor(hullRef.current) });
        map.addLayer({
          id: MASK_FILL,
          type: "fill",
          source: MASK_SRC,
          paint: { "fill-emissive-strength": 1, "fill-opacity-transition": { duration: 300, delay: 0 } },
        });
      }
      if (!map.getSource(AREA_SRC)) {
        map.addSource(AREA_SRC, { type: "geojson", data: hullRef.current });
        map.addLayer({
          id: AREA_LINE,
          type: "line",
          source: AREA_SRC,
          paint: {
            "line-color": "#00AAA6",
            "line-width": 2.5,
            "line-dasharray": [2, 1.5],
            "line-emissive-strength": 1,
          },
        });
      }
      for (const def of DASHBOARD_LAYERS) ensureOverlay(map, def, s.layers[def.id]);
      if (!map.getLayer(SEG_HOVER)) {
        const state = (key: string, on: number, off = 0): ExpressionSpecification => [
          "case",
          ["boolean", ["feature-state", key], false],
          on,
          off,
        ];
        map.addLayer({
          id: SEG_HOVER,
          type: "line",
          source: SEG_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#292984",
            "line-width": 2.5,
            "line-opacity": state("hover", 0.7),
            "line-emissive-strength": 1,
          },
        });
        map.addLayer({
          id: SEG_SEL_CASING,
          type: "line",
          source: SEG_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 7,
            "line-opacity": state("selected", 1),
            "line-emissive-strength": 1,
          },
        });
        map.addLayer({
          id: SEG_SEL,
          type: "line",
          source: SEG_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#292984",
            "line-width": 3.5,
            "line-opacity": state("selected", 1),
            "line-emissive-strength": 1,
          },
        });
      }
      if (!map.getSource(POINT_SEL_SRC)) {
        map.addSource(POINT_SEL_SRC, { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: POINT_SEL,
          type: "circle",
          source: POINT_SEL_SRC,
          paint: {
            "circle-radius": 11,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#292984",
            "circle-stroke-width": 2.5,
            "circle-emissive-strength": 1,
          },
        });
      }
      // Feature state does not survive a source rebuild
      if (selectedSegRef.current) {
        map.setFeatureState({ source: SEG_SRC, id: selectedSegRef.current }, { selected: true });
      }
      applyPaint(map);
    },
    [applyPaint, ensureOverlay],
  );

  const registerHandlers = useCallback((map: mapboxgl.Map) => {
    if (handlersRef.current) return;
    handlersRef.current = true;

    const setSelectedSeg = (id: string | null) => {
      if (selectedSegRef.current) {
        map.setFeatureState({ source: SEG_SRC, id: selectedSegRef.current }, { selected: false });
      }
      selectedSegRef.current = id;
      if (id) map.setFeatureState({ source: SEG_SRC, id }, { selected: true });
    };
    const setSelectedPoint = (geom: GeoJSON.Geometry | null) => {
      const src = map.getSource(POINT_SEL_SRC) as mapboxgl.GeoJSONSource | undefined;
      src?.setData(
        geom && geom.type === "Point"
          ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: geom }] }
          : EMPTY_FC,
      );
    };

    map.on("click", (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const visible = (id: string) =>
        map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
      // Points first, then paths, then area layers under the paths
      const points = DASHBOARD_LAYERS.filter((d) => !d.under).map((d) => layerDraw(d.id));
      const areas = DASHBOARD_LAYERS.filter((d) => d.under).map((d) => layerDraw(d.id));
      const seg = SEG_SETS[activeSetRef.current];
      // Hidden paths are drawn at zero opacity but still hit-test
      const paths = stateRef.current?.pathMode === "off" ? [] : [seg.line, seg.fill];
      const order = [...points, ...paths, ...areas].filter(visible);
      const hits = map.queryRenderedFeatures(e.point, { layers: order });
      const hit = [...hits].sort(
        (a, b) => order.indexOf(a.layer?.id ?? "") - order.indexOf(b.layer?.id ?? ""),
      )[0];
      if (!hit) {
        setSelectedSeg(null);
        setSelectedPoint(null);
        setPopupInfo(null);
        return;
      }
      const layerId = hit.layer?.id ?? "";
      const def = DASHBOARD_LAYERS.find((d) => layerDraw(d.id) === layerId);
      if (def) {
        setSelectedSeg(null);
        setSelectedPoint(def.draw.type === "circle" ? hit.geometry : null);
        const anchor: [number, number] =
          hit.geometry.type === "Point" ? (hit.geometry.coordinates as [number, number]) : lngLat;
        setPopupInfo({ kind: "layer", layerId: def.id, props: hit.properties, lngLat: anchor });
        return;
      }
      const segId = hit.properties?.segment_id;
      setSelectedPoint(null);
      setSelectedSeg(segId != null ? String(segId) : null);
      setPopupInfo({ kind: "segment", props: hit.properties, lngLat });
    });

    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const clear = () => (map.getCanvas().style.cursor = "");
    for (const id of DASHBOARD_LAYERS.filter((d) => !d.under).map((d) => layerDraw(d.id))) {
      map.on("mouseenter", id, pointer);
      map.on("mouseleave", id, clear);
    }

    // Hover outline on the path under the cursor (not while paths are hidden)
    const setHover = (id: string | null) => {
      if (hoverIdRef.current === id) return;
      if (hoverIdRef.current) {
        map.setFeatureState({ source: SEG_SRC, id: hoverIdRef.current }, { hover: false });
      }
      hoverIdRef.current = id;
      if (id) map.setFeatureState({ source: SEG_SRC, id }, { hover: true });
      map.getCanvas().style.cursor = id ? "pointer" : "";
    };
    for (const set of ["A", "B"] as const) {
      map.on("mousemove", SEG_SETS[set].fill, (e) => {
        if (activeSetRef.current !== set || stateRef.current?.pathMode === "off") return;
        const id = e.features?.[0]?.properties?.segment_id;
        setHover(id != null ? String(id) : null);
      });
      map.on("mouseleave", SEG_SETS[set].fill, () => setHover(null));
    }

    clearSelectionRef.current = () => {
      setSelectedSeg(null);
      setSelectedPoint(null);
    };
  }, []);

  // Map + data bootstrap
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: YOURWALK_STANDARD_STYLE,
      bounds: [
        [CASEY_BOUNDS.west, CASEY_BOUNDS.south],
        [CASEY_BOUNDS.east, CASEY_BOUNDS.north],
      ],
      fitBoundsOptions: { padding: 32 },
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapRef.current = map;

    let cancelled = false;
    const dataReady = (async () => {
      const body = await fetchSegmentsGeoJSON(resolveSegmentsUrl());
      try {
        lgaRef.current = await fetchLgaBoundary(resolveLgaUrl());
      } catch (err) {
        console.warn("LGA boundary not loaded", err);
      }
      return body;
    })();

    const styleLoaded = new Promise<void>((resolve) => map.once("style.load", () => resolve()));

    Promise.all([dataReady, styleLoaded])
      .then(([body]) => {
        if (cancelled) return;
        const eligible = (body.features ?? []).filter((f) => {
          const w = f.properties?.length_m;
          return typeof w === "number" && w > 0;
        });
        featuresRef.current = eligible;
        setFeatures(eligible);
        setMeta(body.meta);
        installAll(map);
        registerHandlers(map);
        map.on("style.load", () => installAll(map));
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });

    map.on("error", (e) => {
      const msg = e.error?.message ?? "";
      if (/overlays|map-data|geojson/i.test(msg)) {
        setLayerError("A map layer failed to load. The scores are unaffected.");
      }
    });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      handlersRef.current = false;
    };
  }, [installAll, registerHandlers]);

  // Day / Night: basemap light and paint
  useEffect(() => {
    const map = mapRef.current;
    if (!map || phase !== "ready") return;
    applyLook(map, mode);
    applyPaint(map, true);
  }, [mode, view, phase, applyPaint]);

  // Selection: outline, soft fade, fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || phase !== "ready") return;
    if (!selected) {
      hullRef.current = EMPTY_FC;
      applyPaint(map);
      return;
    }
    const inArea = featuresInArea(featuresRef.current, unit, selected.name);
    hullRef.current = hullFor(inArea);
    applyPaint(map);
    if (inArea.length) {
      const [w, s, e, n] = bbox({ type: "FeatureCollection", features: inArea } as GeoJSON.FeatureCollection);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 56, maxZoom: 15, duration: reduce ? 0 : 700 },
      );
    }
  }, [selected, unit, phase, applyPaint]);

  // Basemap: satellite raster on or off, score paint goes quieter on aerials
  useEffect(() => {
    const map = mapRef.current;
    if (!map || phase !== "ready") return;
    applyPaint(map);
  }, [basemap, pathMode, phase, applyPaint]);

  // Overlay toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || phase !== "ready") return;
    const run = () => {
      for (const def of DASHBOARD_LAYERS) ensureOverlay(map, def, layers[def.id]);
    };
    // Standard reports not-loaded while tiles or imports are in flight
    if (map.isStyleLoaded()) run();
    else map.once("idle", run);
    return () => {
      map.off("idle", run);
    };
  }, [layers, phase, ensureOverlay]);

  // Close Layers menu on outside click / Escape
  useEffect(() => {
    if (!layersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLayersOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [layersOpen]);

  // One Mapbox popup; React fills it through a portal so it can reuse card parts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !popupNode) return;
    if (!popupInfo) {
      popupRef.current?.remove();
      popupRef.current = null;
      clearSelectionRef.current();
      return;
    }
    if (!popupRef.current) {
      const p = new mapboxgl.Popup({
        className: "yw-dash-popup",
        closeButton: false,
        closeOnClick: false,
        maxWidth: "300px",
        offset: 12,
        focusAfterOpen: false,
      }).setDOMContent(popupNode);
      p.on("close", () => {
        popupRef.current = null;
        setPopupInfo(null);
      });
      popupRef.current = p;
    }
    popupRef.current.setLngLat(popupInfo.lngLat);
    if (!popupRef.current.isOpen()) popupRef.current.addTo(map);
  }, [popupInfo, popupNode]);

  useEffect(() => {
    if (!popupInfo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopupInfo(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popupInfo]);

  const showAreaByName = (name: string) => {
    const hit = areasByUnit[unit].find((a) => a.name === name);
    if (hit) selectArea(hit);
  };

  const togglePart = (part: "footpaths" | "stream") => setView((v) => nextView(v, part));

  const changeUnit = (next: AreaUnit) => {
    if (next === unit) return;
    setUnit(next);
    setSelectedId(null);
    setQuery("");
  };

  const selectArea = (a: AreaStats | null) => {
    setSelectedId(a?.id ?? null);
    setQuery(a?.name ?? "");
    setPopupInfo(null);
  };

  const clearSelection = () => {
    selectArea(null);
    const map = mapRef.current;
    map?.fitBounds(
      [
        [CASEY_BOUNDS.west, CASEY_BOUNDS.south],
        [CASEY_BOUNDS.east, CASEY_BOUNDS.north],
      ],
      { padding: 32, duration: 500 },
    );
  };

  const runSearch = (q: string) => {
    const v = q.trim().toLowerCase();
    if (!v) return;
    const list = areasByUnit[unit];
    const hit =
      list.find((a) => a.name.toLowerCase() === v) ??
      list.find((a) => a.name.toLowerCase().startsWith(v)) ??
      list.find((a) => a.name.toLowerCase().includes(v));
    if (hit) selectArea(hit);
    else setNotice(`No scored ${UNIT_WORD[unit].one} matches “${q.trim()}”.`);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice("This browser cannot share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        const inside =
          lng >= CASEY_BOUNDS.west &&
          lng <= CASEY_BOUNDS.east &&
          lat >= CASEY_BOUNDS.south &&
          lat <= CASEY_BOUNDS.north;
        if (!inside) {
          setNotice("You are outside the City of Casey, so the map stays on Casey.");
          return;
        }
        const map = mapRef.current;
        if (!map) return;
        locateMarkerRef.current?.remove();
        const el = document.createElement("div");
        el.className = "yw-locate-dot";
        locateMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        map.flyTo({ center: [lng, lat], zoom: 15 });
      },
      () => setNotice("Location was not shared."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const scoredAt = formatScoredAt(meta?.scored_at);
  const spec = meta?.scoring_spec_version ?? SCORING_SPEC_VERSION;
  const indexLabel = mode === "day" ? "Day" : "Night";
  const showing = viewName(mode, view);
  const singleStream = view !== "index";
  const example =
    areasByUnit.suburb.find((a) => a.name === "Cranbourne North") ?? rankAreas(areasByUnit.suburb, "day")[0];
  const exampleParts = example ? breakdown(example, "day") : null;

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-yw-day-surface text-slate-900">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E8ECF2] bg-white px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/yourwalk-mark.svg" alt="" width={36} height={28} className="h-7 w-auto" aria-hidden />
        <div className="leading-none">
          <p className="text-lg font-extrabold tracking-tight text-yw-navy">YourWalk</p>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">Council insights</p>
        </div>
        <div className="mx-1 h-7 w-px bg-[#E8ECF2]" aria-hidden />
        <SegmentedPill
          value={mode}
          options={MODE_OPTIONS}
          onChange={(m) => setMode(m)}
          isNight={false}
          ariaLabel="Walking conditions index"
          className="h-9! w-40!"
        />
        <span
          className="rounded-md bg-yw-navy/8 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-yw-navy ring-1 ring-yw-navy/15"
          title="Pilot build for City of Casey staff"
        >
          {BETA_LABEL}
        </span>
        <span className="rounded-md bg-yw-day-surface px-1.5 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-[#E8ECF2]">
          scores {spec}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-yw-navy hover:bg-yw-day-surface"
          >
            <MdInfoOutline className="h-4 w-4" aria-hidden />
            How to read this
          </button>
          <p className="text-[12px] font-semibold text-slate-600">City of Casey</p>
          {onDashboardHost ? (
            <button
              type="button"
              onClick={signOut}
              className="h-9 rounded-full px-3 text-[12px] font-semibold text-slate-600 ring-1 ring-[#E8ECF2] hover:bg-yw-day-surface"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[17.5rem_minmax(0,1fr)_17.5rem] lg:overflow-visible xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <aside className="order-2 min-h-0 border-[#E8ECF2] bg-white p-4 lg:order-1 lg:overflow-y-auto lg:border-r">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            {selected ? `Selected ${UNIT_WORD[unit].one}` : "City of Casey"}
          </p>
          <AreaCard
            title={selected?.name ?? "All scored footpaths"}
            unitLabel={selected ? UNIT_WORD[unit].one : "LGA"}
            stats={selected ?? casey}
            casey={casey}
            isCasey={!selected}
            mode={mode}
            view={view}
            onTogglePart={togglePart}
            thin={selected?.thin ?? false}
            onClear={selected ? clearSelection : undefined}
            empty={!selected}
          />

          <p className="mt-4 text-[12px] leading-snug text-slate-600">
            Crossings and kerb ramps are not in the data yet. Scores describe conditions in the data; they are not a
            promise that a walk will feel safe.
          </p>

          <details className="group mt-4 rounded-lg ring-1 ring-[#E8ECF2]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-[12px] font-bold text-yw-navy">
                  Data sources · {DASHBOARD_SOURCES.length}
                </span>
                <span className="block text-[12px] text-slate-500">
                  {scoredAt ? `Scored ${scoredAt}` : `Scores ${spec}`} · heat data 2018
                </span>
              </span>
              <MdExpandMore className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-[#E8ECF2] px-3 pb-3">
              <ul className="divide-y divide-[#E8ECF2]">
                {DASHBOARD_SOURCES.map((s) => (
                  <li key={s.name} className="py-2">
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[12px] font-semibold text-yw-navy hover:underline"
                    >
                      {s.name}
                      <MdOpenInNew className="h-3 w-3 shrink-0 text-slate-500" aria-label="opens in a new tab" />
                    </a>
                    <p className="text-[12px] text-slate-500">
                      {s.vintage} · {s.role}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] leading-snug text-slate-500">{PENDING_DATA_NOTE}</p>
              <p className="mt-2 text-[12px] leading-snug text-slate-500">
                Methodology v1.1 · scores {spec}
                {scoredAt ? ` · scored ${scoredAt}` : ""}.
              </p>
            </div>
          </details>
        </aside>

        <section
          className="relative order-1 min-h-[60vh] lg:order-2 lg:min-h-0"
          aria-label={`${indexLabel} walking conditions map`}
        >
          <div ref={containerRef} className="absolute inset-0" />

          {phase === "loading" ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-yw-day-surface/60">
              <p className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-yw-navy shadow">
                Loading Casey scored footpaths…
              </p>
            </div>
          ) : null}
          {phase === "error" ? (
            <div className="absolute inset-0 z-10 grid place-items-center p-6">
              <p className="max-w-md rounded-lg bg-white p-4 text-[13px] text-slate-700 shadow ring-1 ring-[#E8ECF2]">
                The map could not load. {error}
              </p>
            </div>
          ) : null}

          <div ref={layersRef} className="absolute left-3 top-3 z-20">
            <button
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              aria-expanded={layersOpen}
              aria-controls="dash-layers-menu"
              aria-label="Map layers"
              title="Map layers"
              className={`relative flex h-11 w-11 items-center justify-center rounded-full shadow-lg ring-1 ${
                layersOpen || layersOnCount > 0
                  ? "bg-yw-teal text-white ring-yw-teal/40"
                  : "bg-white text-yw-navy ring-black/10"
              }`}
            >
              <MdLayers className="h-5 w-5" aria-hidden />
              {layersOnCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-yw-navy px-1 text-[11px] font-extrabold text-white">
                  {layersOnCount}
                </span>
              ) : null}
            </button>
            {layersOpen ? (
              <div
                id="dash-layers-menu"
                role="dialog"
                aria-label="Map layers"
                className="yw-sheet-scroll absolute left-0 top-[52px] max-h-[calc(100dvh-9rem)] w-80 overflow-y-auto rounded-lg bg-white p-3 shadow-xl ring-1 ring-black/10"
              >
                <div className="mb-2 flex items-center justify-between border-b border-[#E8ECF2] pb-2">
                  <p className="text-[13px] font-extrabold text-yw-navy">Map layers</p>
                  <button
                    type="button"
                    onClick={() => setLayersOpen(false)}
                    aria-label="Close layers"
                    className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-yw-day-surface"
                  >
                    <MdClose className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Scored paths</p>
                <div role="radiogroup" aria-label="Scored paths" className="mb-1 grid grid-cols-3 gap-1">
                  {PATH_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={pathMode === m.id}
                      onClick={() => setUserPathMode(m.id)}
                      className={`h-9 rounded-md text-[12px] font-bold ring-1 ${
                        pathMode === m.id
                          ? "bg-yw-navy text-white ring-yw-navy"
                          : "bg-yw-day-surface text-slate-600 ring-[#E8ECF2]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mb-3 text-[11px] leading-snug text-slate-500">
                  {userPathMode == null && fadingLayer
                    ? `Faint while ${fadingLayer.label.toLowerCase()} is on, so the layer reads clearly.`
                    : "Scores in the card and list stay the same whatever you pick."}
                </p>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Basemap</p>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "standard", label: "Standard", Icon: MdMap },
                      { id: "satellite", label: "Satellite", Icon: MdSatelliteAlt },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={basemap === id}
                      onClick={() => setBasemap(id)}
                      className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-[12px] font-bold ring-1 ${
                        basemap === id
                          ? "bg-yw-navy text-white ring-yw-navy"
                          : "bg-yw-day-surface text-slate-600 ring-[#E8ECF2]"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
                {LAYER_GROUPS.map((group) => (
                  <div key={group.id} className="mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{group.label}</p>
                    <p className="mb-1 text-[11px] text-slate-500">{group.hint}</p>
                    <ul className="space-y-0.5">
                      {DASHBOARD_LAYERS.filter((d) => d.group === group.id).map((def) => (
                        <li key={def.id}>
                          <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-yw-day-surface">
                            <input
                              type="checkbox"
                              className="yw-check mt-0.5"
                              checked={layers[def.id]}
                              onChange={(e) => toggleLayer(def, e.target.checked)}
                            />
                            <span
                              aria-hidden
                              className={`mt-1 h-2.5 w-2.5 shrink-0 ring-1 ring-black/15 ${
                                def.draw.type === "circle" ? "rounded-full" : "rounded-sm"
                              }`}
                              style={{ background: def.swatch }}
                            />
                            <span className="min-w-0">
                              <span className="block text-[12px] font-bold text-slate-900">{def.label}</span>
                              <span className="block text-[11px] leading-snug text-slate-500">{def.note}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="mt-2 text-[11px] leading-snug text-slate-500">
                  Default off. Turning a layer on never changes a Day or Night number. Graffiti and night crashes also
                  feed the score; they wait on a wording review before they appear here.
                </p>
                {layerError ? <p className="mt-1 text-[11px] text-[#b91c1c]">{layerError}</p> : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={locate}
            aria-label="Zoom to my location if I am in Casey"
            title="Where am I?"
            className="absolute left-3 top-[64px] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-yw-navy shadow-lg ring-1 ring-black/10"
          >
            <IconLocate className="h-5 w-5" aria-hidden />
          </button>

          <form
            className="absolute left-16 right-14 top-3 z-10 flex justify-center"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            role="search"
          >
            <input
              type="search"
              list="dash-area-names"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                const exact = areasByUnit[unit].find((a) => a.name.toLowerCase() === v.trim().toLowerCase());
                if (exact) selectArea(exact);
              }}
              placeholder={`Search ${UNIT_WORD[unit].one}`}
              aria-label={`Search ${UNIT_WORD[unit].one}`}
              className="h-10 w-full max-w-md rounded-lg border border-[#E8ECF2] bg-white px-3 text-[13px] shadow-md"
            />
            <datalist id="dash-area-names">
              {areasByUnit[unit].map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
          </form>

          {notice ? (
            <p
              role="status"
              className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-yw-navy shadow ring-1 ring-[#E8ECF2]"
            >
              {notice}
            </p>
          ) : null}

          <MapLegend
            title={singleStream ? `${showing} only · ${indexLabel}` : `${indexLabel} score`}
            singleStreamNote={singleStream ? `One part of the ${indexLabel} score, not the score itself.` : null}
            pathMode={pathMode}
            fadingLabel={userPathMode == null && fadingLayer ? fadingLayer.label : null}
            selectedName={selected?.name ?? null}
            layers={DASHBOARD_LAYERS.filter((d) => layers[d.id])}
          />
        </section>

        <aside className="order-3 min-h-0 border-[#E8ECF2] bg-white p-4 lg:overflow-y-auto lg:border-l">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">View by</p>
          <SegmentedPill
            value={unit}
            options={hasWard ? UNIT_OPTIONS : UNIT_OPTIONS.slice(0, 1)}
            onChange={changeUnit}
            isNight={false}
            ariaLabel="Area unit"
            className="mb-4 h-9!"
          />
          <div className="mb-2 flex items-end justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              {UNIT_WORD[unit].many} · {singleStream ? `${showing} only (${indexLabel})` : `${indexLabel} score`}
            </p>
            <div role="radiogroup" aria-label="Sort the list" className="flex shrink-0 rounded-md bg-yw-day-surface p-0.5 ring-1 ring-[#E8ECF2]">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={sort === o.id}
                  title={o.title}
                  onClick={() => setSort(o.id)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                    sort === o.id ? "bg-white text-yw-navy shadow-sm ring-1 ring-[#E8ECF2]" : "text-slate-500"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <ol ref={listRef} className="space-y-0.5" aria-label={`${UNIT_WORD[unit].many}, ${sortLabel(sort)}, on ${showing}`}>
            {listed.map((a) => {
              const on = a.id === selectedId;
              const held = singleStream ? null : heldBackBy(a, casey, mode);
              const hint = held?.kind === "stream" ? `Mainly ${held.name.toLowerCase()}` : null;
              const v = areaValue(a, mode, view);
              return (
                <li key={a.id} data-flip-id={a.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => (on ? clearSelection() : selectArea(a))}
                    className={`flex min-h-11 w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left ${
                      on ? "border-yw-teal bg-yw-day-surface" : "border-transparent hover:bg-yw-day-surface"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-900">{a.name}</span>
                      {hint || a.thin ? (
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                          {hint ? <span>{hint}</span> : null}
                          {a.thin ? (
                            <span className="rounded px-1.5 py-px text-[11px] font-bold text-slate-500 ring-1 ring-[#E8ECF2]">
                              Thin data
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <AnimatedNumber value={v} className="text-[16px] font-extrabold text-yw-navy" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[12px] leading-snug text-slate-500">
            All scores are out of 10. Casey {showing.toLowerCase()}: {fmt10(areaValue(casey, mode, view))}. Averages are
            weighted by path length, {UNIT_WORD[unit].one} as tagged on Casey footpaths. &ldquo;Mainly&rdquo; names the
            part that pulls the score furthest below the Casey average.
          </p>
        </aside>
      </div>

      {popupInfo && popupNode
        ? createPortal(
            <DashboardPopup
              info={popupInfo}
              mode={mode}
              view={view}
              unit={unit}
              casey={casey}
              spec={spec}
              selectedArea={selected?.name ?? null}
              onClose={() => setPopupInfo(null)}
              onShowArea={showAreaByName}
            />,
            popupNode,
          )
        : null}

      {introOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-intro-title"
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"
          >
            <p id="dash-intro-title" className="text-[16px] font-extrabold text-yw-navy">
              How to read Council insights
            </p>
            <ul className="mt-3 space-y-2 text-[13px] leading-snug text-slate-700">
              <li>
                <strong className="text-yw-navy">Every score is out of 10. Higher is better.</strong> Scores describe
                walking conditions on Casey footpaths.
              </li>
              <li>
                <strong className="text-yw-navy">Each score has two parts that add up.</strong> Footpaths gives up to
                6 points. Heat and shade (Day) or night lighting (Night) gives up to 4.
              </li>
              <li>
                <strong className="text-yw-navy">Compare with Casey, not with a pass mark.</strong> Heat and shade is
                low across all of Casey, so Day scores run lower than Night.
              </li>
            </ul>
            {example && exampleParts ? (
              <div className="mt-3 rounded-lg bg-yw-day-surface p-3 text-[12px] leading-snug text-slate-700 ring-1 ring-[#E8ECF2]">
                <p className="font-bold text-yw-navy">Example: {example.name}, Day</p>
                <p className="mt-1">
                  Footpaths {fmt10(exampleParts.footpaths.points)} of 6, plus heat and shade{" "}
                  {fmt10(exampleParts.stream.points)} of 4, makes <strong>{fmt10(exampleParts.total)}</strong>. Casey
                  average is {fmt10(casey.day)}.
                </p>
              </div>
            ) : null}
            <p className="mt-3 text-[12px] leading-snug text-slate-500">
              Crossings and kerb ramps are not in the data yet. Heat data is from 2018. Scores are not a promise that a
              walk will feel safe.
            </p>
            <button
              type="button"
              autoFocus
              onClick={closeIntro}
              className="mt-4 h-11 w-full rounded-full bg-yw-navy text-[13px] font-bold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AreaCard({
  title,
  unitLabel,
  stats,
  casey,
  isCasey,
  mode,
  view,
  onTogglePart,
  thin,
  empty,
  onClear,
}: {
  title: string;
  unitLabel: string;
  stats: AreaStats | CaseySummary;
  casey: CaseySummary;
  /** The card is Casey itself: no "Casey average" comparisons. */
  isCasey: boolean;
  mode: IndexMode;
  view: ScoreView;
  onTogglePart: (part: "footpaths" | "stream") => void;
  thin: boolean;
  empty: boolean;
  onClear?: () => void;
}) {
  const parts = breakdown(stats, mode);
  const caseyParts = breakdown(casey, mode);
  const held = isCasey ? null : heldBackBy(stats, casey, mode);
  const conf = confidenceNote(mode === "day" ? stats.confidenceDay : stats.confidenceNight);
  const heldText = heldBackText(held);
  const indexName = mode === "day" ? "Day score" : "Night score";
  const headlineLabel = view === "index" ? indexName : `${viewName(mode, view)} only`;
  const headline = areaValue(stats, mode, view);
  const headlineCasey = isCasey ? null : areaValue(casey, mode, view);
  return (
    <div className="rounded-lg bg-yw-day-surface p-3.5 ring-1 ring-[#E8ECF2]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-extrabold text-yw-navy">{title}</p>
          <p className="text-[12px] text-slate-500">
            {stats.segments.toLocaleString()} scored segments · {stats.lengthKm.toLocaleString()} km · {unitLabel}
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white"
          >
            <MdClose className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="my-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">{headlineLabel}</p>
          <p className="text-[12px] text-slate-500">
            {view === "index" ? "Out of 10 · higher is better" : `One part of the ${indexName}`}
          </p>
        </div>
        <div className="shrink-0 text-right" aria-live="polite">
          <p className="whitespace-nowrap">
            <AnimatedNumber
              value={headline}
              className="text-[36px] font-extrabold leading-none tracking-tight text-yw-navy"
            />
            <span className="ml-0.5 text-[12px] font-semibold text-slate-500">/ 10</span>
          </p>
          {headlineCasey != null ? (
            <p className="text-[12px] text-slate-500">
              Casey average <AnimatedNumber value={headlineCasey} />
            </p>
          ) : null}
        </div>
      </div>

      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
        Parts · tap to show one on the map
      </p>
      <PartRow
        part={parts.footpaths}
        casey={isCasey ? null : caseyParts.footpaths.score}
        weightPct={60}
        on={view !== "stream"}
        locked={view === "footpaths"}
        onToggle={() => onTogglePart("footpaths")}
      />
      <PartRow
        part={parts.stream}
        casey={isCasey ? null : caseyParts.stream.score}
        weightPct={40}
        on={view !== "footpaths"}
        locked={view === "stream"}
        onToggle={() => onTogglePart("stream")}
      />
      <div className="mt-1.5 flex items-center justify-between border-t border-[#E8ECF2] pt-1.5">
        <span className="text-[12px] font-bold text-slate-700">
          {indexName}
          <span className="font-medium text-slate-500">
            {" "}
            = <AnimatedNumber value={parts.footpaths.points} /> + <AnimatedNumber value={parts.stream.points} />
          </span>
        </span>
        <span className="text-[12px] font-extrabold text-yw-navy">
          <AnimatedNumber value={parts.total} /> <span className="font-medium text-slate-500">/ 10</span>
        </span>
      </div>

      {heldText ? <p className="mt-2 text-[12px] font-semibold leading-snug text-slate-700">{heldText}</p> : null}
      <p className="mt-2 text-[12px] leading-snug text-slate-500">
        {conf}
        {thin ? " Few scored paths here, so treat this with care." : ""}
      </p>
      {empty ? (
        <p className="mt-2 text-[12px] leading-snug text-slate-500">
          Pick a row on the right or search to focus one area. Click a path for its scores.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One part of the score: a switch for the map and list, the part's own score
 * out of 10 on a 0–10 bar with the Casey average marked, and how much it
 * counts toward the Day or Night score.
 */
function PartRow({
  part,
  casey,
  weightPct,
  on,
  locked,
  onToggle,
}: {
  part: BreakdownPart;
  casey: number | null;
  weightPct: number;
  on: boolean;
  /** The only part still on; switching it off is not allowed. */
  locked: boolean;
  onToggle: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const color = STREAM_COLOR[part.name];
  const pct = Math.max(0, Math.min(100, (part.score ?? 0) * 10));
  const tick = casey == null ? null : Math.max(0, Math.min(100, casey * 10));
  return (
    <div className={`my-1 rounded-md px-1.5 py-1.5 ${on ? "" : "opacity-55"}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-disabled={locked}
          onClick={locked ? undefined : onToggle}
          title={locked ? "At least one part stays on" : on ? `Hide ${part.name} on the map` : `Show ${part.name}`}
          className={`flex min-h-9 flex-1 items-center gap-2 rounded-md text-left ${locked ? "cursor-default" : "cursor-pointer"}`}
        >
          <span
            aria-hidden
            className={`grid h-4 w-4 shrink-0 place-items-center rounded ring-1 ${on ? "ring-transparent" : "bg-white ring-slate-300"}`}
            style={on ? { background: color } : undefined}
          >
            {on ? (
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
              </svg>
            ) : null}
          </span>
          <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-800">{part.name}</span>
          <span className="text-[13px] font-extrabold text-slate-800">
            <AnimatedNumber value={part.score} />
            <span className="text-[12px] font-medium text-slate-500"> /10</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          aria-expanded={helpOpen}
          aria-label={`What goes into ${part.name}`}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ring-1 ${
            helpOpen ? "bg-yw-navy text-white ring-yw-navy" : "bg-white text-slate-500 ring-[#E8ECF2]"
          }`}
        >
          ?
        </button>
      </div>
      <div className="relative ml-6 mt-1 h-2 rounded-full bg-white ring-1 ring-[#E8ECF2]" aria-hidden>
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%`, background: color }}
        />
        {tick != null ? (
          <span
            className="absolute -top-1 -bottom-1 w-0.5 rounded bg-slate-700 transition-[left] duration-300 ease-out motion-reduce:transition-none"
            style={{ left: `calc(${tick}% - 1px)` }}
          />
        ) : null}
      </div>
      <p className="ml-6 mt-1 text-[11px] leading-snug text-slate-500">
        {casey != null ? `Casey ${fmt10(casey)} (marked) · ` : ""}counts {weightPct}% · {fmt10(part.points)} of{" "}
        {part.maxPoints} points
      </p>
      {helpOpen ? (
        <p className="ml-6 mt-1 rounded-md bg-white px-2 py-1.5 text-[12px] leading-snug text-slate-600 ring-1 ring-[#E8ECF2]">
          {STREAM_HELP[part.name]}
        </p>
      ) : null}
    </div>
  );
}
