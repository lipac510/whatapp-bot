import test from "node:test";
import assert from "node:assert/strict";
import { extractIncomingMessages, parseRoutingId, toRoutingId } from "../src/instagram.js";

test("extracts incoming Instagram text messages with an account-scoped routing id", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        id: "acct-1",
        messaging: [
          {
            sender: { id: "17841400000000001" },
            recipient: { id: "acct-1" },
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
      from: "instagram:acct-1:17841400000000001",
      igUserId: "17841400000000001",
      igAccountId: "acct-1",
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
        id: "acct-2",
        messaging: [
          {
            sender: { id: "ig-2" },
            recipient: { id: "acct-2" },
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
  assert.equal(messages[0].from, "instagram:acct-2:ig-2");
});

test("drops echoes, reactions and read receipts", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        id: "acct-3",
        messaging: [
          { sender: { id: "ig-3" }, recipient: { id: "acct-3" }, message: { mid: "mid.echo", text: "bot reply", is_echo: true } },
          { sender: { id: "ig-3" }, recipient: { id: "acct-3" }, read: { mid: "mid.read" } },
          { sender: { id: "ig-3" }, recipient: { id: "acct-3" }, reaction: { reaction: "love" } },
          { sender: { id: "ig-3" }, recipient: { id: "acct-3" }, message: { mid: "mid.real", text: "real customer" } }
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
        id: "acct-4",
        messaging: [
          {
            sender: { id: "ig-4" },
            recipient: { id: "acct-4" },
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

test("surfaces an unparseable message as unsupported", () => {
  const messages = extractIncomingMessages({
    object: "instagram",
    entry: [
      {
        id: "acct-9",
        messaging: [
          {
            sender: { id: "ig-9" },
            recipient: { id: "acct-9" },
            message: { mid: "mid.audio", attachments: [{ type: "audio", payload: {} }] }
          }
        ]
      }
    ]
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "unsupported");
  assert.equal(messages[0].from, "instagram:acct-9:ig-9");
});

test("routing id encodes account + user and round-trips", () => {
  assert.equal(toRoutingId("acct-1", "user-9"), "instagram:acct-1:user-9");
  assert.deepEqual(parseRoutingId("instagram:acct-1:user-9"), {
    accountId: "acct-1",
    igUserId: "user-9"
  });
  // legacy / accountless id still yields a usable recipient
  assert.deepEqual(parseRoutingId("instagram:user-9"), { accountId: "", igUserId: "user-9" });
});
