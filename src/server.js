import http from "node:http";
import crypto from "node:crypto";
import { config, shouldVerifyWebhookSignature, validateConfig } from "./config.js";
import {
  clearSession,
  getSession,
  isMessageProcessed,
  listFailures,
  listInquiries,
  markMessageProcessed,
  saveFailure,
  saveInquiry,
  saveSession
} from "./storage.js";
import {
  formatInquiryForLog,
  handleCustomerMessage
} from "./conversation.js";
import { createOkkiCustomerFromInquiry } from "./okki.js";
import { extractIncomingMessages, sendTextMessage } from "./whatsapp.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function isValidWebhookSignature(request, rawBody) {
  if (!shouldVerifyWebhookSignature()) return true;

  const signature = request.headers["x-hub-signature-256"];
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", config.appSecret)
    .update(rawBody)
    .digest("hex");
  const actual = signature.slice("sha256=".length);

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function verifyWebhook(request, response, url) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === config.webhookVerifyToken) {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(challenge || "");
    return;
  }

  response.writeHead(403, { "Content-Type": "text/plain" });
  response.end("Forbidden");
}

async function handleWebhookPost(request, response) {
  const rawBody = await readRequestBody(request);
  if (!isValidWebhookSignature(request, rawBody)) {
    sendJson(response, 403, { error: "Invalid webhook signature" });
    return;
  }

  const body = rawBody ? JSON.parse(rawBody) : {};
  const messages = extractIncomingMessages(body);

  for (const message of messages) {
    try {
      if (await isMessageProcessed(message.id)) {
        console.log(`Skipped duplicate message ${message.id} from ${message.from}`);
        continue;
      }

      const session = await getSession(message.from);
      const result = handleCustomerMessage(session, message.text, message.profileName);

      for (const reply of result.replies) {
        await sendTextMessage(message.from, reply);
      }

      await saveSession(message.from, result.session);
      await markMessageProcessed(message.id);

      if (result.complete) {
        const inquiry = {
          customerId: message.from,
          profileName: result.session.profileName,
          ...result.inquiry
        };
        await saveInquiry(inquiry);
        await clearSession(message.from);
        console.log(`New inquiry from ${message.from}\n${formatInquiryForLog(result.inquiry)}`);

        try {
          const okki = await createOkkiCustomerFromInquiry(inquiry);
          if (okki.enabled) {
            console.log(`OKKI customer synced for ${message.from}`);
          } else {
            console.log("OKKI sync skipped because OKKI_CLIENT_ID/OKKI_CLIENT_SECRET are not configured");
          }
        } catch (okkiError) {
          console.error(`Failed to sync OKKI customer for ${message.from}: ${okkiError.message}`);
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text,
            error: `OKKI sync failed: ${okkiError.message}`
          });
        }
      }
    } catch (error) {
      console.error(`Failed to process message ${message.id} from ${message.from}: ${error.message}`);
      await saveFailure({
        messageId: message.id,
        customerId: message.from,
        text: message.text,
        error: error.message
      });
    }
  }

  sendJson(response, 200, { ok: true, received: messages.length });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "wa-customer-info-bot",
        phoneNumberId: config.phoneNumberId
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/webhook") {
      verifyWebhook(request, response, url);
      return;
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      await handleWebhookPost(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/inquiries") {
      sendJson(response, 200, await listInquiries());
      return;
    }

    if (request.method === "GET" && url.pathname === "/failures") {
      sendJson(response, 200, await listFailures());
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message });
  }
}

const missing = validateConfig();
if (missing.length) {
  console.error(`Missing required config: ${missing.join(", ")}`);
  process.exit(1);
}

const server = http.createServer(handleRequest);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Try PORT=3001 npm start.`);
    process.exit(1);
  }

  if (error.code === "EPERM") {
    console.error(
      `Cannot listen on ${config.host}:${config.port}. Check local network permissions or try another terminal.`
    );
    process.exit(1);
  }

  throw error;
});

server.listen(config.port, config.host, () => {
  console.log(`WhatsApp bot listening on http://${config.host}:${config.port}`);
});
