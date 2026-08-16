/**
 * Resident beta chrome — app build vs methodology / map data provenance.
 * Override app version with NEXT_PUBLIC_APP_VERSION at deploy time if needed.
 */

export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.2.0";

/** Locked scoring spec for the Casey pilot (see docs/SCORING_SPEC_v1.1.md). */
export const SCORING_SPEC_VERSION = "1.1.3";

/** GitHub release tag for interim map GeoJSON CDN. */
export const MAP_DATA_RELEASE = "map-data-v1";

export const BETA_LABEL = "Beta";

export function betaVersionTitle(): string {
  return `${BETA_LABEL} · app ${APP_VERSION}`;
}

export function betaVersionDetail(): string {
  return `Scores ${SCORING_SPEC_VERSION} · ${MAP_DATA_RELEASE}`;
}
