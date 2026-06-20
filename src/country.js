let parsePhoneNumberFromString;

try {
  ({ parsePhoneNumberFromString } = await import("libphonenumber-js/max"));
} catch {
  parsePhoneNumberFromString = null;
}

const fallbackPhoneCountryPrefixes = [
  ["971", "AE"],
  ["966", "SA"],
  ["964", "IQ"],
  ["86", "CN"],
  ["44", "GB"],
  ["81", "JP"],
  ["82", "KR"],
  ["91", "IN"],
  ["880", "BD"],
  ["20", "EG"],
  ["93", "AF"],
  ["218", "LY"],
  ["502", "GT"],
  ["95", "MM"],
  ["856", "LA"],
  ["967", "YE"],
  ["216", "TN"],
  ["98", "IR"],
  ["963", "SY"],
  ["962", "JO"],
  ["850", "KP"],
  ["92", "PK"],
  ["52", "MX"],
  ["55", "BR"],
  ["54", "AR"],
  ["56", "CL"],
  ["57", "CO"],
  ["51", "PE"],
  ["58", "VE"],
  ["62", "ID"],
  ["60", "MY"],
  ["66", "TH"],
  ["84", "VN"],
  ["63", "PH"],
  ["65", "SG"],
  ["61", "AU"],
  ["974", "QA"],
  ["968", "OM"],
  ["49", "DE"],
  ["33", "FR"],
  ["39", "IT"],
  ["34", "ES"],
  ["1", "US"]
];

const countryNames = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IQ: "Iraq",
  CN: "China",
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  CA: "Canada",
  AU: "Australia",
  QA: "Qatar",
  OM: "Oman",
  JP: "Japan",
  KR: "South Korea",
  IN: "India",
  BD: "Bangladesh",
  EG: "Egypt",
  AF: "Afghanistan",
  LY: "Libya",
  GT: "Guatemala",
  VN: "Vietnam",
  MM: "Myanmar",
  LA: "Laos",
  YE: "Yemen",
  TN: "Tunisia",
  IR: "Iran",
  SY: "Syria",
  JO: "Jordan",
  KP: "North Korea",
  PK: "Pakistan",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  VE: "Venezuela",
  ID: "Indonesia",
  MY: "Malaysia",
  TH: "Thailand",
  PH: "Philippines",
  SG: "Singapore"
};

const countryKeywords = [
  ["AE", ["uae", "united arab emirates", "dubai", "abu dhabi", "阿联酋", "迪拜"]],
  ["SA", ["saudi", "saudi arabia", "riyadh", "jeddah", "沙特", "沙特阿拉伯"]],
  ["IQ", ["iraq", "baghdad", "karbala", "erbil", "iraqi", "العراق", "كربلاء", "بغداد", "iraq karbala"]],
  ["CN", ["china", "中国", "mainland china", "guangdong", "shanghai", "beijing", "jiangsu", "zhejiang"]],
  ["US", ["usa", "united states", "america", "美国"]],
  ["GB", ["uk", "united kingdom", "britain", "england", "英国"]],
  ["DE", ["germany", "德国"]],
  ["FR", ["france", "法国"]],
  ["IT", ["italy", "意大利"]],
  ["ES", ["spain", "西班牙"]],
  ["CA", ["canada", "加拿大"]],
  ["AU", ["australia", "澳大利亚"]],
  ["QA", ["qatar", "doha", "卡塔尔", "多哈"]],
  ["OM", ["oman", "om", "muscat", "muscut", "阿曼"]],
  ["JP", ["japan", "日本"]],
  ["KR", ["korea", "south korea", "韩国"]],
  ["IN", ["india", "印度"]],
  ["BD", ["bangladesh", "孟加拉", "孟加拉国"]],
  ["EG", ["egypt", "埃及"]],
  ["AF", ["afghanistan", "阿富汗"]],
  ["LY", ["libya", "利比亚"]],
  ["GT", ["guatemala", "危地马拉"]],
  ["VN", ["vietnam", "越南"]],
  ["MM", ["myanmar", "burma", "缅甸"]],
  ["LA", ["laos", "老挝"]],
  ["YE", ["yemen", "也门"]],
  ["TN", ["tunisia", "突尼斯"]],
  ["IR", ["iran", "伊朗"]],
  ["SY", ["syria", "叙利亚"]],
  ["JO", ["jordan", "约旦"]],
  ["KP", ["north korea", "dprk", "朝鲜"]],
  ["PK", ["pakistan", "巴基斯坦"]],
  ["MX", ["mexico", "墨西哥"]],
  ["BR", ["brazil", "巴西"]],
  ["AR", ["argentina", "阿根廷"]],
  ["CL", ["chile", "智利"]],
  ["CO", ["colombia", "哥伦比亚"]],
  ["PE", ["peru", "秘鲁"]],
  ["VE", ["venezuela", "委内瑞拉"]],
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
  if (!phone) return "";

  if (parsePhoneNumberFromString) {
    const parsed = parsePhoneNumberFromString(phone.startsWith("+") ? phone : `+${phone}`);
    if (parsed?.country) return parsed.country;
  }

  for (const [prefix, country] of fallbackPhoneCountryPrefixes) {
    if (phone.startsWith(prefix)) return country;
  }

  return "";
}

export function inferCountry({ address, phone }) {
  return inferCountryFromText(address) || inferCountryFromPhone(phone);
}

export function getCountryName(countryCode) {
  return countryNames[String(countryCode || "").toUpperCase()] || "";
}

export function getCountryFlag(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return [...code].map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
}

export function splitPhone(value) {
  const phone = normalizePhoneNumber(value);
  if (!phone) {
    return {
      telAreaCode: "",
      localNumber: "",
      fullNumber: ""
    };
  }

  if (parsePhoneNumberFromString) {
    const parsed = parsePhoneNumberFromString(phone.startsWith("+") ? phone : `+${phone}`);
    const prefix = parsed?.countryCallingCode || "";
    const localNumber = parsed?.nationalNumber || (prefix ? phone.slice(prefix.length) : phone);

    return {
      telAreaCode: prefix,
      localNumber,
      fullNumber: phone
    };
  }

  const prefix = fallbackPhoneCountryPrefixes.find(([item]) => phone.startsWith(item))?.[0] || "";
  const localNumber = prefix ? phone.slice(prefix.length) : phone;

  return {
    telAreaCode: prefix,
    localNumber,
    fullNumber: phone
  };
}
