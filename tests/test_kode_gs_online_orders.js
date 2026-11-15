/**
 * Test Suite Tahap 3 — Task 2: Google Apps Script Backend OnlineOrders Sheet & Endpoints (backend/Kode.gs & resto-sync.js)
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_online_orders.js
 */

// -----------------------------------------------------------------------------
// 1. Browser Stubs agar dependencies dapat di-load oleh JSC
// -----------------------------------------------------------------------------
function createMemoryStorage() {
  const store = Object.create(null);
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };
}
var localStorage = createMemoryStorage();
var sessionStorage = createMemoryStorage();
var window = {
  location: { search: "" },
  RESTO_CLOUD_CONFIG: null
};
var console = {
  log: function () {},
  warn: function () {},
  error: function () {}
};

load("assets/js/resto-sync.js");

// -----------------------------------------------------------------------------
// 2. Google Apps Script Mock Environment
// -----------------------------------------------------------------------------
var scriptPropsStore = Object.create(null);

var PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (key) {
        return Object.prototype.hasOwnProperty.call(scriptPropsStore, key) ? scriptPropsStore[key] : null;
      },
      setProperty: function (key, value) {
        scriptPropsStore[key] = String(value);
      },
      setProperties: function (obj) {
        if (!obj) return;
        Object.keys(obj).forEach(function (k) {
          scriptPropsStore[k] = String(obj[k]);
        });
      },
      deleteProperty: function (key) {
        delete scriptPropsStore[key];
      }
    };
  }
};

var scriptCacheStore = Object.create(null);
var CacheService = {
  getScriptCache: function () {
    return {
      get: function (k) {
        return Object.prototype.hasOwnProperty.call(scriptCacheStore, k) ? scriptCacheStore[k] : null;
      },
      put: function (k, v) {
        scriptCacheStore[k] = String(v);
      },
      remove: function (k) {
        delete scriptCacheStore[k];
      }
    };
  }
};

var ContentService = {
  MimeType: {
    JSON: "application/json",
    TEXT: "text/plain"
  },
  createTextOutput: function (content) {
    return {
      _content: String(content),
      _mimeType: null,
      setMimeType: function (m) {
        this._mimeType = m;
        return this;
      },
      getContent: function () {
        return this._content;
      }
    };
  }
};

var Utilities = {
  DigestAlgorithm: {
    SHA_256: "SHA_256"
  },
  Charset: {
    UTF_8: "UTF_8"
  },
  computeDigest: function (algo, input) {
    if (algo !== "SHA_256") {
      throw new Error("Unsupported digest algo in mock: " + algo);
    }
    const hex = RestoSync.sha256Hex(String(input));
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      let b = parseInt(hex.substring(i, i + 2), 16);
      if (b > 127) b -= 256;
      bytes.push(b);
    }
    return bytes;
  },
  getUuid: function () {
    return "mock-uuid-" + Math.random().toString(36).substring(2, 10);
  }
};

var Logger = {
  log: function () {}
};

function createMockRange(sheet, startRow, startCol, numRows, numCols) {
  return {
    getValues: function () {
      const out = [];
      for (let r = 0; r < numRows; r++) {
        const rowData = [];
        const targetRow = sheet._rows[startRow - 1 + r] || [];
        for (let c = 0; c < numCols; c++) {
          const val = targetRow[startCol - 1 + c];
          rowData.push(val !== undefined ? val : "");
        }
        out.push(rowData);
      }
      return out;
    },
    setValues: function (vals2D) {
      for (let r = 0; r < vals2D.length; r++) {
        const rIdx = startRow - 1 + r;
        while (sheet._rows.length <= rIdx) {
          sheet._rows.push([]);
        }
        for (let c = 0; c < vals2D[r].length; c++) {
          sheet._rows[rIdx][startCol - 1 + c] = vals2D[r][c];
        }
      }
      return this;
    },
    setValue: function (val) {
      const rIdx = startRow - 1;
      while (sheet._rows.length <= rIdx) {
        sheet._rows.push([]);
      }
      sheet._rows[rIdx][startCol - 1] = val;
      return this;
    },
    setNumberFormat: function () { return this; },
    setFontWeight: function () { return this; },
    setBackground: function () { return this; },
    setFontColor: function () { return this; },
    setHorizontalAlignment: function () { return this; }
  };
}

