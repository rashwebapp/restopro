/**
 * Test Suite Tahap 3 — Task 1: Modul Konversi EMVCo QRIS Dinamis & Algoritma CRC16-CCITT
 * (assets/js/resto-sync.js)
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap3_qris_emvco.js
 */

// -----------------------------------------------------------------------------
// Minimal Browser Environment Mock untuk JavaScriptCore (jsc)
// -----------------------------------------------------------------------------
function createMemoryStorage() {
  const store = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, val) {
      store[key] = String(val);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((k) => delete store[k]);
    }
  };
}

var localStorage = createMemoryStorage();
var sessionStorage = createMemoryStorage();

var console = {
  log: function () {},
  warn: function () {},
  error: function () {}
};

function createMockElement(tagName, ownerDoc) {
  const el = {
    tagName: String(tagName || "div").toUpperCase(),
    _id: "",
    get id() { return this._id; },
    set id(val) {
      this._id = String(val || "");
      if (this._id && ownerDoc) {
        ownerDoc._byId[this._id] = this;
      }
    },
    className: "",
    textContent: "",
    children: [],
    parentNode: null,
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {}
  };
  return el;
}

function createMockDocument() {
  const doc = {
    title: "Resto Pro",
    _byId: Object.create(null),
    createElement(tag) {
      return createMockElement(tag, doc);
    },
    getElementById(id) {
      return doc._byId[id] || null;
    },
    querySelector(selector) {
      if (selector && selector.startsWith("#")) {
        return doc.getElementById(selector.substring(1));
      }
      return null;
    }
  };
  doc.body = createMockElement("body", doc);
  return doc;
}

var document = createMockDocument();

var RESTO_CLOUD_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/MOCK_MASTER_CLOUD/exec",
  API_SECRET_KEY: "MOCK-ADMIN-SECRET-KEY"
};

var window = {
  location: {
    search: "",
    href: "https://resto.example.com/cashier_pos_register.html",
    pathname: "/cashier_pos_register.html",
    hash: ""
  },
  history: {
    replaceState: function () {}
  },
  addEventListener: function () {},
  RESTO_CLOUD_CONFIG: RESTO_CLOUD_CONFIG
};

var fetch = function () {
  return Promise.reject(new Error("Mock fetch offline"));
};

// Load target script
load("assets/js/resto-sync.js");

// -----------------------------------------------------------------------------
// Mini Assertion & Test Runner
// -----------------------------------------------------------------------------
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "Equality failed") + " -> expected: " + expected + ", actual: " + actual);
  }
}

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    localStorage.clear();
    sessionStorage.clear();
    fn();
    print("  [PASS] " + name);
    passedCount++;
  } catch (err) {
    print("  [FAIL] " + name + ": " + (err && err.message ? err.message : err));
    if (err && err.stack) {
      print("         " + err.stack);
    }
    failedCount++;
  }
}

print("===============================================================================");
print("RUNNING TESTS: Task 1 — EMVCo QRIS Dinamis & CRC16-CCITT (resto-sync.js)");
print("===============================================================================");

