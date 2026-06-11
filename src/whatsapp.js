import { config } from "./config.js";

export async function sendTextMessage(to, body) {
  const url = `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `WhatsApp API error ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function fetchMedia(mediaId) {
  const metadataUrl = `https://graph.facebook.com/${config.graphApiVersion}/${mediaId}`;
  const metadataResponse = await fetch(metadataUrl, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    }
  });
  const metadata = await metadataResponse.json().catch(() => ({}));
  if (!metadataResponse.ok || !metadata.url) {
    const message = metadata?.error?.message || `WhatsApp media metadata error ${metadataResponse.status}`;
    throw new Error(message);
  }

  const mediaResponse = await fetch(metadata.url, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    }
  });
  if (!mediaResponse.ok) {
    throw new Error(`WhatsApp media download error ${mediaResponse.status}`);
  }

  return {
    body: Buffer.from(await mediaResponse.arrayBuffer()),
    contentType: mediaResponse.headers.get("content-type") || metadata.mime_type || "application/octet-stream"
  };
}

export function extractIncomingMessages(webhookBody) {
  const messages = [];

  for (const entry of webhookBody.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        const contact = (value.contacts || []).find(
          (item) => item.wa_id === message.from
        );

        const base = {
          id: message.id,
          from: message.from,
          profileName: contact?.profile?.name || "",
          timestamp: message.timestamp
        };

        if (message.type === "text") {
          messages.push({
            ...base,
            type: "text",
            text: message.text?.body || ""
          });
          continue;
        }

        if (message.type === "image") {
          messages.push({
            ...base,
            type: "image",
            text: message.image?.caption || "",
            mediaId: message.image?.id || "",
            mimeType: message.image?.mime_type || "",
            sha256: message.image?.sha256 || ""
          });
          continue;
        }

        if (message.type === "video") {
          messages.push({
            ...base,
            type: "video",
            text: message.video?.caption || "",
            mediaId: message.video?.id || "",
            mimeType: message.video?.mime_type || "",
            sha256: message.video?.sha256 || ""
          });
        }
      }
    }
  }

  return messages;
}