function createMockSheet(name, ss) {
  return {
    _name: name,
    _ss: ss,
    _rows: [],
    getName: function () { return this._name; },
    setName: function (n) {
      delete ss._sheets[this._name];
      this._name = n;
      ss._sheets[n] = this;
      return this;
    },
    appendRow: function (arr) {
      this._rows.push(arr.slice());
      return this;
    },
    deleteRow: function (rowIdx) {
      if (rowIdx >= 1 && rowIdx <= this._rows.length) {
        this._rows.splice(rowIdx - 1, 1);
      }
      return this;
    },
    getLastRow: function () {
      return this._rows.length;
    },
    getLastColumn: function () {
      let maxCols = 0;
      for (let i = 0; i < this._rows.length; i++) {
        if (this._rows[i] && this._rows[i].length > maxCols) {
          maxCols = this._rows[i].length;
        }
      }
      return maxCols;
    },
    getDataRange: function () {
      const numRows = this._rows.length;
      let maxCols = 0;
      for (let i = 0; i < this._rows.length; i++) {
        if (this._rows[i] && this._rows[i].length > maxCols) {
          maxCols = this._rows[i].length;
        }
      }
      return createMockRange(this, 1, 1, Math.max(numRows, 1), Math.max(maxCols, 1));
    },
    getRange: function (row, col, numRows, numCols) {
      const nr = numRows !== undefined ? numRows : 1;
      const nc = numCols !== undefined ? numCols : 1;
      return createMockRange(this, row, col, nr, nc);
    },
    setFrozenRows: function () { return this; },
    autoResizeColumn: function () { return this; }
  };
}

function createMockSpreadsheet(id) {
  const ss = {
    _id: id || "mock-sheet-id",
    _sheets: Object.create(null),
    getId: function () { return this._id; },
    getUrl: function () { return "https://docs.google.com/spreadsheets/d/" + this._id; },
    getSheetByName: function (name) {
      return this._sheets[name] || null;
    },
    insertSheet: function (name) {
      const s = createMockSheet(name, this);
      this._sheets[name] = s;
      return s;
    },
    deleteSheet: function (sheet) {
      if (sheet && sheet.getName()) {
        delete this._sheets[sheet.getName()];
      }
    },
    getActiveSheet: function () {
      const keys = Object.keys(this._sheets);
      return keys.length > 0 ? this._sheets[keys[0]] : null;
    }
  };
  return ss;
}

var currentSpreadsheet = createMockSpreadsheet("test-ss-id");
var SpreadsheetApp = {
  openById: function (id) {
    if (id === currentSpreadsheet.getId()) return currentSpreadsheet;
    return createMockSpreadsheet(id);
  },
  getActiveSpreadsheet: function () {
    return currentSpreadsheet;
  },
  create: function (name) {
    const ss = createMockSpreadsheet("created-" + Math.random().toString(36).substring(2, 8));
    return ss;
  }
};

// -----------------------------------------------------------------------------
// 3. Load backend/Kode.gs
// -----------------------------------------------------------------------------
load("backend/Kode.gs");

// -----------------------------------------------------------------------------
// 4. Test Harness & Helpers
// -----------------------------------------------------------------------------
const TEST_API_KEY = "RP-SEC-TEST123456789";

function resetGasEnv() {
  scriptPropsStore = Object.create(null);
  scriptCacheStore = Object.create(null);
  currentSpreadsheet = createMockSpreadsheet("test-ss-id");
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", currentSpreadsheet.getId());
  PropertiesService.getScriptProperties().setProperty("ROOT_FOLDER_ID", "mock-root-folder-123");
  PropertiesService.getScriptProperties().setProperty("API_SECRET_KEY", TEST_API_KEY);
  localStorage.clear();
}

