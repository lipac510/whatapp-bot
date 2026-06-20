import test from "node:test";
import assert from "node:assert/strict";
import { isRefreshDue, pickToken, reconcileTokens } from "../src/igTokens.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

test("reconcileTokens seeds a new entry when nothing is persisted", () => {
  const { registry, toPersist } = reconcileTokens([{ key: "_default", token: "T1" }], {}, NOW);
  assert.equal(registry._default.token, "T1");
  assert.equal(registry._default.seed, "T1");
  assert.equal(registry._default.everRefreshed, false);
  assert.equal(toPersist.length, 1);
});

test("reconcileTokens continues the refreshed chain when the seed still matches", () => {
  const persisted = {
    _default: { token: "REFRESHED", seed: "T1", expiresAt: NOW + 30 * DAY, refreshedAt: NOW - 2 * DAY, everRefreshed: true }
  };
  const { registry, toPersist } = reconcileTokens([{ key: "_default", token: "T1" }], persisted, NOW);
  assert.equal(registry._default.token, "REFRESHED");
  assert.equal(registry._default.everRefreshed, true);
  assert.equal(toPersist.length, 0);
});

test("reconcileTokens re-seeds when the env token was rotated", () => {
  const persisted = {
    _default: { token: "REFRESHED", seed: "T1", expiresAt: NOW + 30 * DAY, refreshedAt: NOW - 2 * DAY, everRefreshed: true }
  };
  const { registry, toPersist } = reconcileTokens([{ key: "_default", token: "T2" }], persisted, NOW);
  assert.equal(registry._default.token, "T2");
  assert.equal(registry._default.seed, "T2");
  assert.equal(toPersist.length, 1);
});

test("isRefreshDue respects the 24h minimum age", () => {
  assert.equal(isRefreshDue({ token: "x", refreshedAt: NOW - 60 * 60 * 1000, everRefreshed: false }, NOW), false);
});

test("isRefreshDue triggers a learn-refresh once old enough but never refreshed", () => {
  assert.equal(
    isRefreshDue({ token: "x", refreshedAt: NOW - 2 * DAY, everRefreshed: false, expiresAt: NOW + 50 * DAY }, NOW),
    true
  );
});

test("isRefreshDue waits while far from expiry, refreshes within 15 days", () => {
  assert.equal(
    isRefreshDue({ token: "x", refreshedAt: NOW - 20 * DAY, everRefreshed: true, expiresAt: NOW + 40 * DAY }, NOW),
    false
  );
  assert.equal(
    isRefreshDue({ token: "x", refreshedAt: NOW - 20 * DAY, everRefreshed: true, expiresAt: NOW + 10 * DAY }, NOW),
    true
  );
});

test("pickToken uses the exact account, then falls back to _default", () => {
  const registry = { _default: { token: "D" }, acct2: { token: "A2" } };
  assert.equal(pickToken(registry, "acct2"), "A2");
  assert.equal(pickToken(registry, "unknown"), "D");
  assert.equal(pickToken({}, "x"), "");
});
