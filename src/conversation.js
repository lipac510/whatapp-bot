import {
  getCountryFlag,
  getCountryName,
  inferCountryFromPhone
} from "./country.js";
import {
  isHighValueQuantity,
  isMeaningfulAddressAnswer,
  isValidQuantityAnswer,
  isValidWhatsAppAnswer,
  normalizeQuantityAnswer,
  normalizeProductAnswer,
  normalizeWhatsAppAnswer
} from "./rules.js";

// WhatsApp already knows the customer's number, so it confirms the country from the
// phone prefix. Instagram has no phone, so it skips country_confirm and instead collects
// the WhatsApp number as the final step (needed for OKKI identity + sales follow-up).
const stepsByChannel = {
  whatsapp: ["product", "quantity", "country_confirm", "address"],
  instagram: ["product", "quantity", "address", "whatsapp"]
};

function stepsForChannel(channel) {
  return stepsByChannel[channel] || stepsByChannel.whatsapp;
}

function channelOf(session) {
  return (session && session.channel) || "whatsapp";
}

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
  address: "Which country should we ship to?\nIf possible, please share the full delivery address so we can estimate shipping more accurately.",
  whatsapp: "Almost done! 📲 What's the best WhatsApp number for our specialist to send you the catalog & quote?\nPlease include your country code, e.g. +1, +49."
};

