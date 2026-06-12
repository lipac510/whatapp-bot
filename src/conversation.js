import {
  isHighValueQuantity,
  normalizeProductAnswer
} from "./rules.js";

const steps = ["product", "quantity", "address"];
const minimumFastTrackQuantity = 5000;

const prompts = {
  product: [
    "Thanks for reaching out to Lipack.",
    "",
    "We are a 20-year paper box & paper bag factory, exporting to 150+ countries and serving 5,000+ brands.",
    "FSC & SGS certified. Supplier to Disney for 15+ years.",
    "",
    "What type of packaging are you looking for?",
    "1. Corrugated Box, rough range: $0.5-$1.5/pc",
    "2. Luxury Rigid Box, rough range: $1.5-$3/pc",
    "3. Paper Bag, rough range: $0.1-$0.6/pc",
    "4. Other",
    "",
    "Please reply with a number, or send product photos/videos/links."
  ].join("\n"),
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
    "Thank you. We have received your inquiry and will prepare a quotation as soon as possible.",
    "",
    "Inquiry details:",
    `Product: ${data.product}`,
    `Quantity: ${data.quantity}`,
    `Shipping address: ${data.address}`,
    imageCount ? `Photos received: ${imageCount}` : "",
    videoCount ? `Videos received: ${videoCount}` : "",
    linkCount ? `Links received: ${linkCount}` : ""
  ].filter((line) => line !== "").join("\n");
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
    replies: [prompts.product],
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
      replies: [
        "We have already received your inquiry. To submit a new one, please reply \"restart\"."
      ],
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
      [step]: step === "product" ? normalizeProductAnswer(text) : text
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
      step: upcoming
    },
    replies: [prompts[upcoming]],
    complete: false
  };
}

export function handleCustomerAttachment(session, attachmentType, attachmentLink, profileName = "") {
  const activeSession = session || startConversation(profileName).session;
  const key = attachmentType === "video" ? "videoLinks" : "imageLinks";
  const label = attachmentType === "video" ? "video" : "photo";
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
      replies: [`Your ${label} has been received. If this is a new inquiry, please reply "restart" first.`],
      complete: false
    };
  }

  return {
    session: updated,
    replies: [`Your ${label} has been received. You can continue sending attachments.\n\n${prompts[updated.step]}`],
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
