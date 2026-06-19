import {
  isHighValueQuantity,
  isMeaningfulAddressAnswer,
  isValidQuantityAnswer,
  normalizeQuantityAnswer,
  normalizeProductAnswer
} from "./rules.js";

const steps = ["product", "quantity", "address"];
const minimumFastTrackQuantity = 5000;
const websiteReply = "Please view our web: www.cnlipack.com for more products.";
const companyAddress =
  "Our address: Building 6, No. 198 Changjian Road, Luojing Town, Baoshan District, Shanghai.";
const moqReply = "Our MOQ is 500 pcs.";
const customReply =
  "Yes, we support custom packaging. Please send your product type, quantity, shipping address, and any photos/videos/links if you have them.";
const productQuestion = [
  "#1 — what kind of packaging do you need?",
  "",
  "1️⃣ Corrugated Box (ref. $0.5–1.5/pc)",
  "2️⃣ Luxury Rigid Box (ref. $1.5–3/pc)",
  "3️⃣ Paper Bag (ref. $0.1–0.6/pc)",
  "4️⃣ Other — just tell me what you need",
  "",
  "👉 Just reply with a number to begin!"
].join("\n");
const openingPrompt = [
  "Hi there! 👋 I'm Ans, the AI assistant at Lipack. Just share 3 quick things below (~30 sec), then a real specialist will follow up to help you 😊",
  "✅ Product  ",
  "✅ Quantity",
  "✅ Shipping destination",
  "",
  "📖 catalog 👉 www.cnlipack.com",
  "",
  productQuestion
].join("\n");
export const handoffReminderMessage = [
  "Our sales specialist will review your request and contact you within the same business day.",
  "",
  " 👉 Working hours:Monday-Friday, 9:00-18:00,China time."
].join("\n");

const prompts = {
  product: productQuestion,
  quantity: "Great. What quantity do you need?\nYou can reply like: 1000 pcs.",
  address: "Which country should we ship to?\nIf possible, please share the full delivery address so we can estimate shipping more accurately."
};

const labels = {
  product: "采购产品",
  quantity: "采购数量",
  address: "发货地址"
};