// -----------------------------------------------------------------------------
// Test 1: RestoSync.calculateCrc16 — Standard EMVCo / CRC16-CCITT Calculation
// -----------------------------------------------------------------------------
runTest("1. calculateCrc16 accurately computes standard EMVCo CRC16-CCITT checksums", function () {
  assert(typeof RestoSync.calculateCrc16 === "function", "RestoSync.calculateCrc16 must be a function");

  // Standard CRC16-CCITT (0xFFFF, 0x1021) vector
  assertEqual(RestoSync.calculateCrc16("123456789"), "29B1", "Standard test vector 123456789 must equal 29B1");
  assertEqual(RestoSync.calculateCrc16(""), "FFFF", "Empty string must return initial FFFF");

  // Format check: exactly 4 uppercase hexadecimal digits
  const sample = "00020101021153033605802ID5911RESTO PRO6007JAKARTA6304";
  const crc = RestoSync.calculateCrc16(sample);
  assert(/^[0-9A-F]{4}$/.test(crc), "CRC must be 4 uppercase hex characters, got: " + crc);
  assert(crc.length === 4, "CRC length must be exactly 4");
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation on convertStaticQrisToDynamic
// -----------------------------------------------------------------------------
runTest("2. convertStaticQrisToDynamic validates inputs and returns friendly error object", function () {
  assert(typeof RestoSync.convertStaticQrisToDynamic === "function", "convertStaticQrisToDynamic must be a function");

  // Invalid rawQris (null, undefined, not string, missing 000201 or 6304)
  const err1 = RestoSync.convertStaticQrisToDynamic(null, 50000);
  assertEqual(err1.success, false, "null rawQris must fail");
  assertEqual(err1.error, "Format QRIS statis tidak valid", "Must return exact error message");

  const err2 = RestoSync.convertStaticQrisToDynamic("", 50000);
  assertEqual(err2.success, false, "empty rawQris must fail");

  const err3 = RestoSync.convertStaticQrisToDynamic("INVALID_QRIS_STRING_WITHOUT_TAGS", 50000);
  assertEqual(err3.success, false, "Missing 000201 or 6304 must fail");
  assertEqual(err3.error, "Format QRIS statis tidak valid");

  const err4 = RestoSync.convertStaticQrisToDynamic("000201_WITHOUT_CHECKSUM_TAG", 50000);
  assertEqual(err4.success, false, "Missing 6304 must fail");

  // Invalid amount (<= 0, NaN, undefined)
  const validSample = "00020101021153033605802ID5911RESTO PRO6304A1B2";

  const err5 = RestoSync.convertStaticQrisToDynamic(validSample, 0);
  assertEqual(err5.success, false, "amount 0 must fail");
  assertEqual(err5.error, "Nominal transaksi tidak valid");

  const err6 = RestoSync.convertStaticQrisToDynamic(validSample, -10000);
  assertEqual(err6.success, false, "negative amount must fail");
  assertEqual(err6.error, "Nominal transaksi tidak valid");

  const err7 = RestoSync.convertStaticQrisToDynamic(validSample, null);
  assertEqual(err7.success, false, "null amount must fail");

  const err8 = RestoSync.convertStaticQrisToDynamic(validSample, NaN);
  assertEqual(err8.success, false, "NaN amount must fail");
});

// -----------------------------------------------------------------------------
// Test 3: Static to Dynamic Transformation (Tag 01, Tag 54, Tag 53, Tag 58, CRC)
// -----------------------------------------------------------------------------
runTest("3. convertStaticQrisToDynamic transforms static QRIS to valid dynamic QRIS with amount", function () {
  const staticPayload = "00020101021126580014ID.LINKAJA.WWW011893600911002230058802150000000000000000303UMI51440014ID.CO.QRIS.WWW0215ID10200210000010303UMI5204581253033605802ID5911RESTO PRO6007JAKARTA61051234062070703A016304";
  const staticCrc = RestoSync.calculateCrc16(staticPayload);
  const fullStaticQris = staticPayload + staticCrc;

  const amount = 63000;
  const result = RestoSync.convertStaticQrisToDynamic(fullStaticQris, amount);

  assertEqual(result.success, true, "Conversion must succeed");
  assertEqual(result.amount, 63000, "Amount must match input");
  assert(typeof result.dynamicQris === "string", "dynamicQris must be a string");

  const dyn = result.dynamicQris;

  // 1. Tag 01 must be 010212 (Dynamic), not 010211 (Static)
  assert(dyn.indexOf("010212") !== -1, "Must contain dynamic tag 010212");
  assert(dyn.indexOf("010211") === -1, "Must NOT contain static tag 010211");

  // 2. Tag 54 must have length 05 and amount 63000 -> 540563000
  assert(dyn.indexOf("540563000") !== -1, "Must contain tag 54: 540563000");

  // 3. Tag 53 (5303360) and Tag 58 (5802ID) must be present
  assert(dyn.indexOf("5303360") !== -1, "Must contain tag 5303360");
  assert(dyn.indexOf("5802ID") !== -1, "Must contain tag 5802ID");

  // 4. Must end with 6304 followed by valid 4-character hex CRC
  const crcIndex = dyn.lastIndexOf("6304");
  assert(crcIndex !== -1, "Must contain 6304 checksum tag");
  const prefix = dyn.substring(0, crcIndex + 4);
  const calculatedCrc = RestoSync.calculateCrc16(prefix);
  const appendedCrc = dyn.substring(crcIndex + 4);

  assertEqual(appendedCrc.length, 4, "Appended CRC must be 4 characters");
  assertEqual(appendedCrc, calculatedCrc, "Appended CRC must match calculateCrc16 of prefix");
});

// -----------------------------------------------------------------------------
// Test 4: Idempotency & Updating Existing Tag 54 Without Duplication
// -----------------------------------------------------------------------------
runTest("4. convertStaticQrisToDynamic replaces existing Tag 54 cleanly when re-converted", function () {
  const baseStatic = "00020101021153033605802ID5911RESTO PRO6304ABCD";

  // First conversion with 10.000
  const firstRes = RestoSync.convertStaticQrisToDynamic(baseStatic, 10000);
  assertEqual(firstRes.success, true);
  assert(firstRes.dynamicQris.indexOf("540510000") !== -1, "First conversion has 540510000");

  // Second conversion using the already dynamic QRIS with 250.000
  const secondRes = RestoSync.convertStaticQrisToDynamic(firstRes.dynamicQris, 250000);
  assertEqual(secondRes.success, true);
  assert(secondRes.dynamicQris.indexOf("5406250000") !== -1, "Second conversion has 5406250000");
  assert(secondRes.dynamicQris.indexOf("540510000") === -1, "Old tag 540510000 must be removed completely");

  // Ensure Tag 54 appears only once
  const matches = secondRes.dynamicQris.match(/5406250000/g);
  assertEqual(matches ? matches.length : 0, 1, "Tag 54 must appear exactly once");

  // Third conversion with large amount Rp 1.500.000
  const thirdRes = RestoSync.convertStaticQrisToDynamic(secondRes.dynamicQris, 1500000);
  assertEqual(thirdRes.success, true);
  assert(thirdRes.dynamicQris.indexOf("54071500000") !== -1, "Large amount has 54071500000");
  assert(thirdRes.dynamicQris.indexOf("5406250000") === -1, "Old tag 5406250000 must be removed");
});

// -----------------------------------------------------------------------------
// Test 5: Fallbacks — Injects missing Tag 53 and Tag 58 if omitted in input
// -----------------------------------------------------------------------------
runTest("5. convertStaticQrisToDynamic injects missing Tag 53 and Tag 58 if not present", function () {
  // Input missing 5303360 and 5802ID
  const bareStatic = "0002010102115911RESTO PRO6304ABCD";
  const res = RestoSync.convertStaticQrisToDynamic(bareStatic, 45000);

  assertEqual(res.success, true);
  assert(res.dynamicQris.indexOf("5303360") !== -1, "Must inject 5303360");
  assert(res.dynamicQris.indexOf("5802ID") !== -1, "Must inject 5802ID");
  assert(res.dynamicQris.indexOf("540545000") !== -1, "Must inject 540545000");
  assert(res.dynamicQris.indexOf("010212") !== -1, "Must be dynamic 010212");
});

// -----------------------------------------------------------------------------
// Test 6: Tenant QRIS Getter & Setter (RestoSync.getTenantQris & saveTenantQris)
// -----------------------------------------------------------------------------
runTest("6. getTenantQris and saveTenantQris isolate QRIS storage per tenant", function () {
  assert(typeof RestoSync.getTenantQris === "function", "getTenantQris must be a function");
  assert(typeof RestoSync.saveTenantQris === "function", "saveTenantQris must be a function");

  // Initial state should return empty string
  assertEqual(RestoSync.getTenantQris("default"), "", "Default tenant QRIS empty initially");
  assertEqual(RestoSync.getTenantQris("warung-berkah"), "", "warung-berkah QRIS empty initially");

  const qrisDefault = "00020101021153033605802ID5910MASTER QR63041111";
  const qrisBerkah = "00020101021153033605802ID5913WARUNG BERKAH63042222";

  // Save for default
  const saved1 = RestoSync.saveTenantQris("default", qrisDefault);
  assertEqual(saved1, true, "saveTenantQris must return true on success");
  assertEqual(RestoSync.getTenantQris("default"), qrisDefault, "Default tenant QRIS retrieved correctly");

  // Save for tenant 'warung-berkah'
  const saved2 = RestoSync.saveTenantQris("warung-berkah", qrisBerkah);
  assertEqual(saved2, true);
  assertEqual(RestoSync.getTenantQris("warung-berkah"), qrisBerkah, "Tenant QRIS retrieved correctly");

  // Isolation check: tenant default remains qrisDefault, not overwritten by berkah
  assertEqual(RestoSync.getTenantQris("default"), qrisDefault, "Default tenant was not overwritten");

  // Key check in localStorage: default uses qris_static, tenant uses qris_static_tenant_<id>
  assertEqual(localStorage.getItem("qris_static"), qrisDefault, "Default stored under qris_static");
  assertEqual(localStorage.getItem("qris_static_tenant_warung-berkah"), qrisBerkah, "Tenant stored with tenant suffix");

  // getStorageKey contract test
  assertEqual(RestoSync.getStorageKey("default", "qris_static"), "qris_static");
  assertEqual(RestoSync.getStorageKey("warung-berkah", "qris_static"), "qris_static_tenant_warung-berkah");
});

// -----------------------------------------------------------------------------
// Test 7: Optional billNo in Tag 62 (Additional Data Field)
// -----------------------------------------------------------------------------
runTest("7. convertStaticQrisToDynamic handles optional options.billNo in Tag 62", function () {
  const baseStatic = "00020101021153033605802ID5911RESTO PRO6304ABCD";
  const res = RestoSync.convertStaticQrisToDynamic(baseStatic, 85000, { billNo: "INV-99" });

  assertEqual(res.success, true);
  assertEqual(res.amount, 85000);
  assert(res.dynamicQris.indexOf("540585000") !== -1, "Must contain amount tag");
  assert(res.dynamicQris.indexOf("62100106INV-99") !== -1, "Must contain tag 62 with billNo");

  // Verify CRC
  const crcIndex = res.dynamicQris.lastIndexOf("6304");
  const prefix = res.dynamicQris.substring(0, crcIndex + 4);
  const calculatedCrc = RestoSync.calculateCrc16(prefix);
  assertEqual(res.dynamicQris.substring(crcIndex + 4), calculatedCrc, "CRC must match");
});

print("===============================================================================");
print("HASIL: " + passedCount + " passed, " + failedCount + " failed, total " + (passedCount + failedCount));
print("===============================================================================");

if (failedCount > 0) {
  throw new Error(failedCount + " test(s) failed in Task 1!");
}
