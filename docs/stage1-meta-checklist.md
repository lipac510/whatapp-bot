# 第一阶段：Meta WhatsApp API 配置清单

## 0. 重要安全动作

之前分享页中出现过 Access Token。请把它视为已经泄露。

必须完成：

- 在 Meta 后台撤销旧 Token，或删除旧 System User Token。
- 重新生成一个新的永久 Token。
- 新 Token 只保存在 `.env` 或密码管理器里。
- 不要再把 Token 发到聊天、截图或公开链接里。

## 1. 确认真实号码状态

在 Meta for Developers 或 WhatsApp Manager 中确认：

- App 名称：`520Lipack` 或你当前正式使用的 App
- Business Portfolio：`Lipack Packaging.SA` 或你实际要使用的企业
- 真实号码状态：`Registered`
- 真实号码：`+86 177 1290 2437`
- Phone Number ID：使用真实号码对应的 ID，不再使用测试号码 ID
- WhatsApp Business Account ID：使用真实号码所在 WABA 的 ID

注意：测试号码 ID 和真实号码 ID 不是同一个。后续机器人必须使用真实号码的 Phone Number ID。

## 2. 生成正式永久 Token

推荐使用 System User Token：

1. 进入 Meta Business Settings。
2. 找到 `Users` -> `System Users`。
3. 新建或选择一个 System User。
4. 给它分配 WhatsApp 账号权限。
5. 生成 Token 时选择对应 App。
6. 勾选 WhatsApp 需要的权限，例如：
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
7. 复制 Token，保存到 `.env` 的 `WHATSAPP_ACCESS_TOKEN`。

不要使用测试页面生成的临时用户 Token 做正式机器人。

## 3. 付款方式策略

你当前遇到的问题是中国大陆信用卡无法绑定。第一阶段可以暂时跳过付款方式。

暂时跳过的影响：

- 客户主动发消息给你后，机器人可以在客户服务窗口内回复。
- 你不能稳定地向未先联系你的客户主动发第一条消息。
- 不能依赖营销/通知模板做主动触达。

当前项目目标是“客户主动询盘后自动收集资料”，所以可以先不处理付款方式。

## 4. Webhook 准备

后续机器人需要一个 HTTPS Webhook 地址。Meta 会要求填写：

- Callback URL：后续部署后获得，例如 `https://your-domain.com/webhook`
- Verify Token：我们自己设置，填入 `.env` 的 `WEBHOOK_VERIFY_TOKEN`
- 订阅字段：至少订阅 `messages`

Webhook 会用于接收：

- 客户发来的文字消息
- 消息状态
- 可能的错误回调

## 5. 第一阶段完成标准

满足以下条件后，可以进入第二阶段开发机器人：

- 旧 Token 已撤销或弃用。状态：已完成。
- 新永久 Token 已生成并安全保存。状态：已完成。
- 真实号码状态是 `Registered` 或 `Connected`。状态：已完成。
- 已确认真实号码的 Phone Number ID。状态：已完成，`1157609587429611`。
- 已确认 WABA ID。状态：已完成，`1698230251593984`。
- 已决定暂时跳过付款方式，先做客户主动询盘自动回复。状态：建议跳过。
- `.env` 已准备好，但没有把真实 Token 写进公开文档。状态：已完成。

## 6. 你需要发给我的信息

可以发这些，不要发 Token：

- App 名称
- 真实号码 Phone Number ID
- WhatsApp Business Account ID
- 真实号码是否显示 Registered
- 付款方式是否先跳过

不要发：

- Access Token
- Meta App Secret
- 任何包含 Token 的截图
