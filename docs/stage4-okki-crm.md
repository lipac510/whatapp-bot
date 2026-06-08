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
- `origin_list`：客户来源。客户来源“社媒”的 ID 暂时未知，先通过 `OKKI_ORIGIN_ID` 配置，可留空。
- `remark`：写入公司备注，包含产品、数量、地址、国家、Email、WhatsApp、图片链接、询盘简述。

联系人字段：

- `name`：WhatsApp 昵称，可空。
- `email`：客户 Email，可空。
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
OKKI_SCOPE=company
OKKI_ORIGIN_ID=社媒来源ID，可先留空
OKKI_OWNER_USER_ID=跟进人ID，可先留空
```

不要把 `OKKI_CLIENT_SECRET` 发到聊天或提交到 GitHub。

## 当前限制

- 客户来源“社媒”的 ID 暂时未知；留空时不会写入来源。
- 图片处理还没有完成。后续需要先下载 WhatsApp 图片，再上传到可访问位置，然后把图片链接写入 `remark`。
- 当前 Email 仍沿用 WhatsApp 机器人已有流程收集。后续可改为允许客户回复“跳过”。
