import test from "node:test";
import assert from "node:assert/strict";
import {
  handleCustomerImage,
  handleCustomerMessage,
  handleCustomerVideo,
  handoffReminderMessage,
  startConversation
} from "../src/conversation.js";

test("collects product, quantity, and address", () => {
  let result = startConversation("Alice");
  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /Hi there! 👋 I'm Ans, the AI assistant at Lipack\./);
  assert.match(result.replies[0], /📖 catalog 👉 www\.cnlipack\.com/);
  assert.match(result.replies[0], /✅ Product/);

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
  assert.match(result.replies[0], /😊 Thank you\. We have received your inquiry\./);
  assert.match(result.replies[0], /Shipping address:/);
  assert.match(result.replies[0], /👉 Working hours:Monday-Friday, 9:00-18:00,China time\./);
});

test("confirms shipping country from WhatsApp number before asking open address", () => {
  let result = startConversation("Alice", "97451111111");
  result = handleCustomerMessage(result.session, "1", "Alice", "97451111111");
  assert.equal(result.session.step, "quantity");

  result = handleCustomerMessage(result.session, "1000 pcs", "Alice", "97451111111");
  assert.equal(result.session.step, "country_confirm");
  assert.match(result.replies[0], /Should we ship to Qatar/i);

  result = handleCustomerMessage(result.session, "Yes", "Alice", "97451111111");
  assert.equal(result.complete, true);
  assert.equal(result.inquiry.address, "Qatar");
});

test("falls back to manual address when customer rejects phone-based country guess", () => {
  let result = startConversation("Alice", "97451111111");
  result = handleCustomerMessage(result.session, "2", "Alice", "97451111111");
  result = handleCustomerMessage(result.session, "1000 pcs", "Alice", "97451111111");
  result = handleCustomerMessage(result.session, "No", "Alice", "97451111111");

  assert.equal(result.session.step, "address");
  assert.match(result.replies[0], /Which country should we ship to/i);

  result = handleCustomerMessage(result.session, "Dubai, UAE", "Alice", "97451111111");
  assert.equal(result.complete, true);
  assert.equal(result.inquiry.address, "Dubai, UAE");
});

test("instagram flow collects product, quantity, WhatsApp, then confirms country from it", () => {
  let result = startConversation("", "instagram:acct:ig-1", "instagram");
  assert.equal(result.session.step, "product");
  assert.equal(result.session.channel, "instagram");

  result = handleCustomerMessage(result.session, "1", "", "instagram:acct:ig-1");
  assert.equal(result.session.step, "quantity");

  // High-value quantity must NOT short-circuit on Instagram (number not collected yet).
  result = handleCustomerMessage(result.session, "5000", "", "instagram:acct:ig-1");
  assert.equal(result.session.step, "whatsapp");
  assert.match(result.replies[0], /WhatsApp number/i);

  // WhatsApp number drives the country guess (971 -> United Arab Emirates).
  result = handleCustomerMessage(result.session, "+971 50 123 4567", "", "instagram:acct:ig-1");
  assert.equal(result.session.step, "country_confirm");
  assert.match(result.replies[0], /I see your WhatsApp number looks like United Arab Emirates/i);
  assert.match(result.replies[0], /Should we ship to United Arab Emirates/i);

  result = handleCustomerMessage(result.session, "Yes", "", "instagram:acct:ig-1");
  assert.equal(result.complete, true);
  assert.equal(result.inquiry.product, "Corrugated Box");
  assert.equal(result.inquiry.quantity, "5000");
  assert.equal(result.inquiry.whatsapp, "971501234567");
  assert.equal(result.inquiry.address, "United Arab Emirates");
  assert.equal(result.inquiry.fastTrack, true);
});

test("country confirmation asks for text again when the inbound message is empty or unsupported", () => {
  let result = startConversation("", "instagram:acct:ig-iraq", "instagram");
  result = handleCustomerMessage(result.session, "2", "", "instagram:acct:ig-iraq");
  result = handleCustomerMessage(result.session, "1000", "", "instagram:acct:ig-iraq");
  result = handleCustomerMessage(result.session, "+9647814412800", "", "instagram:acct:ig-iraq");

  assert.equal(result.session.step, "country_confirm");
  assert.match(result.replies[0], /Should we ship to Iraq/i);

  result = handleCustomerMessage(result.session, "", "", "instagram:acct:ig-iraq");

  assert.equal(result.session.step, "country_confirm");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /reply with text: Yes, No/i);
});

