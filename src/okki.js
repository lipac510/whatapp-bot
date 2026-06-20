import { config, hasOkkiConfig } from "./config.js";
import { inferCountry, splitPhone } from "./country.js";

let tokenCache = null;
const okkiSummaryLimit = 255;

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      return item !== "" && item !== null && item !== undefined;
    })
  );
}

function parseOriginList() {
  return String(config.okkiOriginId || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function setConfiguredField(target, fieldId, value) {
  const key = String(fieldId || "").trim();
  if (!key || value === "" || value === null || value === undefined) return;
  target[key] = value;
}

function joinSummaryParts(parts) {
  return parts.filter(Boolean).join(" | ");
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildDetailedInquirySummary(inquiry) {
  return (
    inquiry.summaryOverride ||
    [
      `询盘产品：${inquiry.product || ""}`,
      `采购数量：${inquiry.quantity || ""}`,
      `发货地址：${inquiry.address || "not provided yet"}`,
      inquiry.customerLinks?.length ? `客户链接：${inquiry.customerLinks.join(" , ")}` : "",
      inquiry.imageLinks?.length ? `图片链接：${inquiry.imageLinks.join(" , ")}` : "",
      inquiry.videoLinks?.length ? `视频链接：${inquiry.videoLinks.join(" , ")}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function buildCompactInquirySummary(inquiry) {
  if (inquiry.summaryOverride) {
    const summaryOverride = String(inquiry.summaryOverride);
    if (summaryOverride.length <= okkiSummaryLimit) return summaryOverride;
    return `${summaryOverride.slice(0, Math.max(0, okkiSummaryLimit - 3)).trimEnd()}...`;
  }

  const summary = joinSummaryParts([
    inquiry.product || "",
    inquiry.quantity || "",
    inquiry.address ? truncateText(inquiry.address, 80) : "",
    inquiry.imageLinks?.length ? `Photos:${inquiry.imageLinks.length}` : "",
    inquiry.videoLinks?.length ? `Videos:${inquiry.videoLinks.length}` : "",
    inquiry.customerLinks?.length ? `Links:${inquiry.customerLinks.length}` : "",
    inquiry.message ? truncateText(inquiry.message, 80) : ""
  ]);

  return truncateText(summary, okkiSummaryLimit);
}

async function getOkkiAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const response = await fetch(`${config.okkiApiBase}/v1/oauth2/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.okkiClientId,
      client_secret: config.okkiClientSecret,
      scope: config.okkiScope
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.message || `OKKI auth failed: ${response.status}`);
  }

  const expiresIn = Number(payload.expires_in || 28800);
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  };

  return tokenCache.accessToken;
}

export function buildOkkiCompanyPayload(inquiry) {
  // Routing id (inquiry.customerId) may be channel-prefixed (e.g. "instagram:<igsid>"),
  // so the actual contact number must come from inquiry.whatsapp. WhatsApp-channel
  // inquiries fall back to customerId, keeping their payload identical to before.
  const contactNumber = inquiry.whatsapp || inquiry.customerId;
  const phone = splitPhone(contactNumber);
  const country = inferCountry({
    address: inquiry.address,
    phone: contactNumber
  });
  const isOfficialNotice = Boolean(inquiry.officialNotice);
  const companyName = inquiry.companyName || phone.fullNumber;
  const originList = parseOriginList();
  const userId = Number(config.okkiOwnerUserId || 0);

  const inquirySummary = buildDetailedInquirySummary(inquiry);
  const compactInquirySummary = buildCompactInquirySummary(inquiry);

  const payload = cleanObject({
    company_id: 0,
    user_id: userId > 0 ? userId : undefined,
    is_public: userId > 0 ? 0 : undefined,
    name: companyName,
    short_name: companyName,
    country,
    address: inquiry.address || "",
    tel_area_code: isOfficialNotice ? undefined : phone.telAreaCode,
    tel: isOfficialNotice ? undefined : phone.localNumber,
    origin_list: originList,
    remark: compactInquirySummary || inquirySummary,
    customers: [
      cleanObject({
        customer_id: 0,
        name: inquiry.profileName || inquiry.displayName || phone.fullNumber,
        email: inquiry.email || "",
        tel_area_code: isOfficialNotice ? undefined : phone.telAreaCode,
        tel: isOfficialNotice ? undefined : phone.localNumber,
        whatsapp: isOfficialNotice ? undefined : phone.fullNumber,
        main_customer_flag: 1,
        remark: compactInquirySummary || inquirySummary
      })
    ]
  });

  if (!isOfficialNotice) {
    setConfiguredField(payload, config.okkiInquiryProductFieldId, inquiry.product || "");
    setConfiguredField(payload, config.okkiPurchaseQuantityFieldId, inquiry.quantity || "");
  }
  setConfiguredField(payload, config.okkiInquirySummaryFieldId, compactInquirySummary || inquirySummary);

  return payload;
}

export async function createOkkiCustomerFromInquiry(inquiry) {
  if (!hasOkkiConfig()) {
    return { enabled: false };
  }

  const token = await getOkkiAccessToken();
  const payload = buildOkkiCompanyPayload(inquiry);
  const response = await fetch(`${config.okkiApiBase}/v1/company/pushCompanyAndCustomers`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.code !== 200) {
    throw new Error(result.message || `OKKI customer sync failed: ${response.status}`);
  }

  return {
    enabled: true,
    payload,
    result
  };
}

async function okkiGet(path, params = {}) {
  const token = await getOkkiAccessToken();
  const url = new URL(`${config.okkiApiBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== "" && value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: token
    }
  });
  const result = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    result
  };
}

async function safeDiagnostic(name, fn) {
  try {
    return { name, ...(await fn()) };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

export async function getOkkiDiagnostics() {
  if (!hasOkkiConfig()) {
    return { enabled: false };
  }

  const checks = await Promise.all([
    safeDiagnostic("company_fields", () => okkiGet("/v1/company/fields")),
    safeDiagnostic("company_enums", () => okkiGet("/v1/company/companyEnums")),
    safeDiagnostic("origin_list_selector", () =>
      okkiGet("/v1/company/fields/selector", { field: "origin_list" })
    ),
    safeDiagnostic("origin_selector", () => okkiGet("/v1/company/fields/selector", { field: "origin" })),
    safeDiagnostic("users", () => okkiGet("/v1/user/list"))
  ]);

  return {
    enabled: true,
    checks
  };
}
