import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminModel, renderAdminPage } from "../src/admin.js";

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
  assert.doesNotMatch(html, /<script>/);
});
