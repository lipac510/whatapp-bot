import test from "node:test";
import assert from "node:assert/strict";
import {
  getCountryName,
  inferCountry,
  inferCountryFromPhone,
  inferCountryFromText,
  splitPhone
} from "../src/country.js";

test("infers country from address text first", () => {
  assert.equal(inferCountryFromText("Dubai, UAE"), "AE");
  assert.equal(inferCountryFromText("Riyadh Saudi Arabia"), "SA");
  assert.equal(inferCountryFromText("江苏省苏州市 China"), "CN");
  assert.equal(inferCountryFromText("Mumbai India"), "IN");
  assert.equal(inferCountryFromText("Mexico City"), "MX");
  assert.equal(inferCountryFromText("Qatar"), "QA");
  assert.equal(inferCountryFromText("Doha Qatar"), "QA");
  assert.equal(inferCountryFromText("OMAN MUSCUT"), "OM");
  assert.equal(inferCountryFromText("Delivery to Muscat Oman"), "OM");
});

test("infers countries from a broader country name list", () => {
  assert.equal(inferCountryFromText("Eptanisou , Limassol\nCYPRUS"), "CY");
  assert.equal(inferCountryFromText("Country : CYPRUS"), "CY");
  assert.equal(inferCountryFromText("Istanbul Turkey"), "TR");
  assert.equal(inferCountryFromText("Netherlands"), "NL");
  assert.equal(inferCountryFromText("South Africa"), "ZA");
  assert.equal(inferCountryFromText("Hong Kong"), "HK");
  assert.equal(inferCountryFromText("Taiwan"), "TW");
  assert.equal(inferCountryFromText("Sri Lanka"), "LK");
  assert.equal(inferCountryFromText("Panama"), "PA");
  assert.equal(inferCountryFromText("Puerto Rico"), "PR");
});

test("recognizes restricted countries by name", () => {
  assert.equal(inferCountryFromText("Kenya"), "KE");
  assert.equal(inferCountryFromText("Nigeria"), "NG");
  assert.equal(inferCountryFromText("Benin"), "BJ");
  assert.equal(inferCountryFromText("Lebanon"), "LB");
  assert.equal(inferCountryFromText("Sudan"), "SD");
});

test("does not match short country aliases inside normal words", () => {
  assert.equal(inferCountryFromText("custom packaging"), "");
});

test("returns names for newly supported country codes", () => {
  assert.equal(getCountryName("CY"), "Cyprus");
  assert.equal(getCountryName("TR"), "Turkey");
  assert.equal(getCountryName("ZA"), "South Africa");
});

test("infers country from WhatsApp phone prefix", () => {
  assert.equal(inferCountryFromPhone("8618014856231"), "CN");
  assert.equal(inferCountryFromPhone("+971501234567"), "AE");
  assert.equal(inferCountryFromPhone("966501234567"), "SA");
  assert.equal(inferCountryFromPhone("97451111111"), "QA");
  assert.equal(inferCountryFromPhone("+96891234567"), "OM");
  assert.equal(inferCountryFromPhone("918888888888"), "IN");
  assert.equal(inferCountryFromPhone("521234567890"), "MX");
});

test("address country wins over phone country", () => {
  assert.equal(
    inferCountry({ address: "Dubai, UAE", phone: "8618014856231" }),
    "AE"
  );
});

test("splits phone into area code and local number", () => {
  assert.deepEqual(splitPhone("+86 18014856231"), {
    telAreaCode: "86",
    localNumber: "18014856231",
    fullNumber: "8618014856231"
  });
});
