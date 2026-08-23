# Knowledge Base MVP

这个文件夹用于存放机器人可查询的产品资料、FAQ、图片和 catalog。

当前阶段先做 MVP：资料先用 `.md` 和静态文件整理好，后续再接入机器人检索逻辑。

## 目录结构

```text
knowledge/
  index.json
  products/
  faq/
  assets/
    catalogs/
    documents/
    images/
      paper-bags/
      rigid-boxes/
      process/
    videos/
```

## 怎么放资料

- 产品说明放到 `products/`
- 常见问题放到 `faq/`
- Catalog、PDF 放到 `assets/catalogs/`
- Word 源文件和内部参考文档放到 `assets/documents/`
- 产品图片、案例图放到 `assets/images/`
- 产品视频放到 `assets/videos/`

## 当前已整理资料

### Catalog

- `assets/catalogs/rigid-box-catalog.pdf`

### Source documents

- `assets/documents/faq-source.docx`

### Images

- `assets/images/paper-bags/`
- `assets/images/rigid-boxes/`
- `assets/images/process/`

### Videos

- `assets/videos/product-video-01.mp4`
- `assets/videos/product-video-02.mp4`

### FAQ entries

- MOQ
- Delivery Time
- Custom Logo
- Catalog
- Samples
- Order Process
- Company Contact

## 写资料的规则

每个 `.md` 文件尽量包含这些部分：

- `Customer questions`: 客户可能会怎么问
- `Short answer`: 机器人可以直接发给客户的简短回答
- `Details`: 给机器人参考的补充信息
- `Assets`: 可以附带发送的图片、PDF、catalog 文件
- `Return prompt`: 回答完后，机器人应该回到哪个收集问题

## 机器人回答原则

1. 如果客户是在回答当前流程问题，优先继续收集信息。
2. 如果客户是在问资料库问题，先回答问题。
3. 回答完之后，继续回到当前收集步骤。
4. 资料库没有写清楚的内容，不要编造，交给 Emma 人工跟进。
