import { config, hasOkkiConfig } from "./config.js";
import { inferCountry, splitPhone } from "./country.js";

let tokenCache = null;

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
  const phone = splitPhone(inquiry.customerId);
  const country = inferCountry({
    address: inquiry.address,
    phone: inquiry.customerId
  });
  const companyName = inquiry.companyName || phone.fullNumber;
  const originList = parseOriginList();
  const userId = Number(config.okkiOwnerUserId || 0);

  const remark = [
    "WhatsApp询盘",
    `询盘产品：${inquiry.product || ""}`,
    `采购数量：${inquiry.quantity || ""}`,
    `发货地址：${inquiry.address || ""}`,
    `发货国家：${country || ""}`,
    `Email：${inquiry.email || ""}`,
    `WhatsApp：${phone.fullNumber}`,
    inquiry.profileName ? `WhatsApp昵称：${inquiry.profileName}` : "",
    inquiry.imageLinks?.length ? `图片链接：${inquiry.imageLinks.join(" , ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return cleanObject({
    company_id: 0,
    user_id: userId > 0 ? userId : undefined,
    name: companyName,
    short_name: companyName,
    country,
    address: inquiry.address || "",
    origin_list: originList,
    remark,
    customers: [
      cleanObject({
        customer_id: 0,
        name: inquiry.profileName || "",
        email: inquiry.email || "",
        tel_area_code: phone.telAreaCode,
        tel: phone.localNumber,
        whatsapp: phone.fullNumber,
        main_customer_flag: 1,
        remark
      })
    ]
  });
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
