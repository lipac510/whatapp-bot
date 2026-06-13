import test from "node:test";
import assert from "node:assert/strict";
import {
  handleCustomerImage,
  handleCustomerMessage,
  handleCustomerVideo,
  startConversation
} from "../src/conversation.js";

test("collects product, quantity, and address", () => {
  let result = startConversation("Alice");
  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);

  result = handleCustomerMessage(result.session, "1", "Alice");
  assert.equal(result.session.step, "quantity");

  result = handleCustomerMessage(result.session, "5000", "Alice");
  assert.equal(result.session.step, "complete");
  assert.equal(result.complete, true);
  assert.deepEqual(result.inquiry, {
    imageLinks: [],
    videoLinks: [],
    customerLinks: [],
    product: "Corrugated Box",
    quantity: "5000",
    fastTrack: true
  });
  assert.match(result.replies[0], /Inquiry details:/);
  assert.match(result.replies[0], /Product: Corrugated Box/);
  assert.match(result.replies[0], /within the same business day/);
});

test("answers bot questions without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "Are you a bot?", "Alice");

  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /automated assistant/);
  assert.match(result.replies[0], /What type of packaging/);
});

test("answers catalog questions and keeps collecting product", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "catalog please", "Alice");

  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /www\.cnlipack\.com/);
  assert.match(result.replies[0], /What type of packaging/);
});

test("answers location and MOQ questions without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "where are you?", "Alice");

  assert.equal(result.session.step, "product");
  assert.match(result.replies[0], /Changjian Road/);

  result = handleCustomerMessage(result.session, "can I order sample?", "Alice");
  assert.equal(result.session.step, "product");
  assert.match(result.replies[0], /MOQ is 500 pcs/);
});

test("rejects empty answers without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "   ", "Alice");

  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /product/);
});

test("rejects low-information product answers", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "hi", "Alice");

  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /reply with 1, 2, 3, or 4/);
});

test("saves product links but keeps asking for product", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "https://example.com/product", "Alice");

  assert.equal(result.session.step, "product");
  assert.deepEqual(result.session.data.customerLinks, ["https://example.com/product"]);
  assert.match(result.replies[0], /reply with 1, 2, 3, or 4/);
});

test("can restart a conversation", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "Box", "Alice");
  result = handleCustomerMessage(result.session, "重新开始", "Alice");

  assert.equal(result.session.step, "product");
  assert.deepEqual(result.session.data, {
    imageLinks: [],
    videoLinks: [],
    customerLinks: []
  });
});

test("collects image links without advancing the conversation", () => {
  let result = startConversation("Alice");
  result = handleCustomerImage(result.session, "https://example.com/media/abc", "Alice");

  assert.equal(result.session.step, "product");
  assert.deepEqual(result.session.data.imageLinks, ["https://example.com/media/abc"]);

  result = handleCustomerMessage(result.session, "Paper bag", "Alice");
  result = handleCustomerMessage(result.session, "5000 pcs", "Alice");

  assert.equal(result.complete, true);
  assert.deepEqual(result.inquiry.imageLinks, ["https://example.com/media/abc"]);
  assert.match(result.replies[0], /Photos received: 1/);
});

test("collects customer links and video links", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(
    result.session,
    "Paper bag https://example.com/product",
    "Alice"
  );
  result = handleCustomerVideo(result.session, "https://example.com/media/video", "Alice");
  result = handleCustomerMessage(result.session, "5000 pcs", "Alice");

  assert.equal(result.complete, true);
  assert.deepEqual(result.inquiry.customerLinks, ["https://example.com/product"]);
  assert.deepEqual(result.inquiry.videoLinks, ["https://example.com/media/video"]);
  assert.match(result.replies[0], /Videos received: 1/);
  assert.match(result.replies[0], /Links received: 1/);
});