function parseResponse(output) {
  if (!output || typeof output.getContent !== "function") {
    throw new Error("Invalid output object returned from doGet/doPost");
  }
  return JSON.parse(output.getContent());
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details) {
  if (condition) {
    print("  [PASS] " + testName);
    passedCount++;
  } else {
    print("  [FAIL] " + testName);
    if (details) print("         -> " + details);
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// 5. Test Suites Execution
// -----------------------------------------------------------------------------
print("===============================================================================");
print("RUNNING TESTS: Task 2 — backend/Kode.gs OnlineOrders Sheet & Endpoints");
print("===============================================================================");

// -----------------------------------------------------------------------------
// Test Suite 1: Auto-create sheet OnlineOrders dengan 15 header kolom yang tepat
// -----------------------------------------------------------------------------
resetGasEnv();

assert(CONFIG.SHEET_NAMES.ONLINE_ORDERS === "OnlineOrders",
  "1.1 CONFIG.SHEET_NAMES.ONLINE_ORDERS is 'OnlineOrders'",
  "Expected 'OnlineOrders', got: " + (CONFIG.SHEET_NAMES && CONFIG.SHEET_NAMES.ONLINE_ORDERS));

const expectedHeaders = [
  'orderId', 'tenantId', 'platform', 'platformRef', 'customerName',
  'customerPhone', 'driverInfo', 'itemsJson', 'subtotal', 'packagingFee',
  'totalAmount', 'specialNotes', 'status', 'createdAt', 'updatedAt'
];

const isHeadersDefined = typeof ONLINE_ORDER_HEADERS !== "undefined";
assert(isHeadersDefined && Array.isArray(ONLINE_ORDER_HEADERS),
  "1.2 ONLINE_ORDER_HEADERS is defined as array",
  "ONLINE_ORDER_HEADERS is undefined or not array");

assert(isHeadersDefined && ONLINE_ORDER_HEADERS.length === 15,
  "1.3 ONLINE_ORDER_HEADERS has exactly 15 columns",
  "Expected 15, got: " + (isHeadersDefined ? ONLINE_ORDER_HEADERS.length : 0));

let headersMatch = isHeadersDefined;
for (let i = 0; isHeadersDefined && i < expectedHeaders.length; i++) {
  if (ONLINE_ORDER_HEADERS[i] !== expectedHeaders[i]) {
    headersMatch = false;
    break;
  }
}
assert(headersMatch, "1.4 ONLINE_ORDER_HEADERS matches official specification",
  "Expected: " + JSON.stringify(expectedHeaders) + ", got: " + (isHeadersDefined ? JSON.stringify(ONLINE_ORDER_HEADERS) : "undefined"));

assert(typeof initOnlineOrdersSheet_ === "function",
  "1.5 initOnlineOrdersSheet_ helper function exists",
  "typeof initOnlineOrdersSheet_ is " + typeof initOnlineOrdersSheet_);

if (typeof initOnlineOrdersSheet_ === "function") {
  const createdSheet = initOnlineOrdersSheet_(currentSpreadsheet);
  assert(Boolean(createdSheet), "1.6 initOnlineOrdersSheet_ returns created sheet");
  assert(createdSheet.getName() === "OnlineOrders", "1.7 Created sheet name is 'OnlineOrders'");
  assert(createdSheet.getLastRow() === 1, "1.8 Created sheet has 1 header row");
  assert(createdSheet.getLastColumn() === 15, "1.9 Created sheet has 15 columns");
}

// -----------------------------------------------------------------------------
// Test Suite 2: submitOnlineOrder sukses dengan payload GoFood, GrabFood, ShopeeFood, Qpon
// -----------------------------------------------------------------------------
resetGasEnv();

const sampleItemsGofood = [
  { name: "Nasi Mandhi Kambing", qty: 2, price: 65000, station: "arabian" },
  { name: "Authentic Teh Tarik", qty: 2, price: 18000, station: "drinks" }
];

const postGofood = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "warung-berkah",
      platform: "gofood",
      platformRef: "GF-1001",
      customerName: "Dini Rahayu",
      customerPhone: "081298765432",
      driverInfo: { name: "Pak Budi", phone: "081311223344", plate: "B 1234 XYZ" },
      items: sampleItemsGofood,
      subtotal: 166000,
      packagingFee: 4000,
      totalAmount: 170000,
      specialNotes: "Sambal dhabah dipisah",
      status: "cooking"
    })
  }
});
const resGofood = parseResponse(postGofood);

