/**
 * Test Suite Tahap 1 — Task 2: Google Apps Script Backend Tenants Sheet & Endpoints (backend/Kode.gs)
 *
 * Jalankan via:
 *   cd ".worktrees/tahap1" && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_tenants.js
 */

// -----------------------------------------------------------------------------
// 1. Browser Stubs agar assets/js/resto-sync.js dapat di-load oleh JSC
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
var window = { location: { search: "" } };
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
    return currentSpreadsheet;
  },
  getActiveSpreadsheet: function () {
    return currentSpreadsheet;
  },
  create: function (name) {
    currentSpreadsheet = createMockSpreadsheet("new-ss-" + Date.now());
    return currentSpreadsheet;
  }
};

var DriveApp = {
  createFolder: function (name) {
    return {
      getId: function () { return "folder-" + Math.random().toString(36).substring(2, 8); },
      getUrl: function () { return "https://drive.google.com/folder"; },
      createFolder: function () {
        return {
          getId: function () { return "subfolder-" + Math.random().toString(36).substring(2, 8); }
        };
      }
    };
  },
  getFileById: function () {
    return {
      moveTo: function () {}
    };
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
  PropertiesService.getScriptProperties().setProperty("API_SECRET_KEY", TEST_API_KEY);
}

function parseResponse(output) {
  if (!output || typeof output.getContent !== "function") {
    throw new Error("Invalid output object from doGet/doPost: " + JSON.stringify(output));
  }
  return JSON.parse(output.getContent());
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "Mismatch") + " — expected: " + JSON.stringify(expected) + ", actual: " + JSON.stringify(actual));
  }
}

// -----------------------------------------------------------------------------
// 5. Test Cases
// -----------------------------------------------------------------------------
const tests = [];

tests.push({
  name: "1. doGet getTenantPublicInfo for unknown tenant returns notFound: true, cloudInitialized: false",
  fn: function () {
    resetGasEnv();
    const res = parseResponse(doGet({
      parameter: {
        action: "getTenantPublicInfo",
        tenantId: "unknown-tenant"
      }
    }));
    assertEqual(res.success, true, "res.success must be true");
    assertEqual(res.notFound, true, "res.notFound must be true");
    assertEqual(res.cloudInitialized, false, "res.cloudInitialized must be false initially");
  }
});

tests.push({
  name: "2. doPost saveTenant without apiKey returns unauthorized: true; with valid apiKey saves tenant and sets TENANTS_CLOUD_INITIALIZED='true'",
  fn: function () {
    resetGasEnv();

    // Unauthorized attempt
    const unauthRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "saveTenant",
          data: { id: "warung-test", name: "Warung Test", cashierPin: "1234", ownerPin: "5678" }
        })
      }
    }));
    assertEqual(unauthRes.success, false, "unauthRes.success must be false");
    assertEqual(unauthRes.unauthorized, true, "unauthRes.unauthorized must be true");

    // Authorized attempt
    const authRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "saveTenant",
          apiKey: TEST_API_KEY,
          data: {
            id: "warung-test",
            name: "Warung Test",
            pic: "Pak Budi",
            phone: "08123456789",
            cashierPhone: "081299998888",
            cashierPin: "1234",
            ownerPin: "5678",
            city: "Bandung",
            plan: "monthly",
            planName: "Paket Bulanan",
            price: 199000,
            originalPrice: 199000,
            billingCycle: "monthly",
            tablesCount: 15,
            status: "active",
            isLifetime: false,
            expiresAt: "2026-12-31T23:59:59.000Z",
            apiKey: "custom-tenant-key"
          }
        })
      }
    }));
    assertEqual(authRes.success, true, "authRes.success must be true");

    // Verify TENANTS_CLOUD_INITIALIZED in Script Properties
    const initProp = PropertiesService.getScriptProperties().getProperty("TENANTS_CLOUD_INITIALIZED");
    assertEqual(initProp, "true", "TENANTS_CLOUD_INITIALIZED must be set to 'true'");

    // Verify row was written to sheet 'Tenants'
    const sheet = currentSpreadsheet.getSheetByName("Tenants");
    assert(sheet !== null, "Sheet 'Tenants' must exist");
    assert(sheet.getLastRow() >= 2, "Sheet 'Tenants' must contain headers + at least 1 data row");
  }
});

