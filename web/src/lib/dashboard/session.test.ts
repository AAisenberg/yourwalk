import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SESSION_MAX_AGE_S,
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from "./session";

const SECRET = "test-secret-with-some-length";

test("a fresh token verifies", async () => {
  const t = await createSessionToken(SECRET, 1_000);
  assert.equal(await verifySessionToken(t, SECRET, 2_000), true);
});

test("an expired token fails", async () => {
  const t = await createSessionToken(SECRET, 0);
  assert.equal(await verifySessionToken(t, SECRET, SESSION_MAX_AGE_S * 1000 + 1), false);
});

test("a tampered expiry fails", async () => {
  const t = await createSessionToken(SECRET, 1_000);
  const [, sig] = t.split(".");
  assert.equal(await verifySessionToken(`99999999999999.${sig}`, SECRET, 2_000), false);
});

test("a rotated secret revokes old tokens", async () => {
  const t = await createSessionToken(SECRET, 1_000);
  assert.equal(await verifySessionToken(t, "a-new-secret", 2_000), false);
});

test("missing or malformed tokens fail", async () => {
  assert.equal(await verifySessionToken(undefined, SECRET), false);
  assert.equal(await verifySessionToken("nonsense", SECRET), false);
  assert.equal(await verifySessionToken(".abc", SECRET), false);
});

test("password compare", async () => {
  assert.equal(await passwordMatches("casey walks", "casey walks"), true);
  assert.equal(await passwordMatches("casey walk", "casey walks"), false);
  assert.equal(await passwordMatches("", "casey walks"), false);
});