assert(resGofood.success === true, "2.1 submitOnlineOrder GoFood returns success: true", resGofood.error || resGofood.message);
assert(typeof resGofood.orderId === "string" && resGofood.orderId.indexOf("ORD-GOFOOD-") === 0,
  "2.2 submitOnlineOrder generates ID starting with ORD-GOFOOD-",
  "Got orderId: " + resGofood.orderId);
assert(resGofood.status === "cooking", "2.3 submitOnlineOrder preserves status 'cooking'", "Got status: " + resGofood.status);

// Verify row inserted in sheet
const ooSheet = currentSpreadsheet.getSheetByName("OnlineOrders");
assert(Boolean(ooSheet), "2.4 OnlineOrders sheet exists in spreadsheet");
assert(ooSheet && ooSheet.getLastRow() === 2, "2.5 Sheet has 1 header + 1 data row", "getLastRow: " + (ooSheet ? ooSheet.getLastRow() : 0));

const row1 = ooSheet.getRange(2, 1, 1, 15).getValues()[0];
assert(row1[0] === resGofood.orderId, "2.6 Sheet row col 1 orderId matches", row1[0]);
assert(row1[1] === "warung-berkah", "2.7 Sheet row col 2 tenantId is 'warung-berkah'", row1[1]);
assert(row1[2] === "gofood", "2.8 Sheet row col 3 platform is 'gofood'", row1[2]);
assert(row1[3] === "GF-1001", "2.9 Sheet row col 4 platformRef is 'GF-1001'", row1[3]);
assert(row1[4] === "Dini Rahayu", "2.10 Sheet row col 5 customerName is 'Dini Rahayu'", row1[4]);
assert(Number(row1[8]) === 166000, "2.11 Sheet row col 9 subtotal is 166000", row1[8]);
assert(Number(row1[9]) === 4000, "2.12 Sheet row col 10 packagingFee is 4000", row1[9]);
assert(Number(row1[10]) === 170000, "2.13 Sheet row col 11 totalAmount is 170000", row1[10]);

// Test GrabFood, ShopeeFood, Qpon platforms
const platforms = [
  { platform: "grabfood", ref: "GB-2002", cust: "Hendra", amount: 152000 },
  { platform: "shopeefood", ref: "SF-3003", cust: "Maya", amount: 97000 },
  { platform: "qpon", ref: "QP-4004", cust: "Kevin", amount: 85000 }
];

for (let p of platforms) {
  const pPost = doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitOnlineOrder",
        tenantId: "warung-berkah",
        platform: p.platform,
        platformRef: p.ref,
        customerName: p.cust,
        items: [{ name: "Menu Item", qty: 1, price: p.amount }],
        totalAmount: p.amount,
        status: "new"
      })
    }
  });
  const pRes = parseResponse(pPost);
  assert(pRes.success === true, "2.14 submitOnlineOrder " + p.platform + " returns success", pRes.error);
  assert(pRes.orderId.indexOf("ORD-" + p.platform.toUpperCase() + "-") === 0,
    "2.15 " + p.platform + " ID prefix matches ORD-" + p.platform.toUpperCase() + "-",
    pRes.orderId);
}
assert(ooSheet.getLastRow() === 5, "2.16 Sheet has 4 orders recorded (total 5 rows)");

