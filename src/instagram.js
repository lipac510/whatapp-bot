import { config } from "./config.js";

const ROUTING_PREFIX = "instagram:";

// Instagram-scoped sender ids are namespaced so they never collide with WhatsApp phone
// numbers in shared storage (sessions / known_customers / handoff_windows / ...).
export function toRoutingId(igUserId) {
  return `${ROUTING_PREFIX}${igUserId}`;
}

export function stripRoutingPrefix(value) {
  const text = String(value || "");
  return text.startsWith(ROUTING_PREFIX) ? text.slice(ROUTING_PREFIX.length) : text;
}

function classifyAttachment(attachment) {
  const type = attachment?.type || "";
  const url = attachment?.payload?.url || "";
  if (!url) return null;

  if (type === "image") return { kind: "image", url };
  if (type === "video" || type === "ig_reel") return { kind: "video", url };
  // share / story_mention / story_reply / file / audio etc. — keep the URL as a customer
  // link so the conversation engine records it (rule: IG/TikTok/FB links are saved).
  return { kind: "link", url };
}

// Instagram Messaging is delivered through the Messenger Platform shape:
//   { object: "instagram", entry: [ { messaging: [ { sender, recipient, message, ... } ] } ] }
// We keep ONLY genuine inbound customer messages and drop echoes, read receipts,
// delivery receipts and reactions so the bot never replies to its own output.
export function extractIncomingMessages(webhookBody) {
  const messages = [];

  for (const entry of webhookBody.entry || []) {
    for (const event of entry.messaging || []) {
      const message = event.message;
      if (!message) continue; // read / delivery / postback / reaction
      if (message.is_echo) continue; // our own outgoing message echoed back

      const igUserId = event.sender?.id;
      if (!igUserId) continue;

      const base = {
        id: message.mid,
        from: toRoutingId(igUserId),
        igUserId,
        profileName: "",
        username: "",
        timestamp: event.timestamp
      };

      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const media = attachments.map(classifyAttachment).filter(Boolean);
      const firstMediaItem = media.find((item) => item.kind === "image" || item.kind === "video");
      const linkItems = media.filter((item) => item.kind === "link");

      if (firstMediaItem) {
        messages.push({
          ...base,
          type: firstMediaItem.kind,
          text: message.text || "",
          mediaUrl: firstMediaItem.url
        });
        continue;
      }

      // No image/video: treat any text plus any share/story link URLs as a text message,
      // so URL extraction in the conversation engine records them as customer links.
      const text = [message.text || "", ...linkItems.map((item) => item.url)]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!text) continue; // nothing actionable (e.g. an unsupported attachment with no url)

      messages.push({
        ...base,
        type: "text",
        text
      });
    }
  }

  return messages;
}

export async function sendTextMessage(to, body) {
  const recipientId = stripRoutingPrefix(to);
  const url = `https://graph.facebook.com/${config.graphApiVersion}/${config.igPageId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.igPageAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text: body }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Instagram API error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

// Instagram webhook attachments are already-public CDN URLs (no media-id download flow like
// WhatsApp). They are time-limited, so for durable OKKI records they should later be
// re-hosted (e.g. to Supabase Storage). For the MVP we record the CDN URL as-is.
// TODO(phase-2): re-host to Supabase Storage and return the persistent URL.
export function resolveMediaUrl(_request, message) {
  return message.mediaUrl || "";
}
