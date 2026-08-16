/**
 * Circle + star walk pins — logo glyph, From/To colours (not Mapbox teardrops).
 * Mark: pink/orange circles with #FFF200 stars. Map uses the same star on
 * green (From) and pink (To).
 */
export const WALK_PIN_FROM = "#009444";
export const WALK_PIN_TO = "#EC008C";
export const WALK_PIN_STAR = "#FFF200";

function starPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 8,
): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    parts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`,
    );
  }
  return `M${parts.join("L")}Z`;
}

export function walkPinSvg(color: string, size = 32): string {
  const c = 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="${c}" cy="${c}" r="14" fill="${color}" stroke="#fff" stroke-width="2.25"/><path d="${starPath(c, c, 8.2, 3.7)}" fill="${WALK_PIN_STAR}"/></svg>`;
}

export function createWalkPinElement(
  color: string,
  label: string,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "yw-walk-pin";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.innerHTML = walkPinSvg(color, 32);
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.lineHeight = "0";
  el.style.filter = "drop-shadow(0 1px 2px rgba(11, 12, 26, 0.45))";
  return el;
}

export function WalkPinGlyph({
  color,
  size = 16,
  label,
}: {
  color: string;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="shrink-0"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill={color}
        stroke="#fff"
        strokeWidth="2.25"
      />
      <path d={starPath(16, 16, 8.2, 3.7)} fill={WALK_PIN_STAR} />
    </svg>
  );
}