test("country confirmation accepts Arabic yes and no answers", () => {
  let result = startConversation("", "instagram:acct:ig-ar", "instagram");
  result = handleCustomerMessage(result.session, "2", "", "instagram:acct:ig-ar");
  result = handleCustomerMessage(result.session, "1000", "", "instagram:acct:ig-ar");
  result = handleCustomerMessage(result.session, "+9647814412800", "", "instagram:acct:ig-ar");

  result = handleCustomerMessage(result.session, "نعم", "", "instagram:acct:ig-ar");
  assert.equal(result.complete, true);
  assert.equal(result.inquiry.address, "Iraq");

  result = startConversation("", "instagram:acct:ig-ar-2", "instagram");
  result = handleCustomerMessage(result.session, "2", "", "instagram:acct:ig-ar-2");
  result = handleCustomerMessage(result.session, "1000", "", "instagram:acct:ig-ar-2");
  result = handleCustomerMessage(result.session, "+9647814412800", "", "instagram:acct:ig-ar-2");

  result = handleCustomerMessage(result.session, "لا", "", "instagram:acct:ig-ar-2");
  assert.equal(result.session.step, "address");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /Which country should we ship to/i);
});

test("instagram flow falls back to manual address when country guess is rejected", () => {
  let result = startConversation("", "instagram:acct:ig-2", "instagram");
  result = handleCustomerMessage(result.session, "2", "", "instagram:acct:ig-2");
  result = handleCustomerMessage(result.session, "1000 pcs", "", "instagram:acct:ig-2");
  assert.equal(result.session.step, "whatsapp");

  // Invalid number is rejected and keeps asking.
  result = handleCustomerMessage(result.session, "hello", "", "instagram:acct:ig-2");
  assert.equal(result.session.step, "whatsapp");
  assert.match(result.replies[0], /valid WhatsApp number/i);

  result = handleCustomerMessage(result.session, "+971501234567", "", "instagram:acct:ig-2");
  assert.equal(result.session.step, "country_confirm");

  result = handleCustomerMessage(result.session, "No", "", "instagram:acct:ig-2");
  assert.equal(result.session.step, "address");
  assert.match(result.replies[0], /Which country should we ship to/i);

  result = handleCustomerMessage(result.session, "Canada", "", "instagram:acct:ig-2");
  assert.equal(result.complete, true);
  assert.equal(result.inquiry.whatsapp, "971501234567");
  assert.equal(result.inquiry.address, "Canada");
});

test("hands off to a human after repeated invalid answers", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "hi", "Alice");
  assert.match(result.replies[0], /reply with 1, 2, 3, or 4/i);
  result = handleCustomerMessage(result.session, "hi", "Alice");
  assert.match(result.replies[0], /reply with 1, 2, 3, or 4/i);
  result = handleCustomerMessage(result.session, "hi", "Alice");
  assert.match(result.replies[0], /Emma -- NANJING LIPACK/);
  assert.match(result.replies[0], /86-18014856231/);
});

test("answers bot questions without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "Are you a bot?", "Alice");

  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /automated assistant/);
  assert.match(result.replies[0], /what kind of packaging do you need/);
});

test("answers catalog questions and keeps collecting product", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "catalog please", "Alice");

  assert.equal(result.session.step, "product");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /product examples and catalog/i);
  assert.match(result.replies[0], /what kind of packaging do you need/);
  assert.doesNotMatch(result.replies[0], /Hi there!/);
});

test("answers location and sample questions from knowledge without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "where are you?", "Alice");

  assert.equal(result.session.step, "product");
  assert.match(result.replies[0], /Changjian Road/);

  result = handleCustomerMessage(result.session, "can I order sample?", "Alice");
  assert.equal(result.session.step, "product");
  assert.match(result.replies[0], /sample fee is usually USD 300/i);
});

