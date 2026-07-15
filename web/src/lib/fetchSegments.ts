/**
 * Load scored segments GeoJSON from Supabase Storage (public bucket).
 *
 * Prefer plain `.geojson` — Cloudflare Smart CDN already compresses on the wire
 * (brotli/gzip via Content-Encoding). Pre-gzipped `.geojson.gz` objects can
 * return HTTP 400 in browsers that also send Accept-Encoding: gzip.
 */

export type SegmentsMeta = {
  feature_count?: number;
  scoring_spec_version?: string | null;
  methodology_version?: string;
};

export type SegmentsPayload = GeoJSON.FeatureCollection & {
  meta?: SegmentsMeta;
};

async function parseGzipBody(res: Response): Promise<unknown> {
  if (!res.body) {
    throw new Error("Empty response body for gzip GeoJSON");
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "DecompressionStream not supported — use uncompressed .geojson URL",
    );
  }
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

export async function fetchSegmentsGeoJSON(
  url: string,
): Promise<SegmentsPayload> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GeoJSON fetch failed: HTTP ${res.status} (${url})`);
  }

  // Only client-decompress when the object itself is a .gz file (not CDN encoding)
  const collection = (
    url.endsWith(".gz")
      ? await parseGzipBody(res)
      : await res.json()
  ) as GeoJSON.FeatureCollection;

  if (collection?.type !== "FeatureCollection") {
    throw new Error("Expected a GeoJSON FeatureCollection");
  }

  const metaUrl = url
    .replace(/\.geojson\.gz$/i, ".meta.json")
    .replace(/\.geojson$/i, ".meta.json");

  let meta: SegmentsMeta = {
    feature_count: collection.features?.length,
  };

  try {
    if (metaUrl !== url) {
      const mr = await fetch(metaUrl);
      if (mr.ok) {
        const m = (await mr.json()) as SegmentsMeta;
        meta = {
          feature_count: m.feature_count ?? meta.feature_count,
          scoring_spec_version: m.scoring_spec_version,
          methodology_version: m.methodology_version,
        };
      }
    }
  } catch {
    // meta is optional
  }

  return { ...collection, meta };
}

/** Default public object — plain GeoJSON (CDN-compressed on the wire). */
export function defaultSegmentsGeoJsonUrl(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/map-data/segment_scores.geojson`;
}

export function defaultLgaBoundaryUrl(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/map-data/casey_lga_boundary.geojson`;
}

export async function fetchLgaBoundary(
  url: string,
): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LGA boundary fetch failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as GeoJSON.FeatureCollection;
  if (data?.type !== "FeatureCollection") {
    throw new Error("Expected LGA FeatureCollection");
  }
  return data;
}
