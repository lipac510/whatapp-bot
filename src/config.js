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

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || (process.env.RENDER ? "0.0.0.0" : "127.0.0.1"),
  graphApiVersion: process.env.GRAPH_API_VERSION || "v25.0",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "",
  appSecret: process.env.META_APP_SECRET || "",
  businessName: process.env.BUSINESS_NAME || "Lipack Packaging",
  dataDir: process.env.DATA_DIR || (process.env.RENDER ? "/tmp/wa-bot-data" : "data"),
  okkiApiBase: process.env.OKKI_API_BASE || "https://api-sandbox.xiaoman.cn",
  okkiClientId: process.env.OKKI_CLIENT_ID || "",
  okkiClientSecret: process.env.OKKI_CLIENT_SECRET || "",
  okkiScope: process.env.OKKI_SCOPE || "company",
  okkiOriginId: process.env.OKKI_ORIGIN_ID || "",
  okkiOwnerUserId: process.env.OKKI_OWNER_USER_ID || ""
};

export function shouldVerifyWebhookSignature() {
  return Boolean(config.appSecret && !config.appSecret.includes("replace_with"));
}

export function hasOkkiConfig() {
  return Boolean(
    config.okkiClientId &&
      !config.okkiClientId.includes("replace_with") &&
      config.okkiClientSecret &&
      !config.okkiClientSecret.includes("replace_with")
  );
}

export function validateConfig() {
  const missing = [];

  if (!config.accessToken || config.accessToken.includes("replace_with")) {
    missing.push("WHATSAPP_ACCESS_TOKEN");
  }
  if (!config.phoneNumberId || config.phoneNumberId.includes("replace_with")) {
    missing.push("WHATSAPP_PHONE_NUMBER_ID");
  }
  if (!config.webhookVerifyToken || config.webhookVerifyToken.includes("replace_with")) {
    missing.push("WEBHOOK_VERIFY_TOKEN");
  }

  return missing;
}