test("answers MOQ and delivery time questions from knowledge without advancing", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "2", "Alice");
  assert.equal(result.session.step, "quantity");

  result = handleCustomerMessage(result.session, "what is your MOQ?", "Alice");
  assert.equal(result.session.step, "quantity");
  assert.match(result.replies[0], /customized orders, MOQ is usually around 500 pieces/i);
  assert.match(result.replies[0], /What quantity do you need/i);

  result = handleCustomerMessage(result.session, "how long is production time?", "Alice");
  assert.equal(result.session.step, "quantity");
  assert.match(result.replies[0], /15-25 days/i);
  assert.match(result.replies[0], /What quantity do you need/i);
});

test("answers product knowledge questions but plain product answers still advance", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "Do you make paper bags?", "Alice");

  assert.equal(result.session.step, "product");
  assert.match(result.replies[0], /custom paper bags/i);
  assert.match(result.replies[0], /what kind of packaging do you need/i);

  result = handleCustomerMessage(result.session, "Paper bag", "Alice");
  assert.equal(result.session.step, "quantity");
  assert.equal(result.session.data.product, "Paper Bag");
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

test("rejects invalid quantity answers", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "1", "Alice");
  result = handleCustomerMessage(result.session, "hi", "Alice");

  assert.equal(result.session.step, "quantity");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /quantity you need, for example: 1000 pcs/i);
});

test("rejects mixed product text in quantity step", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "1", "Alice");
  result = handleCustomerMessage(result.session, "1000 paper bag", "Alice");

  assert.equal(result.session.step, "quantity");
  assert.match(result.replies[0], /quantity you need, for example: 1000 pcs/i);
});

test("accepts common typo and filler words in quantity step", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "2", "Alice");
  result = handleCustomerMessage(result.session, "100 psc as of now", "Alice");

  assert.equal(result.session.step, "address");
  assert.equal(result.session.data.quantity, "100 pcs");
  assert.equal(result.complete, false);
});

test("rejects invalid shipping address answers", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "1", "Alice");
  result = handleCustomerMessage(result.session, "1000", "Alice");
  result = handleCustomerMessage(result.session, "hi", "Alice");

  assert.equal(result.session.step, "address");
  assert.equal(result.complete, false);
  assert.match(result.replies[0], /share your country or shipping address/i);
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

test("image at product step skips to quantity and sets product to Other", () => {
  let result = startConversation("Alice");
  result = handleCustomerImage(result.session, "https://example.com/media/abc", "Alice");

  assert.equal(result.session.step, "quantity");
  assert.equal(result.session.data.product, "Other");
  assert.deepEqual(result.session.data.imageLinks, ["https://example.com/media/abc"]);
  assert.match(result.replies[0], /Your photo has been received/i);
  assert.match(result.replies[0], /quantity/i);

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
  assert.match(result.replies[0], /Your video has been received/i);
  result = handleCustomerMessage(result.session, "5000 pcs", "Alice");

  assert.equal(result.complete, true);
  assert.deepEqual(result.inquiry.customerLinks, ["https://example.com/product"]);
  assert.deepEqual(result.inquiry.videoLinks, ["https://example.com/media/video"]);
  assert.match(result.replies[0], /Videos received: 1/);
  assert.match(result.replies[0], /Links received: 1/);
});

test("replies only once when multiple attachments arrive in the same step", () => {
  let result = startConversation("Alice");
  result = handleCustomerImage(result.session, "https://example.com/media/1", "Alice");
  assert.match(result.replies[0], /Your photo has been received/i);

  result = handleCustomerImage(result.session, "https://example.com/media/2", "Alice");
  assert.deepEqual(result.replies, []);
  assert.deepEqual(result.session.data.imageLinks, [
    "https://example.com/media/1",
    "https://example.com/media/2"
  ]);
});

test("does not reply to attachments after inquiry is already complete", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "1", "Alice");
  result = handleCustomerMessage(result.session, "5000", "Alice");

  const attachmentResult = handleCustomerImage(
    result.session,
    "https://example.com/media/extra",
    "Alice"
  );

  assert.deepEqual(attachmentResult.replies, []);
});

test("does not restart after inquiry is already complete", () => {
  let result = startConversation("Alice");
  result = handleCustomerMessage(result.session, "2", "Alice");
  result = handleCustomerMessage(result.session, "5000", "Alice");

  const followUp = handleCustomerMessage(result.session, "hi", "Alice");

  assert.equal(followUp.complete, false);
  assert.deepEqual(followUp.replies, [handoffReminderMessage]);
  assert.equal(followUp.session.step, "complete");
});
