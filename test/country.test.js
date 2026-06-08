import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCountry,
  inferCountryFromPhone,
  inferCountryFromText,
  splitPhone
} from "../src/country.js";

test("infers country from address text first", () => {
  assert.equal(inferCountryFromText("Dubai, UAE"), "AE");
  assert.equal(inferCountryFromText("Riyadh Saudi Arabia"), "SA");
  assert.equal(inferCountryFromText("江苏省苏州市 China"), "CN");
});

test("infers country from WhatsApp phone prefix", () => {
  assert.equal(inferCountryFromPhone("8618014856231"), "CN");
  assert.equal(inferCountryFromPhone("+971501234567"), "AE");
  assert.equal(inferCountryFromPhone("966501234567"), "SA");
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
