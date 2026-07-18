import { inferCountry, inferCountryFromText } from "./country.js";

const productOptions = new Map([
  ["1", "Corrugated Box"],
  ["2", "Luxury Rigid Box"],
  ["3", "Paper Bag"],
  ["4", "Other"]
]);

const lowInformationPattern =
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|你好|您好|谢谢|在吗|嗨)$/i;
const urlOnlyPattern = /^https?:\/\/\S+$/i;
const numberOnlyPattern = /^\d+(?:\.\d+)?\s*(k|pcs|pc|pieces|只|个)?$/i;
const strictQuantityPattern = /^\s*\d+(?:\.\d+)?\s*(k|pcs|pc|pieces|只|个)?\s*$/i;

const officialCodePattern =
  /(\b\d{4,8}\b.{0,80}(是你的|is your|verification code|verify code|security code|login code|confirmation code|auth(?:entication)? code|\bcode\b|验证码|校验码|动态码|one-time password|otp)|(verification code|verify code|security code|login code|confirmation code|auth(?:entication)? code|\bcode\b|验证码|校验码|动态码|one-time password|otp).{0,80}\b\d{4,8}\b)/i;

const restrictedCountries = new Set([
  "IN",
  "BD",
  "EG",
  "AF",
  "LY",
  "GT",
  "VN",
  "MM",
  "LA",
  "YE",
  "TN",
  "IR",
  "SY",
  "JO",
  "KP",
  "PK",
  "LB",
  "SD",
  "NG",
  "BJ",
  "KE"
]);

const latinAmericaCountries = new Set([
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "SV",
  "HN",
  "MX",
  "NI",
  "PA",
  "PY",
  "PE",
  "PR",
  "UY",
  "VE"
]);

export const existingCustomerReply = [
  "Thank you. Our sales team will contact you soon.",
  "",
  "If no one contacts you, please contact ",
  "Emma (LIPACK):",
  "Cell: 86-18014856231 (WhatsApp / WeChat)",
  "Email: emma@cnlipack.com"
].join("\n");

export const humanFallbackReply = [
  "Emma -- NANJING LIPACK",
  "",
  "Cell: 86-18014856231 ( whatsapp/wechat )"
].join("\n");

export const noShippingAgentReply =
  "Thank you for your inquiry, but sorry that we don't have the shipping agent to your country now.";

export function normalizeProductAnswer(text) {
  const value = String(text || "").trim();
  if (productOptions.has(value)) return productOptions.get(value);

  const lower = value.toLowerCase();
  if (/\bcorrugated\b|\bcorrugated box\b|瓦楞/.test(lower)) return "Corrugated Box";
  if (/\brigid\b|\bluxury box\b|\bgift box\b|精装|礼盒/.test(lower)) return "Luxury Rigid Box";
  if (/\bpaper bag\b|\bbag\b|纸袋/.test(lower)) return "Paper Bag";
  if (lowInformationPattern.test(value)) return "";
  if (urlOnlyPattern.test(value)) return "";
  if (numberOnlyPattern.test(value)) return "";
  if (/[a-z\u4e00-\u9fff]{2,}/i.test(value)) return value;

  return "";
}

export function isOfficialCodeMessage(text) {
  const value = String(text || "");
  if (!/\b\d{4,8}\b/.test(value)) return false;
  return officialCodePattern.test(value);
}

export function isHumanHandoffRequest(text) {
  return /\b(human|real person|real human|sales|salesperson|agent|staff|representative|contact me|call me|whatsapp me)\b/i.test(String(text || "")) ||
    /人工|真人|业务员|销售|客服联系|人工客服|转人工|联系我|给我打电话/.test(String(text || ""));
}

export function parseQuantity(value) {
  const text = String(value || "").toLowerCase().replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|pcs|pc|pieces|只|个)?/i);
  if (!match) return 0;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return 0;
  return match[2] === "k" ? number * 1000 : number;
}

export function normalizeQuantityAnswer(value) {
  const text = String(value || "").toLowerCase().replace(/,/g, " ").trim();
  if (!strictQuantityPattern.test(text)) return "";
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|pcs|pc|pieces|只|个)?/i);
  if (!match) return "";

  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) return "";

  if (match[2] && match[2].toLowerCase() === "k") {
    return `${number * 1000} pcs`;
  }

  const normalizedUnit = match[2] ? " pcs" : "";
  return `${number}${normalizedUnit}`;
}

export function isHighValueQuantity(quantityText, threshold = 5000) {
  return parseQuantity(quantityText) >= threshold;
}

export function normalizeWhatsAppAnswer(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return digits;
}

export function isValidWhatsAppAnswer(value) {
  return Boolean(normalizeWhatsAppAnswer(value));
}

export function isRestrictedCountry(countryCode) {
  return restrictedCountries.has(countryCode) || latinAmericaCountries.has(countryCode);
}

export function isLowInformationText(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return lowInformationPattern.test(text) || urlOnlyPattern.test(text);
}

export function isValidQuantityAnswer(value) {
  if (isLowInformationText(value)) return false;
  if (!strictQuantityPattern.test(String(value || "").toLowerCase().replace(/,/g, " ").trim())) {
    return false;
  }
  return parseQuantity(value) > 0;
}

export function isMeaningfulAddressAnswer(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (isLowInformationText(text)) return false;
  if (numberOnlyPattern.test(text)) return false;
  if (inferCountryFromText(text)) return true;
  if (/[\u4e00-\u9fff]{2,}/.test(text)) return true;
  if (/[a-z]{2,}/i.test(text)) return true;
  return false;
}

export function canResolveInquiryCountry(inquiry = {}) {
  return Boolean(
    inferCountry({
      address: inquiry.address || "",
      phone: inquiry.whatsapp || inquiry.customerId || ""
    })
  );
}

export function validateInquiryForRecording(inquiry = {}) {
  if (!normalizeProductAnswer(inquiry.product || "")) {
    return "Invalid product";
  }
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
