"use client";

import type { IconType } from "react-icons";

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
  Icon?: IconType;
  title?: string;
};

type Props<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (id: T) => void;
  isNight: boolean;
  ariaLabel: string;
  className?: string;
};

/**
 * Full-width segmented control for binary / ternary plan choices
 * (Day/Night, A to B / Around here, outing shape).
 */
export function SegmentedPill<T extends string>({
  value,
  options,
  onChange,
  isNight,
  ariaLabel,
  className = "",
}: Props<T>) {
  const count = options.length;
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`relative flex h-11 w-full rounded-full p-1 ${
        isNight
          ? "bg-white/[0.06] ring-1 ring-white/12"
          : "bg-yw-day-surface ring-1 ring-[#E8ECF2]"
      } ${className}`}
    >
      <span
        aria-hidden
        className="yw-segment-thumb pointer-events-none absolute top-1 bottom-1 rounded-full bg-yw-teal shadow-sm"
        style={{
          width: `calc((100% - 8px) / ${count})`,
          left: `calc(4px + ${selectedIndex} * (100% - 8px) / ${count})`,
        }}
      />
      {options.map((opt) => {
        const on = opt.id === value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.id)}
            aria-pressed={on}
            className={`yw-segment-label relative z-[1] flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1 text-[12px] font-bold leading-tight ${
              on
                ? "text-white"
                : isNight
                  ? "text-white/55"
                  : "text-slate-600"
            }`}
          >
            {Icon ? (
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
            ) : null}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
