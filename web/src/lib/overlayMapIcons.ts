import type { Map as MapboxMap } from "mapbox-gl";

import { OVERLAY_DEFS, type OverlayId } from "@/lib/overlays";

/** Material-style 24×24 glyphs, drawn white on the coloured disc. */
const GLYPH: Record<OverlayId, string> = {
  fountains:
    "M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z",
  benches:
    "M7 13c-1.1 0-2 .9-2 2v6h2v-2h10v2h2v-6c0-1.1-.9-2-2-2H7zm12-6h-2V5c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H5c-1.1 0-2 .9-2 2v3h2V9h14v3h2V9c0-1.1-.9-2-2-2z",
  toilets:
    "M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63C18.18 7.55 17.42 7 16.56 7h-.12c-.86 0-1.63.55-1.9 1.37L12 16h3v6h3zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z",
  dog_bags:
    "M4.5 9.5C5.88 9.5 7 8.38 7 7S5.88 4.5 4.5 4.5 2 5.62 2 7s1.12 2.5 2.5 2.5zm15 0c1.38 0 2.5-1.12 2.5-2.5S20.88 4.5 19.5 4.5 17 5.62 17 7s1.12 2.5 2.5 2.5zM14.5 8c1.38 0 2.5-1.12 2.5-2.5S15.88 3 14.5 3 12 4.12 12 5.5 13.12 8 14.5 8zm-5 0C10.88 8 12 6.88 12 5.5S10.88 3 9.5 3 7 4.12 7 5.5 8.12 8 9.5 8zM12 14.5c-3.04 0-5.5 1.51-5.5 3.37V20h11v-2.13c0-1.86-2.46-3.37-5.5-3.37z",
};

export function overlayIconImageId(id: OverlayId): string {
  return `yw-overlay-${id}`;
}

export function overlayIconLayerId(id: OverlayId): string {
  return `overlay-${id}-icons`;
}

function overlayIconSvg(id: OverlayId, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="28" fill="${color}" stroke="#ffffff" stroke-width="5"/>
    <g transform="translate(32 32) scale(1.28) translate(-12 -12)" fill="#ffffff">
      <path d="${GLYPH[id]}"/>
    </g>
  </svg>`;
}

function loadOverlayIcon(id: OverlayId, color: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not draw ${id} overlay icon`));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      overlayIconSvg(id, color),
    )}`;
  });
}

export async function ensureOverlayImages(map: MapboxMap): Promise<void> {
  await Promise.all(
    OVERLAY_DEFS.map(async (def) => {
      const imageId = overlayIconImageId(def.id);
      if (map.hasImage(imageId)) return;
      const img = await loadOverlayIcon(def.id, def.color);
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, img, { pixelRatio: 2 });
      }
    }),
  );
}
