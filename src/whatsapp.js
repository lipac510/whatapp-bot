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

export function extractIncomingMessages(webhookBody) {
  const messages = [];

  for (const entry of webhookBody.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        if (message.type !== "text") continue;

        const contact = (value.contacts || []).find(
          (item) => item.wa_id === message.from
        );

        messages.push({
          id: message.id,
          from: message.from,
          profileName: contact?.profile?.name || "",
          text: message.text?.body || "",
          timestamp: message.timestamp
        });
      }
    }
  }

  return messages;
}
