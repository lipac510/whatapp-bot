const phoneCountryPrefixes = [
  ["971", "AE"],
  ["966", "SA"],
  ["86", "CN"],
  ["44", "GB"],
  ["81", "JP"],
  ["82", "KR"],
  ["91", "IN"],
  ["62", "ID"],
  ["60", "MY"],
  ["66", "TH"],
  ["84", "VN"],
  ["63", "PH"],
  ["65", "SG"],
  ["61", "AU"],
  ["49", "DE"],
  ["33", "FR"],
  ["39", "IT"],
  ["34", "ES"],
  ["1", "US"]
];

const countryKeywords = [
  ["AE", ["uae", "united arab emirates", "dubai", "abu dhabi", "阿联酋", "迪拜"]],
  ["SA", ["saudi", "saudi arabia", "riyadh", "jeddah", "沙特", "沙特阿拉伯"]],
  ["CN", ["china", "中国", "mainland china", "guangdong", "shanghai", "beijing", "jiangsu", "zhejiang"]],
  ["US", ["usa", "united states", "america", "美国"]],
  ["GB", ["uk", "united kingdom", "britain", "england", "英国"]],
  ["DE", ["germany", "德国"]],
  ["FR", ["france", "法国"]],
  ["IT", ["italy", "意大利"]],
  ["ES", ["spain", "西班牙"]],
  ["CA", ["canada", "加拿大"]],
  ["AU", ["australia", "澳大利亚"]],
  ["JP", ["japan", "日本"]],
  ["KR", ["korea", "south korea", "韩国"]],
  ["IN", ["india", "印度"]],
  ["ID", ["indonesia", "印尼", "印度尼西亚"]],
  ["MY", ["malaysia", "马来西亚"]],
  ["TH", ["thailand", "泰国"]],
  ["VN", ["vietnam", "越南"]],
  ["PH", ["philippines", "菲律宾"]],
  ["SG", ["singapore", "新加坡"]]
];

export function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function inferCountryFromText(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";

  for (const [country, keywords] of countryKeywords) {
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      return country;
    }
  }

  return "";
}

export function inferCountryFromPhone(value) {
  const phone = normalizePhoneNumber(value);
  for (const [prefix, country] of phoneCountryPrefixes) {
    if (phone.startsWith(prefix)) return country;
  }
  return "";
}

export function inferCountry({ address, phone }) {
  return inferCountryFromText(address) || inferCountryFromPhone(phone);
}

export function splitPhone(value) {
  const phone = normalizePhoneNumber(value);
  const prefix = phoneCountryPrefixes.find(([item]) => phone.startsWith(item))?.[0] || "";

  return {
    telAreaCode: prefix,
    localNumber: prefix ? phone.slice(prefix.length) : phone,
    fullNumber: phone
  };
}
