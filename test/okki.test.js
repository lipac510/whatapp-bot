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
  assert.match(payload.remark, /Paper cup/);
  assert.match(payload.remark, /5000/);
  assert.match(payload.remark, /Links:1/);
  assert.match(payload.remark, /Photos:1/);
  assert.match(payload.remark, /Videos:1/);
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

  assert.match(payload.remark, /Paper cup/);
  assert.match(payload.remark, /5000/);
  assert.match(payload.remark, /Dubai, UAE/);
  assert.doesNotMatch(payload.remark, /Product:/);
  assert.doesNotMatch(payload.remark, /Qty:/);
  assert.doesNotMatch(payload.remark, /Ship:/);
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

test("limits OKKI inquiry summary field to 255 characters", () => {
  const payload = buildOkkiCompanyPayload({
    customerId: "22231619826",
    profileName: "M",
    product: "Corrugated Box",
    quantity: "120000",
    address: "Mauritania nouakchott africa west coast industrial zone warehouse building 9 section A",
    customerLinks: [
      "https://example.com/very/long/link/1",
      "https://example.com/very/long/link/2"
    ],
    imageLinks: [
      "https://wa-customer-info-bot.onrender.com/media/1330875441809267",
      "https://wa-customer-info-bot.onrender.com/media/1330875441809268"
    ],
    videoLinks: ["https://wa-customer-info-bot.onrender.com/media/1550000000000001"]
  });

  assert.ok(payload.remark.length <= 255);
  assert.match(payload.remark, /Corrugated Box/);
  assert.match(payload.remark, /120000/);
  assert.match(payload.remark, /Photos:2/);
  assert.match(payload.remark, /Videos:1/);
  assert.doesNotMatch(payload.remark, /Product:/);
});
