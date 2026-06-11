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
        type: "text",
        timestamp: "1780000000"
      }
    ]);
});

test("extracts incoming WhatsApp image messages", () => {
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
                  timestamp: "1780000001",
                  type: "image",
                  image: {
                    id: "media.test",
                    mime_type: "image/jpeg",
                    sha256: "abc"
                  }
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
      id: "wamid.image",
      from: "8618014856231",
      profileName: "",
      text: "",
      type: "image",
      timestamp: "1780000001",
      mediaId: "media.test",
      mimeType: "image/jpeg",
      sha256: "abc"
    }
  ]);
});

test("extracts incoming WhatsApp video messages", () => {
  const messages = extractIncomingMessages({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: "wamid.video",
                  from: "8618014856231",
                  timestamp: "1780000002",
                  type: "video",
                  video: {
                    id: "media.video",
                    mime_type: "video/mp4",
                    sha256: "def"
                  }
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
      id: "wamid.video",
      from: "8618014856231",
      profileName: "",
      text: "",
      type: "video",
      timestamp: "1780000002",
      mediaId: "media.video",
      mimeType: "video/mp4",
      sha256: "def"
    }
  ]);
});