tests.push({
  name: "3. doGet getTenantPublicInfo for saved tenant returns hashes & plan, strips plaintext PINs, phones, and custom apiKey",
  fn: function () {
    // Continues after test 2
    const res = parseResponse(doGet({
      parameter: {
        action: "getTenantPublicInfo",
        tenantId: "warung-test"
      }
    }));

    assertEqual(res.success, true, "res.success must be true");
    assertEqual(res.cloudInitialized, true, "res.cloudInitialized must be true after save");
    assert(res.tenant !== undefined && res.tenant !== null, "res.tenant must exist");

    const t = res.tenant;
    assertEqual(t.id, "warung-test", "tenant id match");
    assertEqual(t.name, "Warung Test", "tenant name match");
    assertEqual(t.plan, "monthly", "tenant plan match");
    assertEqual(t.status, "active", "tenant status match");
    assertEqual(t.tablesCount, 15, "tenant tablesCount match");
    assertEqual(t.isLifetime, false, "tenant isLifetime match");
    assertEqual(t.expiresAt, "2026-12-31T23:59:59.000Z", "tenant expiresAt match");

    // Check PIN hashes
    const expectedCashierHash = RestoSync.hashTenantPin("warung-test", "1234");
    const expectedOwnerHash = RestoSync.hashTenantPin("warung-test", "5678");
    assertEqual(t.cashierPinHash, expectedCashierHash, "cashierPinHash must match RestoSync.hashTenantPin");
    assertEqual(t.ownerPinHash, expectedOwnerHash, "ownerPinHash must match RestoSync.hashTenantPin");

    // SECURITY VERIFICATION: Plaintext PINs, phones, and custom apiKey MUST BE UNDEFINED!
    assertEqual(t.cashierPin, undefined, "cashierPin must be undefined (stripped)");
    assertEqual(t.ownerPin, undefined, "ownerPin must be undefined (stripped)");
    assertEqual(t.phone, undefined, "phone must be undefined (stripped)");
    assertEqual(t.cashierPhone, undefined, "cashierPhone must be undefined (stripped)");
    assertEqual(t.apiKey, undefined, "apiKey must be undefined (stripped)");
  }
});

tests.push({
  name: "4. doGet getTenants without apiKey returns unauthorized: true; with valid apiKey returns all rows",
  fn: function () {
    // Unauthorized
    const unauth = parseResponse(doGet({
      parameter: {
        action: "getTenants"
      }
    }));
    assertEqual(unauth.success, false, "unauth.success must be false");
    assertEqual(unauth.unauthorized, true, "unauth.unauthorized must be true");

    // Authorized
    const auth = parseResponse(doGet({
      parameter: {
        action: "getTenants",
        apiKey: TEST_API_KEY
      }
    }));
    assertEqual(auth.success, true, "auth.success must be true");
    assertEqual(auth.cloudInitialized, true, "auth.cloudInitialized must be true");

    const list = Array.isArray(auth.tenants) ? auth.tenants : auth.data;
    assert(Array.isArray(list), "tenants must be an array");
    assertEqual(list.length, 1, "must have 1 saved tenant");
    assertEqual(list[0].id, "warung-test", "tenant id match");
  }
});

