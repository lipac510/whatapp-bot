# 第四阶段：同步 OKKI 客户

## 目标

客户在 WhatsApp 完成询盘信息收集后，机器人直接创建/更新 OKKI 客户，并写入联系人信息。

## OKKI 接口

使用客户（含联系人）新增/编辑接口：

```text
POST /v1/company/pushCompanyAndCustomers
```

鉴权：

```text
POST /v1/oauth2/access_token
```

## 字段规则

客户字段：

- `name`：如果客户提供公司名，用公司名；否则用 WhatsApp 号码。
- `short_name`：同 `name`。
- `country`：优先从发货地址识别；识别不到则从 WhatsApp 区号推断。
- `address`：写入客户提供的发货地址，可空。
- `origin_list`：客户来源。当前目标为 OKKI 里的 `TK`。
- `remark`：写入询盘摘要，包含产品、数量、地址、客户链接、图片链接、视频链接。
- `OKKI_INQUIRY_PRODUCT_FIELD_ID`：写入 OKKI 的“询盘产品”字段。
- `OKKI_PURCHASE_QUANTITY_FIELD_ID`：写入 OKKI 的“采购数量”字段。
- `OKKI_INQUIRY_SUMMARY_FIELD_ID`：写入 OKKI 的“核心痛点 询盘简述”字段。

联系人字段：

- `name`：WhatsApp 昵称，可空。
- `email`：不主动收集，保留为空。
- `tel_area_code`：从 WhatsApp 号码推断。
- `tel`：去掉国家区号后的号码。
- `whatsapp`：完整 WhatsApp 号码。
- `main_customer_flag`：固定为 `1`。
- `remark`：同询盘摘要。

## Render 环境变量

需要新增：

```text
OKKI_API_BASE=https://api-sandbox.xiaoman.cn
OKKI_CLIENT_ID=你的OKKI client_id
OKKI_CLIENT_SECRET=你的OKKI client_secret
OKKI_SCOPE=company user
OKKI_ORIGIN_ID=TK来源ID
OKKI_OWNER_USER_ID=跟进人ID
OKKI_INQUIRY_SUMMARY_FIELD_ID=核心痛点询盘简述字段ID
OKKI_PURCHASE_QUANTITY_FIELD_ID=采购数量字段ID
OKKI_INQUIRY_PRODUCT_FIELD_ID=询盘产品字段ID
```

不要把 `OKKI_CLIENT_SECRET` 发到聊天或提交到 GitHub。

## 当前限制

- 图片和视频目前使用 Render 代理链接。真实客户高频发送大文件后，建议改为 Cloudflare R2、S3 或 OSS 永久存储。
- 重复客户目前会被 OKKI 拒绝创建。后续需要改成“号码已存在时更新原客户”。
