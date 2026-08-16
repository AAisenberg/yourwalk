"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MdClose, MdEdit, MdLayers, MdMyLocation, MdPlace } from "react-icons/md";

import {
  IconMoon,
  IconOuting,
  IconSun,
  IconTrip,
} from "@/components/resident/icons";
import { RingedAmenityIcon } from "@/components/resident/RingedAmenityIcon";
import { SegmentedPill } from "@/components/resident/SegmentedPill";
import { DEFAULT_OVERLAYS, OVERLAY_DEFS, type OverlayId } from "@/lib/overlays";
import {
  prefSliderDescription,
  type WalkMode,
} from "@/lib/routing/preferences";

type WalkIntent = "trip" | "outing";
type SheetMode = "plan" | "results";

const INTRO_KEY = "yw-planner-mock-intro-v1";
const LAYERS_KEY = "yw-planner-mock-layers-v1";
const LAYERS_TIP_KEY = "yw-planner-mock-layers-tip-v1";

const AMENITY_MARKS: { id: OverlayId; x: string; y: string }[] = [
  { id: "fountains", x: "42%", y: "38%" },
  { id: "benches", x: "56%", y: "28%" },
  { id: "toilets", x: "66%", y: "48%" },
  { id: "dog_bags", x: "32%", y: "55%" },
];

type MockRoute = {
  id: string;
  label: string;
  minutes: number;
  km: string;
  match: string;
  why: string;
  footpaths: string;
  comfort: string;
  amenities: string;
  coverage?: string;
};

const TRIP_ROUTES: MockRoute[] = [
  {
    id: "best",
    label: "Best for you",
    minutes: 18,
    km: "1.4 km",
    match: "8.2",
    why: "More tree cover than the shortest option. About 3 minutes longer.",
    footpaths: "8.4",
    comfort: "8.1",
    amenities: "Passes a drinking fountain near Homestead Road",
  },
  {
    id: "short",
    label: "Shortest",
    minutes: 15,
    km: "1.2 km",
    match: "7.4",
    why: "Quicker, more street-edge walking. Fine if time matters more than shade.",
    footpaths: "7.6",
    comfort: "6.8",
    amenities: "No checked amenities on this path",
    coverage: "Partial score coverage (72% of path)",
  },
];

const OUTING_ROUTES: MockRoute[] = [
  {
    id: "loop-a",
    label: "Best for you",
    minutes: 24,
    km: "1.9 km",
    match: "8.0",
    why: "Circuit near your start. Smoother paths, returns on a different street.",
    footpaths: "8.2",
    comfort: "7.9",
    amenities: "Passes benches in the reserve",
  },
  {
    id: "loop-b",
    label: "Another loop",
    minutes: 27,
    km: "2.1 km",
    match: "7.6",
    why: "A bit longer. More shade along the creek edge.",
    footpaths: "7.5",
    comfort: "8.4",
    amenities: "Passes a drinking fountain",
  },
];

