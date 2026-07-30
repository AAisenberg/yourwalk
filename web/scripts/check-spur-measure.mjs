/**
 * Sanity check for cul-de-sac spur detection (mirrors planOuting heuristics).
 * Run: node scripts/check-spur-measure.mjs
 */

const R = 6371000;
const REVISIT_NEAR_M = 36;
const START_STUB_IGNORE_M = 80;
const SPUR_MIN_M = 60;
const SPUR_MAX_M = 160;
const STEP = 28;

function haversineM(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function dest(start, distM, bearingDeg) {
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (start.lat * Math.PI) / 180;
  const lng1 = (start.lng * Math.PI) / 180;
  const ang = distM / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) +
      Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function densify(coords) {
  const samples = [{ p: { lng: coords[0][0], lat: coords[0][1] }, along: 0 }];
  let along = 0;
  let since = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = { lng: coords[i - 1][0], lat: coords[i - 1][1] };
    const b = { lng: coords[i][0], lat: coords[i][1] };
    const seg = haversineM(a, b);
    if (seg < 0.5) continue;
    let remaining = seg;
    let t0 = 0;
    while (since + remaining >= STEP) {
      const need = STEP - since;
      const t = t0 + need / seg;
      samples.push({
        p: {
          lng: a.lng + (b.lng - a.lng) * t,
          lat: a.lat + (b.lat - a.lat) * t,
        },
        along: along + need,
      });
      along += need;
      remaining -= need;
      t0 += need / seg;
      since = 0;
    }
    along += remaining;
    since += remaining;
  }
  return samples;
}

function measure(coords, start) {
  const samples = densify(coords);
  const totalM = samples[samples.length - 1].along;
  let worst = 0;
  let total = 0;
  const counted = new Set();
  for (let i = 2; i < samples.length; i++) {
    const s = samples[i];
    if (haversineM(s.p, start) <= START_STUB_IGNORE_M) continue;
    if (s.along < START_STUB_IGNORE_M) continue;
    if (s.along > totalM - START_STUB_IGNORE_M) continue;
    for (let j = i - 1; j >= 0; j--) {
      const earlier = samples[j];
      const sep = s.along - earlier.along;
      if (sep < SPUR_MIN_M * 2) continue;
      if (sep > SPUR_MAX_M * 2 + 40) break;
      if (haversineM(earlier.p, start) <= START_STUB_IGNORE_M) continue;
      if (earlier.along < START_STUB_IGNORE_M * 0.5) continue;
      if (haversineM(s.p, earlier.p) > REVISIT_NEAR_M) continue;
      const midAlong = (s.along + earlier.along) / 2;
      let mid = earlier;
      let midErr = Infinity;
      for (let k = j; k <= i; k++) {
        const err = Math.abs(samples[k].along - midAlong);
        if (err < midErr) {
          midErr = err;
          mid = samples[k];
        }
      }
      const spurLen = sep / 2;
      if (spurLen < SPUR_MIN_M || spurLen > SPUR_MAX_M) break;
      const tipAway = haversineM(mid.p, earlier.p);
      if (tipAway < Math.max(50, spurLen * 0.6)) continue;
      if (tipAway > spurLen * 1.35) continue;
      worst = Math.max(worst, spurLen);
      const bucket = Math.floor(earlier.along / 50);
      if (!counted.has(bucket)) {
        counted.add(bucket);
        total += spurLen;
      }
      break;
    }
  }
  return { worst, total };
}

const start = { lng: 145.27, lat: -38.03 };
const a = dest(start, 400, 0);
const b = dest(start, 400, 120);
const clean = [
  [start.lng, start.lat],
  [a.lng, a.lat],
  [b.lng, b.lat],
  [start.lng, start.lat],
];

const spurTip = dest(start, 200, 0);
const spurEnd = dest(spurTip, 100, 90);
const withSpur = [
  [start.lng, start.lat],
  [spurTip.lng, spurTip.lat],
  [spurEnd.lng, spurEnd.lat],
  [spurTip.lng, spurTip.lat],
  [a.lng, a.lat],
  [b.lng, b.lat],
  [start.lng, start.lat],
];

const c1 = measure(clean, start);
const c2 = measure(withSpur, start);
console.log("clean", c1);
console.log("withSpur", c2);

let ok = true;
if (c1.worst >= 60) {
  console.error("FAIL: clean circuit should have little/no spur");
  ok = false;
}
if (c2.worst < 70) {
  console.error("FAIL: spurred circuit should detect ~100m spur");
  ok = false;
}
if (c2.worst <= c1.worst) {
  console.error("FAIL: spurred should be worse than clean");
  ok = false;
}
if (!ok) process.exit(1);
console.log("OK");
