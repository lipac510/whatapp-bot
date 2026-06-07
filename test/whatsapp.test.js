import test from "node:test";
import assert from "node:assert/strict";
import { extractIncomingMessages } from "../src/whatsapp.js";

test("extracts incoming WhatsApp text messages", () => {
  const messages = extractIncomingMessages({
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [
                {
                  wa_id: "8618014856231",
                  profile: { name: "Buyer" }
                }
              ],
              messages: [
                {
                  id: "wamid.test",
                  from: "8618014856231",
                  timestamp: "1780000000",
                  type: "text",
                  text: { body: "你好" }
                }
              ]
            }
          }
        ]
      }
    ]
  });

  assert.deepEqual(messages, [
    {
      id: "wamid.test",
      from: "8618014856231",
      profileName: "Buyer",
      text: "你好",
      timestamp: "1780000000"
    }
  ]);
});

test("ignores unsupported message types", () => {
  const messages = extractIncomingMessages({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: "wamid.image",
                  from: "8618014856231",
                  type: "image"
                }
              ]
            }
          }
        ]
      }
    ]
  });

  assert.deepEqual(messages, []);
});
