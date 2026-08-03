"use client";

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
  const thumb = pctAlong(value);

  return (
    <div
      className="space-y-2"
      style={
        {
          "--outing-thumb-ring": isNight ? "#0B0C1A" : "#ffffff",
        } as React.CSSProperties
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={`text-[10px] ${
            isNight ? "text-white/40" : "text-slate-400"
          }`}
        >
          About how long?
        </p>
        <p
          className={`text-sm font-extrabold tabular-nums ${
            isNight ? "text-[#00AAA6]" : "text-[#008f8c]"
          }`}
        >
          ~{value} min
        </p>
      </div>

      <div className="relative px-0.5 py-1">
        <div
          className={`absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full ${
            isNight ? "bg-white/10" : "bg-slate-200"
          }`}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: isNight
              ? "linear-gradient(90deg, transparent 0%, rgba(0,170,166,0.2) 15%, rgba(0,170,166,0.55) 50%, rgba(0,170,166,0.2) 85%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(0,170,166,0.16) 15%, rgba(0,170,166,0.42) 50%, rgba(0,170,166,0.16) 85%, transparent 100%)",
            boxShadow: isNight
              ? "0 0 14px rgba(0,170,166,0.28)"
              : "0 0 12px rgba(0,170,166,0.22)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00AAA6]"
          style={{ left: `${thumb}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={OUTING_MIN_MINUTES}
          max={OUTING_MAX_MINUTES}
          step={OUTING_DURATION_STEP}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Walk duration in minutes"
          aria-valuetext={`About ${value} minutes. Looking for walks between ${bandLo} and ${bandHi} minutes.`}
          className="outing-duration-range relative z-10 w-full cursor-pointer"
        />
      </div>

      <div
        className={`flex justify-between text-[9px] tabular-nums ${
          isNight ? "text-white/35" : "text-slate-400"
        }`}
      >
        <span>{OUTING_MIN_MINUTES} min</span>
        <span
          className={`font-medium ${
            isNight ? "text-white/60" : "text-slate-600"
          }`}
        >
          Looking ~{bandLo}–{bandHi} min
        </span>
        <span>{OUTING_MAX_MINUTES} min</span>
      </div>
    </div>
  );
}