export default function PlannerMockupPage() {
  const [walkMode, setWalkMode] = useState<WalkMode>("day");
  const [whenOverridden, setWhenOverridden] = useState(false);
  const [walkIntent, setWalkIntent] = useState<WalkIntent>("trip");
  const [outingMinutes, setOutingMinutes] = useState(25);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [layersOpen, setLayersOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showLayersTip, setShowLayersTip] = useState(true);
  const [pickMode, setPickMode] = useState<"idle" | "origin" | "destination">(
    "idle",
  );
  const [accessibility, setAccessibility] = useState(60);
  const [shadeHeat, setShadeHeat] = useState(85);
  const [afterDark, setAfterDark] = useState(92);
  const [preferAway, setPreferAway] = useState(false);
  const [overlays, setOverlays] =
    useState<Record<OverlayId, boolean>>(DEFAULT_OVERLAYS);
  const [layersReady, setLayersReady] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("plan");
  const [selectedId, setSelectedId] = useState("best");
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    try {
      setShowIntro(window.localStorage.getItem(INTRO_KEY) !== "1");
      setShowLayersTip(window.localStorage.getItem(LAYERS_TIP_KEY) !== "1");
      const raw = window.localStorage.getItem(LAYERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<OverlayId, boolean>>;
      setOverlays({ ...DEFAULT_OVERLAYS, ...parsed });
    } catch {
      /* private mode */
    }
    setLayersReady(true);
  }, []);

  useEffect(() => {
    if (!layersReady) return;
    try {
      window.localStorage.setItem(LAYERS_KEY, JSON.stringify(overlays));
    } catch {
      /* ignore */
    }
  }, [overlays, layersReady]);

  const dismissIntro = () => {
    setShowIntro(false);
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
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

  const isNight = walkMode === "night";
  const routes = walkIntent === "outing" ? OUTING_ROUTES : TRIP_ROUTES;
  const canFind =
    Boolean(origin) && (walkIntent === "outing" || Boolean(destination));

  const whenHint = useMemo(() => {
    if (whenOverridden) {
      return isNight
        ? "Night · you chose this"
        : "Day · you chose this";
    }
    return isNight
      ? "Night · after dark in Casey now"
      : "Day · daylight in Casey now";
  }, [isNight, whenOverridden]);

  const onWhenChange = (mode: WalkMode) => {
    setWhenOverridden(true);
    setWalkMode(mode);
  };

  const useMyLocation = () => {
    setGeoBusy(true);
    window.setTimeout(() => {
      setOrigin("Near Homestead Road, Berwick");
      setGeoBusy(false);
    }, 450);
  };

  const findWalk = () => {
    if (!canFind) return;
    setSelectedId(routes[0]!.id);
    setSheetMode("results");
  };

  return (
    <main
      className={`min-h-dvh px-4 py-6 sm:px-8 ${
        isNight
          ? "bg-yw-night-surface text-white"
          : "bg-yw-day-surface text-slate-900"
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-6 lg:w-72">
          <p
            className={`text-[11px] font-bold uppercase tracking-wide ${
              isNight ? "text-white/45" : "text-slate-500"
            }`}
          >
            Design mockup
          </p>
          <h1
            className={`mt-1 text-xl font-extrabold tracking-tight ${
              isNight ? "text-white" : "text-yw-navy"
            }`}
          >
            Planner flow
          </h1>
          <p
            className={`mt-2 text-[13px] leading-snug ${
              isNight ? "text-white/60" : "text-slate-600"
            }`}
          >
            Click through the planner before we wire the live app. No
            Mapbox, no routing. Canned Casey places only.
          </p>
          <ol
            className={`mt-4 list-decimal space-y-1.5 pl-4 text-[12px] leading-snug ${
              isNight ? "text-white/55" : "text-slate-600"
            }`}
          >
            <li>Find your walk + Casey first-visit line</li>
            <li>Layers top-left, ringed amenity marks</li>
            <li>Layers off by default; tip once; ticks persist</li>
            <li>Less / More under compact sliders</li>
            <li>Locate + pin; tap a result card for more</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/design" className="text-yw-blue hover:underline">
              Visual system
            </Link>
            <Link href="/" className="text-yw-blue hover:underline">
              Live app
            </Link>
          </div>
        </aside>

        <div className="flex flex-1 justify-center">
          <div
            className={`relative flex h-[740px] w-[375px] flex-col overflow-hidden rounded-[2rem] ring-1 ${
              isNight
                ? "bg-yw-night-surface ring-white/15"
                : "bg-white ring-black/10"
            }`}
          >
            <header
              className={`flex items-center gap-2 border-b px-3 py-2.5 ${
                isNight
                  ? "border-white/10 bg-yw-night-surface"
                  : "border-[#E8ECF2] bg-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/yourwalk-mark.svg"
                alt=""
                width={32}
                height={24}
                className="h-7 w-auto shrink-0"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-base font-extrabold leading-none ${
                    isNight ? "text-white" : "text-yw-navy"
                  }`}
                >
                  YourWalk
                </p>
                <p
                  className={`mt-0.5 truncate text-[10px] font-medium ${
                    isNight ? "text-white/45" : "text-slate-500"
                  }`}
                >
                  {whenHint}
                </p>
              </div>
              <div className="w-[138px] shrink-0">
                <SegmentedPill
                  value={walkMode}
                  onChange={onWhenChange}
                  isNight={isNight}
                  ariaLabel="When are you walking?"
                  className="mb-0"
                  options={[
                    { id: "day", label: "Day", Icon: IconSun },
                    { id: "night", label: "Night", Icon: IconMoon },
                  ]}
                />
              </div>
            </header>

            <div className="relative min-h-0 flex-1">
              <FakeMap
                isNight={isNight}
                showRoutes={sheetMode === "results"}
                overlays={overlays}
                pickActive={pickMode !== "idle"}
                onMapTap={() => {
                  if (pickMode === "origin") {
                    setOrigin("Dropped pin, Berwick");
                    setPickMode("idle");
                  } else if (pickMode === "destination") {
                    setDestination("Dropped pin, Clyde North");
                    setPickMode("idle");
                  }
                }}
              />

              <button
                type="button"
                onClick={openLayers}
                className={`absolute left-3 top-3 z-[8] flex h-11 w-11 items-center justify-center rounded-full ring-1 ${
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
                  className={`absolute left-16 top-3 z-[8] max-w-[13.5rem] rounded-xl px-2.5 py-2 text-[11px] font-semibold leading-snug shadow-sm ${
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
                  className={`absolute left-3 top-16 z-[9] w-56 rounded-2xl p-2.5 ring-1 ${
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
                    {walkIntent === "outing"
                      ? " · soft bias for Loop"
                      : ""}
                  </p>
                  {OVERLAY_DEFS.map((def) => {
                    const on = overlays[def.id];
                    return (
                      <button
                        key={def.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setOverlays((prev) => ({
                            ...prev,
                            [def.id]: !prev[def.id],
                          }))
                        }
                        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[11px] font-semibold ${
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
                        <span className="min-w-0 flex-1">{def.label}</span>
                        {on ? (
                          <span className="text-[10px] font-bold text-yw-teal">
                            Showing
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {pickMode !== "idle" ? (
                <p className="absolute left-16 right-3 top-3 z-[8] rounded-xl bg-yw-blue px-3 py-2 text-[11px] font-semibold text-white">
                  Tap the map to set{" "}
                  {pickMode === "origin"
                    ? walkIntent === "outing"
                      ? "start"
                      : "from"
                    : "to"}
                </p>
              ) : null}

              <div
                className={`absolute inset-x-0 bottom-0 flex max-h-[72%] flex-col overflow-hidden rounded-t-2xl ${
                  isNight
                    ? "bg-yw-night-panel/95"
                    : "bg-white/95"
                }`}
              >
                <div className="flex shrink-0 flex-col items-center pt-2">
                  <div
                    className={`h-1 w-10 rounded-full ${
                      isNight ? "bg-white/25" : "bg-slate-300"
                    }`}
                  />
                </div>

                <div
                  className={`yw-sheet-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2 ${
                    isNight ? "yw-sheet-scroll-night" : ""
                  }`}
                >
                  {sheetMode === "plan" ? (
                    <PlanSheet
                      isNight={isNight}
                      showIntro={showIntro}
                      onDismissIntro={dismissIntro}
                      walkIntent={walkIntent}
                      setWalkIntent={setWalkIntent}
                      outingMinutes={outingMinutes}
                      setOutingMinutes={setOutingMinutes}
                      origin={origin}
                      destination={destination}
                      setOrigin={setOrigin}
                      setDestination={setDestination}
                      geoBusy={geoBusy}
                      onLocate={useMyLocation}
                      pickMode={pickMode}
                      onPickOrigin={() =>
                        setPickMode((m) => (m === "origin" ? "idle" : "origin"))
                      }
                      onPickDestination={() =>
                        setPickMode((m) =>
                          m === "destination" ? "idle" : "destination",
                        )
                      }
                      accessibility={accessibility}
                      setAccessibility={setAccessibility}
                      shadeHeat={shadeHeat}
                      afterDark={afterDark}
                      setShadeHeat={setShadeHeat}
                      setAfterDark={setAfterDark}
                      preferAway={preferAway}
                      setPreferAway={setPreferAway}
                    />
                  ) : (
                    <ResultsSheet
                      isNight={isNight}
                      walkIntent={walkIntent}
                      origin={origin}
                      destination={destination}
                      outingMinutes={outingMinutes}
                      routes={routes}
                      selectedId={selectedId}
                      setSelectedId={setSelectedId}
                      onEdit={() => setSheetMode("plan")}
                      onClear={() => {
                        setOrigin("");
                        setDestination("");
                        setSheetMode("plan");
                      }}
                    />
                  )}
                </div>

                {sheetMode === "plan" ? (
                  <div
                    className={`shrink-0 border-t px-4 py-3 ${
                      isNight ? "border-white/10" : "border-[#E8ECF2]"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!canFind}
                      onClick={findWalk}
                      className={`flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white disabled:opacity-40 ${
                        isNight ? "bg-yw-blue" : "bg-yw-navy"
                      }`}
                    >
                      {walkIntent === "outing"
                        ? "Find my loop"
                        : "Find my route"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FakeMap({
  isNight,
  showRoutes,
  overlays,
  pickActive,
  onMapTap,
}: {
  isNight: boolean;
  showRoutes: boolean;
  overlays: Record<OverlayId, boolean>;
  pickActive: boolean;
  onMapTap: () => void;
}) {
  return (
    <div className="absolute inset-0">
      <button
        type="button"
        onClick={onMapTap}
        className={`absolute inset-0 block w-full ${
          isNight ? "bg-[#1a1c33]" : "bg-[#d8e4d2]"
        } ${pickActive ? "cursor-crosshair" : "cursor-default"}`}
        aria-label={pickActive ? "Tap to drop a pin" : "Map"}
      >
        <svg className="h-full w-full" viewBox="0 0 375 400" preserveAspectRatio="xMidYMid slice">
          <path
            d="M0 80 H375 M0 160 H375 M0 240 H375 M40 0 V400 M120 0 V400 M220 0 V400 M300 0 V400"
            stroke={isNight ? "rgba(255,255,255,0.06)" : "rgba(41,41,132,0.08)"}
            strokeWidth="10"
            fill="none"
          />
          {showRoutes ? (
            <>
              <path
                d="M70 310 C 90 220, 140 200, 200 160 S 280 90, 310 70"
                fill="none"
                stroke="#00AAA6"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="2 10"
              />
              <path
                d="M70 310 C 110 280, 180 250, 240 180 S 290 110, 310 70"
                fill="none"
                stroke="#27AAE1"
                strokeWidth="3.5"
                strokeLinecap="round"
                opacity="0.45"
              />
            </>
          ) : null}
          <circle cx="70" cy="310" r="6" fill="#009444" />
          <circle cx="310" cy="70" r="6" fill="#EC008C" />
        </svg>
      </button>
      <div className="pointer-events-none absolute inset-0">
        {AMENITY_MARKS.map((mark) =>
          overlays[mark.id] ? (
            <span
              key={mark.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-sm"
              style={{ left: mark.x, top: mark.y }}
            >
              <RingedAmenityIcon id={mark.id} />
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function PlanSheet(props: {
  isNight: boolean;
  showIntro: boolean;
  onDismissIntro: () => void;
  walkIntent: WalkIntent;
  setWalkIntent: (v: WalkIntent) => void;
  outingMinutes: number;
  setOutingMinutes: (v: number) => void;
  origin: string;
  destination: string;
  setOrigin: (v: string) => void;
  setDestination: (v: string) => void;
  geoBusy: boolean;
  onLocate: () => void;
  pickMode: "idle" | "origin" | "destination";
  onPickOrigin: () => void;
  onPickDestination: () => void;
  accessibility: number;
  setAccessibility: (v: number) => void;
  shadeHeat: number;
  afterDark: number;
  setShadeHeat: (v: number) => void;
  setAfterDark: (v: number) => void;
  preferAway: boolean;
  setPreferAway: (v: boolean) => void;
}) {
  const { isNight } = props;

  return (
    <div className="yw-sheet-panel">
      <h2
        className={`mb-1.5 text-lg font-extrabold tracking-tight ${
          isNight ? "text-white" : "text-yw-navy"
        }`}
      >
        Find your walk
      </h2>
      {props.showIntro ? (
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
            Casey footpaths, ranked for shade, smoother paths, or lighting
            after dark. Not just the shortest way.
          </p>
          <button
            type="button"
            onClick={props.onDismissIntro}
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

      <SectionLabel isNight={isNight}>Type of walk</SectionLabel>
      <SegmentedPill
        value={props.walkIntent}
        onChange={props.setWalkIntent}
        isNight={isNight}
        ariaLabel="Type of walk"
        className="mb-3"
        options={[
          { id: "trip", label: "A to B", Icon: IconTrip },
          { id: "outing", label: "Loop", Icon: IconOuting },
        ]}
      />

      {props.walkIntent === "trip" ? (
        <div className="mb-4 space-y-2">
          <MockPlace
            label="From"
            placeholder="Park, school, suburb, or street"
            dot="#009444"
            isNight={isNight}
            value={props.origin}
            onChange={props.setOrigin}
            onLocate={props.onLocate}
            geoBusy={props.geoBusy}
            showLocate
            pickActive={props.pickMode === "origin"}
            onPickMap={props.onPickOrigin}
          />
          <MockPlace
            label="To"
            placeholder="Park, school, suburb, or street"
            dot="#EC008C"
            isNight={isNight}
            value={props.destination}
            onChange={props.setDestination}
            pickActive={props.pickMode === "destination"}
            onPickMap={props.onPickDestination}
          />
        </div>
      ) : (
        <div className="mb-4 space-y-2">
          <MockPlace
            label="Start"
            placeholder="Park, school, suburb, or street"
            dot="#009444"
            isNight={isNight}
            value={props.origin}
            onChange={props.setOrigin}
            onLocate={props.onLocate}
            geoBusy={props.geoBusy}
            showLocate
            pickActive={props.pickMode === "origin"}
            onPickMap={props.onPickOrigin}
          />
          <p
            className={`text-[12px] font-semibold ${
              isNight ? "text-white/60" : "text-slate-600"
            }`}
          >
            About {props.outingMinutes} minutes
          </p>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={props.outingMinutes}
            onChange={(e) => props.setOutingMinutes(Number(e.target.value))}
            className="yw-pref-range"
            aria-label="Loop duration"
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

      <SectionLabel isNight={isNight}>What matters most</SectionLabel>
      <MockPref
        title="Accessible footpaths"
        description={prefSliderDescription("accessibility", props.accessibility)}
        value={props.accessibility}
        isNight={isNight}
        accent="#27AAE1"
        tone="blue"
        onChange={props.setAccessibility}
        headerAccessory={
          <label
            className={`flex shrink-0 cursor-pointer items-start gap-1 rounded-lg px-1 py-0.5 ${
              props.preferAway
                ? isNight
                  ? "bg-yw-blue/20"
                  : "bg-[color-mix(in_srgb,var(--yw-blue)_14%,white)]"
                : ""
            }`}
          >
            <input
              type="checkbox"
              className="yw-check yw-check-sm mt-0.5"
              checked={props.preferAway}
              onChange={(e) => props.setPreferAway(e.target.checked)}
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
        <MockPref
          title="Lighting after dark"
          description={prefSliderDescription("afterDark", props.afterDark)}
          value={props.afterDark}
          isNight={isNight}
          accent="#FFCB1F"
          tone="amber"
          onChange={props.setAfterDark}
        />
      ) : (
        <MockPref
          title="Heat & Shade"
          description={prefSliderDescription("shadeHeat", props.shadeHeat)}
          value={props.shadeHeat}
          isNight={isNight}
          accent="#8DC63F"
          tone="lime"
          onChange={props.setShadeHeat}
        />
      )}
    </div>
  );
}

function ResultsSheet(props: {
  isNight: boolean;
  walkIntent: WalkIntent;
  origin: string;
  destination: string;
  outingMinutes: number;
  routes: MockRoute[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  onEdit: () => void;
  onClear: () => void;
}) {
  const { isNight } = props;
  const summary =
    props.walkIntent === "outing"
      ? `${props.origin || "Start"} · ~${props.outingMinutes} min loop`
      : `${props.origin || "From"} → ${props.destination || "To"}`;

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{summary}</p>
          <p
            className={`text-[11px] ${
              isNight ? "text-white/55" : "text-slate-600"
            }`}
          >
            {props.routes.length} options · tap a walk to highlight it on the map
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconAction
            label="Edit walk"
            isNight={isNight}
            onClick={props.onEdit}
          >
            <MdEdit className="h-5 w-5" />
          </IconAction>
          <IconAction
            label="Clear walk"
            isNight={isNight}
            onClick={props.onClear}
          >
            <MdClose className="h-5 w-5" />
          </IconAction>
        </div>
      </div>

      <ul className="space-y-2.5">
        {props.routes.map((r, i) => {
          const active = r.id === props.selectedId;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => props.setSelectedId(r.id)}
                className={`relative w-full rounded-2xl border px-3.5 py-3 text-left ${
                  active
                    ? "border-[color-mix(in_srgb,var(--yw-teal)_55%,transparent)] bg-[color-mix(in_srgb,var(--yw-teal)_10%,transparent)]"
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
                        style={{
                          background: i === 0 ? "#00AAA6" : "#27AAE1",
                        }}
                      />
                      {r.label}
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        isNight ? "text-white/60" : "text-slate-600"
                      }`}
                    >
                      <strong>{r.minutes} min</strong>
                      <span className="mx-1.5 opacity-30">·</span>
                      <strong>{r.km}</strong>
                    </p>
                  </div>
                  <div
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-yw-teal text-yw-teal"
                  >
                    <span className="text-base font-extrabold leading-none">
                      {r.match}
                    </span>
                    <span className="text-[8px] font-semibold opacity-70">
                      match
                    </span>
                  </div>
                </div>

                <div
                  className={`mt-2.5 border-t pt-2.5 ${
                    active
                      ? "border-[color-mix(in_srgb,var(--yw-teal)_25%,transparent)]"
                      : isNight
                        ? "border-white/10"
                        : "border-[#E8ECF2]"
                  }`}
                >
                    <p
                      className={`text-[11px] leading-snug ${
                        isNight ? "text-white/70" : "text-slate-700"
                      }`}
                    >
                      {r.why}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--yw-blue)_12%,white)] px-2 py-0.5 text-[10px] font-semibold text-[#0B5F8A]">
                        Footpaths {r.footpaths}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isNight
                            ? "bg-[color-mix(in_srgb,var(--yw-amber)_14%,transparent)] text-yw-amber"
                            : "bg-[color-mix(in_srgb,var(--yw-lime)_14%,white)] text-[#2D6A1A]"
                        }`}
                      >
                        {isNight ? "Lighting" : "Heat & Shade"} {r.comfort}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-[10px] leading-snug ${
                        isNight ? "text-yw-lime" : "text-[#2D6A1A]"
                      }`}
                    >
                      {r.amenities}
                    </p>
                    {r.coverage ? (
                      <p
                        className={`mt-1 text-[10px] ${
                          isNight ? "text-amber-200" : "text-amber-900"
                        }`}
                      >
                        {r.coverage}
                      </p>
                    ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SectionLabel({
  children,
  isNight,
}: {
  children: string;
  isNight: boolean;
}) {
  return (
    <p
      className={`mb-2 text-[13px] font-semibold ${
        isNight ? "text-white/70" : "text-slate-700"
      }`}
    >
      {children}
    </p>
  );
}

function MockPlace({
  label,
  placeholder,
  dot,
  isNight,
  value,
  onChange,
  onLocate,
  geoBusy,
  showLocate,
  pickActive,
  onPickMap,
}: {
  label: string;
  placeholder: string;
  dot: string;
  isNight: boolean;
  value: string;
  onChange: (v: string) => void;
  onLocate?: () => void;
  geoBusy?: boolean;
  showLocate?: boolean;
  pickActive?: boolean;
  onPickMap?: () => void;
}) {
  const actionClass = (on: boolean) =>
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
      on
        ? "bg-yw-blue text-white"
        : isNight
          ? "bg-white/10 text-white/80"
          : "bg-yw-day-surface text-yw-navy"
    }`;

  return (
    <div
      className={`flex min-h-12 items-center gap-2 rounded-2xl px-3 py-2 ring-1 ${
        pickActive
          ? "ring-yw-blue"
          : isNight
            ? "bg-yw-night-surface ring-white/12"
            : "bg-white ring-[#E8ECF2]"
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: dot }}
      />
      <div className="min-w-0 flex-1">
        <div
          className={`text-[10px] font-semibold uppercase tracking-wide ${
            isNight ? "text-white/45" : "text-slate-500"
          }`}
        >
          {label}
        </div>
        <input
          className={`w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal ${
            isNight ? "placeholder:text-white/35" : "placeholder:text-slate-400"
          }`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {showLocate ? (
        <button
          type="button"
          onClick={onLocate}
          disabled={geoBusy}
          className={actionClass(false)}
          aria-label="Use my location"
        >
          {geoBusy ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-yw-teal border-t-transparent" />
          ) : (
            <MdMyLocation className="h-5 w-5" />
          )}
        </button>
      ) : null}
      {onPickMap ? (
        <button
          type="button"
          onClick={onPickMap}
          className={actionClass(Boolean(pickActive))}
          aria-label="Drop a pin on the map"
          title="Drop pin"
        >
          <MdPlace className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

function MockPref({
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
  headerAccessory?: ReactNode;
}) {
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
    amber: isNight
      ? "text-[color-mix(in_srgb,var(--yw-amber)_70%,transparent)]"
      : "text-[#A07800]",
    blue: isNight
      ? "text-[color-mix(in_srgb,var(--yw-blue)_70%,transparent)]"
      : "text-[#146B96]",
    lime: isNight
      ? "text-[color-mix(in_srgb,var(--yw-lime)_70%,transparent)]"
      : "text-[#3A7A22]",
  };
  return (
    <div
      className={`mb-1.5 rounded-xl border px-3 py-2 ${shells[tone]}`}
      style={{ "--yw-pref-accent": accent } as CSSProperties}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`text-[13px] font-bold ${titles[tone]}`}>
            {title}
          </span>
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
        min={10}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="yw-pref-range"
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

function IconAction({
  label,
  isNight,
  onClick,
  children,
}: {
  label: string;
  isNight: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
        isNight ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
