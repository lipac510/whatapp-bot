import http from "node:http";
import crypto from "node:crypto";
import { config, shouldVerifyWebhookSignature, validateConfig } from "./config.js";
import {
  clearSession,
  getHandoffWindow,
  getSession,
  isKnownCustomer,
  isMessageProcessed,
  listEmmaReplies,
  listFailures,
  listHandoffWindows,
  listInquiries,
  listKnownCustomers,
  listMessageEvents,
  listOkkiSyncs,
  listSessions,
  markEmmaReplySent,
  markHandoffReminderSent,
  markHandoffWindow,
  markKnownCustomer,
  markMessageProcessed,
  saveFailure,
  saveInquiry,
  saveMessageEvent,
  saveOkkiSync,
  saveSession,
  wasEmmaReplySent
} from "./storage.js";
import { buildAdminModel, renderAdminCsv, renderAdminPage } from "./admin.js";
import {
  formatInquiryForLog,
  handleCustomerImage,
  handleCustomerMessage,
  handleCustomerVideo,
  handoffReminderMessage
} from "./conversation.js";
import { createOkkiCustomerFromInquiry, getOkkiDiagnostics } from "./okki.js";
import { inferCountry } from "./country.js";
import {
  canResolveInquiryCountry,
  existingCustomerReply,
  humanFallbackReply,
  isHumanHandoffRequest,
  isMeaningfulAddressAnswer,
  isOfficialCodeMessage,
  isRestrictedCountry,
  isValidQuantityAnswer,
  noShippingAgentReply,
  parseQuantity
} from "./rules.js";
import { extractIncomingMessages, fetchMedia, sendTextMessage } from "./whatsapp.js";
import * as instagram from "./instagram.js";
import {
  initIgTokens,
  maybeRefreshTokens,
  startTokenScheduler,
  tokenSnapshot
} from "./igTokens.js";
import { renderPrivacyPage, renderDataDeletionPage, renderGalleryPage } from "./legal.js";
import { detectArabic, localize } from "./i18n.js";

// Sticky per-customer reply language (in-memory). Set to "ar" once a customer writes Arabic;
// outbound replies are then localized at the single send chokepoint (sendAndLogText).
const langByCustomer = new Map();

// A channel adapter lets one inquiry pipeline serve both WhatsApp and Instagram.
// WhatsApp keeps its exact previous behaviour; Instagram plugs in its own parser,
// sender and (already-resolved) media URLs.
const whatsappChannel = {
  name: "whatsapp",
  extract: (body) => extractIncomingMessages(body),
  sendText: (to, text) => sendTextMessage(to, text),
  resolveMediaUrl: (request, message) =>
    message.mediaId ? buildMediaUrl(request, message.mediaId) : "",
  // WhatsApp & Instagram-login sign webhooks with different app secrets.
  appSecret: config.appSecret
};

const instagramChannel = {
  name: "instagram",
  extract: (body) => instagram.extractIncomingMessages(body),
  sendText: (to, text) => instagram.sendTextMessage(to, text),
  resolveMediaUrl: (request, message) => instagram.resolveMediaUrl(request, message),
  appSecret: config.igAppSecret
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

function sendPlain(response, statusCode, text, headers = {}) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  response.end(text);
}

function isAdminAuthorized(request) {
  if (!config.adminPassword) return false;

  const auth = request.headers.authorization || "";
  if (!auth.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(auth.slice("Basic ".length), "base64").toString("utf8");
    const password = decoded.slice(decoded.indexOf(":") + 1);
    return password === config.adminPassword;
  } catch {
    return false;
  }
}

function requireAdmin(request, response) {
  if (!config.adminPassword) {
    sendPlain(response, 403, "Admin dashboard is disabled. Set ADMIN_PASSWORD in Render Environment first.");
    return false;
  }

  if (!isAdminAuthorized(request)) {
    sendPlain(response, 401, "Authentication required", {
      "WWW-Authenticate": 'Basic realm="WhatsApp Bot Admin"'
    });
    return false;
  }

  return true;
}

