import test from "node:test";
import assert from "node:assert/strict";
import { detectArabic, localize, toArabic } from "../src/i18n.js";

test("detectArabic only flags Arabic script", () => {
  assert.equal(detectArabic("مرحبا، أريد صندوق"), true);
  assert.equal(detectArabic("hello"), false);
  assert.equal(detectArabic("1000 pcs"), false);
  assert.equal(detectArabic(""), false);
});

test("localize is a no-op for English (English path unchanged)", () => {
  const en = "Great. What quantity do you need?\nYou can reply like: 1000 pcs.";
  assert.equal(localize(en, "en"), en);
  assert.equal(localize(en, undefined), en);
});

test("toArabic translates fixed phrases but passes dynamic values through", () => {
  const summary = [
    "😊 Thank you. We have received your inquiry.",
    "Product: Luxury Rigid Box",
    "Quantity: 500",
    "Shipping address: United Arab Emirates"
  ].join("\n");

  const ar = toArabic(summary);
  assert.match(ar, /شكرًا لك. لقد استلمنا استفسارك/);
  assert.match(ar, /المنتج: Luxury Rigid Box/); // label translated, product name kept
  assert.match(ar, /الكمية: 500/);
  assert.match(ar, /عنوان الشحن: United Arab Emirates/);
  assert.doesNotMatch(ar, /Thank you/);
});

test("country confirmation keeps the country name in the middle", () => {
  const prompt = "I see your WhatsApp number looks like United Arab Emirates 🇦🇪.\nShould we ship to United Arab Emirates?";
  const ar = toArabic(prompt);
  assert.match(ar, /يبدو أن رقم واتساب الخاص بك من United Arab Emirates/);
  assert.match(ar, /هل نشحن إلى United Arab Emirates/);
});

test("translates the text-only country confirmation retry prompt", () => {
  const ar = toArabic("Please reply with text: Yes, No, or the correct destination country.");
  assert.match(ar, /يرجى الرد برسالة نصية/);
  assert.doesNotMatch(ar, /Please reply/);
});
