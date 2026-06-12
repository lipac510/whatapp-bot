import test from "node:test";
import assert from "node:assert/strict";
import {
  isHighValueQuantity,
  isOfficialCodeMessage,
  isRestrictedCountry,
  normalizeProductAnswer,
  parseQuantity
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
  assert.equal(isHighValueQuantity("5000 pcs"), true);
});

test("detects official code messages", () => {
  assert.equal(isOfficialCodeMessage("Your WhatsApp verification code is 123456"), true);
});

test("detects restricted countries", () => {
  assert.equal(isRestrictedCountry("IN"), true);
  assert.equal(isRestrictedCountry("MX"), true);
  assert.equal(isRestrictedCountry("US"), false);
});
