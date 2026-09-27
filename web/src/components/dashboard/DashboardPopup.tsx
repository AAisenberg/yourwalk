"use client";

import { useEffect, useState } from "react";
import { MdCheck, MdClose, MdContentCopy } from "react-icons/md";

import {
  FOOTPATHS_WEIGHT,
  STREAM_WEIGHT,
  round1,
  streamName,
  viewName,
  type AreaUnit,
  type CaseySummary,
  type IndexMode,
  type ScoreView,
} from "@/lib/dashboard/areas";
import { DASHBOARD_LAYERS, type DashboardLayerId } from "@/lib/dashboard/layers";
import { overlayPopupCopy, type OverlayId } from "@/lib/overlays";

export type PopupInfo =
  | { kind: "segment"; props: GeoJSON.GeoJsonProperties; lngLat: [number, number] }
  | { kind: "layer"; layerId: DashboardLayerId; props: GeoJSON.GeoJsonProperties; lngLat: [number, number] };

const AMENITIES: DashboardLayerId[] = ["fountains", "benches", "toilets", "dog_bags"];

const PART_COLOR = {
  Footpaths: "#27AAE1",
  "Heat and shade": "#F6871F",
  "Night lighting": "#E0A800",
} as const;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 0–100 stored score to 0–10 shown. */
function to10(v: number | null): number | null {
  return round1(v == null ? null : v / 10);
}

