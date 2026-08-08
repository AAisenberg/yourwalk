"use client";

import { IconMoon, IconSun } from "@/components/resident/icons";
import { SegmentedPill } from "@/components/resident/SegmentedPill";
import type { WalkMode } from "@/lib/routing/preferences";

type Props = {
  value: WalkMode;
  onChange: (mode: WalkMode) => void;
  isNight: boolean;
};

const MODE_OPTIONS = [
  { id: "day" as const, label: "Day", Icon: IconSun, title: "Daylight walk" },
  {
    id: "night" as const,
    label: "Night",
    Icon: IconMoon,
    title: "After dark walk",
  },
];

/** Day ↔ night — full-width pill under When in the plan form. */
export function WalkModeSwitch({ value, onChange, isNight }: Props) {
  return (
    <SegmentedPill
      value={value}
      options={MODE_OPTIONS}
      onChange={onChange}
      isNight={isNight}
      ariaLabel="When are you walking?"
      className="mb-3"
    />
  );
}
