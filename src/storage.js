import fs from "node:fs/promises";
import path from "node:path";
import { config, hasSupabaseConfig } from "./config.js";

const sessionsPath = path.join(config.dataDir, "sessions.json");
const inquiriesPath = path.join(config.dataDir, "inquiries.json");
const processedMessagesPath = path.join(config.dataDir, "processed-messages.json");
const failuresPath = path.join(config.dataDir, "failures.json");
const okkiSyncsPath = path.join(config.dataDir, "okki-syncs.json");
const messageEventsPath = path.join(config.dataDir, "message-events.json");
const knownCustomersPath = path.join(config.dataDir, "known-customers.json");
const handoffWindowsPath = path.join(config.dataDir, "handoff-windows.json");
const emmaRepliesPath = path.join(config.dataDir, "emma-replies.json");
const igTokensPath = path.join(config.dataDir, "ig-tokens.json");

const storageLimits = {
  failures: 1000,
  okkiSyncs: 1000,
  messageEvents: 10000,
  processedMessages: 1000
};
const supabasePageSize = 1000;
const supabaseMaxAttempts = 3;
let lastSupabaseError = null;
let lastSupabaseOkAt = "";

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSupabaseEnabled() {
  return hasSupabaseConfig();
}

function isRecoverableSupabaseError(error) {
  const message = String(error?.message || "");
  return /JWT issued at future|Invalid JWT|expired|network|fetch failed|ECONNRESET|ENOTFOUND|timed out|timeout/i.test(message);
}

function describeError(error) {
  const message = String(error?.message || error);
  const cause = error?.cause || {};
  const details = [
    cause.code ? `code=${cause.code}` : "",
    cause.errno ? `errno=${cause.errno}` : "",
    cause.syscall ? `syscall=${cause.syscall}` : "",
    cause.hostname ? `host=${cause.hostname}` : ""
  ].filter(Boolean);
  return details.length ? `${message} (${details.join(", ")})` : message;
}

function detailedError(error) {
  const message = describeError(error);
  return message === error?.message ? error : new Error(message);
}

async function withSupabaseFallback(label, localOperation, supabaseOperation) {
  if (!isSupabaseEnabled()) {
    return localOperation();
  }

  try {
    return await supabaseOperation();
  } catch (error) {
    if (!isRecoverableSupabaseError(error)) throw error;
    noteSupabaseError(label, error);
    console.warn(`${label}: ${error.message}. Falling back to local storage for this operation.`);
    return localOperation();
  }
}

function noteSupabaseError(label, error) {
  lastSupabaseError = {
    label,
    message: describeError(error),
    at: new Date().toISOString()
  };
}

