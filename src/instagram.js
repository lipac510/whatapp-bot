import { config, getInstagramToken } from "./config.js";

const ROUTING_PREFIX = "instagram:";

// Routing id format: `instagram:<accountId>:<igUserId>`.
//  - accountId  = the Instagram business account that RECEIVED the message (so one webhook
//    can serve several accounts; replies are sent with that account's token).
//  - igUserId   = the customer's Instagram-scoped id (the recipient when we reply).
// The prefix also keeps these ids from colliding with WhatsApp phone numbers in storage.
export function toRoutingId(accountId, igUserId) {
  return `${ROUTING_PREFIX}${accountId || "_"}:${igUserId}`;
}

export function parseRoutingId(value) {
  const text = String(value || "");
  const body = text.startsWith(ROUTING_PREFIX) ? text.slice(ROUTING_PREFIX.length) : text;
  const sep = body.indexOf(":");
  if (sep === -1) {
    return { accountId: "", igUserId: body };
  }
  return { accountId: body.slice(0, sep), igUserId: body.slice(sep + 1) };
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

// Instagram messaging is delivered through the Messenger Platform shape:
//   { object: "instagram", entry: [ { id, messaging: [ { sender, recipient, message, ... } ] } ] }
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

      const accountId = event.recipient?.id || entry.id || "";

      const base = {
        id: message.mid,
        from: toRoutingId(accountId, igUserId),
        igUserId,
        igAccountId: accountId,
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
  const { accountId, igUserId } = parseRoutingId(to);
  const token = getInstagramToken(accountId);
  if (!token) {
    throw new Error(`No Instagram access token configured for account ${accountId || "(default)"}`);
  }

  const url = `https://graph.instagram.com/${config.graphApiVersion}/me/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipient: { id: igUserId },
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

// Look up an Instagram user's @username (and name) from their scoped id. The webhook only
// carries the id, so we fetch the username so OKKI can show the customer's @handle — useful
// for finding the account if the customer typed a wrong WhatsApp number. Best-effort: returns
// null on any error so the inquiry still completes.
export async function fetchProfile(igUserId, accountId) {
  const token = getInstagramToken(accountId);
  if (!token || !igUserId) return null;

  const url = `https://graph.instagram.com/${config.graphApiVersion}/${igUserId}?fields=username,name`;
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    return { username: payload.username || "", name: payload.name || "" };
  } catch {
    return null;
  }
}

// Instagram webhook attachments are already-public CDN URLs (no media-id download flow like
// WhatsApp). They are time-limited, so for durable OKKI records they should later be
// re-hosted (e.g. to Supabase Storage). For the MVP we record the CDN URL as-is.
// TODO(phase-2): re-host to Supabase Storage and return the persistent URL.
export function resolveMediaUrl(_request, message) {
  return message.mediaUrl || "";
}
