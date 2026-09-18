import assert from "node:assert/strict";

import {
  cardTypeFromLabel,
  distanceBand,
  findFailReason,
  isAnalyticsEventName,
  isAnalyticsSessionId,
  outingDurationBand,
  sanitizeProperties,
  suburbFromPlaceLabel,
} from "./events";

assert.equal(isAnalyticsEventName("find_completed"), true);
assert.equal(isAnalyticsEventName("page_view"), false);
assert.equal(
  isAnalyticsSessionId("2c1f0e3a-9b8a-4c11-a222-0d9f6e5c4b3a"),
  true,
);
assert.equal(isAnalyticsSessionId("not-a-uuid"), false);

assert.equal(suburbFromPlaceLabel("Wilson Botanic Park, Berwick"), "Berwick");
assert.equal(
  suburbFromPlaceLabel("66 Cupples Crescent, Berwick VIC 3806"),
  "Berwick",
);
assert.equal(suburbFromPlaceLabel("Cranbourne North"), null);
assert.equal(suburbFromPlaceLabel("12 Smith Street"), null);
assert.equal(suburbFromPlaceLabel("Park, 3806"), null);

assert.equal(outingDurationBand(15), "10-20");
assert.equal(outingDurationBand(25), "25-35");
assert.equal(distanceBand(800), "0-1km");
assert.equal(distanceBand(3200), "2-5km");
assert.equal(cardTypeFromLabel("Best for you"), "best_for_you");
assert.equal(findFailReason("Footpath network is still loading"), "network_loading");
assert.equal(findFailReason("Point is outside Casey"), "outside_casey");

const stripped = sanitizeProperties({
  suburb: "Berwick",
  lat: -38.1,
  lng: 145.2,
  address: "66 Cupples Crescent",
  origin: { lat: 1, lng: 2 },
  intent: "trip",
  extra: "nope",
});
assert.deepEqual(stripped, { suburb: "Berwick", intent: "trip" });

const dirtySuburb = sanitizeProperties({ suburb: "12 Smith St" });
assert.deepEqual(dirtySuburb, {});

console.log("analytics sanitize tests ok");
