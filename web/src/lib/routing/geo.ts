import { CASEY_BOUNDS } from "@/lib/scores";

import type { LngLat } from "./types";

export function pointInCaseyBbox(p: LngLat): boolean {
  return (
    p.lng >= CASEY_BOUNDS.west &&
    p.lng <= CASEY_BOUNDS.east &&
    p.lat >= CASEY_BOUNDS.south &&
    p.lat <= CASEY_BOUNDS.north
  );
}

/** Display index 0–10 (1 decimal) from absolute 0–100. */
export function toDisplayScore(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(score) / 10;
}

/**
 * Recover Heat & Shade stream (0–100) from Day Index + Accessibility when the
 * map GeoJSON omits `heat_shade_score`. Locked model: Day = 0.6×Acc + 0.4×Heat.
 */
export function deriveHeatShadeScore(
  dayIndex: number | null | undefined,
  accessibility: number | null | undefined,
): number | null {
  if (
    dayIndex == null ||
    accessibility == null ||
    Number.isNaN(dayIndex) ||
    Number.isNaN(accessibility)
  ) {
    return null;
  }
  const heat = (dayIndex - 0.6 * accessibility) / 0.4;
  if (!Number.isFinite(heat)) return null;
  return Math.min(100, Math.max(0, heat));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
