# 第二阶段：本地版机器人

## 目标

先跑通最小可用版本：

- 客户主动发 WhatsApp 消息。
- 机器人自动收集 4 项信息。
- 信息保存到本地文件。

## 对话流程

1. 客户发第一条消息。
2. 机器人问：需要采购什么产品？
3. 客户回答后，机器人问：采购数量是多少？
4. 客户回答后，机器人问：发货地址是什么，包含国家名？
5. 客户回答后，机器人问：Email 是什么？
6. 收齐后，机器人发送汇总，并保存到 `data/inquiries.json`。

客户随时回复 `重新开始` 可以重置流程。

## 文件说明

- `src/server.js`：HTTP 服务和 Webhook 入口。
- `src/conversation.js`：客户信息收集流程。
- `src/whatsapp.js`：调用 WhatsApp Cloud API 发送消息。
- `src/storage.js`：本地保存会话和询盘。
- `data/sessions.json`：未完成会话。
- `data/inquiries.json`：已完成询盘。
- `data/processed-messages.json`：已处理消息，防止重复处理。
- `data/failures.json`：最近处理失败记录。

## 本地验证

运行：

```bash
npm test
npm start
```

检查：

```text
http://localhost:3000/health
```

## 后续要做

1. 使用 ngrok 暴露本地服务。
2. 在 Meta 后台配置 Webhook。
3. 用真实 WhatsApp 给企业号发消息测试。
4. 确认 `data/inquiries.json` 正常生成客户资料。
