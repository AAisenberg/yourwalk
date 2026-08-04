"use client";

import { IconMoon, IconSun } from "@/components/resident/icons";
import type { WalkMode } from "@/lib/routing/preferences";

type Props = {
  value: WalkMode;
  onChange: (mode: WalkMode) => void;
  isNight: boolean;
};

/**
 * Sliding day ↔ night pill. Shows both options so the control is not
 * confused with a single toggle label that flips meaning on click.
 */
export function WalkModeSwitch({ value, onChange, isNight }: Props) {
  const nightOn = value === "night";

  return (
    <div
      role="group"
      aria-label="When are you walking?"
      className={`relative flex h-11 w-[9.5rem] shrink-0 rounded-full p-1 ${
        isNight
          ? "bg-yw-night-panel ring-1 ring-white/12"
          : "bg-yw-day-surface ring-1 ring-[#E8ECF2]"
      }`}
    >
      <span
        aria-hidden
        className="yw-chrome-transition absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-yw-teal shadow-sm"
        style={{ left: nightOn ? "50%" : "4px" }}
      />
      <button
        type="button"
        onClick={() => onChange("day")}
        className={`relative z-[1] flex flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-bold ${
          !nightOn
            ? "text-white"
            : isNight
              ? "text-white/55"
              : "text-slate-600"
        }`}
        aria-pressed={!nightOn}
        aria-label="Day walk"
      >
        <IconSun className="h-3.5 w-3.5" aria-hidden />
        Day
      </button>
      <button
        type="button"
        onClick={() => onChange("night")}
        className={`relative z-[1] flex flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-bold ${
          nightOn
            ? "text-white"
            : isNight
              ? "text-white/55"
              : "text-slate-600"
        }`}
        aria-pressed={nightOn}
        aria-label="Night walk"
      >
        <IconMoon className="h-3.5 w-3.5" aria-hidden />
        Night
      </button>
    </div>
  );
}