function fmt(v: number | null): string {
  return v == null ? "–" : v.toFixed(1);
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function Shell({
  tag,
  swatch,
  group,
  title,
  onClose,
  children,
  footer,
}: {
  tag: string;
  swatch: string;
  group: string | null;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="yw-dash-popup-body w-[17.5rem] text-slate-900" role="dialog" aria-label={title}>
      <div className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: swatch }} />
            <span className="truncate">{tag}</span>
            {group ? (
              <span className="shrink-0 rounded bg-yw-day-surface px-1 py-px text-[10px] font-bold normal-case tracking-normal text-slate-600 ring-1 ring-[#E8ECF2]">
                {group}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[14px] font-extrabold leading-snug text-yw-navy">{title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-yw-day-surface"
        >
          <MdClose className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="px-3 pb-3 pt-2">{children}</div>
      <div className="border-t border-[#E8ECF2] bg-yw-day-surface/60 px-3 py-2 text-[11px] text-slate-500">{footer}</div>
    </div>
  );
}

function PartBar({
  label,
  value,
  casey,
  weight,
  dim,
}: {
  label: keyof typeof PART_COLOR;
  value: number | null;
  casey: number | null;
  weight: number;
  dim: boolean;
}) {
  const color = PART_COLOR[label];
  const pct = Math.max(0, Math.min(100, (value ?? 0) * 10));
  const tick = casey == null ? null : Math.max(0, Math.min(100, casey * 10));
  return (
    <div className={`mt-1.5 ${dim ? "opacity-50" : ""}`}>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="tabular-nums font-bold text-slate-800">
          {fmt(value)}
          <span className="font-medium text-slate-500"> /10 · {Math.round(weight * 100)}%</span>
        </span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-yw-day-surface ring-1 ring-[#E8ECF2]" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
        {tick != null ? (
          <span className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-slate-700" style={{ left: `calc(${tick}% - 1px)` }} />
        ) : null}
      </div>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(id).then(() => setCopied(true));
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-yw-navy ring-1 ring-[#E8ECF2] hover:bg-white"
      aria-label={copied ? "Segment ID copied" : `Copy segment ID ${id}`}
    >
      {copied ? <MdCheck className="h-3.5 w-3.5" aria-hidden /> : <MdContentCopy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy ID"}
    </button>
  );
}

function SegmentPopup({
  props: p,
  mode,
  view,
  unit,
  casey,
  spec,
  selectedArea,
  onClose,
  onShowArea,
}: {
  props: GeoJSON.GeoJsonProperties;
  mode: IndexMode;
  view: ScoreView;
  unit: AreaUnit;
  casey: CaseySummary;
  spec: string;
  selectedArea: string | null;
  onClose: () => void;
  onShowArea: (name: string) => void;
}) {
  const index100 = num(mode === "day" ? p?.day_index_score : p?.night_index_score);
  const foot100 = num(p?.accessibility_score);
  const stream100 = num(mode === "day" ? p?.heat_shade_score : p?.lighting_after_dark_score);
  const caseyStream = mode === "day" ? casey.heatShade : casey.nightLighting;
  const headline = view === "footpaths" ? to10(foot100) : view === "stream" ? to10(stream100) : to10(index100);
  const headlineCasey =
    view === "footpaths"
      ? to10(casey.footpaths)
      : view === "stream"
        ? to10(caseyStream)
        : mode === "day"
          ? casey.day
          : casey.night;
  const suburb = text(p?.suburb);
  const ward = text(p?.ward);
  const street = text(p?.street_name);
  const area = unit === "ward" ? ward : suburb;
  const placeLine = [street ? suburb : null, ward ? `${ward} ward` : null].filter(Boolean).join(" · ");
  const kind = p?.walk_path_class === "shared_use" ? "Shared path" : "Footpath";
  const conf = text(mode === "day" ? p?.confidence_day : p?.confidence_night);
  const id = p?.segment_id != null ? String(p.segment_id) : null;
  const label = view === "index" ? viewName(mode, view) : `${viewName(mode, view)} only`;

  return (
    <Shell
      tag={kind}
      swatch="#292984"
      group={null}
      title={street ?? (suburb ? `${kind} in ${suburb}` : kind)}
      onClose={onClose}
      footer={
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">
            {id ? `T1EAM ${id}` : "T1EAM"} · scores {spec}
          </span>
          {id ? <CopyId id={id} /> : null}
        </span>
      }
    >
      {placeLine ? <p className="-mt-1 mb-2 text-[12px] text-slate-500">{placeLine}</p> : null}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">{label}</p>
          <p className="text-[11px] text-slate-500">Out of 10 · higher is better</p>
        </div>
        <div className="text-right">
          <p className="tabular-nums">
            <span className="text-[26px] font-extrabold leading-none tracking-tight text-yw-navy">{fmt(headline)}</span>
            <span className="text-[12px] font-semibold text-slate-500"> /10</span>
          </p>
          <p className="text-[11px] text-slate-500">Casey {fmt(headlineCasey)}</p>
        </div>
      </div>
      <PartBar
        label="Footpaths"
        value={to10(foot100)}
        casey={to10(casey.footpaths)}
        weight={FOOTPATHS_WEIGHT}
        dim={view === "stream"}
      />
      <PartBar
        label={streamName(mode)}
        value={to10(stream100)}
        casey={to10(caseyStream)}
        weight={STREAM_WEIGHT}
        dim={view === "footpaths"}
      />
      {conf ? (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {conf === "high" ? "Higher" : conf === "low" ? "Lower" : "Medium"} confidence for this path. Crossings and
          kerb ramps are not in the data yet.
        </p>
      ) : null}
      {area && area !== selectedArea ? (
        <button
          type="button"
          onClick={() => onShowArea(area)}
          className="mt-2.5 w-full rounded-md bg-yw-navy px-3 py-2 text-[12px] font-bold text-white hover:bg-yw-navy/90"
        >
          Show {area}
          {unit === "ward" ? " ward" : ""}
        </button>
      ) : null}
    </Shell>
  );
}

function LayerPopup({
  layerId,
  props: p,
  onClose,
}: {
  layerId: DashboardLayerId;
  props: GeoJSON.GeoJsonProperties;
  onClose: () => void;
}) {
  const def = DASHBOARD_LAYERS.find((d) => d.id === layerId);
  if (!def) return null;
  const copy = AMENITIES.includes(layerId)
    ? overlayPopupCopy(layerId as OverlayId, p)
    : def.popup(p);
  const facts = copy.lines;
  return (
    <Shell
      tag={def.label}
      swatch={def.swatch}
      group={def.group === "score" ? "In the score" : "Context"}
      title={copy.title}
      onClose={onClose}
      footer={def.note}
    >
      {facts.length ? (
        <ul className="space-y-0.5 text-[12px] leading-snug text-slate-700">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-slate-500">No further details recorded.</p>
      )}
    </Shell>
  );
}

/** YourWalk map popup for scored paths and every Layers feature. */
export function DashboardPopup({
  info,
  mode,
  view,
  unit,
  casey,
  spec,
  selectedArea,
  onClose,
  onShowArea,
}: {
  info: PopupInfo;
  mode: IndexMode;
  view: ScoreView;
  unit: AreaUnit;
  casey: CaseySummary;
  spec: string;
  /** The area already selected in the card; its "Show" button is hidden. */
  selectedArea: string | null;
  onClose: () => void;
  onShowArea: (name: string) => void;
}) {
  if (info.kind === "segment") {
    return (
      <SegmentPopup
        props={info.props}
        mode={mode}
        view={view}
        unit={unit}
        casey={casey}
        spec={spec}
        selectedArea={selectedArea}
        onClose={onClose}
        onShowArea={onShowArea}
      />
    );
  }
  return <LayerPopup layerId={info.layerId} props={info.props} onClose={onClose} />;
}
