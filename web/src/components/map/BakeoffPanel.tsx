"use client";

import { useEffect, useMemo, useState } from "react";

type RouteEntry = {
  geometry: GeoJSON.LineString;
  distance_m: number;
  duration_s: number;
  day_display: number | null;
  night_display: number | null;
  accessibility_display: number | null;
  coverage_ratio: number;
  confidence: string;
  strategy: string;
  detour_vs_mapbox_shortest?: number;
};

type OdCompare = {
  id: string;
  label: string;
  why?: string;
  verified?: boolean;
  origin?: [number, number];
  destination?: [number, number];
  day: { mapbox?: RouteEntry[]; challenger?: RouteEntry };
  night: { mapbox?: RouteEntry[]; challenger?: RouteEntry };
};

type ComparePayload = {
  reasoning: { headline: string; evidence: string[] };
  ods: OdCompare[];
  generated_from?: { day: string; night: string };
};

export type BakeoffSelection = {
  odId: string;
  mode: "day" | "night";
  showMapbox: boolean;
  showChallenger: boolean;
  features: GeoJSON.Feature[];
  origin?: [number, number];
  destination?: [number, number];
};

type Props = {
  onSelection: (sel: BakeoffSelection | null) => void;
};

function fmtKm(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function fmtMin(s: number) {
  return `${(s / 60).toFixed(1)} min`;
}

export function BakeoffPanel({ onSelection }: Props) {
  const [data, setData] = useState<ComparePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [odId, setOdId] = useState<string>("OD-01");
  const [mode, setMode] = useState<"day" | "night">("day");
  const [showMapbox, setShowMapbox] = useState(true);
  const [showChallenger, setShowChallenger] = useState(true);
  const [openWhy, setOpenWhy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/bakeoff/compare.json")
      .then((r) => {
        if (!r.ok) throw new Error(`compare.json ${r.status}`);
        return r.json();
      })
      .then((j: ComparePayload) => {
        if (cancelled) return;
        setData(j);
        if (j.ods[0]) setOdId(j.ods[0].id);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load bake-off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const od = useMemo(
    () => data?.ods.find((o) => o.id === odId) ?? null,
    [data, odId],
  );

  useEffect(() => {
    if (!od) {
      onSelection(null);
      return;
    }
    const bucket = mode === "day" ? od.day : od.night;
    const features: GeoJSON.Feature[] = [];
    if (showMapbox) {
      for (const [i, r] of (bucket.mapbox ?? []).entries()) {
        if (!r?.geometry) continue;
        features.push({
          type: "Feature",
          properties: {
            engine: "mapbox",
            rank: i,
            color: i === 0 ? "#38bdf8" : "#7dd3fc",
            label: `Mapbox ${i + 1}`,
            ...r,
          },
          geometry: r.geometry,
        });
      }
    }
    if (showChallenger && bucket.challenger?.geometry) {
      features.push({
        type: "Feature",
        properties: {
          engine: "challenger",
          rank: 0,
          color: "#c084fc",
          label: "Score-aware",
          ...bucket.challenger,
        },
        geometry: bucket.challenger.geometry,
      });
    }
    onSelection({
      odId: od.id,
      mode,
      showMapbox,
      showChallenger,
      features,
      origin: od.origin,
      destination: od.destination,
    });
  }, [od, mode, showMapbox, showChallenger, onSelection]);

  if (error) {
    return (
      <div className="rounded border border-amber-700/50 bg-amber-950/40 p-2 text-[11px] text-amber-200">
        Bake-off data missing. Run{" "}
        <code className="text-amber-100">python bakeoff/export_lab_compare.py</code>
        . {error}
      </div>
    );
  }
  if (!data || !od) {
    return (
      <p className="text-[11px] text-slate-500">Loading bake-off compare…</p>
    );
  }

  const bucket = mode === "day" ? od.day : od.night;
  const scoreKey = mode === "day" ? "day_display" : "night_display";
  const mbBest = (bucket.mapbox ?? []).reduce<RouteEntry | null>((best, r) => {
    if (!best) return r;
    const a = r[scoreKey] ?? -Infinity;
    const b = best[scoreKey] ?? -Infinity;
    return a > b ? r : best;
  }, null);
  const ch = bucket.challenger;

  return (
    <div className="space-y-2 text-xs text-slate-200">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-100">L2c bake-off</span>
        <button
          type="button"
          className="text-[10px] text-slate-400 underline"
          onClick={() => setOpenWhy((v) => !v)}
        >
          {openWhy ? "Hide why" : "Why day≠night?"}
        </button>
      </div>

      {openWhy ? (
        <div className="rounded border border-slate-700 bg-slate-950/60 p-2 text-[10px] leading-snug text-slate-400">
          <p className="text-slate-300">{data.reasoning.headline}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-3">
            {data.reasoning.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="block text-[11px] text-slate-400">
        OD pair
        <select
          className="mt-0.5 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
          value={odId}
          onChange={(e) => setOdId(e.target.value)}
        >
          {data.ods.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id} · {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-1">
        {(["day", "night"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`flex-1 rounded border px-2 py-1 text-[11px] capitalize ${
              mode === m
                ? "border-violet-400 bg-violet-950 text-violet-100"
                : "border-slate-600 bg-slate-900 text-slate-300"
            }`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex gap-3 text-[11px]">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showMapbox}
            onChange={(e) => setShowMapbox(e.target.checked)}
          />
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          Mapbox
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showChallenger}
            onChange={(e) => setShowChallenger(e.target.checked)}
          />
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
          Score-aware
        </label>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded border border-sky-800/50 bg-sky-950/30 p-1.5">
          <div className="font-medium text-sky-200">Mapbox best</div>
          {mbBest ? (
            <>
              <div>
                {fmtKm(mbBest.distance_m)} · {fmtMin(mbBest.duration_s)}
              </div>
              <div>
                {mode} {(mbBest[scoreKey] as number | null)?.toFixed(2) ?? "—"}
              </div>
            </>
          ) : (
            <div className="text-slate-500">—</div>
          )}
        </div>
        <div className="rounded border border-violet-800/50 bg-violet-950/30 p-1.5">
          <div className="font-medium text-violet-200">Score-aware</div>
          {ch ? (
            <>
              <div>
                {fmtKm(ch.distance_m)} · {fmtMin(ch.duration_s)}
              </div>
              <div>
                {mode} {(ch[scoreKey] as number | null)?.toFixed(2) ?? "—"}
                {ch.detour_vs_mapbox_shortest != null
                  ? ` · ×${ch.detour_vs_mapbox_shortest}`
                  : ""}
              </div>
            </>
          ) : (
            <div className="text-slate-500">—</div>
          )}
        </div>
      </div>

      {od.why ? (
        <p className="text-[10px] text-slate-500">{od.why}</p>
      ) : null}
    </div>
  );
}