// -----------------------------------------------------------------------------
// Test Suite 3: Validasi error jika items kosong atau totalAmount tidak valid
// -----------------------------------------------------------------------------
const emptyItemsPost = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "warung-berkah",
      platform: "gofood",
      platformRef: "GF-EMPTY-01",
      customerName: "Tes Kosong",
      items: [],
      totalAmount: 50000
    })
  }
});
const emptyItemsRes = parseResponse(emptyItemsPost);
assert(emptyItemsRes.success === false, "3.1 submitOnlineOrder fails when items is empty array");

const invalidAmountPost = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "warung-berkah",
      platform: "gofood",
      platformRef: "GF-BAD-AMOUNT",
      customerName: "Tes Amount",
      items: [{ name: "Item", qty: 1, price: 10000 }],
      totalAmount: 0
    })
  }
});
const invalidAmountRes = parseResponse(invalidAmountPost);
assert(invalidAmountRes.success === false, "3.2 submitOnlineOrder fails when totalAmount <= 0");

const invalidPlatformPost = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "warung-berkah",
      platform: "unknown_delivery",
      platformRef: "UD-123",
      items: [{ name: "Item", qty: 1, price: 10000 }],
      totalAmount: 10000
    })
  }
});
const invalidPlatformRes = parseResponse(invalidPlatformPost);
assert(invalidPlatformRes.success === false, "3.3 submitOnlineOrder fails when platform is invalid");

// -----------------------------------------------------------------------------
// Test Suite 4: Pencegahan duplikasi jika platformRef sama dikirim ulang
// -----------------------------------------------------------------------------
resetGasEnv();

const firstSubmit = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "warung-berkah",
      platform: "gofood",
      platformRef: "GF-RETRY-999",
      customerName: "Pak Anton",
      items: [{ name: "Tom Yum", qty: 1, price: 55000 }],
      totalAmount: 55000,
      status: "cooking"
    })
  }
});
const firstRes = parseResponse(firstSubmit);
assert(firstRes.success === true, "4.1 Initial submit succeeds");
const initialOrderId = firstRes.orderId;

const sheetAfter1 = currentSpreadsheet.getSheetByName("OnlineOrders");
assert(sheetAfter1.getLastRow() === 2, "4.2 OnlineOrders has 1 data row");

// Retry with same platformRef and same tenantId
const retrySubmit = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "warung-berkah",
      platform: "gofood",
      platformRef: "GF-RETRY-999",
      customerName: "Pak Anton",
      items: [{ name: "Tom Yum", qty: 1, price: 55000 }],
      totalAmount: 55000,
      status: "cooking"
    })
  }
});
const retryRes = parseResponse(retrySubmit);
assert(retryRes.success === true, "4.3 Retry submit returns success: true");
assert(retryRes.orderId === initialOrderId, "4.4 Retry reuses existing orderId without regenerating new ID",
  "Expected: " + initialOrderId + ", got: " + retryRes.orderId);
assert(sheetAfter1.getLastRow() === 2, "4.5 Sheet still has exactly 1 data row (no duplicate row created)");

// Same platformRef on DIFFERENT tenant should create separate order
const differentTenantSubmit = doPost({
  postData: {
    contents: JSON.stringify({
      action: "submitOnlineOrder",
      tenantId: "resto-sedap",
      platform: "gofood",
      platformRef: "GF-RETRY-999",
      customerName: "Ibu Maria",
      items: [{ name: "Pad Thai", qty: 1, price: 48000 }],
      totalAmount: 48000,
      status: "cooking"
    })
  }
});
const diffRes = parseResponse(differentTenantSubmit);
assert(diffRes.success === true, "4.6 Same ref on different tenant succeeds");
assert(diffRes.orderId !== initialOrderId, "4.7 Generates different orderId for different tenant");
assert(sheetAfter1.getLastRow() === 3, "4.8 Sheet now has 2 distinct data rows for different tenants");

