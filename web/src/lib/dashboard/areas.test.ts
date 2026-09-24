import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  rankAreas,
  rollUpAreas,
  summariseCasey,
  type AreaStats,
} from "./areas";

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
