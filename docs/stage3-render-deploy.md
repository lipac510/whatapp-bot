# 第三阶段：部署到 Render

## 为什么部署到 Render

Mac-mini 当前无法连接 `graph.facebook.com`，所以本地机器人能收到 WhatsApp Webhook，但不能稳定发消息。Render 的海外 Web Service 可以直接访问 Meta Graph API，并提供固定 HTTPS 地址。

## 当前部署方式

先部署最小可用版本：

- Webhook URL 固定为 Render 的 HTTPS 地址。
- 使用 Render 环境变量保存 Token。
- 客户询盘暂时保存到服务本地文件。

注意：Render 默认文件系统是临时的，服务重启或重新部署后，本地 JSON 可能丢失。正式长期使用时，建议下一步接 Google Sheet、Postgres 或 Render Persistent Disk。

## Render 设置

创建 Web Service 时选择：

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

环境变量：

```text
HOST=0.0.0.0
GRAPH_API_VERSION=v25.0
BUSINESS_NAME=Lipack Packaging
TIMEZONE=America/Los_Angeles
WHATSAPP_ACCESS_TOKEN=你的新永久Token
WHATSAPP_PHONE_NUMBER_ID=1157609587429611
WHATSAPP_BUSINESS_ACCOUNT_ID=1698230251593984
WEBHOOK_VERIFY_TOKEN=你的Webhook验证Token
META_APP_SECRET=可先留空
```

不要把真实 Token 写进 GitHub 仓库。

如果填写 `META_APP_SECRET`，机器人会校验 Meta Webhook 签名，防止伪造请求。当前也可以先留空，等部署跑通后再开启。

## 部署成功后

假设 Render 地址是：

```text
https://wa-customer-info-bot.onrender.com
```

健康检查：

```text
https://wa-customer-info-bot.onrender.com/health
```

失败记录：

```text
https://wa-customer-info-bot.onrender.com/failures
```

Meta Callback URL：

```text
https://wa-customer-info-bot.onrender.com/webhook
```

Verify Token：

```text
.env 里的 WEBHOOK_VERIFY_TOKEN
```

Webhook fields 至少订阅：

```text
messages
```