tests.push({
  name: "5. doPost registerTrialTenant auto-suffixes duplicate slug, enforces trial plan & 4 tables without modifying existing row",
  fn: function () {
    // 5a. Save initial "Kopi Senja" as an active monthly tenant
    const saveRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "saveTenant",
          apiKey: TEST_API_KEY,
          data: {
            id: "kopi-senja",
            name: "Kopi Senja Heritage",
            plan: "monthly",
            status: "active",
            tablesCount: 20,
            price: 199000,
            isLifetime: false
          }
        })
      }
    }));
    assertEqual(saveRes.success, true, "save initial kopi-senja");

    // 5b. Public self-serve register trial with name "Kopi Senja" (no apiKey required)
    const regRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "registerTrialTenant",
          data: {
            id: "kopi-senja",
            name: "Kopi Senja",
            pic: "Barista Baru",
            cashierPin: "4321",
            ownerPin: "8765",
            // Attempt to maliciously inject lifetime/enterprise plan in self-serve trial
            plan: "lifetime",
            status: "active",
            price: 999999,
            tablesCount: 50,
            isLifetime: true
          }
        })
      }
    }));

    assertEqual(regRes.success, true, "registerTrialTenant must succeed publicly");
    assert(regRes.tenant !== undefined, "regRes.tenant must exist");
    const trial = regRes.tenant;

    // Enforced trial properties
    assert(trial.id !== "kopi-senja", "New trial must not overwrite existing kopi-senja ID");
    assert(trial.id.indexOf("kopi-senja-") === 0, "New trial ID must have prefix 'kopi-senja-'");
    assertEqual(trial.plan, "trial", "plan must be enforced to 'trial'");
    assertEqual(trial.status, "trial", "status must be enforced to 'trial'");
    assertEqual(trial.price, 0, "price must be enforced to 0");
    assertEqual(trial.isLifetime, false, "isLifetime must be false");
    assertEqual(trial.tablesCount, 4, "tablesCount must be enforced to 4");

    // Hash calculation must use the new generated slug
    const expectedCashierHash = RestoSync.hashTenantPin(trial.id, "4321");
    const expectedOwnerHash = RestoSync.hashTenantPin(trial.id, "8765");
    assertEqual(trial.cashierPinHash, expectedCashierHash, "cashierPinHash must use unique final slug");
    assertEqual(trial.ownerPinHash, expectedOwnerHash, "ownerPinHash must use unique final slug");

    // Verify existing 'kopi-senja' was NOT modified
    const origInfo = parseResponse(doGet({
      parameter: {
        action: "getTenantPublicInfo",
        tenantId: "kopi-senja"
      }
    }));
    assertEqual(origInfo.tenant.id, "kopi-senja", "Original kopi-senja id preserved");
    assertEqual(origInfo.tenant.plan, "monthly", "Original kopi-senja plan preserved");
    assertEqual(origInfo.tenant.tablesCount, 20, "Original kopi-senja tablesCount preserved");
  }
});

tests.push({
  name: "6. doPost deleteTenant removes row, leaving cloudInitialized: true and getTenants empty without auto-reseed",
  fn: function () {
    // Delete all current tenants
    const del1 = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "deleteTenant",
          apiKey: TEST_API_KEY,
          data: { id: "warung-test" }
        })
      }
    }));
    assertEqual(del1.success, true, "warung-test deleted");

    const del2 = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "deleteTenant",
          apiKey: TEST_API_KEY,
          data: { id: "kopi-senja" }
        })
      }
    }));
    assertEqual(del2.success, true, "kopi-senja deleted");

    // Also delete any trial slug generated in test 5
    const all = parseResponse(doGet({
      parameter: { action: "getTenants", apiKey: TEST_API_KEY }
    }));
    const remaining = Array.isArray(all.tenants) ? all.tenants : all.data;
    remaining.forEach(t => {
      parseResponse(doPost({
        postData: {
          contents: JSON.stringify({
            action: "deleteTenant",
            apiKey: TEST_API_KEY,
            data: { id: t.id }
          })
        }
      }));
    });

    // Subsequent getTenantPublicInfo returns notFound: true, cloudInitialized: true
    const checkInfo = parseResponse(doGet({
      parameter: { action: "getTenantPublicInfo", tenantId: "warung-test" }
    }));
    assertEqual(checkInfo.success, true, "checkInfo.success is true");
    assertEqual(checkInfo.notFound, true, "checkInfo.notFound is true");
    assertEqual(checkInfo.cloudInitialized, true, "cloudInitialized MUST BE true after delete!");

    // Subsequent getTenants returns [] without auto-reseeding dummy rows
    const checkAll = parseResponse(doGet({
      parameter: { action: "getTenants", apiKey: TEST_API_KEY }
    }));
    const finalList = Array.isArray(checkAll.tenants) ? checkAll.tenants : checkAll.data;
    assertEqual(finalList.length, 0, "final tenants list must be empty []");
  }
});

