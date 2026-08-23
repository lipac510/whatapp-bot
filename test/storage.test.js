import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import { isMessageProcessed, listMessageEvents } from "../src/storage.js";

function supabaseErrorResponse(message) {
  return new Response(JSON.stringify({ message }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
}

function supabaseOkResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("admin list reads do not silently fall back to empty local data", async () => {
  const originalFetch = global.fetch;
  const originalUrl = config.supabaseUrl;
  const originalKey = config.supabaseServiceRoleKey;

  try {
    config.supabaseUrl = "https://example.supabase.co";
    config.supabaseServiceRoleKey = "service-role-key";

    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return supabaseErrorResponse("JWT issued at future");
    };

    await assert.rejects(() => listMessageEvents(), /JWT issued at future/);
    assert.equal(calls, 3);
  } finally {
    config.supabaseUrl = originalUrl;
    config.supabaseServiceRoleKey = originalKey;
    global.fetch = originalFetch;
  }
});

test("recoverable Supabase errors do not disable later Supabase reads", async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const originalUrl = config.supabaseUrl;
  const originalKey = config.supabaseServiceRoleKey;

  try {
    config.supabaseUrl = "https://example.supabase.co";
    config.supabaseServiceRoleKey = "service-role-key";
    console.warn = () => {};

    let failedCalls = 0;
    global.fetch = async () => {
      failedCalls += 1;
      return supabaseErrorResponse("JWT issued at future");
    };

    assert.equal(await isMessageProcessed("mid-storage-test"), false);
    assert.equal(failedCalls, 3);

    let successCalls = 0;
    global.fetch = async () => {
      successCalls += 1;
      return supabaseOkResponse([{ message_id: "mid-storage-test" }]);
    };

    assert.equal(await isMessageProcessed("mid-storage-test"), true);
    assert.equal(successCalls, 1);
  } finally {
    config.supabaseUrl = originalUrl;
    config.supabaseServiceRoleKey = originalKey;
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
