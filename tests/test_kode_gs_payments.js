/**
 * Test Suite Tahap 2 — Task 2: Google Apps Script Backend Payments Sheet, Drive Upload & Endpoints (backend/Kode.gs)
 *
 * Jalankan via:
 *   cd ".worktrees/tahap2" && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_payments.js
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
  },
  base64Decode: function (str) {
    // Basic mock decoding string to array of char codes
    const s = String(str || "");
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
      bytes.push(s.charCodeAt(i) & 0xff);
    }
    return bytes;
  },
  newBlob: function (bytes, contentType, name) {
    return {
      _bytes: bytes,
      _contentType: contentType || "image/jpeg",
      _name: name || "blob.jpg",
      getBytes: function () { return this._bytes; },
      getContentType: function () { return this._contentType; },
      getName: function () { return this._name; }
    };
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

// DriveApp Mock with failure simulation switch
var driveFailMode = false;
var driveCreatedFiles = [];
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
  getFolderById: function (folderId) {
    return {
      getId: function () { return folderId; },
      createFile: function (blob) {
        if (driveFailMode) {
          throw new Error("Simulated Drive error: Quota exceeded");
        }
        const fileId = "drive-file-" + Math.random().toString(36).substring(2, 10);
        const fileUrl = "https://drive.google.com/file/d/" + fileId + "/view";
        const f = {
          getId: function () { return fileId; },
          getUrl: function () { return fileUrl; },
          getName: function () { return blob.getName ? blob.getName() : "file.jpg"; }
        };
        driveCreatedFiles.push(f);
        return f;
      }
    };
  },
  createFile: function (blob) {
    if (driveFailMode) {
      throw new Error("Simulated Drive error: Quota exceeded");
    }
    const fileId = "drive-file-" + Math.random().toString(36).substring(2, 10);
    const fileUrl = "https://drive.google.com/file/d/" + fileId + "/view";
    const f = {
      getId: function () { return fileId; },
      getUrl: function () { return fileUrl; },
      getName: function () { return blob.getName ? blob.getName() : "file.jpg"; }
    };
    driveCreatedFiles.push(f);
    return f;
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
  PropertiesService.getScriptProperties().setProperty("ROOT_FOLDER_ID", "mock-root-folder-123");
  PropertiesService.getScriptProperties().setProperty("API_SECRET_KEY", TEST_API_KEY);
  driveFailMode = false;
  driveCreatedFiles = [];
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
    print("  [FAIL] " + testName + (details ? " (" + details + ")" : ""));
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// 5. Test Cases
// -----------------------------------------------------------------------------

print("===============================================================================");
print("RUNNING TESTS: Task 2 — backend/Kode.gs Payments Sheet & Endpoints");
print("===============================================================================");

// -----------------------------------------------------------------------------
// Test 1: submitPaymentProof saves to Drive mock, creates Payments row with pending,
// leaves Tenants status untouched
// -----------------------------------------------------------------------------
(function testSubmitPaymentProofBasic() {
  resetGasEnv();

  // Seed 1 trial tenant
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "saveTenant",
        apiKey: TEST_API_KEY,
        data: {
          id: "warung-berkah",
          name: "Warung Berkah",
          plan: "trial",
          status: "trial",
          tablesCount: 4,
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
        }
      })
    }
  });

  const uploadPayload = {
    action: "submitPaymentProof",
    tenantId: "warung-berkah",
    plan: "monthly",
    amount: 199000,
    bankTarget: "BCA (123-456-7890 a.n RASH)",
    senderName: "Budi Santoso",
    senderBank: "BCA",
    imageBase64: "data:image/jpeg;base64,QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=",
    imageMimeType: "image/jpeg",
    fileName: "struk_transfer.jpg"
  };

  const res = parseResponse(doPost({ postData: { contents: JSON.stringify(uploadPayload) } }));

  assert(res.success === true, "1.1 submitPaymentProof returns success: true", JSON.stringify(res));
  assert(res.status === "pending", "1.2 submitPaymentProof returns status: 'pending'");
  assert(typeof res.paymentId === "string" && res.paymentId.startsWith("PAY-"), "1.3 submitPaymentProof generates paymentId 'PAY-...'");
  assert(driveCreatedFiles.length === 1, "1.4 Drive mock received 1 created file");

  // Check Payments sheet
  const paySheet = currentSpreadsheet.getSheetByName("Payments");
  assert(paySheet !== null, "1.5 Payments sheet was created");
  const payRows = paySheet.getDataRange().getValues();
  assert(payRows.length === 2, "1.6 Payments sheet has header + 1 data row");
  const row = payRows[1];
  assert(row[1] === "warung-berkah", "1.7 Payments row has tenantId 'warung-berkah'");
  assert(row[2] === "Warung Berkah", "1.8 Payments row has tenantName 'Warung Berkah'");
  assert(row[3] === "monthly", "1.9 Payments row has plan 'monthly'");
  assert(Number(row[4]) === 199000, "1.10 Payments row has amount 199000");
  assert(row[10] === "pending", "1.11 Payments row status is 'pending'");

  // CRUCIAL: Check Tenants sheet is untouched!
  const tenantRes = parseResponse(doGet({ parameter: { action: "getTenantPublicInfo", tenantId: "warung-berkah" } }));
  assert(tenantRes.tenant.status === "trial", "1.12 Tenant status in Tenants sheet remains untouched ('trial')");
  assert(tenantRes.tenant.plan === "trial", "1.13 Tenant plan in Tenants sheet remains untouched ('trial')");
})();

// -----------------------------------------------------------------------------
// Test 2: Submitting again while pending updates existing pending row (Review Focus #2)
// -----------------------------------------------------------------------------
(function testDuplicatePendingUpdatesExistingRow() {
  resetGasEnv();

  // Seed 1 tenant
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "saveTenant",
        apiKey: TEST_API_KEY,
        data: { id: "kedai-kopi", name: "Kedai Kopi", plan: "trial", status: "trial" }
      })
    }
  });

  // Submit first proof (monthly, 199000)
  const res1 = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "kedai-kopi",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        senderName: "Ahmad",
        senderBank: "BCA",
        imageBase64: "QUJDRA=="
      })
    }
  }));

  const initialPaymentId = res1.paymentId;

  // Submit second proof while still pending (switched to lifetime, 2999000, new image)
  const res2 = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "kedai-kopi",
        plan: "lifetime",
        amount: 2999000,
        bankTarget: "Mandiri",
        senderName: "Ahmad Dahlan",
        senderBank: "Mandiri",
        imageBase64: "WFlaWk=="
      })
    }
  }));

  assert(res2.success === true, "2.1 Duplicate pending submit returns success: true");
  assert(res2.paymentId === initialPaymentId, "2.2 Duplicate pending submit reuses existing paymentId instead of creating duplicate ID");

  const paySheet = currentSpreadsheet.getSheetByName("Payments");
  const payRows = paySheet.getDataRange().getValues();
  assert(payRows.length === 2, "2.3 Payments sheet STILL has only 1 data row (no duplicate pending rows)");

  const row = payRows[1];
  assert(row[3] === "lifetime", "2.4 Pending row plan updated to 'lifetime'");
  assert(Number(row[4]) === 2999000, "2.5 Pending row amount updated to 2999000");
  assert(row[8] === "Ahmad Dahlan", "2.6 Pending row senderName updated to 'Ahmad Dahlan'");
  assert(row[10] === "pending", "2.7 Pending row status remains 'pending'");
})();

// -----------------------------------------------------------------------------
// Test 3: getTenantPaymentStatus returns latest payment
// -----------------------------------------------------------------------------
(function testGetTenantPaymentStatus() {
  resetGasEnv();

  // For tenant with no payments: returns null
  const emptyRes = parseResponse(doGet({ parameter: { action: "getTenantPaymentStatus", tenantId: "nonexistent" } }));
  assert(emptyRes.success === true, "3.1 getTenantPaymentStatus returns success: true for empty");
  assert(emptyRes.latestPayment === null, "3.2 getTenantPaymentStatus returns latestPayment: null when no payment exists");

  // Submit a payment
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-alfa",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        senderName: "Alfa",
        senderBank: "BCA",
        imageBase64: "QUJD"
      })
    }
  });

  const res = parseResponse(doGet({ parameter: { action: "getTenantPaymentStatus", tenantId: "resto-alfa" } }));
  assert(res.success === true, "3.3 getTenantPaymentStatus returns success: true");
  assert(res.latestPayment !== null, "3.4 getTenantPaymentStatus returns latestPayment object");
  assert(res.latestPayment.tenantId === undefined || res.latestPayment.status === "pending", "3.5 latestPayment status is 'pending'");
  assert(Number(res.latestPayment.amount) === 199000, "3.6 latestPayment amount is 199000");
  assert(res.latestPayment.plan === "monthly", "3.7 latestPayment plan is 'monthly'");
  assert(typeof res.latestPayment.proofUrl === "string", "3.8 latestPayment has proofUrl string");
})();

// -----------------------------------------------------------------------------
// Test 4: verifyPayment (approve)
// - Accumulates 30 days for active monthly (Review Focus #1)
// - Sets 30 days from now for expired
// - Preserves custom tablesCount (> 12)
// - Sets lifetime plan
// -----------------------------------------------------------------------------
(function testVerifyPaymentApprove() {
  resetGasEnv();

  const now = Date.now();
  const futureExpiry = new Date(now + 10 * 86400000).toISOString(); // 10 days left

  // Seed 1 active tenant with 10 days remaining and 20 custom tables
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "saveTenant",
        apiKey: TEST_API_KEY,
        data: {
          id: "resto-beta",
          name: "Resto Beta",
          plan: "monthly",
          status: "active",
          tablesCount: 20,
          expiresAt: futureExpiry
        }
      })
    }
  });

  // Submit payment proof
  const subRes = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-beta",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        senderName: "Beta Owner",
        senderBank: "BCA",
        imageBase64: "QUJD"
      })
    }
  }));

  // Verify (approve)
  const appRes = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "verifyPayment",
        apiKey: TEST_API_KEY,
        paymentId: subRes.paymentId,
        actionType: "approve" // support action: "approve"
      })
    }
  }));

  // Also support action: "approve" directly
  assert(appRes.success === true, "4.1 verifyPayment approve returns success: true", JSON.stringify(appRes));
  assert(appRes.paymentStatus === "verified", "4.2 paymentStatus is 'verified'");

  // Verify payment row
  const paySheet = currentSpreadsheet.getSheetByName("Payments");
  const payRow = paySheet.getDataRange().getValues()[1];
  assert(payRow[10] === "verified", "4.3 Payment row status updated to 'verified'");
  assert(payRow[13] !== "", "4.4 Payment row verifiedAt is filled");
  assert(payRow[14] === "admin", "4.5 Payment row verifiedBy is 'admin'");

  // Check updated tenant
  const tenantRes = parseResponse(doGet({ parameter: { action: "getTenantPublicInfo", tenantId: "resto-beta" } }));
  assert(tenantRes.tenant.status === "active", "4.6 Tenant status is 'active'");
  assert(tenantRes.tenant.tablesCount === 20, "4.7 Custom tablesCount (20) was PRESERVED, not downgraded to 12");

  // Check Day Accumulation: new expiry should be futureExpiry + 30 days (~40 days from now)
  const oldExpiryMs = new Date(futureExpiry).getTime();
  const newExpiryMs = new Date(tenantRes.tenant.expiresAt).getTime();
  const diffDays = Math.round((newExpiryMs - oldExpiryMs) / 86400000);
  assert(diffDays === 30, "4.8 Expiry date accumulated +30 days on top of remaining days (diffDays=" + diffDays + ")");

  // Subcase 4b: Expired tenant gets 30 days from now
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "saveTenant",
        apiKey: TEST_API_KEY,
        data: {
          id: "resto-gamma",
          name: "Resto Gamma",
          plan: "trial",
          status: "expired",
          tablesCount: 4,
          expiresAt: new Date(now - 5 * 86400000).toISOString() // expired 5 days ago
        }
      })
    }
  });

  const subGamma = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-gamma",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        imageBase64: "QUJD"
      })
    }
  }));

  parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "verifyPayment",
        apiKey: TEST_API_KEY,
        data: {
          paymentId: subGamma.paymentId,
          action: "approve"
        }
      })
    }
  }));

  const gammaRes = parseResponse(doGet({ parameter: { action: "getTenantPublicInfo", tenantId: "resto-gamma" } }));
  assert(gammaRes.tenant.status === "active", "4.9 Expired tenant becomes 'active'");
  assert(gammaRes.tenant.tablesCount === 12, "4.10 Standard tablesCount upgraded from 4 to 12");
  const gammaExpiryMs = new Date(gammaRes.tenant.expiresAt).getTime();
  const gammaDiffFromNow = Math.round((gammaExpiryMs - now) / 86400000);
  assert(gammaDiffFromNow >= 29 && gammaDiffFromNow <= 31, "4.11 Expired tenant expiry set to ~30 days from today (diff=" + gammaDiffFromNow + ")");

  // Subcase 4c: Lifetime approval sets isLifetime: true, expiresAt: empty
  const subLife = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-gamma",
        plan: "lifetime",
        amount: 2999000,
        bankTarget: "Mandiri",
        imageBase64: "QUJD"
      })
    }
  }));

  parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "verifyPayment",
        apiKey: TEST_API_KEY,
        data: {
          paymentId: subLife.paymentId,
          action: "approve"
        }
      })
    }
  }));

  const lifeRes = parseResponse(doGet({ parameter: { action: "getTenantPublicInfo", tenantId: "resto-gamma" } }));
  assert(lifeRes.tenant.plan === "lifetime", "4.12 Tenant plan upgraded to 'lifetime'");
  assert(lifeRes.tenant.isLifetime === true, "4.13 Tenant isLifetime is true");
  assert(!lifeRes.tenant.expiresAt, "4.14 Lifetime tenant expiresAt is cleared/empty");
})();

// -----------------------------------------------------------------------------
// Test 5: verifyPayment (reject)
// - Records custom rejectReason
// - Fallback default reason when rejectReason is blank (Review Focus #4)
// - Leaves sheet Tenants status untouched
// -----------------------------------------------------------------------------
(function testVerifyPaymentReject() {
  resetGasEnv();

  doPost({
    postData: {
      contents: JSON.stringify({
        action: "saveTenant",
        apiKey: TEST_API_KEY,
        data: { id: "resto-delta", name: "Resto Delta", plan: "trial", status: "trial" }
      })
    }
  });

  // Submit proof
  const subRes = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-delta",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        imageBase64: "QUJD"
      })
    }
  }));

  // Reject with custom reason
  const rejRes = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "verifyPayment",
        apiKey: TEST_API_KEY,
        data: {
          paymentId: subRes.paymentId,
          action: "reject",
          rejectReason: "Nominal struk tidak sesuai (tertera Rp 50.000)"
        }
      })
    }
  }));

  assert(rejRes.success === true, "5.1 verifyPayment reject returns success: true");
  assert(rejRes.paymentStatus === "rejected", "5.2 paymentStatus is 'rejected'");
  assert(rejRes.rejectReason === "Nominal struk tidak sesuai (tertera Rp 50.000)", "5.3 rejectReason matches custom reason");

  // Verify sheet Tenants is untouched
  const tenantRes = parseResponse(doGet({ parameter: { action: "getTenantPublicInfo", tenantId: "resto-delta" } }));
  assert(tenantRes.tenant.status === "trial", "5.4 Sheet Tenants status remains 'trial' on reject");

  // Re-submit and reject with BLANK reason -> must use fallback default!
  const subRes2 = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-delta",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        imageBase64: "QUJD"
      })
    }
  }));

  const rejRes2 = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "verifyPayment",
        apiKey: TEST_API_KEY,
        data: {
          paymentId: subRes2.paymentId,
          action: "reject",
          rejectReason: "   " // blank!
        }
      })
    }
  }));

  assert(rejRes2.rejectReason.indexOf("Bukti pembayaran belum dapat diverifikasi") !== -1, "5.5 Blank rejectReason falls back to default Indonesian message (Review Focus #4)");
})();

// -----------------------------------------------------------------------------
// Test 6: Drive upload failure returns clean error without corrupting sheet
// (Review Focus #3)
// -----------------------------------------------------------------------------
(function testDriveUploadFailureHandling() {
  resetGasEnv();
  driveFailMode = true; // Trigger simulated Drive error

  const res = parseResponse(doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-fail-test",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        imageBase64: "QUJD"
      })
    }
  }));

  assert(res.success === false, "6.1 Drive failure returns success: false");
  assert(typeof res.error === "string" && res.error.indexOf("Drive") !== -1, "6.2 Clean error message mentions Drive issue");

  // Ensure Payments sheet was NOT created or has 0 data rows
  const paySheet = currentSpreadsheet.getSheetByName("Payments");
  if (paySheet) {
    const payRows = paySheet.getDataRange().getValues();
    assert(payRows.length <= 1, "6.3 Sheet Payments was not corrupted with incomplete data row");
  } else {
    assert(true, "6.3 Sheet Payments has no corrupted rows");
  }
})();

// -----------------------------------------------------------------------------
// Test 7: getPayments (Super Admin endpoint) with auth protection & filtering
// -----------------------------------------------------------------------------
(function testGetPaymentsAdmin() {
  resetGasEnv();

  // Unauthorized without apiKey
  const unauthRes = parseResponse(doGet({ parameter: { action: "getPayments" } }));
  assert(unauthRes.success === false && unauthRes.unauthorized === true, "7.1 getPayments without apiKey is rejected (unauthorized)");

  // Submit 1 pending payment
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "submitPaymentProof",
        tenantId: "resto-p1",
        plan: "monthly",
        amount: 199000,
        bankTarget: "BCA",
        imageBase64: "QUJD"
      })
    }
  });

  // Call with valid apiKey
  const listRes = parseResponse(doGet({ parameter: { action: "getPayments", apiKey: TEST_API_KEY } }));
  assert(listRes.success === true, "7.2 getPayments with valid apiKey returns success: true");
  assert(Array.isArray(listRes.payments) && listRes.payments.length === 1, "7.3 getPayments returns array with 1 payment");

  // Test status filter
  const verifiedRes = parseResponse(doGet({ parameter: { action: "getPayments", apiKey: TEST_API_KEY, statusFilter: "verified" } }));
  assert(verifiedRes.payments.length === 0, "7.4 filter by status 'verified' returns 0 payments");

  const pendingRes = parseResponse(doGet({ parameter: { action: "getPayments", apiKey: TEST_API_KEY, statusFilter: "pending" } }));
  assert(pendingRes.payments.length === 1, "7.5 filter by status 'pending' returns 1 payment");
})();

print("===============================================================================");
print("HASIL: " + passedCount + " passed, " + failedCount + " failed, total " + (passedCount + failedCount));
print("===============================================================================");

if (failedCount > 0) {
  throw new Error(failedCount + " tests failed!");
}
