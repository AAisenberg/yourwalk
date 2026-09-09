import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyHilliness,
  densifyLine,
  hillinessCardLine,
  mergeElevationById,
  profileFromElevations,
  sparklinePath,
  type RouteElevation,
} from "./elevation";
import { decodeTerrainRgb } from "./elevationMapbox";
import { walkOptionsResultsHint } from "../../components/resident/WalkOptions";
import {
  DEFAULT_PREFS_DAY,
  FLATTER_PENALTY,
  flatterWalksAdjustment,
} from "./preferences";

function line(coords: [number, number][]) {
  return { type: "LineString" as const, coordinates: coords };
}

/** ~200 m east-west at Casey latitude. */
function caseyEastLine(): GeoJSON.LineString {
  return line([
    [145.317, -38.112],
    [145.3193, -38.112],
  ]);
}

function fixtureProfile(over: Partial<RouteElevation> = {}): RouteElevation {
  return {
    source: "mapbox-terrain-rgb",
    sample_count: 5,
    coverage_ratio: 1,
    start_m: 40,
    end_m: 58,
    min_m: 40,
    max_m: 58,
    climb_m: 18,
    descent_m: 0,
    max_grade_pct: 9.2,
    band: "steep",
    samples: [
      { distance_m: 0, elevation_m: 40 },
      { distance_m: 100, elevation_m: 58 },
    ],
    ...over,
  };
}

describe("densifyLine", () => {
  it("spaces samples along a Casey-length segment", () => {
    const pts = densifyLine(caseyEastLine(), 20);
    assert.ok(pts.length >= 8);
    assert.equal(pts[0][0], 145.317);
    assert.ok(Math.abs(pts[pts.length - 1][0] - 145.3193) < 1e-5);
  });
});

describe("classifyHilliness", () => {
  it("uses AS 1428-style grade bands without claiming compliance", () => {
    assert.equal(classifyHilliness(2, 2), "flat");
    assert.equal(classifyHilliness(3.5, 4), "gentle");
    assert.equal(classifyHilliness(6, 10), "hilly");
    assert.equal(classifyHilliness(8, 10), "steep");
  });

  it("treats a long climb as hilly even when the peak grade is moderate", () => {
    assert.equal(classifyHilliness(4.2, 28), "hilly");
  });
});

describe("profileFromElevations", () => {
  it("returns climb and a steep band for a 10% rise over 40 m", () => {
    const linePts: [number, number][] = [
      [145.317, -38.112],
      [145.31715, -38.112],
      [145.3173, -38.112],
      [145.31745, -38.112],
      [145.3176, -38.112],
    ];
    const elevations = [50, 52, 54, 56, 58];
    const profile = profileFromElevations(linePts, elevations);
    assert.ok(profile);
    assert.ok(profile.climb_m >= 6);
    assert.ok(profile.max_grade_pct >= 8);
    assert.equal(profile.band, "steep");
    assert.equal(profile.source, "mapbox-terrain-rgb");
  });

  it("does not impute a flat walk when coverage is thin", () => {
    const linePts: [number, number][] = [
      [145.317, -38.112],
      [145.3172, -38.112],
      [145.3174, -38.112],
      [145.3176, -38.112],
    ];
    const elevations = [40, null, null, 41];
    assert.equal(profileFromElevations(linePts, elevations), null);
  });

  it("stays flat on a level path", () => {
    const linePts: [number, number][] = [
      [145.317, -38.112],
      [145.3172, -38.112],
      [145.3174, -38.112],
      [145.3176, -38.112],
      [145.3178, -38.112],
    ];
    const profile = profileFromElevations(linePts, [42, 42.1, 41.9, 42, 42.2]);
    assert.ok(profile);
    assert.equal(profile.band, "flat");
    assert.match(hillinessCardLine(profile), /Mostly flat/);
  });
});

describe("decodeTerrainRgb", () => {
  it("decodes the Mapbox Terrain-RGB formula", () => {
    // 40 m: (40 + 10000) / 0.1 = 100400
    const v = 100400;
    const r = Math.floor(v / (256 * 256));
    const g = Math.floor((v % (256 * 256)) / 256);
    const b = v % 256;
    const z = decodeTerrainRgb(r, g, b);
    assert.ok(z != null);
    assert.ok(Math.abs(z - 40) < 0.15);
  });

  it("rejects the nodata well below sea level", () => {
    assert.equal(decodeTerrainRgb(0, 0, 0), null);
  });
});

describe("sparklinePath and merge", () => {
  it("builds an SVG path from samples", () => {
    const d = sparklinePath(
      [
        { distance_m: 0, elevation_m: 40 },
        { distance_m: 50, elevation_m: 48 },
        { distance_m: 100, elevation_m: 44 },
      ],
      100,
      40,
    );
    assert.match(d, /^M/);
    assert.match(d, /L/);
  });

  it("merges elevation onto existing card order by id", () => {
    const current = [{ id: "b" }, { id: "a" }];
    const sourced = [
      { id: "a", elevation: fixtureProfile() },
      { id: "b", elevation: fixtureProfile({ band: "flat", climb_m: 1, max_grade_pct: 1 }) },
    ];
    const merged = mergeElevationById(current, sourced);
    assert.equal(merged[0].id, "b");
    assert.equal(merged[0].elevation?.band, "flat");
    assert.equal(merged[1].elevation?.band, "steep");
  });
});

describe("flatterWalksAdjustment", () => {
  it("does nothing unless the toggle is on", () => {
    const route = {
      elevation: fixtureProfile(),
    } as Parameters<typeof flatterWalksAdjustment>[0];
    assert.equal(flatterWalksAdjustment(route, DEFAULT_PREFS_DAY), 0);
  });

  it("demotes steep walks and leaves missing elevation alone", () => {
    const on = { ...DEFAULT_PREFS_DAY, preferFlatterWalks: true };
    const steep = {
      elevation: fixtureProfile({ band: "steep" }),
    } as Parameters<typeof flatterWalksAdjustment>[0];
    const unknown = {
      elevation: null,
    } as Parameters<typeof flatterWalksAdjustment>[0];
    assert.equal(flatterWalksAdjustment(steep, on), -FLATTER_PENALTY.steep);
    assert.equal(flatterWalksAdjustment(unknown, on), 0);
  });
});

describe("walkOptionsResultsHint", () => {
  it("stays quiet when both Options are off", () => {
    assert.equal(walkOptionsResultsHint(false, false), null);
  });

  it("names both Options and asks for Edit then Find", () => {
    assert.equal(
      walkOptionsResultsHint(true, true),
      "Options: away from roads · flatter walks. Edit walk to change, then Find again.",
    );
  });
});
