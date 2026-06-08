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
    email: "buyer@example.com"
  });

  assert.equal(payload.company_id, 0);
  assert.equal(payload.name, "8618014856231");
  assert.equal(payload.country, "AE");
  assert.equal(payload.address, "Dubai, UAE");
  assert.equal(payload.customers[0].name, "Buyer");
  assert.equal(payload.customers[0].email, "buyer@example.com");
  assert.equal(payload.customers[0].tel_area_code, "86");
  assert.equal(payload.customers[0].tel, "18014856231");
  assert.equal(payload.customers[0].whatsapp, "8618014856231");
  assert.equal(payload.customers[0].main_customer_flag, 1);
  assert.match(payload.remark, /询盘产品：Paper cup/);
  assert.match(payload.remark, /采购数量：5000/);
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