// -----------------------------------------------------------------------------
// Test Suite 5: getOnlineOrders mengembalikan daftar terfilter per tenantId dengan parse JSON items
// -----------------------------------------------------------------------------
const getWarungOrders = doGet({
  parameter: {
    action: "getOnlineOrders",
    tenantId: "warung-berkah"
  }
});
const warungRes = parseResponse(getWarungOrders);

assert(warungRes.success === true, "5.1 getOnlineOrders returns success: true", warungRes.error);
assert(Array.isArray(warungRes.orders), "5.2 orders property is an array");
assert(warungRes.orders.length === 1, "5.3 warung-berkah has exactly 1 order filtered", "Got: " + (warungRes.orders ? warungRes.orders.length : 0));

if (warungRes.orders && warungRes.orders.length > 0) {
  const o = warungRes.orders[0];
  assert(o.orderId === initialOrderId, "5.4 Filtered order ID matches initialOrderId");
  assert(o.tenantId === "warung-berkah", "5.5 Filtered order tenantId is 'warung-berkah'");
  assert(Array.isArray(o.items), "5.6 Order items is parsed as genuine Array (from itemsJson)");
  assert(o.items.length === 1 && o.items[0].name === "Tom Yum", "5.7 Parsed item content matches original payload");
}

const getSedapOrders = doGet({
  parameter: {
    action: "getOnlineOrders",
    tenantId: "resto-sedap"
  }
});
const sedapRes = parseResponse(getSedapOrders);
assert(sedapRes.success === true && sedapRes.orders.length === 1, "5.8 resto-sedap has 1 order filtered");
assert(sedapRes.orders[0].tenantId === "resto-sedap", "5.9 resto-sedap order matches tenant");

// -----------------------------------------------------------------------------
// Test Suite 6: updateOnlineOrderStatus memperbarui kolom status dan updatedAt
// -----------------------------------------------------------------------------
const updatePost = doPost({
  postData: {
    contents: JSON.stringify({
      action: "updateOnlineOrderStatus",
      orderId: initialOrderId,
      tenantId: "warung-berkah",
      status: "ready",
      driverInfo: { name: "Pak Anton Driver", phone: "081223344", plate: "B 9999 KDS" }
    })
  }
});
const updateRes = parseResponse(updatePost);
assert(updateRes.success === true, "6.1 updateOnlineOrderStatus returns success: true", updateRes.error);
assert(updateRes.status === "ready", "6.2 updateOnlineOrderStatus returned status is 'ready'");

// Verify in Sheet
const sheetCheck = currentSpreadsheet.getSheetByName("OnlineOrders");
const valuesCheck = sheetCheck.getDataRange().getValues();
const statusColIdx = ONLINE_ORDER_HEADERS.indexOf("status");
const updatedColIdx = ONLINE_ORDER_HEADERS.indexOf("updatedAt");

assert(statusColIdx !== -1 && updatedColIdx !== -1, "6.3 Header indexes for status and updatedAt exist");
assert(valuesCheck[1][statusColIdx] === "ready", "6.4 Sheet row status updated to 'ready'", valuesCheck[1][statusColIdx]);
assert(String(valuesCheck[1][updatedColIdx]).length > 0, "6.5 Sheet row updatedAt is filled with timestamp");

// Update non-existing order
const notFoundPost = doPost({
  postData: {
    contents: JSON.stringify({
      action: "updateOnlineOrderStatus",
      orderId: "ORD-NONEXISTING-1234",
      status: "completed"
    })
  }
});
const notFoundRes = parseResponse(notFoundPost);
assert(notFoundRes.success === false, "6.6 updateOnlineOrderStatus for unknown order returns success: false");

// -----------------------------------------------------------------------------
// Test Suite 7: Client RestoSync.submitOnlineOrder dan updateOnlineOrderStatus
//                memancarkan event ONLINE_ORDER_RECEIVED dan ONLINE_ORDER_STATUS_CHANGED
// -----------------------------------------------------------------------------
resetGasEnv();
localStorage.clear();

