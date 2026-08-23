import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminModel, renderAdminCsv, renderAdminErrorPage, renderAdminPage } from "../src/admin.js";

test("builds admin conversations from message and OKKI logs", () => {
  const model = buildAdminModel({
    messages: [
      {
        customerId: "8618014856231",
        profileName: "Buyer",
        direction: "in",
        type: "text",
        text: "1",
        createdAt: "2026-06-10T00:00:00.000Z"
      },
      {
        customerId: "8618014856231",
        direction: "out",
        type: "text",
        text: "What quantity do you need?",
        createdAt: "2026-06-10T00:01:00.000Z"
      }
    ],
    inquiries: [
      {
        customerId: "8618014856231",
        product: "Corrugated Box",
        quantity: "5000",
        address: "USA",
        createdAt: "2026-06-10T00:02:00.000Z"
      }
    ],
    okkiSyncs: [
      {
        customerId: "8618014856231",
        ok: true,
        createdAt: "2026-06-10T00:03:00.000Z"
      }
    ]
  });

  assert.equal(model.totals.conversations, 1);
  assert.equal(model.totals.okkiSynced, 1);
  assert.equal(model.totals.messages, 2);
  assert.equal(model.conversations[0].status, "OKKI synced");
  assert.equal(model.conversations[0].product, "Corrugated Box");
});

test("assigns a stable first-contact number independent of recent-activity order", () => {
  const model = buildAdminModel({
    messages: [
      { customerId: "A", text: "hi", createdAt: "2026-06-01T00:00:00.000Z" },
      { customerId: "B", text: "hi", createdAt: "2026-06-02T00:00:00.000Z" },
      { customerId: "A", text: "again", createdAt: "2026-06-03T00:00:00.000Z" }
    ]
  });

  // List is sorted by recent activity: A (active 06-03) on top, B below.
  assert.equal(model.conversations[0].customerId, "A");
  assert.equal(model.conversations[1].customerId, "B");

  // But the number is by FIRST contact and never changes: A = 1, B = 2.
  const a = model.conversations.find((c) => c.customerId === "A");
  const b = model.conversations.find((c) => c.customerId === "B");
  assert.equal(a.seqNo, 1);
  assert.equal(b.seqNo, 2);
});

test("filters admin conversations by product or customer", () => {
  const model = buildAdminModel({
    messages: [
      { customerId: "111", text: "paper bag", createdAt: "2026-06-10T00:00:00.000Z" },
      { customerId: "222", text: "rigid box", createdAt: "2026-06-10T00:00:00.000Z" }
    ],
    inquiries: [
      { customerId: "111", product: "Paper Bag" },
      { customerId: "222", product: "Luxury Rigid Box" }
    ],
    query: "paper"
  });

  assert.equal(model.conversations.length, 1);
  assert.equal(model.conversations[0].customerId, "111");
});

test("renders admin HTML with escaped customer content", () => {
  const model = buildAdminModel({
    messages: [
      {
        customerId: "8618014856231",
        profileName: "<script>",
        direction: "in",
        type: "text",
        text: "<img src=x>",
        createdAt: "2026-06-10T00:00:00.000Z"
      }
    ]
  });

  const html = renderAdminPage({
    model,
    messages: [
      {
        customerId: "8618014856231",
        profileName: "<script>",
        direction: "in",
        type: "text",
        text: "<img src=x>",
        createdAt: "2026-06-10T00:00:00.000Z"
      }
    ],
    selectedCustomerId: "8618014856231"
  });

  assert.match(html, /8618014856231/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x&gt;/);
  // User-supplied "<script>" must be escaped; the page's own <script> block is allowed.
  assert.doesNotMatch(html, /<script>alert/);
});

test("renders admin HTML with row number and export link", () => {
  const model = buildAdminModel({
    messages: [
      {
        customerId: "123",
        profileName: "Alice",
        direction: "in",
        type: "text",
        text: "hello",
        createdAt: "2026-06-10T00:00:00.000Z"
      }
    ]
  });

  const html = renderAdminPage({
    model,
    messages: model.conversations
  });

  assert.match(html, /<th>No\.<\/th>/);
  assert.match(html, /Download Excel/);
});

test("renders admin csv export", () => {
  const model = buildAdminModel({
    messages: [
      {
        customerId: "123",
        profileName: "Alice",
        direction: "in",
        type: "text",
        text: "hello",
        createdAt: "2026-06-10T00:00:00.000Z"
      }
    ],
    inquiries: [
      {
        customerId: "123",
        product: "Paper Bag",
        quantity: "500",
        address: "USA",
        createdAt: "2026-06-10T00:01:00.000Z"
      }
    ]
  });

  const csv = renderAdminCsv(model);

  assert.match(csv, /"No\.","Customer ID"/);
  assert.match(csv, /\"123\"/);
  assert.match(csv, /\"Paper Bag\"/);
});

test("renders explicit admin storage errors instead of an empty dashboard", () => {
  const html = renderAdminErrorPage({
    error: new Error("Supabase message_events GET failed: JWT issued at future"),
    storageStatus: {
      mode: "supabase",
      supabaseConfigured: true
    }
  });

  assert.match(html, /Supabase data could not be loaded/);
  assert.match(html, /not showing zero customers/);
  assert.match(html, /JWT issued at future/);
});
