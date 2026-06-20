import { config } from "./config.js";
import { listIgTokens, saveIgToken } from "./storage.js";

const DAY = 24 * 60 * 60 * 1000;
const SEED_ASSUMED_LIFETIME = 60 * DAY; // IG long-lived tokens last ~60 days
const MIN_AGE_TO_REFRESH = 24 * 60 * 60 * 1000; // IG requires the token to be >= 24h old
const REFRESH_WHEN_WITHIN = 15 * DAY; // refresh once it's within 15 days of expiry
const DEFAULT_KEY = "_default"; // the IG_ACCESS_TOKEN fallback (account 1)

// ---- pure helpers (unit tested) ----

// Build the live registry from env "seed" tokens + persisted refreshed tokens.
// A persisted entry continues the chain only if it was seeded from the SAME env token,
// so rotating the env var cleanly takes over.
export function reconcileTokens(envTokens, persisted = {}, now = 0) {
  const registry = {};
  const toPersist = [];

  for (const { key, token } of envTokens) {
    if (!token) continue;
    const p = persisted[key];
    if (p && p.seed === token && p.token) {
      registry[key] = {
        token: p.token,
        seed: p.seed,
        expiresAt: Number(p.expiresAt) || now + SEED_ASSUMED_LIFETIME,
        refreshedAt: Number(p.refreshedAt) || now,
        everRefreshed: Boolean(p.everRefreshed)
      };
    } else {
      const entry = {
        token,
        seed: token,
        expiresAt: now + SEED_ASSUMED_LIFETIME,
        refreshedAt: now,
        everRefreshed: false
      };
      registry[key] = entry;
      toPersist.push({ key, entry });
    }
  }

  return { registry, toPersist };
}

export function isRefreshDue(entry, now = 0) {
  if (!entry || !entry.token) return false;
  if (now - (Number(entry.refreshedAt) || 0) < MIN_AGE_TO_REFRESH) return false; // too young to refresh
  if (!entry.everRefreshed) return true; // learn the real expiry once it's old enough
  return (Number(entry.expiresAt) || 0) - now <= REFRESH_WHEN_WITHIN;
}

export function pickToken(registry, accountId) {
  return registry?.[accountId]?.token || registry?.[DEFAULT_KEY]?.token || "";
}

// ---- runtime ----

let registry = {};
let refreshInFlight = false;
let lastMaybeRefresh = 0;

function envTokens() {
  const list = [];
  if (config.igAccessToken && !config.igAccessToken.includes("replace_with")) {
    list.push({ key: DEFAULT_KEY, token: config.igAccessToken });
  }
  for (const [id, token] of Object.entries(config.igAccounts || {})) {
    if (token) list.push({ key: id, token });
  }
  return list;
}

export async function initIgTokens() {
  const seeds = envTokens();
  if (!seeds.length) return; // Instagram not configured
  const persisted = await listIgTokens().catch(() => ({}));
  const { registry: next, toPersist } = reconcileTokens(seeds, persisted, Date.now());
  registry = next;
  for (const { key, entry } of toPersist) {
    await saveIgToken(key, entry).catch((error) =>
      console.warn(`ig_tokens seed persist failed for ${key}: ${error.message}`)
    );
  }
  console.log(`Instagram token registry ready: ${Object.keys(registry).length} account(s).`);
}

export function getToken(accountId) {
  return pickToken(registry, accountId);
}

async function refreshOne(key, entry) {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(entry.token)}`;
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload?.error?.message || `refresh failed (${response.status})`);
  }

  const now = Date.now();
  const updated = {
    ...entry,
    token: payload.access_token,
    expiresAt: now + Number(payload.expires_in || SEED_ASSUMED_LIFETIME / 1000) * 1000,
    refreshedAt: now,
    everRefreshed: true
  };
  registry[key] = updated;
  await saveIgToken(key, updated);
  console.log(`Instagram token refreshed for ${key}; expires in ~${Math.round((updated.expiresAt - now) / DAY)}d.`);
}

export async function refreshDueTokens() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const now = Date.now();
    for (const [key, entry] of Object.entries(registry)) {
      if (!isRefreshDue(entry, now)) continue;
      try {
        await refreshOne(key, entry);
      } catch (error) {
        console.warn(`Instagram token refresh failed for ${key}: ${error.message}`);
      }
    }
  } finally {
    refreshInFlight = false;
  }
}

// Cheap, throttled hook to call on inbound traffic so a sleepy free-tier instance still
// refreshes when it wakes up. Fire-and-forget.
export function maybeRefreshTokens() {
  const now = Date.now();
  if (now - lastMaybeRefresh < 60 * 60 * 1000) return; // at most once per hour
  lastMaybeRefresh = now;
  refreshDueTokens().catch(() => {});
}

export function startTokenScheduler() {
  if (!envTokens().length) return;
  setTimeout(() => refreshDueTokens().catch(() => {}), 30 * 1000);
  setInterval(() => refreshDueTokens().catch(() => {}), 6 * 60 * 60 * 1000);
}

function maskKey(key) {
  if (key === DEFAULT_KEY) return key;
  const s = String(key);
  return s.length <= 4 ? s : `…${s.slice(-4)}`;
}

// Non-sensitive snapshot for diagnostics (never exposes the token value).
export function tokenSnapshot() {
  const now = Date.now();
  return Object.entries(registry).map(([key, entry]) => ({
    account: maskKey(key),
    hasToken: Boolean(entry.token),
    everRefreshed: entry.everRefreshed,
    expiresInDays: Math.round(((Number(entry.expiresAt) || 0) - now) / DAY),
    refreshedAt: new Date(Number(entry.refreshedAt) || 0).toISOString()
  }));
}