let receivedEventFired = false;
let receivedEventPayload = null;
let statusChangedEventFired = false;
let statusChangedEventPayload = null;

RestoSync.on("ONLINE_ORDER_RECEIVED", function (data) {
  receivedEventFired = true;
  receivedEventPayload = data;
});

RestoSync.on("ONLINE_ORDER_STATUS_CHANGED", function (data) {
  statusChangedEventFired = true;
  statusChangedEventPayload = data;
});

assert(typeof RestoSync.submitOnlineOrder === "function",
  "7.1 RestoSync.submitOnlineOrder function exists",
  "typeof RestoSync.submitOnlineOrder is " + typeof RestoSync.submitOnlineOrder);

assert(typeof RestoSync.updateOnlineOrderStatus === "function",
  "7.2 RestoSync.updateOnlineOrderStatus function exists",
  "typeof RestoSync.updateOnlineOrderStatus is " + typeof RestoSync.updateOnlineOrderStatus);

if (typeof RestoSync.submitOnlineOrder === "function") {
  // Execute submitOnlineOrder client-side
  let clientOrderPromise = RestoSync.submitOnlineOrder({
    tenantId: "tenant-client-test",
    platform: "gofood",
    platformRef: "GF-CLIENT-01",
    customerName: "Rina Kusuma",
    customerPhone: "08123450987",
    items: [{ name: "Nasi Lemak", qty: 2, price: 45000 }],
    subtotal: 90000,
    packagingFee: 3000,
    totalAmount: 93000,
    specialNotes: "Pakai sendok"
  });

  assert(receivedEventFired === true, "7.3 RestoSync.submitOnlineOrder emitted ONLINE_ORDER_RECEIVED");
  assert(receivedEventPayload && receivedEventPayload.platform === "gofood",
    "7.4 Event payload contains valid order data");

  // Check tenant local storage
  const tenantKey = "online_orders_tenant_tenant-client-test";
  const storedJson = localStorage.getItem(tenantKey);
  assert(Boolean(storedJson), "7.5 Order saved in localStorage under key: " + tenantKey);

  if (storedJson) {
    const parsedStored = JSON.parse(storedJson);
    assert(Array.isArray(parsedStored) && parsedStored.length === 1,
      "7.6 LocalStorage contains 1 order array");
  }

  // Execute updateOnlineOrderStatus client-side
  const createdId = receivedEventPayload ? receivedEventPayload.orderId : "ORD-UNKNOWN";
  RestoSync.updateOnlineOrderStatus(createdId, "ready", { tenantId: "tenant-client-test" });

  assert(statusChangedEventFired === true, "7.7 RestoSync.updateOnlineOrderStatus emitted ONLINE_ORDER_STATUS_CHANGED");
  assert(statusChangedEventPayload && statusChangedEventPayload.orderId === createdId && statusChangedEventPayload.status === "ready",
    "7.8 Status changed event payload contains orderId and updated status");

  // Check updated status in localStorage
  const updatedStored = JSON.parse(localStorage.getItem(tenantKey) || "[]");
  assert(updatedStored.length > 0 && updatedStored[0].status === "ready",
    "7.9 Order status in tenant localStorage updated to 'ready'");

  // Test RestoSync.getOnlineOrders(tenantId)
  const clientGet = RestoSync.getOnlineOrders("tenant-client-test");
  assert(Array.isArray(clientGet), "7.10 RestoSync.getOnlineOrders returns Array");
  assert(clientGet.length === 1 && clientGet[0].orderId === createdId,
    "7.11 RestoSync.getOnlineOrders retrieved cached orders for tenant");
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
print("===============================================================================");
print("HASIL: " + passedCount + " passed, " + failedCount + " failed, total " + (passedCount + failedCount));
print("===============================================================================");

if (failedCount > 0) {
  throw new Error("Terdapat " + failedCount + " pengujian gagal.");
}
