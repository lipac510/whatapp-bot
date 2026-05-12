// Updated with auto-subscription
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// =====================
// 配置信息
// =====================
const VERIFY_TOKEN = 'lipack520bot';
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// =====================
// 对话状态存储（内存）
// =====================
const sessions = {};

// 对话步骤定义
const STEPS = {
  START: 'start',
  PRODUCT: 'product',
  QUANTITY: 'quantity',
  ADDRESS: 'address',
  EMAIL: 'email',
  DONE: 'done',
};

// =====================
// Webhook 验证（Meta 要求）
// =====================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// =====================
// 接收消息
// =====================
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message || message.type !== 'text') return;

    const from = message.from;
    const text = message.text.body.trim();
    await handleMessage(from, text);
  } catch (err) {
    console.error('Error:', err.message);
  }
});

// =====================
// 消息处理逻辑
// =====================
async function handleMessage(from, text) {
  if (!sessions[from]) {
    sessions[from] = { step: STEPS.START, data: {} };
  }
  const session = sessions[from];

  switch (session.step) {
    case STEPS.START:
      await sendMessage(from,
        `您好！感谢联系我们 🙏\n\n我是 520Lipack 的采购助手，将帮您快速完成询价登记。\n\n*第一步：请问您需要采购什么产品？*`
      );
      session.step = STEPS.PRODUCT;
      break;

    case STEPS.PRODUCT:
      session.data.product = text;
      await sendMessage(from,
        `✅ 产品：${text}\n\n*第二步：请问需要采购多少数量？*（请注明单位，如：500个、1吨等）`
      );
      session.step = STEPS.QUANTITY;
      break;

    case STEPS.QUANTITY:
      session.data.quantity = text;
      await sendMessage(from,
        `✅ 数量：${text}\n\n*第三步：请提供发货地址*（请务必注明国家名称）`
      );
      session.step = STEPS.ADDRESS;
      break;

    case STEPS.ADDRESS:
      session.data.address = text;
      await sendMessage(from,
        `✅ 地址：${text}\n\n*第四步：请提供您的 Email 地址*（我们将发送正式报价单）`
      );
      session.step = STEPS.EMAIL;
      break;

    case STEPS.EMAIL:
      session.data.email = text;
      const { product, quantity, address, email } = session.data;
      await sendMessage(from,
        `🎉 *信息登记完成！以下是您的询价信息：*\n\n` +
        `📦 采购产品：${product}\n` +
        `🔢 采购数量：${quantity}\n` +
        `📍 发货地址：${address}\n` +
        `📧 Email：${email}\n\n` +
        `我们的销售团队将在 *24小时内* 通过 Email 发送正式报价单。\n如有任何问题，请随时联系我们！`
      );
      session.step = STEPS.DONE;
      console.log(`\n========== 新询价信息 ==========`);
      console.log(`客户号码: ${from}`);
      console.log(`产品: ${product}`);
      console.log(`数量: ${quantity}`);
      console.log(`地址: ${address}`);
      console.log(`Email: ${email}`);
      console.log(`================================\n`);
      break;

    case STEPS.DONE:
      await sendMessage(from,
        `您的询价已登记完成 ✅\n我们将尽快与您联系！\n\n如需重新询价，请发送"*重新开始*"`
      );
      if (text === '重新开始') {
        delete sessions[from];
        await handleMessage(from, '');
      }
      break;
  }
}

// =====================
// 发送消息函数
// =====================
async function sendMessage(to, body) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// =====================
// 健康检查
// =====================
app.get('/', (req, res) => res.send('520Lipack WhatsApp Bot is running! 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
