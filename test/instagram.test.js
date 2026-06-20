import test from "node:test";
import assert from "node:assert/strict";
import { extractIncomingMessages, stripRoutingPrefix, toRoutingId } from "../src/instagram.js";

test("extracts incoming Instagram text messages with a routing-prefixed id", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        messaging: [
          {
            sender: { id: "17841400000000001" },
            recipient: { id: "page-1" },
            timestamp: 1780000000,
            message: { mid: "mid.text", text: "Hello" }
          }
        ]
      }
    ]
  });

  assert.deepEqual(messages, [
    {
      id: "mid.text",
      from: "instagram:17841400000000001",
      igUserId: "17841400000000001",
      profileName: "",
      username: "",
      timestamp: 1780000000,
      type: "text",
      text: "Hello"
    }
  ]);
});

test("extracts Instagram image attachments as media with a direct url", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        messaging: [
          {
            sender: { id: "ig-2" },
            timestamp: 1780000001,
            message: {
              mid: "mid.image",
              attachments: [{ type: "image", payload: { url: "https://cdn.ig/img.jpg" } }]
            }
          }
        ]
      }
    ]
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "image");
  assert.equal(messages[0].mediaUrl, "https://cdn.ig/img.jpg");
  assert.equal(messages[0].from, "instagram:ig-2");
});

test("drops echoes, reactions and read receipts", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        messaging: [
          { sender: { id: "ig-3" }, message: { mid: "mid.echo", text: "bot reply", is_echo: true } },
          { sender: { id: "ig-3" }, read: { mid: "mid.read" } },
          { sender: { id: "ig-3" }, reaction: { reaction: "love" } },
          { sender: { id: "ig-3" }, message: { mid: "mid.real", text: "real customer" } }
        ]
      }
    ]
  });

  assert.deepEqual(messages.map((m) => m.id), ["mid.real"]);
});

test("records story/share attachments as a text link so they are captured", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        messaging: [
          {
            sender: { id: "ig-4" },
            message: {
              mid: "mid.share",
              attachments: [{ type: "share", payload: { url: "https://instagram.com/p/abc" } }]
            }
          }
        ]
      }
    ]
  });

  assert.equal(messages[0].type, "text");
  assert.match(messages[0].text, /instagram\.com\/p\/abc/);
});

test("routing prefix helpers round-trip", () => {
  assert.equal(toRoutingId("123"), "instagram:123");
  assert.equal(stripRoutingPrefix("instagram:123"), "123");
  assert.equal(stripRoutingPrefix("8618000000000"), "8618000000000");
});