function noteSupabaseOk() {
  lastSupabaseOkAt = new Date().toISOString();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getStorageStatus() {
  const supabaseHost = (() => {
    try {
      return config.supabaseUrl ? new URL(config.supabaseUrl).hostname : "";
    } catch {
      return "invalid-url";
    }
  })();

  return {
    mode: isSupabaseEnabled() ? "supabase" : "local",
    supabaseConfigured: hasSupabaseConfig(),
    supabaseHost,
    localDataDir: config.dataDir,
    supabaseMaxAttempts,
    lastSupabaseOkAt,
    lastSupabaseError
  };
}

async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function buildSupabaseUrl(table, params = {}) {
  const url = new URL(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function supabaseRequest(method, table, { params = {}, body, prefer } = {}) {
  for (let attempt = 1; attempt <= supabaseMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(buildSupabaseUrl(table, params), {
        method,
        headers: {
          apikey: config.supabaseServiceRoleKey,
          Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
          ...(prefer ? { Prefer: prefer } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      if (!response.ok) {
        const detail = payload?.message || payload?.error_description || payload?.hint || response.statusText;
        throw new Error(`Supabase ${table} ${method} failed: ${detail}`);
      }

      noteSupabaseOk();
      return payload;
    } catch (error) {
      const detailed = detailedError(error);
      noteSupabaseError(`Supabase ${table} ${method} failed`, detailed);
      if (!isRecoverableSupabaseError(detailed) || attempt === supabaseMaxAttempts) throw detailed;
      await wait(250 * attempt);
    }
  }
}

async function supabaseSelect(table, params = {}) {
  return (await supabaseRequest("GET", table, { params })) || [];
}

async function supabaseSelectAll(table, params = {}, pageSize = supabasePageSize) {
  const rows = [];
  let offset = 0;

  while (true) {
    const batch = await supabaseSelect(table, {
      ...params,
      limit: String(pageSize),
      offset: String(offset)
    });

    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function supabaseInsert(table, row) {
  return supabaseRequest("POST", table, {
    body: Array.isArray(row) ? row : [row],
    prefer: "return=representation"
  });
}

async function supabaseUpsert(table, row, onConflict) {
  const params = onConflict ? { on_conflict: onConflict } : {};
  return supabaseRequest("POST", table, {
    params,
    body: Array.isArray(row) ? row : [row],
    prefer: "resolution=merge-duplicates,return=representation"
  });
}

async function supabaseDelete(table, params = {}) {
  return supabaseRequest("DELETE", table, { params });
}

function rowToStoredPayload(row) {
  return {
    ...(row.payload || {}),
    ...(row.id ? { id: row.id } : {}),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {})
  };
}

function chunkRows(rows, size = 250) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function upsertMany(table, rows, onConflict) {
  for (const chunk of chunkRows(rows)) {
    await supabaseUpsert(table, chunk, onConflict);
  }
}

async function flushArrayFile(filePath, table, mapRecord) {
  const records = await readJson(filePath, []);
  if (!records.length) return 0;
  await upsertMany(table, records.map(mapRecord), "id");
  await writeJson(filePath, []);
  return records.length;
}

async function flushObjectFile(filePath, table, mapEntries, emptyValue = {}, onConflict = "customer_id") {
  const records = await readJson(filePath, {});
  const entries = Object.entries(records);
  if (!entries.length) return 0;
  await upsertMany(table, mapEntries(entries), onConflict);
  await writeJson(filePath, emptyValue);
  return entries.length;
}

async function flushOne(stats, name, operation) {
  try {
    stats[name] = { count: await operation() };
  } catch (error) {
    noteSupabaseError(`Supabase ${name} local flush failed`, error);
    stats[name] = { error: error.message };
  }
}

let localFlushInFlight = null;

export async function flushLocalFallbackToSupabase() {
  if (!isSupabaseEnabled()) {
    return { skipped: true, reason: "Supabase is not configured" };
  }

  if (localFlushInFlight) return localFlushInFlight;

  localFlushInFlight = (async () => {
    const stats = {};

    await flushOne(stats, "sessions", () =>
      flushObjectFile(sessionsPath, "sessions", (entries) =>
        entries.map(([customerId, session]) => ({
          customer_id: customerId,
          payload: session,
          updated_at: session.updatedAt || new Date().toISOString()
        }))
      )
    );

    await flushOne(stats, "inquiries", () =>
      flushArrayFile(inquiriesPath, "inquiries", (record) => ({
        id: record.id,
        customer_id: record.customerId || "",
        profile_name: record.profileName || "",
        payload: record,
        created_at: record.createdAt || new Date().toISOString()
      }))
    );

    await flushOne(stats, "processed_messages", () =>
      flushObjectFile(
        processedMessagesPath,
        "processed_messages",
        (entries) =>
          entries.map(([messageId, processedAt]) => ({
            message_id: messageId,
            processed_at: processedAt || new Date().toISOString()
          })),
        {},
        "message_id"
      )
    );

    await flushOne(stats, "failures", () =>
      flushArrayFile(failuresPath, "failures", (record) => ({
        id: record.id,
        customer_id: record.customerId || "",
        message_id: record.messageId || "",
        payload: record,
        created_at: record.createdAt || new Date().toISOString()
      }))
    );

    await flushOne(stats, "okki_syncs", () =>
      flushArrayFile(okkiSyncsPath, "okki_syncs", (record) => ({
        id: record.id,
        customer_id: record.customerId || "",
        message_id: record.messageId || "",
        payload: record,
        created_at: record.createdAt || new Date().toISOString()
      }))
    );

    await flushOne(stats, "message_events", () =>
      flushArrayFile(messageEventsPath, "message_events", (record) => ({
        id: record.id,
        customer_id: record.customerId || "",
        message_id: record.messageId || "",
        direction: record.direction || "",
        event_type: record.type || "",
        category: record.category || "",
        payload: record,
        created_at: record.createdAt || new Date().toISOString()
      }))
    );

    await flushOne(stats, "known_customers", () =>
      flushObjectFile(knownCustomersPath, "known_customers", (entries) =>
        entries.map(([customerId, record]) => ({
          customer_id: customerId,
          reason: record.reason || "",
          updated_at: record.updatedAt || new Date().toISOString()
        }))
      )
    );

    await flushOne(stats, "handoff_windows", () =>
      flushObjectFile(handoffWindowsPath, "handoff_windows", (entries) =>
        entries.map(([customerId, record]) => ({
          customer_id: customerId,
          completed_at: record.completedAt || new Date().toISOString(),
          reminder_sent: Boolean(record.reminderSent),
          reminder_sent_at: record.reminderSentAt || null
        }))
      )
    );

    await flushOne(stats, "emma_replies", () =>
      flushObjectFile(emmaRepliesPath, "emma_replies", (entries) =>
        entries.map(([customerId, record]) => ({
          customer_id: customerId,
          reason: record.reason || "",
          sent_at: record.sentAt || new Date().toISOString()
        }))
      )
    );

    await flushOne(stats, "ig_tokens", () =>
      flushObjectFile(
        igTokensPath,
        "ig_tokens",
        (entries) =>
          entries.map(([accountKey, record]) => ({
            account_key: accountKey,
            payload: record,
            updated_at: record.updatedAt || new Date().toISOString()
          })),
        {},
        "account_key"
      )
    );

    return stats;
  })().finally(() => {
    localFlushInFlight = null;
  });

  return localFlushInFlight;
}

export async function getSession(customerId) {
  if (!isSupabaseEnabled()) {
    await ensureDataDir();
    const sessions = await readJson(sessionsPath, {});
    return sessions[customerId] || null;
  }
  return withSupabaseFallback(
    "Supabase sessions GET failed",
    async () => {
      await ensureDataDir();
      const sessions = await readJson(sessionsPath, {});
      return sessions[customerId] || null;
    },
    async () => {
      const rows = await supabaseSelect("sessions", {
        select: "customer_id,payload,updated_at",
        customer_id: `eq.${customerId}`,
        limit: "1"
      });
      return rows[0] ? rowToStoredPayload(rows[0]) : null;
    }
  );
}

export async function listSessions() {
  if (!isSupabaseEnabled()) {
    return readJson(sessionsPath, {});
  }

  const rows = await supabaseSelectAll("sessions", {
    select: "customer_id,payload,updated_at",
    order: "updated_at.desc"
  });
  return Object.fromEntries(rows.map((row) => [row.customer_id, rowToStoredPayload(row)]));
}

export async function saveSession(customerId, session) {
  const next = {
    ...session,
    updatedAt: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase sessions UPSERT failed",
    async () => {
      const sessions = await readJson(sessionsPath, {});
      sessions[customerId] = next;
      await writeJson(sessionsPath, sessions);
    },
    async () => {
      await supabaseUpsert(
        "sessions",
        {
          customer_id: customerId,
          payload: next,
          updated_at: next.updatedAt
        },
        "customer_id"
      );
    }
  );
}

export async function clearSession(customerId) {
  return withSupabaseFallback(
    "Supabase sessions DELETE failed",
    async () => {
      const sessions = await readJson(sessionsPath, {});
      delete sessions[customerId];
      await writeJson(sessionsPath, sessions);
    },
    async () => {
      await supabaseDelete("sessions", {
        customer_id: `eq.${customerId}`
      });
    }
  );
}

export async function saveInquiry(inquiry) {
  const record = {
    id: `${Date.now()}-${inquiry.customerId}`,
    ...inquiry,
    createdAt: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase inquiries INSERT failed",
    async () => {
      const inquiries = await readJson(inquiriesPath, []);
      inquiries.push(record);
      await writeJson(inquiriesPath, inquiries);
    },
    async () => {
      await supabaseInsert("inquiries", {
        id: record.id,
        customer_id: inquiry.customerId,
        profile_name: inquiry.profileName || "",
        payload: record,
        created_at: record.createdAt
      });
    }
  );
}

export async function listInquiries() {
  if (!isSupabaseEnabled()) {
    return readJson(inquiriesPath, []);
  }

  const rows = await supabaseSelectAll("inquiries", {
    select: "id,payload,created_at",
    order: "created_at.asc"
  });
  return rows.map(rowToStoredPayload);
}

export async function isMessageProcessed(messageId) {
  return withSupabaseFallback(
    "Supabase processed_messages GET failed",
    async () => {
      const processed = await readJson(processedMessagesPath, {});
      return Boolean(processed[messageId]);
    },
    async () => {
      const rows = await supabaseSelect("processed_messages", {
        select: "message_id",
        message_id: `eq.${messageId}`,
        limit: "1"
      });
      return rows.length > 0;
    }
  );
}

export async function markMessageProcessed(messageId) {
  const processedAt = new Date().toISOString();
  return withSupabaseFallback(
    "Supabase processed_messages UPSERT failed",
    async () => {
      const processed = await readJson(processedMessagesPath, {});
      processed[messageId] = processedAt;
      const entries = Object.entries(processed).slice(-storageLimits.processedMessages);
      await writeJson(processedMessagesPath, Object.fromEntries(entries));
    },
    async () => {
      await supabaseUpsert(
        "processed_messages",
        {
          message_id: messageId,
          processed_at: processedAt
        },
        "message_id"
      );
    }
  );
}

export async function saveFailure(failure) {
  const record = {
    id: randomId("failure"),
    ...failure,
    createdAt: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase failures INSERT failed",
    async () => {
      const failures = await readJson(failuresPath, []);
      failures.push(record);
      await writeJson(failuresPath, failures.slice(-storageLimits.failures));
    },
    async () => {
      await supabaseInsert("failures", {
        id: record.id,
        customer_id: failure.customerId || "",
        message_id: failure.messageId || "",
        payload: record,
        created_at: record.createdAt
      });
    }
  );
}

export async function listFailures() {
  if (!isSupabaseEnabled()) {
    return readJson(failuresPath, []);
  }

  const rows = await supabaseSelectAll("failures", {
    select: "id,payload,created_at",
    order: "created_at.asc"
  });
  return rows.map(rowToStoredPayload);
}

export async function saveOkkiSync(sync) {
  const record = {
    id: randomId("okki"),
    ...sync,
    createdAt: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase okki_syncs INSERT failed",
    async () => {
      const syncs = await readJson(okkiSyncsPath, []);
      syncs.push(record);
      await writeJson(okkiSyncsPath, syncs.slice(-storageLimits.okkiSyncs));
    },
    async () => {
      await supabaseInsert("okki_syncs", {
        id: record.id,
        customer_id: sync.customerId || "",
        message_id: sync.messageId || "",
        payload: record,
        created_at: record.createdAt
      });
    }
  );
}

export async function listOkkiSyncs() {
  if (!isSupabaseEnabled()) {
    return readJson(okkiSyncsPath, []);
  }

  const rows = await supabaseSelectAll("okki_syncs", {
    select: "id,payload,created_at",
    order: "created_at.asc"
  });
  return rows.map(rowToStoredPayload);
}

export async function saveMessageEvent(event) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...event,
    createdAt: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase message_events INSERT failed",
    async () => {
      const events = await readJson(messageEventsPath, []);
      events.push(record);
      await writeJson(messageEventsPath, events.slice(-storageLimits.messageEvents));
    },
    async () => {
      await supabaseInsert("message_events", {
        id: record.id,
        customer_id: event.customerId || "",
        message_id: event.messageId || "",
        direction: event.direction || "",
        event_type: event.type || "",
        category: event.category || "",
        payload: record,
        created_at: record.createdAt
      });
    }
  );
}

export async function listMessageEvents() {
  if (!isSupabaseEnabled()) {
    return readJson(messageEventsPath, []);
  }

  const rows = await supabaseSelectAll("message_events", {
    select: "id,payload,created_at",
    order: "created_at.asc"
  });
  return rows.map(rowToStoredPayload);
}

export async function isKnownCustomer(customerId) {
  return withSupabaseFallback(
    "Supabase known_customers GET failed",
    async () => {
      const knownCustomers = await readJson(knownCustomersPath, {});
      return Boolean(knownCustomers[customerId]);
    },
    async () => {
      const rows = await supabaseSelect("known_customers", {
        select: "customer_id",
        customer_id: `eq.${customerId}`,
        limit: "1"
      });
      return rows.length > 0;
    }
  );
}

export async function listKnownCustomers() {
  if (!isSupabaseEnabled()) {
    return readJson(knownCustomersPath, {});
  }

  const rows = await supabaseSelectAll("known_customers", {
    select: "customer_id,reason,updated_at",
    order: "updated_at.desc"
  });
  return Object.fromEntries(
    rows.map((row) => [
      row.customer_id,
      {
        reason: row.reason,
        updatedAt: row.updated_at
      }
    ])
  );
}

export async function markKnownCustomer(customerId, reason = "okki") {
  const row = {
    customer_id: customerId,
    reason,
    updated_at: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase known_customers UPSERT failed",
    async () => {
      const knownCustomers = await readJson(knownCustomersPath, {});
      knownCustomers[customerId] = {
        reason,
        updatedAt: row.updated_at
      };
      await writeJson(knownCustomersPath, knownCustomers);
    },
    async () => {
      await supabaseUpsert("known_customers", row, "customer_id");
    }
  );
}

export async function getHandoffWindow(customerId) {
  return withSupabaseFallback(
    "Supabase handoff_windows GET failed",
    async () => {
      const handoffWindows = await readJson(handoffWindowsPath, {});
      return handoffWindows[customerId] || null;
    },
    async () => {
      const rows = await supabaseSelect("handoff_windows", {
        select: "customer_id,completed_at,reminder_sent,reminder_sent_at",
        customer_id: `eq.${customerId}`,
        limit: "1"
      });
      return rows[0]
        ? {
            completedAt: rows[0].completed_at,
            reminderSent: rows[0].reminder_sent,
            reminderSentAt: rows[0].reminder_sent_at
          }
        : null;
    }
  );
}

export async function listHandoffWindows() {
  if (!isSupabaseEnabled()) {
    return readJson(handoffWindowsPath, {});
  }

  const rows = await supabaseSelectAll("handoff_windows", {
    select: "customer_id,completed_at,reminder_sent,reminder_sent_at",
    order: "completed_at.desc"
  });
  return Object.fromEntries(
    rows.map((row) => [
      row.customer_id,
      {
        completedAt: row.completed_at,
        reminderSent: row.reminder_sent,
        reminderSentAt: row.reminder_sent_at
      }
    ])
  );
}

export async function markHandoffWindow(customerId) {
  const row = {
    customer_id: customerId,
    completed_at: new Date().toISOString(),
    reminder_sent: false,
    reminder_sent_at: null
  };

  return withSupabaseFallback(
    "Supabase handoff_windows UPSERT failed",
    async () => {
      const handoffWindows = await readJson(handoffWindowsPath, {});
      handoffWindows[customerId] = {
        completedAt: row.completed_at,
        reminderSent: false
      };
      await writeJson(handoffWindowsPath, handoffWindows);
    },
    async () => {
      await supabaseUpsert("handoff_windows", row, "customer_id");
    }
  );
}

export async function markHandoffReminderSent(customerId) {
  const reminderSentAt = new Date().toISOString();
  return withSupabaseFallback(
    "Supabase handoff_windows reminder UPSERT failed",
    async () => {
      const handoffWindows = await readJson(handoffWindowsPath, {});
      handoffWindows[customerId] = {
        ...(handoffWindows[customerId] || {}),
        reminderSent: true,
        reminderSentAt
      };
      await writeJson(handoffWindowsPath, handoffWindows);
    },
    async () => {
      const existing = await getHandoffWindow(customerId);
      await supabaseUpsert(
        "handoff_windows",
        {
          customer_id: customerId,
          completed_at: existing?.completedAt || reminderSentAt,
          reminder_sent: true,
          reminder_sent_at: reminderSentAt
        },
        "customer_id"
      );
    }
  );
}

export async function wasEmmaReplySent(customerId) {
  return withSupabaseFallback(
    "Supabase emma_replies GET failed",
    async () => {
      const emmaReplies = await readJson(emmaRepliesPath, {});
      return Boolean(emmaReplies[customerId]);
    },
    async () => {
      const rows = await supabaseSelect("emma_replies", {
        select: "customer_id",
        customer_id: `eq.${customerId}`,
        limit: "1"
      });
      return rows.length > 0;
    }
  );
}

export async function listEmmaReplies() {
  if (!isSupabaseEnabled()) {
    return readJson(emmaRepliesPath, {});
  }

  const rows = await supabaseSelectAll("emma_replies", {
    select: "customer_id,reason,sent_at",
    order: "sent_at.desc"
  });
  return Object.fromEntries(
    rows.map((row) => [
      row.customer_id,
      {
        reason: row.reason,
        sentAt: row.sent_at
      }
    ])
  );
}

// Durable storage for refreshed Instagram access tokens (survives restarts via Supabase).
// Keyed by account key ("_default" for the IG_ACCESS_TOKEN fallback, or the IG account id).
export async function listIgTokens() {
  if (!isSupabaseEnabled()) {
    return readJson(igTokensPath, {});
  }

  return withSupabaseFallback(
    "Supabase ig_tokens GET failed",
    async () => readJson(igTokensPath, {}),
    async () => {
      const rows = await supabaseSelect("ig_tokens", {
        select: "account_key,payload,updated_at",
        limit: "1000"
      });
      return Object.fromEntries(rows.map((row) => [row.account_key, rowToStoredPayload(row)]));
    }
  );
}

export async function saveIgToken(accountKey, payload) {
  const next = { ...payload, updatedAt: new Date().toISOString() };

  return withSupabaseFallback(
    "Supabase ig_tokens UPSERT failed",
    async () => {
      const tokens = await readJson(igTokensPath, {});
      tokens[accountKey] = next;
      await writeJson(igTokensPath, tokens);
    },
    async () => {
      await supabaseUpsert(
        "ig_tokens",
        {
          account_key: accountKey,
          payload: next,
          updated_at: next.updatedAt
        },
        "account_key"
      );
    }
  );
}

export async function markEmmaReplySent(customerId, reason = "existing_customer") {
  const row = {
    customer_id: customerId,
    reason,
    sent_at: new Date().toISOString()
  };

  return withSupabaseFallback(
    "Supabase emma_replies UPSERT failed",
    async () => {
      const emmaReplies = await readJson(emmaRepliesPath, {});
      emmaReplies[customerId] = {
        reason,
        sentAt: row.sent_at
      };
      await writeJson(emmaRepliesPath, emmaReplies);
    },
    async () => {
      await supabaseUpsert("emma_replies", row, "customer_id");
    }
  );
}