const urlPattern = /https?:\/\/[^\s<>"'，。；、]+/gi;

function normalizeText(text) {
  return String(text || "").trim();
}

function isRestart(text) {
  return /^(restart|reset|重新开始|重来|开始)$/i.test(normalizeText(text));
}

function isBotQuestion(text) {
  return /\b(bot|robot|ai|human|real person|real human)\b/i.test(normalizeText(text)) ||
    /机器人|真人|人工客服/.test(normalizeText(text));
}

function isCatalogQuestion(text) {
  return /\b(catalog|catalogue|brochure|website|web|products?)\b/i.test(normalizeText(text)) ||
    /目录|产品册|网站/.test(normalizeText(text));
}

function isLocationQuestion(text) {
  return /\b(where are you|location|address|factory address|company address|office address)\b/i.test(normalizeText(text)) ||
    /你们在哪里|地址|工厂在哪里|公司在哪里/.test(normalizeText(text));
}

function isSampleQuestion(text) {
  return /\b(sample|samples?|moq|minimum order|minimum quantity)\b/i.test(normalizeText(text)) ||
    /样品|起订量|最小起订|最少/.test(normalizeText(text));
}

function isCustomQuestion(text) {
  return /\b(custom|customized|bespoke|oem|odm|size|sizes|specification|specifications)\b/i.test(normalizeText(text)) ||
    /定制|尺寸|规格|可不可以做|能不能做/.test(normalizeText(text));
}

function validationMessage(step, text) {
  if (text) return "";
  if (step === "product") return "Please tell us the product you are looking for.";
  if (step === "quantity") return "Please tell us the quantity you need.";
  if (step === "address") return "Please share your destination country or shipping address.";
  return "Please send your answer.";
}

function validateStepAnswer(step, text) {
  const emptyMessage = validationMessage(step, text);
  if (emptyMessage) return emptyMessage;
  if (step === "product" && !normalizeProductAnswer(text)) {
    return "Please reply with 1, 2, 3, or 4, or tell us the packaging product you need.";
  }
  if (step === "quantity" && !isValidQuantityAnswer(text)) {
    return "Please tell us the quantity you need, for example: 1000 pcs.";
  }
  if (step === "address" && !isMeaningfulAddressAnswer(text)) {
    return "Please share your country or shipping address, for example: Canada or Dubai, UAE.";
  }
  return "";
}

function nextStep(currentStep) {
  const index = steps.indexOf(currentStep);
  return steps[index + 1] || null;
}

function mergeUnique(existing = [], incoming = []) {
  return [...new Set([...existing, ...incoming].filter(Boolean))];
}

function extractLinks(text) {
  return normalizeText(text).match(urlPattern) || [];
}

function buildSummary(data) {
  const imageCount = data.imageLinks?.length || 0;
  const videoCount = data.videoLinks?.length || 0;
  const linkCount = data.customerLinks?.length || 0;
  return [
    "😊 Thank you. We have received your inquiry.",
    "",
    "Inquiry details:",
    `Product: ${data.product}`,
    `Quantity: ${data.quantity}`,
    `Shipping address: ${data.address || ""}`,
    imageCount ? `Photos received: ${imageCount}` : "",
    videoCount ? `Videos received: ${videoCount}` : "",
    linkCount ? `Links received: ${linkCount}` : "",
    "",
    handoffReminderMessage
  ].filter((line) => line !== "").join("\n");
}

function buildAttachmentReply(step, attachmentType) {
  const label = attachmentType === "video" ? "video" : "photo";
  return `Your ${label} has been received. You can continue sending attachments.\n\n${prompts[step]}`;
}

export function startConversation(profileName = "") {
  return {
    session: {
      step: "product",
      profileName,
      data: {
        imageLinks: [],
        videoLinks: [],
        customerLinks: []
      },
      startedAt: new Date().toISOString()
    },
    replies: [openingPrompt],
    complete: false
  };
}

export function handleCustomerMessage(session, messageText, profileName = "") {
  const text = normalizeText(messageText);

  if (!session || isRestart(text)) {
    return startConversation(profileName);
  }

  if (session.step === "complete") {
    return {
      session,
      replies: [handoffReminderMessage],
      complete: false
    };
  }

  const step = session.step;
  const customerLinks = mergeUnique(session.data?.customerLinks, extractLinks(text));

  if (isBotQuestion(text)) {
    return {
      session,
      replies: [
        `I am Lipack's automated assistant, here to collect your inquiry details quickly. Our sales team will review your request and follow up with you soon.\n\n${prompts[step]}`
      ],
      complete: false
    };
  }

  if (isCatalogQuestion(text) && customerLinks.length === 0) {
    return {
      session: customerLinks.length
        ? {
            ...session,
            data: {
              ...session.data,
              customerLinks
            }
          }
        : session,
      replies: [`${websiteReply}\n\n${prompts[step]}`],
      complete: false
    };
  }

  if (isLocationQuestion(text)) {
    return {
      session,
      replies: [`${companyAddress}\n\n${prompts[step]}`],
      complete: false
    };
  }

  if (isSampleQuestion(text)) {
    return {
      session,
      replies: [`${moqReply}\n\n${prompts[step]}`],
      complete: false
    };
  }

  if (isCustomQuestion(text)) {
    return {
      session,
      replies: [`${customReply}\n\n${prompts[step]}`],
      complete: false
    };
  }

  const invalidMessage = validateStepAnswer(step, text);
  if (invalidMessage) {
    return {
      session: customerLinks.length
        ? {
            ...session,
            data: {
              ...session.data,
              customerLinks
            }
          }
        : session,
      replies: [invalidMessage],
      complete: false
    };
  }

  const updated = {
    ...session,
    profileName: session.profileName || profileName,
    data: {
      ...session.data,
      customerLinks,
      [step]:
        step === "product"
          ? normalizeProductAnswer(text)
          : step === "quantity"
            ? normalizeQuantityAnswer(text)
            : text
    }
  };

  if (step === "quantity" && isHighValueQuantity(text, minimumFastTrackQuantity)) {
    const completed = {
      ...updated,
      fastTrack: true,
      step: "complete",
      completedAt: new Date().toISOString()
    };

    return {
      session: completed,
      replies: [buildSummary(completed.data)],
      complete: true,
      inquiry: {
        ...completed.data,
        fastTrack: true
      }
    };
  }

  const upcoming = nextStep(step);
  if (!upcoming) {
    const completed = {
      ...updated,
      step: "complete",
      completedAt: new Date().toISOString()
    };

    return {
      session: completed,
      replies: [buildSummary(completed.data)],
      complete: true,
      inquiry: completed.data
    };
  }

  return {
    session: {
      ...updated,
      step: upcoming,
      attachmentPromptedStep: ""
    },
    replies: [prompts[upcoming]],
    complete: false
  };
}

export function handleCustomerAttachment(session, attachmentType, attachmentLink, profileName = "") {
  const activeSession = session || startConversation(profileName).session;
  const key = attachmentType === "video" ? "videoLinks" : "imageLinks";
  const updated = {
    ...activeSession,
    profileName: activeSession.profileName || profileName,
    data: {
      ...activeSession.data,
      [key]: mergeUnique(activeSession.data?.[key], [attachmentLink])
    }
  };

  if (updated.step === "complete") {
    return {
      session: updated,
      replies: [],
      complete: false
    };
  }

  if (updated.attachmentPromptedStep === updated.step) {
    return {
      session: updated,
      replies: [],
      complete: false
    };
  }

  return {
    session: {
      ...updated,
      attachmentPromptedStep: updated.step
    },
    replies: [buildAttachmentReply(updated.step, attachmentType)],
    complete: false
  };
}

export function handleCustomerImage(session, imageLink, profileName = "") {
  return handleCustomerAttachment(session, "image", imageLink, profileName);
}

export function handleCustomerVideo(session, videoLink, profileName = "") {
  return handleCustomerAttachment(session, "video", videoLink, profileName);
}

export function formatInquiryForLog(inquiry) {
  return [
    ...steps.map((step) => `${labels[step]}：${inquiry[step] || ""}`),
    inquiry.imageLinks?.length ? `图片链接：${inquiry.imageLinks.join(" , ")}` : "",
    inquiry.videoLinks?.length ? `视频链接：${inquiry.videoLinks.join(" , ")}` : "",
    inquiry.customerLinks?.length ? `客户链接：${inquiry.customerLinks.join(" , ")}` : ""
  ].filter(Boolean).join("\n");
}
