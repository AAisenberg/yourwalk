import {
  cardTypeFromLabel,
  distanceBand,
  outingDurationBand,
  suburbFromPlaceLabel,
  type AnalyticsProperties,
} from "@/lib/analytics/events";
import { OVERLAY_DEFS, type OverlayId, type OverlayState } from "@/lib/overlays";
import {
  isScoreAwareStrategy,
  routeCardLabel,
  type WalkMode,
} from "@/lib/routing/preferences";
import type { ScoredRoute } from "@/lib/routing/types";

export function activeOverlayIds(overlays: OverlayState): string[] {
  return (Object.keys(overlays) as OverlayId[]).filter(
    (id) => overlays[id] && OVERLAY_DEFS.some((d) => d.id === id && d.available),
  );
}

export function findStartProps(args: {
  intent: "trip" | "outing";
  when: WalkMode;
  outingMinutes: number;
  overlays: OverlayState;
}): AnalyticsProperties {
  return {
    intent: args.intent,
    when: args.when,
    overlays: activeOverlayIds(args.overlays),
    ...(args.intent === "outing"
      ? { duration_band: outingDurationBand(args.outingMinutes) }
      : {}),
  };
}

export function enginesFromRoutes(routes: ScoredRoute[]): string[] {
  const engines = new Set<string>();
  for (const route of routes) {
    if (isScoreAwareStrategy(route.strategy)) engines.add("casey");
    else engines.add("mapbox");
  }
  return [...engines];
}

export function selectedRouteProps(
  route: ScoredRoute,
  ranked: ScoredRoute[],
): AnalyticsProperties {
  return {
    card_type: cardTypeFromLabel(routeCardLabel(route, ranked)),
    distance_band: distanceBand(route.distance_m),
  };
}

export function areaSuburb(originLabel: string): string | null {
  return suburbFromPlaceLabel(originLabel);
}
