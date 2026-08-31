"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  PREF_IMPORTANCE_MAX,
  PREF_IMPORTANCE_MIN,
  clampImportance,
} from "@/lib/routing/preferences";

export function PrefSlider({
  title,
  description,
  value,
  isNight,
  accent,
  tone,
  onChange,
  footerAccessory,
}: {
  title: string;
  description?: string;
  value: number;
  isNight: boolean;
  accent: string;
  tone: "amber" | "blue" | "lime";
  onChange: (v: number) => void;
  /** Full-width control under the slider (e.g. Prefer away from roads). */
  footerAccessory?: ReactNode;
}) {
  const clamped = Math.min(
    PREF_IMPORTANCE_MAX,
    Math.max(PREF_IMPORTANCE_MIN, value),
  );
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
      <div className="mb-1 min-w-0">
        <span className={`text-[13px] font-bold ${titles[tone]}`}>{title}</span>
        {description ? (
          <p className={`text-[10px] leading-snug ${descs[tone]}`}>
            {description}
          </p>
        ) : null}
      </div>
      <input
        type="range"
        min={PREF_IMPORTANCE_MIN}
        max={PREF_IMPORTANCE_MAX}
        value={clamped}
        onChange={(e) => onChange(clampImportance(Number(e.target.value)))}
        className="yw-pref-range"
        aria-valuemin={PREF_IMPORTANCE_MIN}
        aria-valuemax={PREF_IMPORTANCE_MAX}
        aria-valuenow={clamped}
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
      {footerAccessory}
    </div>
  );
}
