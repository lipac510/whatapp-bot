// Lightweight outbound localization. Only Arabic is supported: when a customer writes in
// Arabic we translate the bot's (fixed) replies by replacing known English phrases with their
// Arabic equivalents. Dynamic values (product names, numbers, country names, links, Emma's
// contact) are not in the table, so they pass through unchanged — and the English path is
// completely untouched (localize is a no-op unless lang === "ar").

export function detectArabic(text) {
  return /[؀-ۿ]/.test(String(text || ""));
}

// Ordered: where one phrase is a substring of another, the longer one MUST come first.
const AR_REPLACEMENTS = [
  // opening
  [
    "Hi there! 👋 I'm Ans, the AI assistant at Lipack. Just share 3 quick things below (~30 sec), then a real specialist will follow up to help you 😊",
    "مرحبًا! 👋 أنا Ans، المساعد الذكي لدى Lipack. شارك 3 معلومات سريعة أدناه (~30 ثانية)، وسيتابع معك أحد المختصين لمساعدتك 😊"
  ],
  ["✅ Shipping destination", "✅ وجهة الشحن"],
  ["✅ Product", "✅ المنتج"],
  ["✅ Quantity", "✅ الكمية"],
  ["📖 catalog 👉 www.cnlipack.com", "📖 الكتالوج 👉 www.cnlipack.com"],

  // product menu
  ["#1 — what kind of packaging do you need?", "ما نوع التغليف الذي تحتاجه؟"],
  ["1️⃣ Corrugated Box (ref. $0.5–1.5/pc)", "1️⃣ صندوق كرتون مضلّع (السعر التقريبي 0.5–1.5$/قطعة)"],
  ["2️⃣ Luxury Rigid Box (ref. $1.5–3/pc)", "2️⃣ علبة صلبة فاخرة (السعر التقريبي 1.5–3$/قطعة)"],
  ["3️⃣ Paper Bag (ref. $0.1–0.6/pc)", "3️⃣ كيس ورقي (السعر التقريبي 0.1–0.6$/قطعة)"],
  ["4️⃣ Other — just tell me what you need", "4️⃣ غير ذلك — فقط أخبرني بما تحتاجه"],
  ["👉 Just reply with a number to begin!", "👉 فقط أرسل رقمًا للبدء!"],

  // step prompts
  ["Great. What quantity do you need?", "رائع. ما الكمية التي تحتاجها؟"],
  ["You can reply like: 1000 pcs.", "يمكنك الرد مثل: 1000 قطعة."],
  ["Which country should we ship to?", "إلى أي دولة نشحن؟"],
  [
    "If possible, please share the full delivery address so we can estimate shipping more accurately.",
    "إن أمكن، شارك عنوان التسليم الكامل حتى نقدّر تكلفة الشحن بدقة أكبر."
  ],
  [
    "Almost done! 📲 What's the best WhatsApp number for our specialist to send you the catalog & quote?",
    "اقتربنا من الانتهاء! 📲 ما أفضل رقم واتساب ليرسل لك مختصنا الكتالوج وعرض السعر؟"
  ],
  ["Please include your country code, e.g. +1, +49.", "يرجى تضمين رمز الدولة، مثل ‎+1‎ أو ‎+49‎."],

  // handoff reminder
  [
    "Our sales specialist will review your request and contact you within the same business day.",
    "سيراجع مختص المبيعات لدينا طلبك ويتواصل معك في نفس يوم العمل."
  ],
  [
    " 👉 Working hours:Monday-Friday, 9:00-18:00,China time.",
    " 👉 ساعات العمل: الاثنين-الجمعة، 9:00-18:00 بتوقيت الصين."
  ],

  // summary
  ["😊 Thank you. We have received your inquiry.", "😊 شكرًا لك. لقد استلمنا استفسارك."],
  ["Inquiry details:", "تفاصيل الاستفسار:"],
  ["Product: ", "المنتج: "],
  ["Quantity: ", "الكمية: "],
  ["Shipping address: ", "عنوان الشحن: "],
  ["Photos received: ", "الصور المستلمة: "],
  ["Videos received: ", "الفيديوهات المستلمة: "],
  ["Links received: ", "الروابط المستلمة: "],

  // country confirmation (country name + flag pass through in the middle/after)
  ["I see your WhatsApp number looks like ", "يبدو أن رقم واتساب الخاص بك من "],
  ["Should we ship to ", "هل نشحن إلى "],
  ["✅ Yes, ", "✅ نعم، "],
  ["↔️ No, another country (please tell me which)", "↔️ لا، دولة أخرى (يرجى إخباري بأيها)"],

  // validation (longer variants before shorter to avoid partial replacement)
  ["Please tell us the quantity you need, for example: 1000 pcs.", "يرجى إخبارنا بالكمية التي تحتاجها، مثال: 1000 قطعة."],
  ["Please tell us the product you are looking for.", "يرجى إخبارنا بالمنتج الذي تبحث عنه."],
  ["Please tell us the quantity you need.", "يرجى إخبارنا بالكمية التي تحتاجها."],
  ["Please reply with 1, 2, 3, or 4, or tell us the packaging product you need.", "يرجى الرد بـ 1 أو 2 أو 3 أو 4، أو إخبارنا بمنتج التغليف الذي تحتاجه."],
  ["Please reply Yes, or tell us the correct destination country.", "يرجى الرد بنعم، أو إخبارنا بدولة الوجهة الصحيحة."],
  ["Please share your destination country or shipping address.", "يرجى مشاركة دولة الوجهة أو عنوان الشحن."],
  ["Please share your country or full shipping address, for example: Qatar or Porto Arabia tower 24, Doha, Qatar.", "يرجى مشاركة دولتك أو عنوان الشحن الكامل، مثال: قطر أو Porto Arabia tower 24، الدوحة، قطر."],
  ["Please share your country or shipping address, for example: Canada or Dubai, UAE.", "يرجى مشاركة دولتك أو عنوان الشحن، مثال: كندا أو دبي، الإمارات."],
  ["Please share a valid WhatsApp number with country code, for example: +1 7185551234.", "يرجى مشاركة رقم واتساب صحيح مع رمز الدولة، مثال: ‎+1 7185551234‎."],
  ["Please share your WhatsApp number with country code.", "يرجى مشاركة رقم واتساب مع رمز الدولة."],
  ["Please send your answer.", "يرجى إرسال إجابتك."],

  // FAQ
  ["Please view our web: www.cnlipack.com for more products.", "يرجى زيارة موقعنا: www.cnlipack.com لمزيد من المنتجات."],
  ["Our address: Building 6, No. 198 Changjian Road, Luojing Town, Baoshan District, Shanghai.", "عنواننا: Building 6, No. 198 Changjian Road, Luojing Town, Baoshan District, Shanghai."],
  ["Our MOQ is 500 pcs.", "الحد الأدنى للطلب لدينا هو 500 قطعة."],
  [
    "Yes, we support custom packaging. Please send your product type, quantity, shipping address, and any photos/videos/links if you have them.",
    "نعم، ندعم التغليف المخصّص. يرجى إرسال نوع المنتج والكمية وعنوان الشحن وأي صور/فيديوهات/روابط إن وجدت."
  ],
  [
    "I am Lipack's automated assistant, here to collect your inquiry details quickly. Our sales team will review your request and follow up with you soon.",
    "أنا المساعد الآلي لـ Lipack، أجمع تفاصيل استفسارك بسرعة. سيراجع فريق المبيعات طلبك ويتابع معك قريبًا."
  ],

  // attachments
  ["Your photo has been received. You can continue sending attachments.", "تم استلام صورتك. يمكنك متابعة إرسال المرفقات."],
  ["Your video has been received. You can continue sending attachments.", "تم استلام الفيديو الخاص بك. يمكنك متابعة إرسال المرفقات."],

  // restricted country
  [
    "Thank you for your inquiry, but sorry that we don't have the shipping agent to your country now.",
    "شكرًا لاستفسارك، لكن للأسف لا يتوفر لدينا وكيل شحن إلى دولتك حاليًا."
  ]
];

export function toArabic(text) {
  let out = String(text || "");
  for (const [en, ar] of AR_REPLACEMENTS) {
    if (out.includes(en)) out = out.split(en).join(ar);
  }
  return out;
}

export function localize(text, lang) {
  return lang === "ar" ? toArabic(text) : text;
}
