"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { MdExpandLess, MdExpandMore } from "react-icons/md";

import { IconTune } from "@/components/resident/icons";

/**
 * Google Maps-style Options: tuck secondary Find settings away from
 * the importance sliders. Both prefers live here so the chrome matches.
 */
export function WalkOptions({
  isNight,
  preferAway,
  preferFlatter,
  onPreferAway,
  onPreferFlatter,
}: {
  isNight: boolean;
  preferAway: boolean;
  preferFlatter: boolean;
  onPreferAway: (next: boolean) => void;
  onPreferFlatter: (next: boolean) => void;
}) {
  const panelId = useId();
  const anyOn = preferAway || preferFlatter;
  const [open, setOpen] = useState(anyOn);
  const wasOn = useRef(anyOn);

  useEffect(() => {
    if (anyOn && !wasOn.current) setOpen(true);
    wasOn.current = anyOn;
  }, [anyOn]);

  const summary = [
    preferAway ? "Away from roads" : null,
    preferFlatter ? "Flatter walks" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-1.5">
      <button
        type="button"
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left ${
          isNight ? "text-white/80" : "text-[#0B5F8A]"
        }`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <IconTune className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold">Options</span>
          {summary ? (
            <span
              className={`block truncate text-[10px] font-medium ${
                isNight ? "text-white/50" : "text-slate-600"
              }`}
            >
              {summary}
            </span>
          ) : (
            <span
              className={`block text-[10px] font-medium ${
                isNight ? "text-white/45" : "text-slate-500"
              }`}
            >
              Away from roads, flatter walks
            </span>
          )}
        </span>
        {open ? (
          <MdExpandLess className="h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <MdExpandMore className="h-5 w-5 shrink-0" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={panelId} className="space-y-1 px-1 pb-1">
          <PreferCheck
            label="Prefer away from roads"
            title="When you Find, include a walk that stays on parks and paths even if it takes longer (up to about 1.6×). Does not change corridor score pills."
            checked={preferAway}
            isNight={isNight}
            onChange={onPreferAway}
          />
          <PreferCheck
            label="Prefer flatter walks"
            title="When you Find, rank gentler hills higher among the walks we find. Approximate from Mapbox Terrain. Does not hide steep options or change Footpaths scores."
            checked={preferFlatter}
            isNight={isNight}
            onChange={onPreferFlatter}
          />
          <p
            className={`px-1 pt-0.5 text-[10px] leading-snug ${
              isNight ? "text-white/40" : "text-slate-500"
            }`}
          >
            Tap Find after you change these. Neither option changes the
            Footpaths or Heat & Shade scores.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function walkOptionsResultsHint(
  preferAway: boolean,
  preferFlatter: boolean,
): string | null {
  const bits = [
    preferAway ? "away from roads" : null,
    preferFlatter ? "flatter walks" : null,
  ].filter(Boolean);
  if (!bits.length) return null;
  return `Options: ${bits.join(" · ")}. Edit walk to change, then Find again.`;
}

function PreferCheck({
  label,
  title,
  checked,
  isNight,
  onChange,
}: {
  label: string;
  title: string;
  checked: boolean;
  isNight: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-0.5 ${
        checked
          ? isNight
            ? "bg-yw-blue/20"
            : "bg-[color-mix(in_srgb,var(--yw-blue)_14%,white)]"
          : ""
      }`}
      title={title}
      style={
        {
          "--yw-check-accent": "#0B5F8A",
          "--yw-check-border": isNight
            ? "rgba(255,255,255,0.35)"
            : "#7EB8D4",
          "--yw-check-bg": isNight ? "rgba(255,255,255,0.06)" : "#fff",
        } as CSSProperties
      }
    >
      <input
        type="checkbox"
        className="yw-check yw-check-sm"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span
        className={`text-[10px] font-semibold leading-tight ${
          isNight ? "text-white/80" : "text-[#0B5F8A]"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