function getPublicBaseUrl(request) {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/$/, "");
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${request.headers.host}`;
}

function buildMediaUrl(request, mediaId) {
  return `${getPublicBaseUrl(request)}/media/${encodeURIComponent(mediaId)}`;
}

function handleParsedMessage(channel, request, session, message) {
  if (message.type === "image") {
    const mediaUrl = channel.resolveMediaUrl(request, message);
    if (mediaUrl) {
      return handleCustomerImage(session, mediaUrl, message.profileName, message.from, channel.name);
    }
  }
  if (message.type === "video") {
    const mediaUrl = channel.resolveMediaUrl(request, message);
    if (mediaUrl) {
      return handleCustomerVideo(session, mediaUrl, message.profileName, message.from, channel.name);
    }
  }
  return handleCustomerMessage(session, message.text, message.profileName, message.from, channel.name);
}

function shouldRejectInquiry(inquiry) {
  const country = inferCountry({
    address: inquiry.address,
    phone: inquiry.whatsapp || inquiry.customerId
  });
  const quantity = parseQuantity(inquiry.quantity);
  return {
    country,
    quantity,
    rejected: isRestrictedCountry(country) && quantity < 20000
  };
}

function getInquiryQualityError(inquiry) {
  if (!isValidQuantityAnswer(inquiry.quantity || "")) {
    return "Invalid quantity";
  }
  if (!inquiry.fastTrack && !isMeaningfulAddressAnswer(inquiry.address || "")) {
    return "Invalid shipping address";
  }
  if (inquiry.fastTrack && inquiry.address && !isMeaningfulAddressAnswer(inquiry.address)) {
    return "Invalid shipping address";
  }
  if (!canResolveInquiryCountry(inquiry)) {
    return "Country could not be resolved";
  }
  return "";
}

function isExistingCustomerError(message) {
  return /已存在|already exists|exist/i.test(String(message || ""));
}

function isRetryableCountryError(message) {
  return /国家地区.*不能为空|country.*empty|country.*required|invalid country/i.test(String(message || ""));
}

function isWithinHours(isoDate, hours) {
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time < hours * 60 * 60 * 1000;
}

async function sendEmmaReplyOnce(channel, customerId, reason, text = existingCustomerReply) {
  if (await wasEmmaReplySent(customerId)) return false;
  await sendAndLogText(channel, customerId, text, { category: reason });
  await markEmmaReplySent(customerId, reason);
  await saveSystemEvent(customerId, "Emma contact sent", reason);
  return true;
}

async function handleRecentHandoffWindow(channel, customerId) {
  const handoff = await getHandoffWindow(customerId);
  if (!handoff || !isWithinHours(handoff.completedAt, 6)) return false;

  if (!handoff.reminderSent) {
    await sendAndLogText(channel, customerId, handoffReminderMessage, { category: "handoff_reminder" });
    await markHandoffReminderSent(customerId);
    await saveSystemEvent(customerId, "Handoff reminder sent", "handoff_reminder");
  }

  return true;
}

async function sendAndLogText(channel, customerId, text, extra = {}) {
  const outText = localize(text, langByCustomer.get(customerId) || "en");
  await channel.sendText(customerId, outText);
  await saveMessageEvent({
    customerId,
    channel: channel.name,
    direction: "out",
    type: "text",
    text: outText,
    ...extra
  });
}

async function saveSystemEvent(customerId, label, category, extra = {}) {
  await saveMessageEvent({
    customerId,
    direction: "system",
    type: "event",
    label,
    category,
    ...extra
  });
}

async function saveInboundMessageEvent(channel, message, request) {
  await saveMessageEvent({
    messageId: message.id,
    customerId: message.from,
    channel: channel.name,
    profileName: message.profileName,
    direction: "in",
    type: message.type,
    text: message.text || "",
    mediaId: message.mediaId || "",
    mediaUrl: channel.resolveMediaUrl(request, message),
    category: "customer_message"
  });
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function isValidWebhookSignature(request, rawBody, secret) {
  // No secret configured for this channel → skip verification (keeps the channel usable
  // before its app secret is set; matches the previous WhatsApp behaviour).
  if (!secret || secret.includes("replace_with")) return true;

  const signature = request.headers["x-hub-signature-256"];
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", secret)
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

async function handleWebhookPost(request, response, channel) {
  const rawBody = await readRequestBody(request);
  if (!isValidWebhookSignature(request, rawBody, channel.appSecret)) {
    sendJson(response, 403, { error: "Invalid webhook signature" });
    return;
  }

  // Opportunistic, throttled token refresh so a sleepy free-tier instance still keeps its
  // Instagram tokens fresh whenever it receives traffic.
  if (channel.name === "instagram") maybeRefreshTokens();

  const body = rawBody ? JSON.parse(rawBody) : {};
  const messages = channel.extract(body);
  const sessionCache = new Map();

  for (const message of messages) {
    try {
      if (await isMessageProcessed(message.id)) {
        console.log(`Skipped duplicate message ${message.id} from ${message.from}`);
        continue;
      }

      await saveInboundMessageEvent(channel, message, request);

      // Detect Arabic and remember it for this customer (sticky — never downgraded).
      if (detectArabic(message.text)) langByCustomer.set(message.from, "ar");

      if (message.type === "unsupported") {
        // Message the bot can't parse (e.g. voice note / sticker) — hand off to a human once.
        await sendEmmaReplyOnce(channel, message.from, "unsupported_message", humanFallbackReply);
        await markMessageProcessed(message.id);
        continue;
      }

      if (message.type === "text" && isOfficialCodeMessage(message.text)) {
        const noticeTime = new Date().toISOString().replace(/[:.]/g, "-");
        const officialNotice = {
          customerId: message.from,
          channel: channel.name,
          whatsapp: channel.name === "whatsapp" ? message.from : "",
          profileName: message.profileName,
          type: "official_code_or_notice",
          officialNotice: true,
          companyName: `Official notice - ${message.from} - ${noticeTime}`,
          product: "Official message",
          quantity: "",
          address: "",
          message: message.text,
          summaryOverride: [
            "Official message / verification code",
            `WhatsApp number: ${message.from}`,
            `Sender name: ${message.profileName || ""}`,
            `Message: ${message.text}`
          ].join("\n")
        };
        await saveInquiry(officialNotice);
        await saveSystemEvent(message.from, "Official notice saved", "official_notice", {
          messageId: message.id
        });
        try {
          const okki = await createOkkiCustomerFromInquiry(officialNotice);
          if (okki.enabled) {
            await markKnownCustomer(message.from, "official_notice_synced");
            await saveOkkiSync({
              messageId: message.id,
              customerId: message.from,
              ok: true,
              officialNotice: true,
              result: okki.result
            });
            await saveSystemEvent(message.from, "Official notice synced to OKKI", "okki_synced", {
              messageId: message.id
            });
          }
        } catch (okkiError) {
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text,
            error: `OKKI official notice sync failed: ${okkiError.message}`
          });
          await saveSystemEvent(message.from, "OKKI official notice sync failed", "okki_failed", {
            messageId: message.id,
            error: okkiError.message
          });
        }
        await markMessageProcessed(message.id);
        continue;
      }

      if (message.type === "text" && isHumanHandoffRequest(message.text)) {
        await sendEmmaReplyOnce(channel, message.from, "manual_handoff_requested");
        await markMessageProcessed(message.id);
        continue;
      }

      if (await handleRecentHandoffWindow(channel, message.from)) {
        await markMessageProcessed(message.id);
        continue;
      }

      if (await isKnownCustomer(message.from)) {
        await sendEmmaReplyOnce(channel, message.from, "existing_customer");
        await markMessageProcessed(message.id);
        continue;
      }

      const session = sessionCache.has(message.from)
        ? sessionCache.get(message.from)
        : await getSession(message.from);
      const result = handleParsedMessage(channel, request, session, message);

      await saveSession(message.from, result.session);
      sessionCache.set(message.from, result.session);
      await markMessageProcessed(message.id);

      if (result.complete) {
        // Resolve the customer's Instagram @handle (the webhook only carries the id) so OKKI
        // can show it — handy for locating the account if the typed WhatsApp number is wrong.
        let igUsername = "";
        if (channel.name === "instagram") {
          const profile = await instagram.fetchProfile(message.igUserId, message.igAccountId);
          igUsername = profile?.username ? `@${profile.username}` : "";
        }

        const inquiry = {
          customerId: message.from,
          channel: channel.name,
          profileName: result.session.profileName,
          ...result.inquiry,
          // contact number: WhatsApp channel = the sender id itself; Instagram = the number
          // collected in the conversation (result.inquiry.whatsapp).
          whatsapp:
            channel.name === "whatsapp"
              ? message.from
              : result.inquiry.whatsapp || "",
          displayName: result.session.profileName || igUsername || "",
          ...(channel.name === "instagram"
            ? {
                sourcePlatform: "Instagram",
                instagramUserId: message.igUserId || "",
                instagramUsername: igUsername,
                instagramAccountId: message.igAccountId || ""
              }
            : {})
        };
        // If the customer sent any media/links, mint a token for a single short gallery URL
        // (so OKKI's image-link field holds one link, not a list that overflows the limit).
        if (inquiry.imageLinks?.length || inquiry.videoLinks?.length || inquiry.customerLinks?.length) {
          inquiry.mediaToken = crypto.randomBytes(9).toString("base64url");
        }

        const inquiryQualityError = getInquiryQualityError(inquiry);
        if (inquiryQualityError) {
          const fallbackStep = inquiryQualityError === "Invalid quantity" ? "quantity" : "address";
          const repairedSession = {
            ...result.session,
            step: fallbackStep,
            attachmentPromptedStep: "",
            completedAt: "",
            data: {
              ...result.session.data,
              [fallbackStep]: ""
            }
          };

          await saveSession(message.from, repairedSession);
          sessionCache.set(message.from, repairedSession);
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text || message.type,
            error: `Inquiry validation failed: ${inquiryQualityError}`
          });
          await saveSystemEvent(message.from, "Inquiry validation failed", "inquiry_validation_failed", {
            messageId: message.id,
            error: inquiryQualityError
          });

          const retryPrompt = fallbackStep === "quantity"
            ? "Please tell us the quantity you need, for example: 1000 pcs."
            : "Please share your country or shipping address, for example: Canada or Dubai, UAE.";
          await sendAndLogText(channel, message.from, retryPrompt, { category: "conversation_reply" });
          continue;
        }
        console.log(`New inquiry from ${message.from}\n${formatInquiryForLog(result.inquiry)}`);

        const rejection = shouldRejectInquiry(inquiry);
        if (rejection.rejected) {
          await saveInquiry(inquiry);
          await saveSystemEvent(message.from, "Inquiry saved", "inquiry_saved", {
            messageId: message.id,
            product: inquiry.product,
            quantity: inquiry.quantity,
            address: inquiry.address
          });
          await clearSession(message.from);
          sessionCache.delete(message.from);
          await sendAndLogText(channel, message.from, noShippingAgentReply, { category: "restricted_country" });
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text || message.type,
            error: `Restricted country skipped: ${rejection.country}, quantity ${rejection.quantity}`
          });
          await saveSystemEvent(message.from, "Restricted country skipped", "restricted_country", {
            messageId: message.id,
            country: rejection.country,
            quantity: rejection.quantity
          });
          continue;
        }

        try {
          const okki = await createOkkiCustomerFromInquiry(inquiry);
          if (okki.enabled) {
            await saveInquiry(inquiry);
            await saveSystemEvent(message.from, "Inquiry saved", "inquiry_saved", {
              messageId: message.id,
              product: inquiry.product,
              quantity: inquiry.quantity,
              address: inquiry.address
            });
            console.log(`OKKI customer synced for ${message.from}`);
            await markKnownCustomer(message.from, "okki_synced");
            await markHandoffWindow(message.from);
            await saveOkkiSync({
              messageId: message.id,
              customerId: message.from,
              ok: true,
              result: okki.result
            });
            await saveSystemEvent(message.from, "OKKI customer synced", "okki_synced", {
              messageId: message.id
            });
            await clearSession(message.from);
            sessionCache.delete(message.from);
          } else {
            await saveInquiry(inquiry);
            await saveSystemEvent(message.from, "Inquiry saved", "inquiry_saved", {
              messageId: message.id,
              product: inquiry.product,
              quantity: inquiry.quantity,
              address: inquiry.address
            });
            console.log("OKKI sync skipped because OKKI_CLIENT_ID/OKKI_CLIENT_SECRET are not configured");
            await markKnownCustomer(message.from, "inquiry_completed");
            await markHandoffWindow(message.from);
            await saveOkkiSync({
              messageId: message.id,
              customerId: message.from,
              ok: false,
              skipped: true
            });
            await saveSystemEvent(message.from, "OKKI sync skipped", "okki_skipped", {
              messageId: message.id
            });
            await clearSession(message.from);
            sessionCache.delete(message.from);
          }

          for (const reply of result.replies) {
            await sendAndLogText(channel, message.from, reply, { category: "conversation_reply" });
          }
        } catch (okkiError) {
          console.error(`Failed to sync OKKI customer for ${message.from}: ${okkiError.message}`);
          if (isExistingCustomerError(okkiError.message)) {
            await markKnownCustomer(message.from, "okki_existing");
            await clearSession(message.from);
            sessionCache.delete(message.from);
            await sendEmmaReplyOnce(channel, message.from, "okki_existing");
          } else if (isRetryableCountryError(okkiError.message)) {
            const repairedSession = {
              ...result.session,
              step: "address",
              attachmentPromptedStep: "",
              completedAt: "",
              data: {
                ...result.session.data
              }
            };
            await saveSession(message.from, repairedSession);
            sessionCache.set(message.from, repairedSession);
            await sendAndLogText(
              channel,
              message.from,
              "Please share your country or full shipping address, for example: Qatar or Porto Arabia tower 24, Doha, Qatar.",
              { category: "conversation_reply" }
            );
          } else {
            await saveInquiry(inquiry);
            await saveSystemEvent(message.from, "Inquiry saved", "inquiry_saved", {
              messageId: message.id,
              product: inquiry.product,
              quantity: inquiry.quantity,
              address: inquiry.address
            });
            await markKnownCustomer(message.from, "inquiry_completed");
            await markHandoffWindow(message.from);
            await clearSession(message.from);
            sessionCache.delete(message.from);
            for (const reply of result.replies) {
              await sendAndLogText(channel, message.from, reply, { category: "conversation_reply" });
            }
          }
          await saveFailure({
            messageId: message.id,
            customerId: message.from,
            text: message.text || message.type,
            error: `OKKI sync failed: ${okkiError.message}`
          });
          await saveSystemEvent(message.from, "OKKI sync failed", "okki_failed", {
            messageId: message.id,
            error: okkiError.message
          });
        }
      } else {
        for (const reply of result.replies) {
          await sendAndLogText(channel, message.from, reply, { category: "conversation_reply" });
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
      await saveSystemEvent(message.from, "Message processing failed", "processing_failed", {
        messageId: message.id,
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

    if (request.method === "GET" && (url.pathname === "/webhook" || url.pathname === "/ig/webhook")) {
      verifyWebhook(request, response, url);
      return;
    }

    if (request.method === "GET" && url.pathname === "/privacy") {
      sendHtml(response, 200, renderPrivacyPage());
      return;
    }

    if (request.method === "GET" && url.pathname === "/data-deletion") {
      sendHtml(response, 200, renderDataDeletionPage());
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/g/")) {
      const token = decodeURIComponent(url.pathname.slice("/g/".length));
      const inquiries = await listInquiries();
      const inquiry = token && inquiries.find((item) => item.mediaToken === token);
      if (!inquiry) {
        sendHtml(response, 404, "<p>Gallery not found or expired.</p>");
        return;
      }
      sendHtml(response, 200, renderGalleryPage(inquiry));
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
      await handleWebhookPost(request, response, whatsappChannel);
      return;
    }

    if (request.method === "POST" && url.pathname === "/ig/webhook") {
      await handleWebhookPost(request, response, instagramChannel);
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

    if (request.method === "GET" && url.pathname === "/ig-tokens") {
      // Non-sensitive: shows per-account expiry/refresh status, never the token value.
      sendJson(response, 200, { accounts: tokenSnapshot() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/conversations") {
      if (!requireAdmin(request, response)) return;
      const payload = {
        messages: await listMessageEvents(),
        inquiries: await listInquiries(),
        failures: await listFailures(),
        okkiSyncs: await listOkkiSyncs(),
        sessions: await listSessions(),
        knownCustomers: await listKnownCustomers(),
        handoffWindows: await listHandoffWindows(),
        emmaReplies: await listEmmaReplies()
      };
      const model = buildAdminModel({
        ...payload,
        query: url.searchParams.get("q") || ""
      });
      sendJson(response, 200, { ...payload, conversations: model.conversations, totals: model.totals });
      return;
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      if (!requireAdmin(request, response)) return;
      const query = url.searchParams.get("q") || "";
      const selectedCustomerId = url.searchParams.get("customer") || "";
      const payload = {
        messages: await listMessageEvents(),
        inquiries: await listInquiries(),
        failures: await listFailures(),
        okkiSyncs: await listOkkiSyncs(),
        sessions: await listSessions(),
        knownCustomers: await listKnownCustomers(),
        handoffWindows: await listHandoffWindows(),
        emmaReplies: await listEmmaReplies()
      };
      const model = buildAdminModel({ ...payload, query });
      sendHtml(response, 200, renderAdminPage({ ...payload, model, selectedCustomerId, query }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/admin/export.csv") {
      if (!requireAdmin(request, response)) return;
      const query = url.searchParams.get("q") || "";
      const payload = {
        messages: await listMessageEvents(),
        inquiries: await listInquiries(),
        failures: await listFailures(),
        okkiSyncs: await listOkkiSyncs(),
        sessions: await listSessions(),
        knownCustomers: await listKnownCustomers(),
        handoffWindows: await listHandoffWindows(),
        emmaReplies: await listEmmaReplies()
      };
      const model = buildAdminModel({ ...payload, query });
      response.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="whatsapp-bot-admin.csv"'
      });
      response.end(renderAdminCsv(model));
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

server.listen(config.port, config.host, async () => {
  console.log(`WhatsApp bot listening on http://${config.host}:${config.port}`);
  await initIgTokens().catch((error) => console.warn(`Instagram token init failed: ${error.message}`));
  startTokenScheduler();
});
