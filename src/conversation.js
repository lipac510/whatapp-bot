const steps = ["product", "quantity", "address", "email"];

const prompts = {
  product: "您好，感谢联系 Lipack Packaging。请问您需要采购什么产品？",
  quantity: "好的。请问采购数量是多少？",
  address: "请提供完整发货地址，并包含国家名。",
  email: "请提供您的 Email，方便我们发送报价单。"
};

const labels = {
  product: "采购产品",
  quantity: "采购数量",
  address: "发货地址",
  email: "Email"
};

function normalizeText(text) {
  return String(text || "").trim();
}

function isRestart(text) {
  return /^(restart|reset|重新开始|重来|开始)$/i.test(normalizeText(text));
}

function looksLikeEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(text));
}

function nextStep(currentStep) {
  const index = steps.indexOf(currentStep);
  return steps[index + 1] || null;
}

function buildSummary(data) {
  return [
    "已收到，谢谢！我们会尽快为您报价。",
    "",
    "询盘信息：",
    `采购产品：${data.product}`,
    `采购数量：${data.quantity}`,
    `发货地址：${data.address}`,
    `Email：${data.email}`
  ].join("\n");
}

export function startConversation(profileName = "") {
  return {
    session: {
      step: "product",
      profileName,
      data: {},
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
        "我们已经收到您的询盘信息。若需要重新提交，请回复“重新开始”。"
      ],
      complete: false
    };
  }

  const step = session.step;

  if (step === "email" && !looksLikeEmail(text)) {
    return {
      session,
      replies: ["这个 Email 格式看起来不太对，请重新发送一个有效 Email。"],
      complete: false
    };
  }

  const updated = {
    ...session,
    profileName: session.profileName || profileName,
    data: {
      ...session.data,
      [step]: text
    }
  };

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

export function formatInquiryForLog(inquiry) {
  return steps.map((step) => `${labels[step]}：${inquiry[step] || ""}`).join("\n");
}
