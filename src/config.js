import fs from "node:fs";

function loadEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return;

  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

// IG_ACCOUNTS maps an Instagram account id to its access token, so one webhook can serve
// several Instagram accounts. Example: {"17841400000000001":"IGTOKEN1","...":"IGTOKEN2"}.
// For a single account you can instead just set IG_ACCESS_TOKEN.
function parseIgAccounts(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.warn("IG_ACCOUNTS is not valid JSON; ignoring it.");
    return {};
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1"),
  graphApiVersion: process.env.GRAPH_API_VERSION || "v25.0",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
  // Instagram API with Instagram login (graph.instagram.com).
  igAccessToken: process.env.IG_ACCESS_TOKEN || "",
  igAccounts: parseIgAccounts(process.env.IG_ACCOUNTS),
  igAppSecret: process.env.IG_APP_SECRET || "",
  // Short display names for our own IG accounts (shown in /admin). Override/extend via IG_ACCOUNT_NAMES.
  igAccountNames: {
    "17841428040000323": "Ins sa",
    "17841474162415513": "Ins ae",
    "17841451800200162": "ins USA",
    ...parseIgAccounts(process.env.IG_ACCOUNT_NAMES)
  },
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "",
  appSecret: process.env.META_APP_SECRET || "",
  businessName: process.env.BUSINESS_NAME || "Lipack Packaging",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  dataDir: process.env.DATA_DIR || (process.env.RENDER ? "/tmp/wa-bot-data" : "data"),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  okkiApiBase: process.env.OKKI_API_BASE || "https://api-sandbox.xiaoman.cn",
  okkiClientId: process.env.OKKI_CLIENT_ID || "",
  okkiClientSecret: process.env.OKKI_CLIENT_SECRET || "",
  okkiScope: process.env.OKKI_SCOPE || "company",
  okkiOriginId: process.env.OKKI_ORIGIN_ID || "",
  okkiIgOriginId: process.env.OKKI_IG_ORIGIN_ID || "",
  okkiOwnerUserId: process.env.OKKI_OWNER_USER_ID || "",
  okkiInquirySummaryFieldId: process.env.OKKI_INQUIRY_SUMMARY_FIELD_ID || "",
  okkiPurchaseQuantityFieldId: process.env.OKKI_PURCHASE_QUANTITY_FIELD_ID || "",
  okkiInquiryProductFieldId: process.env.OKKI_INQUIRY_PRODUCT_FIELD_ID || ""
};

export function shouldVerifyWebhookSignature() {
  return Boolean(config.appSecret && !config.appSecret.includes("replace_with"));
}

export function hasWhatsappConfig() {
  return Boolean(
    config.accessToken &&
      !config.accessToken.includes("replace_with") &&
      config.phoneNumberId &&
      !config.phoneNumberId.includes("replace_with")
  );
}

export function hasInstagramConfig() {
  const hasSingleToken =
    Boolean(config.igAccessToken) && !config.igAccessToken.includes("replace_with");
  const hasAccountMap = Object.keys(config.igAccounts).length > 0;
  return hasSingleToken || hasAccountMap;
}

// Resolve the Instagram access token for the account that received a message.
// Falls back to the single IG_ACCESS_TOKEN when no per-account token is configured.
export function getInstagramToken(accountId) {
  return config.igAccounts[accountId] || config.igAccessToken || "";
}

export function hasOkkiConfig() {
  return Boolean(
    config.okkiClientId &&
      !config.okkiClientId.includes("replace_with") &&
      config.okkiClientSecret &&
      !config.okkiClientSecret.includes("replace_with")
  );
}

export function hasSupabaseConfig() {
  return Boolean(
    config.supabaseUrl &&
      config.supabaseUrl.startsWith("http") &&
      config.supabaseServiceRoleKey &&
      !config.supabaseServiceRoleKey.includes("replace_with")
  );
}

export function validateConfig() {
  const missing = [];

  if (!config.webhookVerifyToken || config.webhookVerifyToken.includes("replace_with")) {
    missing.push("WEBHOOK_VERIFY_TOKEN");
  }

  // At least one channel must be fully configured. WhatsApp-only deployments stay valid;
  // an Instagram-only deployment is also allowed.
  if (!hasWhatsappConfig() && !hasInstagramConfig()) {
    missing.push(
      "WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (or IG_PAGE_ID + IG_PAGE_ACCESS_TOKEN)"
    );
  }

  return missing;
}
