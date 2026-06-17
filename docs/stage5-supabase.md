# Stage 5: Supabase 持久化后台数据

目标：让 `/admin` 后台、消息记录、失败记录、OKKI 同步结果长期保存，不再因为 Render 重启而丢失。

## 需要准备

1. 一个 Supabase 免费项目
2. `SUPABASE_URL`
3. `SUPABASE_SERVICE_ROLE_KEY`

## 建表

在 Supabase 控制台打开 SQL Editor，执行：

- [docs/supabase-schema.sql](/Users/lipack/Documents/WA%20bot/docs/supabase-schema.sql:1)

## Render 环境变量

在 Render 服务 `wa-customer-info-bot` 的 Environment 中新增：

```env
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 service_role key
```

然后点：

```text
Save, rebuild, and deploy
```

## 生效方式

- 配好 Supabase 后，机器人新产生的数据会直接写进 Supabase
- 旧的 `/tmp/wa-bot-data` 不会自动迁移
- 如果没配 Supabase，项目仍然会自动回退到本地 JSON 文件模式

## 当前会写入 Supabase 的数据

- 客户会话进度
- 完整消息流水
- 询盘记录
- OKKI 同步记录
- 失败记录
- 已知客户标记
- Emma 联系方式发送标记
- 人工跟进等待窗口

## 注意

- `SUPABASE_SERVICE_ROLE_KEY` 权限很高，不要发给任何人
- 这个 key 只放在 Render 环境变量里，不要写进代码仓库
