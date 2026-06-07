import test from "node:test";
import assert from "node:assert/strict";
import {
  handleCustomerMessage,
  startConversation
} from "../src/conversation.js";

test("collects product, quantity, address, and email", () => {
  let result = startConversation("Alice");
  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);

  result = handleCustomerMessage(result.session, "Paper cup", "Alice");
  assert.equal(result.session.step, "quantity");

  result = handleCustomerMessage(result.session, "5000", "Alice");
  assert.equal(result.session.step, "address");

  result = handleCustomerMessage(result.session, "Dubai, UAE", "Alice");
  assert.equal(result.session.step, "email");

  result = handleCustomerMessage(result.session, "buyer@example.com", "Alice");
  assert.equal(result.session.step, "complete");
  assert.equal(result.complete, true);
  assert.deepEqual(result.inquiry, {
    product: "Paper cup",
    quantity: "5000",
    address: "Dubai, UAE",
    email: "buyer@example.com"
  });
});

test("rejects invalid email without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "Box", "Alice");
  result = handleCustomerMessage(result.session, "100", "Alice");
  result = handleCustomerMessage(result.session, "Riyadh, Saudi Arabia", "Alice");
  result = handleCustomerMessage(result.session, "not-email", "Alice");

  assert.equal(result.session.step, "email");
  assert.equal(result.complete, false);
});

test("can restart a conversation", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "Box", "Alice");
  result = handleCustomerMessage(result.session, "重新开始", "Alice");

  assert.equal(result.session.step, "product");
  assert.deepEqual(result.session.data, {});
});