tests.push({
  name: "7. hashTenantPin_ in Kode.gs matches RestoSync.hashTenantPin identically",
  fn: function () {
    const testCases = [
      { id: "harapan-corner", pin: "1234" },
      { id: "kopi-senja", pin: "4321" },
      { id: "warung-bu-siti", pin: "9999" },
      { id: "", pin: "1234" },
      { id: "custom-tenant", pin: "" }
    ];

    testCases.forEach(tc => {
      const frontendHash = RestoSync.hashTenantPin(tc.id, tc.pin);
      const backendHash = hashTenantPin_(tc.id, tc.pin);
      assertEqual(backendHash, frontendHash, "Hash mismatch for " + tc.id + ":" + tc.pin);
    });
  }
});

tests.push({
  name: "8. saveTenant update preserves existing cashierPinHash and ownerPinHash when update omits plaintext PINs",
  fn: function () {
    resetGasEnv();

    // 1. Initial save with PINs
    parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "saveTenant",
          apiKey: TEST_API_KEY,
          data: {
            id: "resto-alpha",
            name: "Resto Alpha",
            cashierPin: "1111",
            ownerPin: "2222",
            plan: "monthly"
          }
        })
      }
    }));

    const initialInfo = parseResponse(doGet({
      parameter: { action: "getTenantPublicInfo", tenantId: "resto-alpha" }
    }));
    const initialCashierHash = initialInfo.tenant.cashierPinHash;
    const initialOwnerHash = initialInfo.tenant.ownerPinHash;

    // 2. Update without cashierPin or ownerPin
    parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "saveTenant",
          apiKey: TEST_API_KEY,
          data: {
            id: "resto-alpha",
            name: "Resto Alpha Renovated",
            tablesCount: 25
          }
        })
      }
    }));

    const updatedInfo = parseResponse(doGet({
      parameter: { action: "getTenantPublicInfo", tenantId: "resto-alpha" }
    }));
    assertEqual(updatedInfo.tenant.name, "Resto Alpha Renovated", "name updated");
    assertEqual(updatedInfo.tenant.tablesCount, 25, "tablesCount updated");
    assertEqual(updatedInfo.tenant.cashierPinHash, initialCashierHash, "cashierPinHash must be preserved");
    assertEqual(updatedInfo.tenant.ownerPinHash, initialOwnerHash, "ownerPinHash must be preserved");
  }
});

