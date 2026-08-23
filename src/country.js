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

const isoCountryCodes = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX",
  "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ",
  "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK",
  "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
  "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS",
  "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN",
  "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
  "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV",
  "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ",
  "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI",
  "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
  "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC",
  "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV",
  "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR",
  "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"
];

const countryNameOverrides = {
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CI: "Cote d'Ivoire",
  CV: "Cape Verde",
  CZ: "Czech Republic",
  KR: "South Korea",
  KP: "North Korea",
  MM: "Myanmar",
  PS: "Palestine",
  SZ: "Eswatini",
  TR: "Turkey"
};

let regionDisplayNames = null;
try {
  regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  regionDisplayNames = null;
}

const countryAliases = [
  ["AE", ["uae", "u a e", "united arab emirates", "dubai", "abu dhabi", "阿联酋", "迪拜"]],
  ["SA", ["saudi", "saudi arabia", "ksa", "riyadh", "jeddah", "沙特", "沙特阿拉伯"]],
  ["IQ", ["iraq", "baghdad", "karbala", "erbil", "iraqi", "العراق", "كربلاء", "بغداد", "iraq karbala"]],
  ["CN", ["china", "中国", "mainland china", "guangdong", "shanghai", "beijing", "jiangsu", "zhejiang"]],
  ["US", ["usa", "u s a", "united states", "america", "美国"]],
  ["GB", ["uk", "u k", "united kingdom", "great britain", "britain", "england", "scotland", "wales", "英国"]],
  ["DE", ["germany", "德国"]],
  ["FR", ["france", "法国"]],
  ["IT", ["italy", "意大利"]],
  ["ES", ["spain", "西班牙"]],
  ["CA", ["canada", "加拿大"]],
  ["AU", ["australia", "澳大利亚"]],
  ["QA", ["qatar", "doha", "卡塔尔", "多哈"]],
  ["OM", ["oman", "om", "muscat", "muscut", "阿曼"]],
  ["CY", ["cyprus", "limassol", "nicosia", "larnaca", "paphos"]],
  ["TR", ["turkey", "turkiye", "istanbul", "ankara"]],
  ["NL", ["netherlands", "holland", "amsterdam"]],
  ["BE", ["belgium", "brussels"]],
  ["CH", ["switzerland", "swiss", "zurich", "geneva"]],
  ["AT", ["austria", "vienna"]],
  ["PL", ["poland", "warsaw"]],
  ["PT", ["portugal", "lisbon"]],
  ["GR", ["greece", "athens"]],
  ["SE", ["sweden", "stockholm"]],
  ["NO", ["norway", "oslo"]],
  ["DK", ["denmark", "copenhagen"]],
  ["FI", ["finland", "helsinki"]],
  ["IE", ["ireland", "dublin"]],
  ["RO", ["romania", "bucharest"]],
  ["RS", ["serbia", "belgrade"]],
  ["HR", ["croatia", "zagreb"]],
  ["HU", ["hungary", "budapest"]],
  ["UA", ["ukraine", "kyiv", "kiev"]],
  ["RU", ["russia", "russian federation", "moscow"]],
  ["KW", ["kuwait"]],
  ["BH", ["bahrain"]],
  ["IL", ["israel"]],
  ["LB", ["lebanon", "beirut"]],
  ["PS", ["palestine", "palestinian territories"]],
  ["ZA", ["south africa", "johannesburg", "cape town"]],
  ["MA", ["morocco", "casablanca", "marrakech"]],
  ["DZ", ["algeria", "algiers"]],
  ["KE", ["kenya", "nairobi"]],
  ["NG", ["nigeria", "lagos", "abuja"]],
  ["GH", ["ghana", "accra"]],
  ["BJ", ["benin"]],
  ["SD", ["sudan", "khartoum"]],
  ["ET", ["ethiopia", "addis ababa"]],
  ["TZ", ["tanzania", "dar es salaam"]],
  ["UG", ["uganda", "kampala"]],
  ["AO", ["angola", "luanda"]],
  ["HK", ["hong kong", "hong kong sar"]],
  ["TW", ["taiwan", "taipei"]],
  ["LK", ["sri lanka", "colombo"]],
  ["NP", ["nepal", "kathmandu"]],
  ["KH", ["cambodia", "phnom penh"]],
  ["KZ", ["kazakhstan", "astana", "almaty"]],
  ["MV", ["maldives", "male"]],
  ["MN", ["mongolia", "ulaanbaatar"]],
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
  ["PH", ["philippines", "菲律宾"]],
  ["SG", ["singapore", "新加坡"]],
  ["PA", ["panama"]],
  ["CR", ["costa rica"]],
  ["BO", ["bolivia"]],
  ["EC", ["ecuador"]],
  ["PY", ["paraguay"]],
  ["UY", ["uruguay"]],
  ["PR", ["puerto rico"]],
  ["DO", ["dominican republic"]]
];

function normalizeComparable(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCountryKeywordEntries() {
  const generatedNames = isoCountryCodes
    .map((country) => [country, getCountryName(country)])
    .filter(([, name]) => name);
  const entries = [...countryAliases, ...generatedNames]
    .flatMap(([country, keywords]) => {
      const values = Array.isArray(keywords) ? keywords : [keywords];
      return values.map((keyword) => ({
        country,
        keyword,
        normalizedKeyword: normalizeComparable(keyword)
      }));
    })
    .filter((entry) => entry.normalizedKeyword);

  return entries.sort((a, b) => b.normalizedKeyword.length - a.normalizedKeyword.length);
}

const countryKeywordEntries = buildCountryKeywordEntries();

function keywordMatches(normalizedText, normalizedKeyword) {
  if (!normalizedText || !normalizedKeyword) return false;
  if (/^[a-z0-9 ]+$/.test(normalizedKeyword)) {
    return ` ${normalizedText} `.includes(` ${normalizedKeyword} `);
  }
  return normalizedText.includes(normalizedKeyword);
}

export function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function inferCountryFromText(value) {
  const text = normalizeComparable(value);
  if (!text) return "";

  for (const { country, normalizedKeyword } of countryKeywordEntries) {
    if (keywordMatches(text, normalizedKeyword)) return country;
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
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return countryNameOverrides[code] || regionDisplayNames?.of(code) || "";
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
