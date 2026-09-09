import {
  ELEVATION_SOURCE_NOTE,
  hillinessAriaLabel,
  hillinessDetailLine,
  sparklinePath,
  type RouteElevation,
} from "@/lib/routing/elevation";

/**
 * Compact elevation sparkline for the selected walk.
 * Approximate Terrain-RGB profile — not a surveyed grade.
 */
export function ElevationProfile({
  profile,
  isNight,
}: {
  profile: RouteElevation;
  isNight: boolean;
}) {
  const width = 280;
  const height = 52;
  const line = sparklinePath(profile.samples, width, height);
  const fill = line
    ? `${line} L${width - 3},${height - 3} L3,${height - 3} Z`
    : "";
  const stroke = isNight ? "#2DE0D8" : "#00AAA6";
  const area = isNight
    ? "color-mix(in srgb, var(--yw-teal) 28%, transparent)"
    : "color-mix(in srgb, var(--yw-teal) 22%, white)";
  const warn = profile.band === "steep";

  return (
    <figure className="mt-2.5" aria-label={hillinessAriaLabel(profile)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-14 w-full"
        role="img"
        aria-hidden
      >
        {fill ? <path d={fill} fill={area} /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <figcaption
        className={`mt-1 text-[10px] leading-snug ${
          warn
            ? isNight
              ? "text-amber-200"
              : "text-amber-900"
            : isNight
              ? "text-white/55"
              : "text-slate-600"
        }`}
      >
        {hillinessDetailLine(profile)} {ELEVATION_SOURCE_NOTE}
      </figcaption>
    </figure>
  );
}
