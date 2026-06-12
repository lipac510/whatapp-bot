import http from "node:http";
import crypto from "node:crypto";
import { config, shouldVerifyWebhookSignature, validateConfig } from "./config.js";
import {
  clearSession,
  getSession,
  isKnownCustomer,
  isMessageProcessed,
  listFailures,
  listInquiries,
  listOkkiSyncs,
  markKnownCustomer,
  markMessageProcessed,
  saveFailure,
  saveInquiry,
  saveOkkiSync,
  saveSession
} from "./storage.js";
import {
  formatInquiryForLog,
  handleCustomerImage,
  handleCustomerMessage,
  handleCustomerVideo
} from "./conversation.js";
import { createOkkiCustomerFromInquiry, getOkkiDiagnostics } from "./okki.js";
import { inferCountry } from "./country.js";
import {
  existingCustomerReply,
  isOfficialCodeMessage,
  isRestrictedCountry,
  noShippingAgentReply,
  parseQuantity
} from "./rules.js";
import { extractIncomingMessages, fetchMedia, sendTextMessage } from "./whatsapp.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function getPublicBaseUrl(request) {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/$/, "");
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${request.headers.host}`;
}

function buildMediaUrl(request, mediaId) {
  return `${getPublicBaseUrl(request)}/media/${encodeURIComponent(mediaId)}`;
}

function handleParsedMessage(request, session, message) {
  if (message.type === "image" && message.mediaId) {
    return handleCustomerImage(session, buildMediaUrl(request, message.mediaId), message.profileName);
  }
  if (message.type === "video" && message.mediaId) {
    return handleCustomerVideo(session, buildMediaUrl(request, message.mediaId), message.profileName);
  }
  return handleCustomerMessage(session, message.text, message.profileName);
}

function shouldRejectInquiry(inquiry) {
  const country = inferCountry({
    address: inquiry.address,
    phone: inquiry.customerId
  });
  const quantity = parseQuantity(inquiry.quantity);
  return {
    country,
    quantity,
    rejected: isRestrictedCountry(country) && quantity < 20000
  };
}

function isExistingCustomerError(message) {
  return /已存在|already exists|exist/i.test(String(message || ""));
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

      if (message.type === "text" && isOfficialCodeMessage(message.text)) {
        await saveInquiry({
          customerId: message.from,
          profileName: message.profileName,
          type: "official_code_or_notice",
          message: message.text
        });
        await markMessageProcessed(message.id);
        continue;
      }

      if (await isKnownCustomer(message.from)) {
        await sendTextMessage(message.from, existingCustomerReply);
        await markMessageProcessed(message.id);
        continue;
      }

      const session = await getSession(message.from);
      const result = handleParsedMessage(request, session, message);

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

        const rejection = shouldRejectInquiry(inquiry);
        if (rejection.rejected) {
          await sendTextMessage(message.from, noShippingAgentReply);
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text || message.type,
            error: `Restricted country skipped: ${rejection.country}, quantity ${rejection.quantity}`
          });
          continue;
        }

        for (const reply of result.replies) {
          await sendTextMessage(message.from, reply);
        }

        try {
          const okki = await createOkkiCustomerFromInquiry(inquiry);
          if (okki.enabled) {
            console.log(`OKKI customer synced for ${message.from}`);
            await markKnownCustomer(message.from, "okki_synced");
            await saveOkkiSync({
              messageId: message.id,
              customerId: message.from,
              ok: true,
              result: okki.result
            });
          } else {
            console.log("OKKI sync skipped because OKKI_CLIENT_ID/OKKI_CLIENT_SECRET are not configured");
            await saveOkkiSync({
              messageId: message.id,
              customerId: message.from,
              ok: false,
              skipped: true
            });
          }
        } catch (okkiError) {
          console.error(`Failed to sync OKKI customer for ${message.from}: ${okkiError.message}`);
          if (isExistingCustomerError(okkiError.message)) {
            await markKnownCustomer(message.from, "okki_existing");
            await sendTextMessage(message.from, existingCustomerReply);
          }
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text || message.type,
            error: `OKKI sync failed: ${okkiError.message}`
          });
        }
      } else {
        for (const reply of result.replies) {
          await sendTextMessage(message.from, reply);
        }
      }
    } catch (error) {
      console.error(`Failed to process message ${message.id} from ${message.from}: ${error.message}`);
      await saveFailure({
        messageId: message.id,
        customerId: message.from,
        text: message.text || message.type,
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

    if (request.method === "GET" && url.pathname.startsWith("/media/")) {
      const mediaId = decodeURIComponent(url.pathname.slice("/media/".length));
      const media = await fetchMedia(mediaId);
      response.writeHead(200, {
        "Content-Type": media.contentType,
        "Cache-Control": "public, max-age=300"
      });
      response.end(media.body);
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

    if (request.method === "GET" && url.pathname === "/okki-syncs") {
      sendJson(response, 200, await listOkkiSyncs());
      return;
    }

    if (request.method === "GET" && url.pathname === "/okki-diagnostics") {
      sendJson(response, 200, await getOkkiDiagnostics());
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
