/**
 * Casey civil twilight → YourWalk When (two index states) + Mapbox lightPreset.
 *
 * Sun 6° below the horizon at one LGA point. No weather API. Clock-hour
 * rules (e.g. 6pm) are not used. ADR-009 + FLOWS/02.
 *
 * Morning twilight → Day (product lean, OQ-5). Evening twilight → Night.
 */

import type { WalkMode } from "@/lib/routing/preferences";

export type LightPreset = "dawn" | "day" | "dusk" | "night";

export type CaseyWhen = {
  walkMode: WalkMode;
  lightPreset: LightPreset;
  hint: string;
  phase: LightPreset;
};

/** Casey centroid (bbox mid-point). Sun maths only — not a civic address. */
export const CASEY_WHEN_POINT = { lat: -38.1, lng: 145.3 } as const;

/** Civil twilight: sun 6° below the horizon. */
const CIVIL_TWILIGHT_DEG = -6;

export function whenHintForOverride(mode: WalkMode): string {
  return mode === "night" ? "Night · you chose this" : "Day · you chose this";
}

/**
 * Basemap follows planned When. Night at 2pm → dusk so chrome matches
 * Night scores. Auto mode uses Casey sun (dawn/day/dusk/night).
 */
export function plannedLightPreset(
  mode: WalkMode,
  overridden: boolean,
  at: Date = new Date(),
): LightPreset {
  const auto = resolveCaseyWhen(at);
  if (!overridden) return auto.lightPreset;
  if (mode === "night") {
    return auto.phase === "day" || auto.phase === "dawn" ? "dusk" : "night";
  }
  return "day";
}

export function resolveCaseyWhen(at: Date = new Date()): CaseyWhen {
  const elev = solarElevationDeg(at, CASEY_WHEN_POINT.lat, CASEY_WHEN_POINT.lng);
  const later = new Date(at.getTime() + 8 * 60 * 1000);
  const rising =
    solarElevationDeg(later, CASEY_WHEN_POINT.lat, CASEY_WHEN_POINT.lng) > elev;

  if (elev >= 0) {
    return {
      walkMode: "day",
      lightPreset: "day",
      hint: "Day · daylight in Casey now",
      phase: "day",
    };
  }
  if (elev >= CIVIL_TWILIGHT_DEG) {
    if (rising) {
      return {
        walkMode: "day",
        lightPreset: "dawn",
        hint: "Day · dawn in Casey now",
        phase: "dawn",
      };
    }
    return {
      walkMode: "night",
      lightPreset: "dusk",
      hint: "Night · dusk in Casey now",
      phase: "dusk",
    };
  }
  return {
    walkMode: "night",
    lightPreset: "night",
    hint: "Night · after dark in Casey now",
    phase: "night",
  };
}

/**
 * Apparent solar elevation in degrees (NOAA / Meeus approximation).
 * Good to ~1° — enough for civil-twilight When, not for astro work.
 */
export function solarElevationDeg(
  date: Date,
  lat: number,
  lng: number,
): number {
  const rad = Math.PI / 180;
  const dayMs = 86_400_000;
  const J1970 = 2_440_587.5;
  const n = date.getTime() / dayMs + J1970 - 2_451_545;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const epsilon = (23.439 - 0.0000004 * n) * rad;
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const gmstHours = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (((gmstHours + lng / 15) % 24) + 24) % 24;
  const ha = lst * 15 * rad - ra;
  const elev = Math.asin(
    Math.sin(lat * rad) * Math.sin(decl) +
      Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha),
  );
  return elev / rad;
}