const labels = {
  product: "采购产品",
  quantity: "采购数量",
  country_confirm: "国家确认",
  address: "发货地址",
  whatsapp: "WhatsApp"
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

function isYesAnswer(text) {
  return /^(yes|y|yeah|yep|correct|right|ok|okay|sure|是|对|没错)$/i.test(normalizeText(text));
}

function isNoAnswer(text) {
  return /^(no|n|nope|not|another|不是|不对|不是这个)$/i.test(normalizeText(text));
}

function buildCountryConfirmationPrompt(countryCode) {
  const countryName = getCountryName(countryCode) || countryCode;
  const flag = getCountryFlag(countryCode);
  return [
    `I see your WhatsApp number looks like ${countryName}${flag ? ` ${flag}` : ""}.`,
    `Should we ship to ${countryName}?`,
    "",
    `✅ Yes, ${countryName}`,
    "↔️ No, another country (please tell me which)"
  ].join("\n");
}

function currentPromptForStep(session, step) {
  if (step === "country_confirm") {
    return buildCountryConfirmationPrompt(session.inferredCountry);
  }
  return prompts[step] || productQuestion;
}

function validationMessage(step, text) {
  if (text) return "";
  if (step === "product") return "Please tell us the product you are looking for.";
  if (step === "quantity") return "Please tell us the quantity you need.";
  if (step === "address") return "Please share your destination country or shipping address.";
  if (step === "whatsapp") return "Please share your WhatsApp number with country code.";
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
  if (step === "country_confirm") {
    if (isYesAnswer(text) || isNoAnswer(text) || isMeaningfulAddressAnswer(text)) return "";
    return "Please reply Yes, or tell us the correct destination country.";
  }
  if (step === "address" && !isMeaningfulAddressAnswer(text)) {
    return "Please share your country or shipping address, for example: Canada or Dubai, UAE.";
  }
  if (step === "whatsapp" && !isValidWhatsAppAnswer(text)) {
    return "Please share a valid WhatsApp number with country code, for example: +1 7185551234.";
  }
  return "";
}

function nextStep(currentStep, channel) {
  const channelSteps = stepsForChannel(channel);
  const index = channelSteps.indexOf(currentStep);
  return channelSteps[index + 1] || null;
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

function buildAttachmentReply(session, step, attachmentType) {
  const label = attachmentType === "video" ? "video" : "photo";
  return `Your ${label} has been received. You can continue sending attachments.\n\n${currentPromptForStep(session, step)}`;
}

export function startConversation(profileName = "", customerId = "", channel = "whatsapp") {
  return {
    session: {
      step: "product",
      channel,
      profileName,
      customerId,
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

function buildNextAddressStep(session, profileName, customerId) {
  const inferredCountry = inferCountryFromPhone(customerId || session.customerId || "");
  if (inferredCountry) {
    return {
      ...session,
      profileName: session.profileName || profileName,
      customerId: session.customerId || customerId,
      step: "country_confirm",
      attachmentPromptedStep: "",
      inferredCountry
    };
  }

  return {
    ...session,
    profileName: session.profileName || profileName,
    customerId: session.customerId || customerId,
    step: "address",
    attachmentPromptedStep: "",
    inferredCountry: ""
  };
}

export function handleCustomerMessage(session, messageText, profileName = "", customerId = "", channelName = "whatsapp") {
  const text = normalizeText(messageText);
  const channel = channelOf(session) || channelName;

  if (!session || isRestart(text)) {
    return startConversation(profileName, customerId, (session && session.channel) || channelName);
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
        `I am Lipack's automated assistant, here to collect your inquiry details quickly. Our sales team will review your request and follow up with you soon.\n\n${currentPromptForStep(session, step)}`
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
      replies: [`${websiteReply}\n\n${currentPromptForStep(session, step)}`],
      complete: false
    };
  }

  if (isLocationQuestion(text)) {
    return {
      session,
      replies: [`${companyAddress}\n\n${currentPromptForStep(session, step)}`],
      complete: false
    };
  }

  if (isSampleQuestion(text)) {
    return {
      session,
      replies: [`${moqReply}\n\n${currentPromptForStep(session, step)}`],
      complete: false
    };
  }

  if (isCustomQuestion(text)) {
    return {
      session,
      replies: [`${customReply}\n\n${currentPromptForStep(session, step)}`],
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

  if (step === "country_confirm") {
    if (isYesAnswer(text)) {
      const countryName = getCountryName(session.inferredCountry) || "";
      const completed = {
        ...session,
        profileName: session.profileName || profileName,
        customerId: session.customerId || customerId,
        step: "complete",
        completedAt: new Date().toISOString(),
        data: {
          ...session.data,
          customerLinks,
          address: countryName
        }
      };

      return {
        session: completed,
        replies: [buildSummary(completed.data)],
        complete: true,
        inquiry: completed.data
      };
    }

    if (isNoAnswer(text)) {
      return {
        session: {
          ...session,
          profileName: session.profileName || profileName,
          customerId: session.customerId || customerId,
          step: "address",
          attachmentPromptedStep: "",
          data: {
            ...session.data,
            customerLinks
          }
        },
        replies: [prompts.address],
        complete: false
      };
    }

    const completed = {
      ...session,
      profileName: session.profileName || profileName,
      customerId: session.customerId || customerId,
      step: "complete",
      completedAt: new Date().toISOString(),
      data: {
        ...session.data,
        customerLinks,
        address: text
      }
    };

    return {
      session: completed,
      replies: [buildSummary(completed.data)],
      complete: true,
      inquiry: completed.data
    };
  }

  const stepValue =
    step === "product"
      ? normalizeProductAnswer(text)
      : step === "quantity"
        ? normalizeQuantityAnswer(text)
        : step === "whatsapp"
          ? normalizeWhatsAppAnswer(text)
          : text;

  const highValue = step === "quantity" && isHighValueQuantity(text, minimumFastTrackQuantity);

  const updated = {
    ...session,
    profileName: session.profileName || profileName,
    customerId: session.customerId || customerId,
    ...(highValue ? { fastTrack: true } : {}),
    data: {
      ...session.data,
      customerLinks,
      [step]: stepValue
    }
  };

  // WhatsApp already has the contact number, so a high-value order can be recorded right
  // away. Instagram still needs the address + WhatsApp number, so it keeps collecting and
  // only carries the fastTrack flag forward to relax later validation.
  if (highValue && channel === "whatsapp") {
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

  const upcoming = nextStep(step, channel);
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
      inquiry: completed.fastTrack ? { ...completed.data, fastTrack: true } : completed.data
    };
  }

  if (upcoming === "country_confirm") {
    const nextSession = buildNextAddressStep(updated, profileName, customerId);
    return {
      session: nextSession,
      replies: [nextSession.step === "country_confirm" ? buildCountryConfirmationPrompt(nextSession.inferredCountry) : prompts.address],
      complete: false
    };
  }

  return {
    session: {
      ...updated,
      step: upcoming,
      attachmentPromptedStep: "",
      attachmentPromptedAt: ""
    },
    replies: [prompts[upcoming]],
    complete: false
  };
}

export function handleCustomerAttachment(session, attachmentType, attachmentLink, profileName = "", customerId = "", channelName = "whatsapp") {
  const activeSession = session || startConversation(profileName, customerId, channelName).session;
  const key = attachmentType === "video" ? "videoLinks" : "imageLinks";
  const updated = {
    ...activeSession,
    profileName: activeSession.profileName || profileName,
    customerId: activeSession.customerId || customerId,
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
      attachmentPromptedStep: updated.step,
      attachmentPromptedAt: new Date().toISOString()
    },
    replies: [buildAttachmentReply(updated, updated.step, attachmentType)],
    complete: false
  };
}

export function handleCustomerImage(session, imageLink, profileName = "", customerId = "", channelName = "whatsapp") {
  return handleCustomerAttachment(session, "image", imageLink, profileName, customerId, channelName);
}

export function handleCustomerVideo(session, videoLink, profileName = "", customerId = "", channelName = "whatsapp") {
  return handleCustomerAttachment(session, "video", videoLink, profileName, customerId, channelName);
}

export function formatInquiryForLog(inquiry) {
  return [
    ...Object.keys(labels).map((step) => `${labels[step]}：${inquiry[step] || ""}`),
    inquiry.imageLinks?.length ? `图片链接：${inquiry.imageLinks.join(" , ")}` : "",
    inquiry.videoLinks?.length ? `视频链接：${inquiry.videoLinks.join(" , ")}` : "",
    inquiry.customerLinks?.length ? `客户链接：${inquiry.customerLinks.join(" , ")}` : ""
  ].filter(Boolean).join("\n");
}