tests.push({
  name: "9. Real Google Sheets Cell Coercion: handles numeric id (2026), uppercase isLifetime ('TRUE'), and uncoerced cells",
  fn: function () {
    resetGasEnv();
    const sheet = currentSpreadsheet.insertSheet("Tenants");
    sheet.appendRow(TENANT_HEADERS);

    // Simulate Google Sheets returning raw cells:
    // row 2: id is numeric 2026, phone is numeric, isLifetime is uppercase string 'TRUE', tablesCount is string '12'
    sheet.appendRow([
      2026,
      "Resto 2026",
      "Pak Joko",
      8123456789,
      8129999999,
      RestoSync.hashTenantPin("2026", "1234"),
      RestoSync.hashTenantPin("2026", "1234"),
      "Jakarta",
      "monthly",
      "Paket Bulanan",
      199000,
      199000,
      "monthly",
      12,
      "active",
      "TRUE",
      "2026-01-01T00:00:00.000Z",
      "",
      "2026-01-01T00:00:00.000Z",
      "",
      "custom-secret",
      "RP-MTH-2026"
    ]);

    // Mark cloud as initialized
    PropertiesService.getScriptProperties().setProperty("TENANTS_CLOUD_INITIALIZED", "true");

    // 1. Query getTenantPublicInfo with string "2026"
    const resString = parseResponse(doGet({
      parameter: { action: "getTenantPublicInfo", tenantId: "2026" }
    }));
    assertEqual(resString.success, true, "resString.success must be true");
    assertEqual(resString.notFound, undefined, "resString should find the tenant");
    assert(resString.tenant !== undefined, "tenant must be found");
    assertEqual(typeof resString.tenant.id, "string", "tenant.id must be coerced to string");
    assertEqual(resString.tenant.id, "2026", "tenant.id value must be '2026'");
    assertEqual(resString.tenant.isLifetime, true, "isLifetime 'TRUE' must be normalized to boolean true");

    // 2. Query getTenantPublicInfo with numeric 2026 in parameter
    const resNum = parseResponse(doGet({
      parameter: { action: "getTenantPublicInfo", tenantId: 2026 }
    }));
    assertEqual(resNum.success, true, "resNum.success must be true");
    assertEqual(resNum.tenant.id, "2026", "tenant.id must match");

    // 3. Query getTenants
    const allRes = parseResponse(doGet({
      parameter: { action: "getTenants", apiKey: TEST_API_KEY }
    }));
    assertEqual(allRes.success, true, "allRes.success must be true");
    const t0 = (allRes.tenants || allRes.data)[0];
    assertEqual(typeof t0.id, "string", "getTenants tenant.id must be string");
    assertEqual(typeof t0.phone, "string", "getTenants phone must be string");
    assertEqual(t0.phone, "8123456789", "phone string value match");
    assertEqual(t0.isLifetime, true, "getTenants isLifetime must be boolean true");

    // 4. Update existing tenant 2026 with saveTenant (should update row, not insert a duplicate!)
    const saveRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "saveTenant",
          apiKey: TEST_API_KEY,
          data: {
            id: 2026,
            name: "Resto 2026 Renovated",
            isLifetime: "TRUE"
          }
        })
      }
    }));
    assertEqual(saveRes.success, true, "saveRes.success must be true");
    assertEqual(sheet.getLastRow(), 2, "Sheet must still have exactly 2 rows (header + 1 tenant), no duplicate inserted!");

    // 5. Test registerTrialTenant collision with name "2026"
    const regRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "registerTrialTenant",
          data: {
            name: 2026
          }
        })
      }
    }));
    assertEqual(regRes.success, true, "regRes.success must be true");
    assert(regRes.tenant.id !== "2026", "slug collision must be resolved");
    assert(regRes.tenant.id.indexOf("2026-") === 0, "new trial id must prefix with '2026-'");

    // 6. Delete tenant 2026
    const delRes = parseResponse(doPost({
      postData: {
        contents: JSON.stringify({
          action: "deleteTenant",
          apiKey: TEST_API_KEY,
          data: { id: 2026 }
        })
      }
    }));
    assertEqual(delRes.success, true, "delRes.success must be true");
    const checkDeleted = parseResponse(doGet({
      parameter: { action: "getTenantPublicInfo", tenantId: "2026" }
    }));
    assertEqual(checkDeleted.notFound, true, "tenant 2026 must be deleted");
  }
});

// -----------------------------------------------------------------------------
// 6. Test Runner
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

print("===============================================================================");
print("RUNNING TESTS: Task 2 — backend/Kode.gs Tenants Sheet & Endpoints");
print("===============================================================================");

for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  try {
    t.fn();
    print("  [PASS] " + t.name);
    passed++;
  } catch (err) {
    print("  [FAIL] " + t.name);
    print("         Error: " + (err && err.message ? err.message : String(err)));
    if (err && err.stack) print("         Stack: " + err.stack);
    failed++;
  }
}

print("===============================================================================");
print("HASIL: " + passed + " passed, " + failed + " failed, total " + tests.length);
print("===============================================================================");

if (failed > 0) {
  throw new Error(failed + " test(s) failed in test_kode_gs_tenants.js");
}
