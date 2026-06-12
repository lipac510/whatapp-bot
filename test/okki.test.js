import test from "node:test";
import assert from "node:assert/strict";
import { buildOkkiCompanyPayload } from "../src/okki.js";

test("builds OKKI customer payload from inquiry", () => {
  const payload = buildOkkiCompanyPayload({
    customerId: "8618014856231",
    profileName: "Buyer",
    product: "Paper cup",
    quantity: "5000",
    address: "Dubai, UAE",
    email: "buyer@example.com",
    customerLinks: ["https://example.com/product"],
    imageLinks: ["https://example.com/media/image"],
    videoLinks: ["https://example.com/media/video"]
  });

  assert.equal(payload.company_id, 0);
  assert.equal(payload.name, "8618014856231");
  assert.equal(payload.country, "AE");
  assert.equal(payload.address, "Dubai, UAE");
  assert.equal(payload.tel_area_code, "86");
  assert.equal(payload.tel, "18014856231");
  assert.equal(payload.customers[0].name, "Buyer");
  assert.equal(payload.customers[0].email, "buyer@example.com");
  assert.equal(payload.customers[0].tel_area_code, "86");
  assert.equal(payload.customers[0].tel, "18014856231");
  assert.equal(payload.customers[0].whatsapp, "8618014856231");
  assert.equal(payload.customers[0].main_customer_flag, 1);
  assert.match(payload.remark, /询盘产品：Paper cup/);
  assert.match(payload.remark, /采购数量：5000/);
  assert.match(payload.remark, /客户链接：https:\/\/example.com\/product/);
  assert.match(payload.remark, /图片链接：https:\/\/example.com\/media\/image/);
  assert.match(payload.remark, /视频链接：https:\/\/example.com\/media\/video/);
});

test("uses WhatsApp number as fallback contact name", () => {
  const payload = buildOkkiCompanyPayload({
    customerId: "8618014856231",
    product: "Paper cup",
    quantity: "5000",
    address: "Dubai, UAE",
    email: ""
  });

  assert.equal(payload.customers[0].name, "8618014856231");
});

test("keeps email and WhatsApp out of inquiry summary remark", () => {
  const payload = buildOkkiCompanyPayload({
    customerId: "8618014856231",
    profileName: "Buyer",
    product: "Paper cup",
    quantity: "5000",
    address: "Dubai, UAE",
    email: "buyer@example.com"
  });

  assert.match(payload.remark, /询盘产品：Paper cup/);
  assert.match(payload.remark, /采购数量：5000/);
  assert.match(payload.remark, /发货地址：Dubai, UAE/);
  assert.doesNotMatch(payload.remark, /buyer@example.com/);
  assert.doesNotMatch(payload.remark, /8618014856231/);
});

test("builds OKKI payload for official notices without duplicate phone fields", () => {
  const payload = buildOkkiCompanyPayload({
    customerId: "8618014856231",
    profileName: "Meta",
    officialNotice: true,
    companyName: "Official notice - 8618014856231 - 2026-06-12T00-00-00-000Z",
    product: "Official message",
    quantity: "",
    summaryOverride: "Official message / verification code:\nYour code is 123456"
  });

  assert.equal(payload.name, "Official notice - 8618014856231 - 2026-06-12T00-00-00-000Z");
  assert.equal(payload.remark, "Official message / verification code:\nYour code is 123456");
  assert.equal(payload.tel, undefined);
  assert.equal(payload.customers[0].tel, undefined);
  assert.equal(payload.customers[0].whatsapp, undefined);
});
