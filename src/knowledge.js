import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const knowledgeRoot = join(projectRoot, "knowledge");
const indexPath = join(knowledgeRoot, "index.json");

const fallbackAnswers = new Map([
  ["faq-catalog", "Please view our web: www.cnlipack.com for more products."],
  [
    "faq-company-contact",
    "Our address: Building 6, No. 198 Changjian Road, Luojing Town, Baoshan District, Shanghai."
  ],
  ["faq-moq", "Our MOQ is 500 pcs."],
  [
    "faq-custom-logo",
    "Yes, we support custom packaging. Please send your product type, quantity, shipping address, and any photos/videos/links if you have them."
  ]
]);

const intentRules = [
  {
    id: "faq-catalog",
    pattern: /\b(catalog|catalogue|brochure|pdf|pictures?|photos?)\b|目录|产品册|图片|照片|كتالوج|صور/i
  },
  {
    id: "faq-samples",
    pattern: /\b(samples?|sampling|sample fee|sample cost)\b|样品|打样|عينة/i
  },
  {
    id: "faq-moq",
    pattern: /\b(moq|minimum order|minimum quantity|small quantity)\b|起订量|最小起订|最少|الحد الأدنى/i
  },
  {
    id: "faq-delivery-time",
    pattern: /\b(lead time|delivery time|production time|shipping time|how long|urgent|rush)\b|交期|多久|生产时间|发货时间|مدة|وقت التسليم/i
  },
  {
    id: "faq-custom-logo",
    pattern: /\b(custom logo|logo|printing|branding|customi[sz]e|bespoke|oem|odm|own design)\b|定制|尺寸|规格|印刷|客制|شعار|تخصيص/i
  },
  {
    id: "faq-order-process",
    pattern: /\b(order process|how to order|place an order|payment process|production process|qc)\b|下单流程|怎么下单|付款流程|质检|流程|عملية الطلب|الدفع/i
  },
  {
    id: "faq-company-contact",
    pattern: /\b(where are you|your location|factory address|company address|office address|contact information|live agent|human agent)\b|你们在哪里|工厂在哪里|公司在哪里|人工|真人|联系方式|عنوان|أين أنتم|اين انتم/i
  },
  {
    id: "product-rigid-boxes",
    pattern: /\b(rigid boxes?|luxury boxes?|gift boxes?|magnetic boxes?|premium boxes?)\b|精装|礼盒/i,
    needsQuestionSignal: true
  },
  {
    id: "product-paper-bags",
    pattern: /\b(paper bags?|shopping bags?|kraft bags?|gift bags?)\b|纸袋/i,
    needsQuestionSignal: true
  },
  {
    id: "product-corrugated-boxes",
    pattern: /\b(corrugated boxes?|shipping boxes?|cartons?|mailer boxes?|mailing boxes?)\b|瓦楞|纸箱/i,
    needsQuestionSignal: true
  }
];

function normalizeText(text) {
  return String(text || "").trim();
}

function hasQuestionSignal(text) {
  return /[?？]|\b(can|could|do|does|did|will|would|what|which|where|when|how|have|has|support|make|provide|offer)\b|吗|么|哪里|多久|可以|能不能|有没有|是否|怎么|如何|هل|كيف|أين|اين|كم|ممكن|هل يمكن/i.test(text);
}

function extractSection(markdown, heading) {
  const lines = String(markdown || "").split(/\r?\n/);
  const headingText = heading.toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    return match && match[1].toLowerCase() === headingText;
  });
  if (start === -1) return "";

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    body.push(line);
  }

  return body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function loadKnowledgeDocuments() {
  if (!existsSync(indexPath)) return new Map();

  try {
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    const documents = Array.isArray(index.documents) ? index.documents : [];
    const entries = documents.flatMap((document) => {
      if (!document?.id || !document?.path) return [];

      const documentPath = join(knowledgeRoot, document.path);
      if (!existsSync(documentPath)) return [];

      const markdown = readFileSync(documentPath, "utf8");
      const shortAnswer = extractSection(markdown, "Short answer");
      if (!shortAnswer) return [];

      return [[document.id, { ...document, shortAnswer }]];
    });

    return new Map(entries);
  } catch {
    return new Map();
  }
}

const knowledgeDocuments = loadKnowledgeDocuments();

function answerForIntent(intentId) {
  return knowledgeDocuments.get(intentId)?.shortAnswer || fallbackAnswers.get(intentId) || "";
}

export function findKnowledgeAnswer(messageText) {
  const text = normalizeText(messageText);
  if (!text) return "";

  const questionSignal = hasQuestionSignal(text);
  const matchedRule = intentRules.find((rule) => {
    if (rule.needsQuestionSignal && !questionSignal) return false;
    return rule.pattern.test(text);
  });

  if (!matchedRule) return "";
  return answerForIntent(matchedRule.id);
}
