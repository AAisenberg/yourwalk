import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  areaValue,
  breakdown,
  heldBackBy,
  rankAreas,
  rollUpAreas,
  summariseCasey,
  type AreaStats,
} from "./areas";

const MAP_DATA_PATH = resolve(__dirname, "../../../public/map-data/segment_scores.geojson");

const feature = (
  props: Record<string, unknown>,
): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [145.3, -38.1] },
  properties: props,
});

test("length-weighted mean, not a plain average", () => {
  const areas = rollUpAreas(
    [
      feature({ suburb: "A", day_index_score: 40, length_m: 300 }),
      feature({ suburb: "A", day_index_score: 80, length_m: 100 }),
    ],
    "suburb",
  );
  assert.equal(areas[0].day, 5);
});

test("missing scores are skipped, not treated as zero", () => {
  const [a] = rollUpAreas(
    [
      feature({ suburb: "A", day_index_score: 70, length_m: 100 }),
      feature({ suburb: "A", day_index_score: null, length_m: 900 }),
    ],
    "suburb",
  );
  assert.equal(a.day, 7);
  assert.equal(a.segments, 2);
});

test("zero-length segments do not count", () => {
  const [a] = rollUpAreas(
    [
      feature({ suburb: "A", day_index_score: 70, length_m: 100 }),
      feature({ suburb: "A", day_index_score: 10, length_m: 0 }),
    ],
    "suburb",
  );
  assert.equal(a.day, 7);
  assert.equal(a.segments, 1);
});

test("ranks weakest first on the selected index", () => {
  const areas = rollUpAreas(
    [
      feature({ suburb: "Strong", day_index_score: 80, night_index_score: 50, length_m: 10 }),
      feature({ suburb: "Weak", day_index_score: 50, night_index_score: 80, length_m: 10 }),
    ],
    "suburb",
  );
  assert.deepEqual(rankAreas(areas, "day").map((a) => a.name), ["Weak", "Strong"]);
  assert.deepEqual(rankAreas(areas, "night").map((a) => a.name), ["Strong", "Weak"]);
});

test("breakdown parts add up to the index (Cranbourne North shape)", () => {
  const [a] = rollUpAreas(
    [
      feature({
        suburb: "A",
        day_index_score: 56.8,
        accessibility_score: 74,
        heat_shade_score: 31,
        length_m: 10,
      }),
    ],
    "suburb",
  );
  const b = breakdown(a, "day");
  assert.equal(b.footpaths.score, 7.4);
  assert.equal(b.footpaths.maxPoints, 6);
  assert.equal(b.stream.name, "Heat and shade");
  assert.equal(b.stream.score, 3.1);
  assert.equal(b.stream.maxPoints, 4);
  assert.equal(b.total, 5.7);
  // 4.44 + 1.24 rounds to 4.4 + 1.2 = 5.6; parts must still add to 5.7
  assert.equal(Math.round((b.footpaths.points! + b.stream.points!) * 10) / 10, 5.7);
  assert.ok(Math.abs(b.footpaths.points! - 4.44) <= 0.1);
  assert.ok(Math.abs(b.stream.points! - 1.24) <= 0.1);
});

test("breakdown adds up for every real suburb and ward", { skip: !existsSync(MAP_DATA_PATH) }, () => {
  const geo = JSON.parse(readFileSync(MAP_DATA_PATH, "utf8")) as GeoJSON.FeatureCollection;
  for (const unit of ["suburb", "ward"] as const) {
    for (const a of rollUpAreas(geo.features, unit)) {
      for (const mode of ["day", "night"] as const) {
        const b = breakdown(a, mode);
        if (b.total == null) continue;
        const sum = Math.round((b.footpaths.points! + b.stream.points!) * 10) / 10;
        assert.equal(sum, b.total, `${a.name} ${mode}`);
      }
    }
  }
});

test("held back by the part that costs the most index points", () => {
  const casey = summariseCasey([
    feature({ suburb: "C", accessibility_score: 75, heat_shade_score: 44, length_m: 1 }),
  ]);
  const [weakHeat] = rollUpAreas(
    [feature({ suburb: "A", accessibility_score: 74, heat_shade_score: 31, length_m: 1 })],
    "suburb",
  );
  assert.deepEqual(heldBackBy(weakHeat, casey, "day"), {
    kind: "stream",
    name: "Heat and shade",
    score: 3.1,
    casey: 4.4,
  });
  const [strong] = rollUpAreas(
    [feature({ suburb: "B", accessibility_score: 80, heat_shade_score: 50, length_m: 1 })],
    "suburb",
  );
  assert.deepEqual(heldBackBy(strong, casey, "day"), { kind: "above" });
  const [nearAverage] = rollUpAreas(
    [feature({ suburb: "N", accessibility_score: 74.2, heat_shade_score: 44, length_m: 1 })],
    "suburb",
  );
  assert.deepEqual(heldBackBy(nearAverage, casey, "day"), { kind: "above" });
});

test("single-stream view ranks and reports that stream only", () => {
  const areas = rollUpAreas(
    [
      feature({ suburb: "Dark", night_index_score: 80, lighting_after_dark_score: 40, length_m: 10 }),
      feature({ suburb: "Lit", night_index_score: 70, lighting_after_dark_score: 85, length_m: 10 }),
    ],
    "suburb",
  );
  assert.deepEqual(rankAreas(areas, "night", "stream").map((a) => a.name), ["Dark", "Lit"]);
  assert.deepEqual(rankAreas(areas, "night").map((a) => a.name), ["Lit", "Dark"]);
  const dark = areas.find((a) => a.name === "Dark")!;
  assert.equal(areaValue(dark, "night", "stream"), 4);
  assert.equal(areaValue(dark, "night"), 8);
});

type ExtractRow = { name: string; day: number; night: number; segs: number };

const MAP_DATA = resolve(__dirname, "../../../public/map-data/segment_scores.geojson");
const EXTRACT = resolve(__dirname, "../../../../docs/meeting-prep/dashboard-area-ranks.json");

test(
  "matches the pipeline suburb and ward extract",
  { skip: !existsSync(MAP_DATA) && "local map-data symlink not present" },
  () => {
    const geo = JSON.parse(readFileSync(MAP_DATA, "utf8")) as GeoJSON.FeatureCollection;
    if (!geo.features.some((f) => f.properties?.ward)) {
      return;
    }
    const extract = JSON.parse(readFileSync(EXTRACT, "utf8")) as {
      lga: { day: number; night: number };
      suburbs: ExtractRow[];
      wards: ExtractRow[];
    };
    const check = (areas: AreaStats[], rows: ExtractRow[]) => {
      assert.equal(areas.length, rows.length);
      for (const row of rows) {
        const a = areas.find((x) => x.name === row.name);
        assert.ok(a, `missing ${row.name}`);
        assert.equal(a.day, row.day, `${row.name} day`);
        assert.equal(a.night, row.night, `${row.name} night`);
        assert.equal(a.segments, row.segs, `${row.name} segments`);
      }
    };
    check(rollUpAreas(geo.features, "suburb"), extract.suburbs);
    check(rollUpAreas(geo.features, "ward"), extract.wards);
    const casey = summariseCasey(geo.features);
    assert.equal(casey.day, extract.lga.day);
    assert.equal(casey.night, extract.lga.night);
  },
);
