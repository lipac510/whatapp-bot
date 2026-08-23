import test from "node:test";
import assert from "node:assert/strict";
import {
  canResolveInquiryCountry,
  isHighValueQuantity,
  isMeaningfulAddressAnswer,
  isOfficialCodeMessage,
  isRestrictedCountry,
  isValidQuantityAnswer,
  normalizeQuantityAnswer,
  normalizeProductAnswer,
  parseQuantity,
  validateInquiryForRecording
} from "../src/rules.js";

test("maps product option numbers to product names", () => {
  assert.equal(normalizeProductAnswer("1"), "Corrugated Box");
  assert.equal(normalizeProductAnswer("2"), "Luxury Rigid Box");
  assert.equal(normalizeProductAnswer("3"), "Paper Bag");
  assert.equal(normalizeProductAnswer("4"), "Other");
});

test("rejects low-information product answers", () => {
  assert.equal(normalizeProductAnswer("hi"), "");
  assert.equal(normalizeProductAnswer("5000 pcs"), "");
  assert.equal(normalizeProductAnswer("https://example.com/product"), "");
});

test("parses quantities", () => {
  assert.equal(parseQuantity("5,000 pcs"), 5000);
  assert.equal(parseQuantity("20k"), 20000);
  assert.equal(parseQuantity("100 psc as of now"), 100);
  assert.equal(isHighValueQuantity("5000 pcs"), true);
  assert.equal(normalizeQuantityAnswer("1000 paper bag"), "");
  assert.equal(normalizeQuantityAnswer("2k"), "2000 pcs");
  assert.equal(normalizeQuantityAnswer("100 psc as of now"), "100 pcs");
  assert.equal(normalizeQuantityAnswer("around 100 pcs"), "100 pcs");
});

test("validates quantity answers", () => {
  assert.equal(isValidQuantityAnswer("1000 pcs"), true);
  assert.equal(isValidQuantityAnswer("100 psc"), true);
  assert.equal(isValidQuantityAnswer("100 pcs as of now"), true);
  assert.equal(isValidQuantityAnswer("2k"), true);
  assert.equal(isValidQuantityAnswer("hi"), false);
  assert.equal(isValidQuantityAnswer("1000 paper bag"), false);
  assert.equal(isValidQuantityAnswer(""), false);
});

test("validates shipping addresses", () => {
  assert.equal(isMeaningfulAddressAnswer("Canada"), true);
  assert.equal(isMeaningfulAddressAnswer("Dubai, UAE"), true);
  assert.equal(isMeaningfulAddressAnswer("南京太平南路"), true);
  assert.equal(isMeaningfulAddressAnswer("hi"), false);
  assert.equal(isMeaningfulAddressAnswer("12345"), false);
});

test("validates inquiry before recording", () => {
  assert.equal(validateInquiryForRecording({
    customerId: "8618014856231",
    product: "Corrugated Box",
    quantity: "1000",
    address: "Canada"
  }), "");

  assert.equal(validateInquiryForRecording({
    customerId: "8618014856231",
    product: "Corrugated Box",
    quantity: "hi",
    address: "Canada"
  }), "Invalid quantity");

  assert.equal(validateInquiryForRecording({
    customerId: "8618014856231",
    product: "Corrugated Box",
    quantity: "1000",
    address: "hi"
  }), "Invalid shipping address");
});

test("resolves country from address text or WhatsApp phone", () => {
  assert.equal(canResolveInquiryCountry({
    customerId: "97451111111",
    address: "Porto Arabia tower 24"
  }), true);

  assert.equal(canResolveInquiryCountry({
    customerId: "9647701234567",
    address: "Karbala"
  }), true);

  assert.equal(canResolveInquiryCountry({
    customerId: "8618014856231",
    address: "Qatar"
  }), true);

  assert.equal(canResolveInquiryCountry({
    customerId: "",
    address: "Unknown destination"
  }), false);
});

test("detects official code messages", () => {
  assert.equal(isOfficialCodeMessage("Your WhatsApp verification code is 123456"), true);
  assert.equal(isOfficialCodeMessage("123456 是你的Facebook 验证码"), true);
  assert.equal(isOfficialCodeMessage("123456 是你的Instagram 验证码"), true);
  assert.equal(isOfficialCodeMessage("123456 is your Instagram code, don't share it."), true);
  assert.equal(isOfficialCodeMessage("123456 is your Facebook confirmation code."), true);
  assert.equal(
    isOfficialCodeMessage("https://www.instagram.com/reel/DYVHt8Lgdn8/?igsh=MXVvem5xdmh3dWI0bA=="),
    false
  );
});

test("detects restricted countries", () => {
  assert.equal(isRestrictedCountry("IN"), true);
  assert.equal(isRestrictedCountry("MX"), true);
  assert.equal(isRestrictedCountry("US"), false);
});
