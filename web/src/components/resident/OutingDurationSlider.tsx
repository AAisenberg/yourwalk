"use client";

import type { CSSProperties } from "react";

import {
  OUTING_DURATION_SLACK_MIN,
  OUTING_DURATION_STEP,
  OUTING_MAX_MINUTES,
  OUTING_MIN_MINUTES,
} from "@/lib/routing/planOuting";

type Props = {
  value: number;
  onChange: (minutes: number) => void;
  isNight: boolean;
};

function pctAlong(minutes: number): number {
  return (
    ((minutes - OUTING_MIN_MINUTES) /
      (OUTING_MAX_MINUTES - OUTING_MIN_MINUTES)) *
    100
  );
}

/**
 * Around-here duration: thumb = ask; soft gradient band shows the ±5 min
 * window we search within.
 */
export function OutingDurationSlider({ value, onChange, isNight }: Props) {
  const bandLo = Math.max(
    OUTING_MIN_MINUTES,
    value - OUTING_DURATION_SLACK_MIN,
  );
  const bandHi = Math.min(
    OUTING_MAX_MINUTES,
    value + OUTING_DURATION_SLACK_MIN,
  );
  const left = pctAlong(bandLo);
  const width = Math.max(2, pctAlong(bandHi) - left);

  return (
    <div
      className="space-y-2"
      style={
        {
          "--outing-thumb-ring": isNight
            ? "var(--yw-night-panel)"
            : "#ffffff",
        } as CSSProperties
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={`text-[11px] font-medium ${
            isNight ? "text-white/55" : "text-slate-600"
          }`}
        >
          About how long?
        </p>
        <p className="text-sm font-extrabold tabular-nums text-yw-teal">
          ~{value} min
        </p>
      </div>

      {/* Fixed 28px rail so track + thumb share one vertical centre */}
      <div className="relative h-7 px-0.5">
        <div
          className={`absolute inset-x-0.5 top-1/2 h-2 -translate-y-1/2 rounded-full ${
            isNight ? "bg-white/12" : "bg-slate-200"
          }`}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0.5 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full"
          aria-hidden
        >
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              background: isNight
                ? "linear-gradient(90deg, transparent 0%, rgba(0,170,166,0.25) 12%, rgba(0,170,166,0.6) 50%, rgba(0,170,166,0.25) 88%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, rgba(0,170,166,0.2) 12%, rgba(0,170,166,0.48) 50%, rgba(0,170,166,0.2) 88%, transparent 100%)",
            }}
          />
        </div>
        <input
          type="range"
          min={OUTING_MIN_MINUTES}
          max={OUTING_MAX_MINUTES}
          step={OUTING_DURATION_STEP}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Walk duration in minutes"
          aria-valuetext={`About ${value} minutes. Looking for walks between ${bandLo} and ${bandHi} minutes.`}
          className="outing-duration-range absolute inset-0 z-10 w-full cursor-pointer"
        />
      </div>

      <div
        className={`flex justify-between text-[9px] tabular-nums ${
          isNight ? "text-white/45" : "text-slate-500"
        }`}
      >
        <span>{OUTING_MIN_MINUTES} min</span>
        <span
          className={`font-medium ${
            isNight ? "text-white/65" : "text-slate-600"
          }`}
        >
          Looking ~{bandLo}–{bandHi} min
        </span>
        <span>{OUTING_MAX_MINUTES} min</span>
      </div>
    </div>
  );
}
