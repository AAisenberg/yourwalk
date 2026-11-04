import type { Map, SymbolLayout } from "mapbox-gl";

import { suburbLabelPoints } from "@/lib/mapFilters";
import { CASEY_MASK_BOUNDS } from "@/lib/scores";

const DEFAULT_LABEL_SRC = "casey-suburb-labels";
const DEFAULT_LABEL_LAYER = "casey-suburb-labels";

/** World-outside-Casey fill: Casey LGA rings punched out of a wide outer ring. */
export function caseyOutsideMask(
  lga: GeoJSON.FeatureCollection,
): GeoJSON.Feature | null {
  const holes: GeoJSON.Position[][] = [];
  for (const feature of lga.features) {
    const geom = feature.geometry;
    if (geom?.type === "Polygon") holes.push(geom.coordinates[0]!);
    if (geom?.type === "MultiPolygon") {
      for (const poly of geom.coordinates) holes.push(poly[0]!);
    }
  }
  if (!holes.length) return null;
  const outer: GeoJSON.Position[] = [
    [CASEY_MASK_BOUNDS.west, CASEY_MASK_BOUNDS.south],
    [CASEY_MASK_BOUNDS.east, CASEY_MASK_BOUNDS.south],
    [CASEY_MASK_BOUNDS.east, CASEY_MASK_BOUNDS.north],
    [CASEY_MASK_BOUNDS.west, CASEY_MASK_BOUNDS.north],
    [CASEY_MASK_BOUNDS.west, CASEY_MASK_BOUNDS.south],
  ];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [outer, ...holes] },
  };
}

export function caseyOutsidePaint(night: boolean): {
  color: string;
  opacity: number;
} {
  return night
    ? { color: "#070810", opacity: 0.62 }
    : { color: "#0f172a", opacity: 0.4 };
}

/** Classic Streets / Dark fallback: hide settlement labels we cannot clip. */
export function hideClassicPlaceLabels(map: Map) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    if (!/place|settlement|country|state|continent/i.test(layer.id)) continue;
    if (map.getLayer(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}

/** Hide Standard place names so only Casey suburb labels we draw remain. */
export function hideBasemapPlaceLabels(map: Map) {
  try {
    map.setConfigProperty("basemap", "showPlaceLabels", false);
  } catch {
    /* classic streets / dark, or an older Standard build */
  }
  hideClassicPlaceLabels(map);
}

function suburbLabelPaint(night: boolean): {
  "text-color": string;
  "text-halo-color": string;
  "text-halo-width": number;
  "text-emissive-strength": number;
} {
  return night
    ? {
        "text-color": "#F8FAFC",
        "text-halo-color": "#0B0C1A",
        "text-halo-width": 1.4,
        "text-emissive-strength": 1,
      }
    : {
        "text-color": "#292984",
        "text-halo-color": "#FFFFFF",
        "text-halo-width": 1.6,
        "text-emissive-strength": 0.4,
      };
}

/** One Casey suburb name per scored-footpath centroid. */
export function ensureCaseySuburbLabels(
  map: Map,
  features: GeoJSON.Feature[],
  night: boolean,
  opts?: {
    sourceId?: string;
    layerId?: string;
    beforeId?: string;
    /** Standard slot. Omit for planner (top). Pass null so labels sit with unslotted custom layers. */
    slot?: "top" | null;
  },
) {
  const sourceId = opts?.sourceId ?? DEFAULT_LABEL_SRC;
  const layerId = opts?.layerId ?? DEFAULT_LABEL_LAYER;
  const slot = opts && "slot" in opts ? opts.slot : "top";
  const data = suburbLabelPoints(features);
  const existing = map.getSource(sourceId);
  if (existing && existing.type === "geojson") {
    existing.setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }
  const current = map.getLayer(layerId) as { slot?: string } | undefined;
  const wantedSlot = slot ?? undefined;
  if (current && current.slot !== wantedSlot) {
    map.removeLayer(layerId);
  }
  if (!map.getLayer(layerId)) {
    const layout: SymbolLayout = {
      "text-field": ["get", "suburb"],
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9.5,
        11,
        12,
        13,
        15,
        15,
      ],
      "text-padding": 6,
      "text-optional": true,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
    };
    const fonts: string[][] = [
      ["DIN Pro Medium", "Arial Unicode MS Regular"],
      ["Open Sans Regular", "Arial Unicode MS Regular"],
    ];
    for (const textFont of fonts) {
      try {
        map.addLayer(
          {
            id: layerId,
            type: "symbol",
            source: sourceId,
            ...(slot ? { slot } : {}),
            minzoom: 9.5,
            layout: { ...layout, "text-font": [...textFont] },
            paint: suburbLabelPaint(night),
          },
          opts?.beforeId,
        );
        break;
      } catch {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
    }
  } else {
    const paint = suburbLabelPaint(night);
    map.setPaintProperty(layerId, "text-color", paint["text-color"]);
    map.setPaintProperty(layerId, "text-halo-color", paint["text-halo-color"]);
    map.setPaintProperty(layerId, "text-halo-width", paint["text-halo-width"]);
    map.setPaintProperty(
      layerId,
      "text-emissive-strength",
      paint["text-emissive-strength"],
    );
  }
}
