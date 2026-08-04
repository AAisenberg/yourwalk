"use client";

import { IconMoon, IconSun } from "@/components/resident/icons";
import type { WalkMode } from "@/lib/routing/preferences";

type Props = {
  value: WalkMode;
  onChange: (mode: WalkMode) => void;
  isNight: boolean;
};

/**
 * Icon-only day ↔ night pill. Sun / moon carry the meaning; aria-labels
 * keep the control accessible without crowding the header brand.
 */
export function WalkModeSwitch({ value, onChange, isNight }: Props) {
  const nightOn = value === "night";

  return (
    <div
      role="group"
      aria-label="When are you walking?"
      className={`relative flex h-11 w-[5.75rem] shrink-0 rounded-full p-1 ${
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
        className={`relative z-[1] flex flex-1 items-center justify-center rounded-full ${
          !nightOn
            ? "text-white"
            : isNight
              ? "text-white/45"
              : "text-slate-500"
        }`}
        aria-pressed={!nightOn}
        aria-label="Day walk"
        title="Day walk"
      >
        <IconSun className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onChange("night")}
        className={`relative z-[1] flex flex-1 items-center justify-center rounded-full ${
          nightOn
            ? "text-white"
            : isNight
              ? "text-white/45"
              : "text-slate-500"
        }`}
        aria-pressed={nightOn}
        aria-label="Night walk"
        title="Night walk"
      >
        <IconMoon className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
