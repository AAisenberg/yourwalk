"use client";

import { IconMoon, IconSun } from "@/components/resident/icons";
import { SegmentedPill } from "@/components/resident/SegmentedPill";
import type { WalkMode } from "@/lib/routing/preferences";

type Props = {
  value: WalkMode;
  onChange: (mode: WalkMode) => void;
  isNight: boolean;
  className?: string;
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

/** Day ↔ night — compact in the header; full-width if className is omitted. */
export function WalkModeSwitch({
  value,
  onChange,
  isNight,
  className = "mb-3",
}: Props) {
  return (
    <SegmentedPill
      value={value}
      options={MODE_OPTIONS}
      onChange={onChange}
      isNight={isNight}
      ariaLabel="When are you walking?"
      className={className}
    />
  );
}
