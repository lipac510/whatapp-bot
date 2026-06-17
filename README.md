# WhatsApp 客户信息收集机器人

这个项目用于接入 Meta WhatsApp Cloud API，自动完成客户初步沟通，并收集 3 项核心询盘信息：

- 采购产品
- 采购数量
- 发货地址（包含国家）

## 当前建议路线

先使用“客户主动发消息”的方式运行机器人。这样不需要先解决付款方式问题，也能完成自动接待和信息收集。

如果后续需要主动给客户发起 WhatsApp 消息，再处理付款方式、消息模板和主动会话费用。

## 本地版机器人功能

- 接收 Meta WhatsApp Webhook。
- 自动向客户依次询问产品、数量、发货地址。
- 支持收集客户发来的图片、视频和网页链接。
- 收齐信息后保存到 `data/inquiries.json`。
- 未完成的客户对话进度保存到 `data/sessions.json`。
- 会记录已处理消息，避免 Meta 重复推送导致重复回复。
- 发送失败会保存到 `data/failures.json`，方便排查。

## 启动

确认 `.env` 已填好：

```env
WHATSAPP_ACCESS_TOKEN=你的新永久Token
WHATSAPP_PHONE_NUMBER_ID=1157609587429611
WHATSAPP_BUSINESS_ACCOUNT_ID=1698230251593984
WEBHOOK_VERIFY_TOKEN=本项目生成的验证值
```

启动服务：

```bash
npm start
```

启动后本地地址：

```text
http://localhost:3000
```

健康检查：

```text
GET /health
```

Webhook：

```text
GET /webhook
POST /webhook
```

查看已收集客户资料：

```text
GET /inquiries
```

查看最近处理失败记录：

```text
GET /failures
```

## 内部后台

部署后可以通过下面地址查看客户列表、聊天记录、OKKI 同步记录和失败原因：

```text
GET /admin
```

后台默认关闭。需要先在 Render 的 Environment 里增加：

```env
ADMIN_PASSWORD=你自己设置的后台密码
```

访问 `/admin` 时浏览器会弹出登录框：用户名可以随便填，密码填写 `ADMIN_PASSWORD`。

也可以用 JSON 方式查看完整会话数据：

```text
GET /conversations
```

注意：当前免费 Render 服务的数据默认写在临时目录，适合快速排查；如果要长期保存所有聊天记录，建议后续接 Supabase、数据库或 Google Sheet。

## Supabase 持久化

如果已经配置下面两个环境变量，机器人会优先把后台数据写入 Supabase，不再依赖 Render 的临时目录：

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

未配置时，项目会自动回退到本地 JSON 文件模式。

建表 SQL 和接入步骤见：

- [Supabase 接入说明](</Users/lipack/Documents/WA bot/docs/stage5-supabase.md:1>)
- [Supabase 建表 SQL](</Users/lipack/Documents/WA bot/docs/supabase-schema.sql:1>)

## Meta Webhook 设置

本地服务不能直接被 Meta 访问。后续需要部署到服务器，得到一个 HTTPS 地址。

Meta 后台填写：

```text
Callback URL: https://你的公网地址/webhook
Verify Token: .env 里的 WEBHOOK_VERIFY_TOKEN
Webhook field: messages
```
