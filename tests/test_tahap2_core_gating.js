/**
 * Test Suite Tahap 2 — Core Engine Gating Fitur Pro & Client API Pembayaran
 * (assets/js/resto-sync.js)
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap2_core_gating.js
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
  const attrs = Object.create(null);
  const classes = new Set();
  let _innerHTML = "";

  const el = {
    tagName: String(tagName || "div").toUpperCase(),
    _id: "",
    get id() { return this._id; },
    set id(val) {
      if (this._id && ownerDoc && ownerDoc._byId[this._id] === this) {
        delete ownerDoc._byId[this._id];
      }
      this._id = String(val || "");
      if (this._id && ownerDoc) {
        ownerDoc._byId[this._id] = this;
      }
    },
    className: "",
    textContent: "",
    children: [],
    parentNode: null,
    onclick: null,
    get innerHTML() {
      return _innerHTML;
    },
    set innerHTML(val) {
      _innerHTML = String(val || "");
      // Mini regex to parse elements with id, class, href inside mock DOM
      const tagRegex = /<([a-zA-Z0-9\-]+)([^>]*)>/g;
      let match;
      while ((match = tagRegex.exec(_innerHTML)) !== null) {
        const tag = match[1];
        const attrStr = match[2];
        const idMatch = /id=["']([^"']+)["']/.exec(attrStr);
        if (idMatch && idMatch[1]) {
          const childId = idMatch[1];
          let childEl = ownerDoc._byId[childId];
          if (!childEl) {
            childEl = createMockElement(tag, ownerDoc);
            childEl.id = childId;
            childEl.parentNode = this;
            this.children.push(childEl);
          }
          const hrefMatch = /href=["']([^"']+)["']/.exec(attrStr);
          if (hrefMatch && hrefMatch[1]) {
            childEl.setAttribute("href", hrefMatch[1]);
          }
          const onclickMatch = /onclick=["']([^"']+)["']/.exec(attrStr);
          if (onclickMatch && onclickMatch[1]) {
            childEl.setAttribute("onclick", onclickMatch[1]);
          }
        }
      }
    },
    setAttribute(k, v) {
      attrs[k] = String(v);
      if (k === "id") this.id = v;
      if (k === "href") this.href = String(v);
    },
    getAttribute(k) {
      if (k === "href" && this.href) return this.href;
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); }
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (child.id && ownerDoc) ownerDoc._byId[child.id] = child;
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      child.parentNode = null;
      if (child.id && ownerDoc && ownerDoc._byId[child.id] === child) {
        delete ownerDoc._byId[child.id];
      }
      return child;
    },
    querySelector(selector) {
      if (selector.startsWith("#")) {
        const targetId = selector.substring(1);
        if (this.id === targetId) return this;
        if (ownerDoc && ownerDoc._byId[targetId]) return ownerDoc._byId[targetId];
      }
      for (let i = 0; i < this.children.length; i++) {
        const found = this.children[i].querySelector(selector);
        if (found) return found;
      }
      return null;
    },
    click() {
      if (typeof this.onclick === "function") {
        this.onclick({ preventDefault: function () {} });
      } else if (attrs["onclick"]) {
        const code = attrs["onclick"];
        try {
          const fn = new Function("event", code);
          fn.call(this, { preventDefault: function () {} });
        } catch (e) {}
      }
    }
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
      if (selector.startsWith("#")) {
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
    href: "https://resto.example.com/resto_hub.html",
    pathname: "/resto_hub.html",
    hash: ""
  },
  history: {
    replaceState: function () {}
  },
  addEventListener: function () {},
  RESTO_CLOUD_CONFIG: RESTO_CLOUD_CONFIG,
  openPaymentCheckoutModal: null
};

var fetch = function () {
  return Promise.reject(new Error("Mock fetch not configured for this test"));
};

function setActiveTenantUrl(tenantSlug) {
  window.location.search = tenantSlug ? ("?tenant=" + encodeURIComponent(tenantSlug)) : "";
}

function resetTestEnv() {
  localStorage.clear();
  sessionStorage.clear();
  setActiveTenantUrl("");
  window.RESTO_CLOUD_CONFIG = RESTO_CLOUD_CONFIG;
  window.openPaymentCheckoutModal = null;
  document = createMockDocument();
  fetch = function () {
    return Promise.reject(new Error("Offline mock"));
  };
  if (typeof RestoSync !== "undefined" && RestoSync.listeners) {
    RestoSync.listeners = {};
  }
}

// Load target script
load("assets/js/resto-sync.js");

// -----------------------------------------------------------------------------
// Mini Assertion & Test Runner
// -----------------------------------------------------------------------------
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function safeStringify(val) {
  if (val && typeof val === "object") {
    if (val.tagName || val.id) {
      return "<" + (val.tagName || "element") + (val.id ? " id=\"" + val.id + "\"" : "") + ">";
    }
  }
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "Mismatch") + " — expected: " + safeStringify(expected) + ", actual: " + safeStringify(actual));
  }
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// -----------------------------------------------------------------------------
// Test Cases Tahap 2
// -----------------------------------------------------------------------------

test("testRestoProFeaturesConstants", function () {
  resetTestEnv();
  const proFeatures = RestoSync.RESTO_PRO_FEATURES;
  assert(proFeatures && typeof proFeatures === "object", "RESTO_PRO_FEATURES must exist on RestoSync");

  assertEqual(proFeatures.ANALYTICS_BI.id, "analytics_bi", "ANALYTICS_BI id");
  assertEqual(proFeatures.ANALYTICS_BI.name, "Analitik Bisnis & Margin Laba", "ANALYTICS_BI name");

  assertEqual(proFeatures.CRM_MEMBERS.id, "crm_members", "CRM_MEMBERS id");
  assertEqual(proFeatures.CRM_MEMBERS.name, "CRM Pelanggan & Loyalty Points", "CRM_MEMBERS name");

  assertEqual(proFeatures.RESERVATIONS.id, "reservations", "RESERVATIONS id");
  assertEqual(proFeatures.RESERVATIONS.name, "Manajemen Reservasi Meja Restoran", "RESERVATIONS name");

  assertEqual(proFeatures.EXPORT_LEDGER.id, "export_ledger", "EXPORT_LEDGER id");
  assertEqual(proFeatures.EXPORT_LEDGER.name, "Ekspor Pembukuan Keuangan CSV/Excel", "EXPORT_LEDGER name");

  assertEqual(proFeatures.BACKUP_RESTORE.id, "backup_restore", "BACKUP_RESTORE id");
  assertEqual(proFeatures.BACKUP_RESTORE.name, "Backup & Restore Database Penuh", "BACKUP_RESTORE name");

  assertEqual(proFeatures.TABLES_EXPANSION.id, "tables_expansion", "TABLES_EXPANSION id");
  assertEqual(proFeatures.TABLES_EXPANSION.name, "Kapasitas Meja > 4 Meja Aktif", "TABLES_EXPANSION name");
});

test("testMasterTenantHasAllFeaturesAllowed", function () {
  resetTestEnv();
  setActiveTenantUrl("default");

  const lic = RestoSync.getLicenseData();
  assertEqual(lic.isMaster, true, "Tenant default must be Master");

  const keys = Object.keys(RestoSync.RESTO_PRO_FEATURES);
  for (let i = 0; i < keys.length; i++) {
    const f = RestoSync.RESTO_PRO_FEATURES[keys[i]];
    assertEqual(RestoSync.isFeatureAllowed(f.id), true, "Master must have access to feature id: " + f.id);
    assertEqual(RestoSync.isFeatureAllowed(f), true, "Master must accept feature object: " + f.id);
  }
});

test("testPaidMonthlyAndLifetimeTenantsAllowed", function () {
  resetTestEnv();

  // Active Monthly Tenant
  const tMonthly = RestoSync.registerNewTenant({ name: "Kafe Monthly", plan: "monthly" });
  setActiveTenantUrl(tMonthly.id);
  const licMonthly = RestoSync.getLicenseData();
  assertEqual(licMonthly.isPaidActive, true, "Monthly tenant isPaidActive must be true");

  const keys = Object.keys(RestoSync.RESTO_PRO_FEATURES);
  for (let i = 0; i < keys.length; i++) {
    const f = RestoSync.RESTO_PRO_FEATURES[keys[i]];
    assertEqual(RestoSync.isFeatureAllowed(f.id), true, "Monthly tenant must have access to: " + f.id);
  }

  // Active Lifetime Tenant
  const tLifetime = RestoSync.registerNewTenant({ name: "Resto Lifetime", plan: "lifetime" });
  setActiveTenantUrl(tLifetime.id);
  const licLifetime = RestoSync.getLicenseData();
  assertEqual(licLifetime.isPaidActive, true, "Lifetime tenant isPaidActive must be true");

  for (let i = 0; i < keys.length; i++) {
    const f = RestoSync.RESTO_PRO_FEATURES[keys[i]];
    assertEqual(RestoSync.isFeatureAllowed(f.id), true, "Lifetime tenant must have access to: " + f.id);
  }
});

test("testUnpaidTrialPendingExpiredSuspendedNotSyncedBlocked", function () {
  resetTestEnv();

  // 1. Trial tenant
  const tTrial = RestoSync.registerNewTenant({ name: "Warung Trial", plan: "trial" });
  setActiveTenantUrl(tTrial.id);
  assertEqual(RestoSync.isFeatureAllowed("analytics_bi"), false, "Trial tenant cannot access analytics_bi");
  assertEqual(RestoSync.isFeatureAllowed("crm_members"), false, "Trial tenant cannot access crm_members");
  assertEqual(RestoSync.isFeatureAllowed("reservations"), false, "Trial tenant cannot access reservations");
  assertEqual(RestoSync.isFeatureAllowed("export_ledger"), false, "Trial tenant cannot access export_ledger");
  assertEqual(RestoSync.isFeatureAllowed("backup_restore"), false, "Trial tenant cannot access backup_restore");
  assertEqual(RestoSync.isFeatureAllowed("tables_expansion"), false, "Trial tenant cannot access tables_expansion");

  // 2. Pending tenant
  const tPending = RestoSync.registerNewTenant({ name: "Warung Pending", plan: "monthly", status: "pending" });
  setActiveTenantUrl(tPending.id);
  assertEqual(RestoSync.isFeatureAllowed("analytics_bi"), false, "Pending tenant cannot access analytics_bi");
  assertEqual(RestoSync.isFeatureAllowed("crm_members"), false, "Pending tenant cannot access crm_members");

  // 3. Expired tenant
  const tExpired = RestoSync.registerNewTenant({
    name: "Warung Expired",
    plan: "monthly",
    status: "expired",
    expiresAt: new Date(Date.now() - 86400000).toISOString()
  });
  setActiveTenantUrl(tExpired.id);
  assertEqual(RestoSync.isFeatureAllowed("analytics_bi"), false, "Expired tenant cannot access analytics_bi");
  assertEqual(RestoSync.isFeatureAllowed("reservations"), false, "Expired tenant cannot access reservations");

  // 4. Suspended tenant
  const tSuspended = RestoSync.registerNewTenant({ name: "Warung Suspended", plan: "monthly", status: "suspended" });
  setActiveTenantUrl(tSuspended.id);
  assertEqual(RestoSync.isFeatureAllowed("analytics_bi"), false, "Suspended tenant cannot access analytics_bi");

  // 5. NotSynced / unknown tenant
  setActiveTenantUrl("tenant-tidak-dikenal-123");
  assertEqual(RestoSync.isFeatureAllowed("analytics_bi"), false, "NotSynced tenant cannot access analytics_bi");
});

test("testTablesExpansionRespectsCanAddTable", function () {
  resetTestEnv();

  // Trial tenant cannot expand tables
  const tTrial = RestoSync.registerNewTenant({ name: "Warung Meja Empat", plan: "trial" });
  setActiveTenantUrl(tTrial.id);
  assertEqual(RestoSync.isFeatureAllowed("tables_expansion"), false, "Trial tenant cannot expand tables beyond 4");

  // Paid tenant has tables_expansion allowed as long as canAddTable() is true
  const tPaid = RestoSync.registerNewTenant({ name: "Warung Meja Banyak", plan: "monthly" });
  setActiveTenantUrl(tPaid.id);
  assertEqual(RestoSync.isFeatureAllowed("tables_expansion"), true, "Paid tenant can expand tables when capacity available");
});

test("testModernLockedModalNoOfflineTokenAndTriggersUpgrade", function () {
  resetTestEnv();

  // Call showProFeatureLockedModal
  RestoSync.showProFeatureLockedModal("Analitik Bisnis & Margin Laba", {
    description: "Modul ini mencakup grafik omset dan profit margin harian."
  });

  const modal = document.getElementById("proFeatureLockModal");
  assert(Boolean(modal), "Modal #proFeatureLockModal must be rendered in DOM");
  assertEqual(modal.classList.contains("hidden"), false, "Modal must not have 'hidden' class");

  // Requirement: Removes old offline manual license token box (#proModalTokenInput)
  const tokenInput = document.getElementById("proModalTokenInput");
  assertEqual(tokenInput, null, "Modal must NOT contain #proModalTokenInput offline token box");

  const titleEl = document.getElementById("proModalFeatureTitle");
  assert(Boolean(titleEl), "#proModalFeatureTitle must exist");
  assertEqual(titleEl.textContent, "Analitik Bisnis & Margin Laba", "Title should match feature name");

  const descEl = document.getElementById("proModalFeatureDesc");
  assert(Boolean(descEl), "#proModalFeatureDesc must exist");
  assert(descEl.textContent.indexOf("grafik omset") !== -1, "Description should be reflected in modal");

  // Check WhatsApp link CTA
  const waBtn = document.getElementById("btnProModalWhatsApp");
  assert(Boolean(waBtn), "#btnProModalWhatsApp must exist");
  const waHref = waBtn.getAttribute("href") || waBtn.href || "";
  assert(waHref.indexOf("https://wa.me/6285174273313") === 0, "WhatsApp CTA must link to official 085174273313, got: " + waHref);

  // Check Upgrade CTA and event emission
  let eventDispatched = null;
  RestoSync.on("OPEN_PAYMENT_MODAL", function (data) {
    eventDispatched = data;
  });

  let checkoutModalCalled = null;
  window.openPaymentCheckoutModal = function (payload) {
    checkoutModalCalled = payload;
  };

  const upgradeBtn = document.getElementById("btnProModalUpgrade");
  assert(Boolean(upgradeBtn), "#btnProModalUpgrade must exist");
  upgradeBtn.click();

  assert(Boolean(eventDispatched), "Clicking upgrade CTA must emit OPEN_PAYMENT_MODAL");
  assertEqual(eventDispatched.feature, "Analitik Bisnis & Margin Laba", "Emitted event feature name");
  assert(Boolean(checkoutModalCalled), "Clicking upgrade CTA must call window.openPaymentCheckoutModal() if defined");
});

test("testClientPaymentApiSubmitProof", function () {
  resetTestEnv();

  let capturedRequest = null;
  fetch = function (url, options) {
    capturedRequest = {
      url: url,
      method: options.method,
      headers: options.headers,
      body: JSON.parse(options.body)
    };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () {
        return Promise.resolve({
          success: true,
          paymentId: "PAY-202611-TEST01",
          status: "pending",
          message: "Bukti pembayaran berhasil diunggah."
        });
      }
    });
  };

  const samplePayload = {
    tenantId: "warung-sate-budi",
    plan: "monthly",
    amount: 199000,
    bankTarget: "BCA (123-456-7890 a.n RASH Builder)",
    senderName: "Budi Santoso",
    senderBank: "BCA",
    imageBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    imageMimeType: "image/jpeg",
    fileName: "struk_transfer.jpg"
  };

  return RestoSync.submitPaymentProof(samplePayload).then(function (res) {
    assert(Boolean(capturedRequest), "submitPaymentProof must trigger fetch");
    assertEqual(capturedRequest.url, RESTO_CLOUD_CONFIG.GAS_URL, "Target URL must match GAS_URL");
    assertEqual(capturedRequest.method, "POST", "Method must be POST");
    assertEqual(capturedRequest.body.action, "submitPaymentProof", "action must be submitPaymentProof");
    assertEqual(capturedRequest.body.tenantId, "warung-sate-budi", "tenantId in body");
    assertEqual(capturedRequest.body.plan, "monthly", "plan in body");
    assertEqual(capturedRequest.body.amount, 199000, "amount in body");

    assertEqual(res.success, true, "Response success");
    assertEqual(res.paymentId, "PAY-202611-TEST01", "Response paymentId");
    assertEqual(res.status, "pending", "Response status");

    // Test offline/network error safety (no crash/throw)
    fetch = function () {
      return Promise.reject(new Error("Network failed"));
    };

    return RestoSync.submitPaymentProof(samplePayload).then(function (errRes) {
      assertEqual(errRes.success, false, "Offline submit should return success: false");
      assertEqual(errRes.offline, true, "Offline submit should flag offline: true");
    });
  });
});

test("testClientPaymentApiGetStatusAndAdmin", function () {
  resetTestEnv();

  const mockHistory = [];
  fetch = function (url, options) {
    mockHistory.push({ url: url, options: options || {} });

    if (url.indexOf("action=getTenantPaymentStatus") !== -1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () {
          return Promise.resolve({
            success: true,
            latestPayment: {
              id: "PAY-202611-TEST01",
              status: "pending",
              plan: "monthly",
              amount: 199000
            }
          });
        }
      });
    }

    if (url.indexOf("action=getPayments") !== -1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () {
          return Promise.resolve({
            success: true,
            payments: [
              { id: "PAY-001", status: "pending" },
              { id: "PAY-002", status: "verified" }
            ]
          });
        }
      });
    }

    if (options && options.method === "POST") {
      const parsed = JSON.parse(options.body);
      if (parsed.action === "verifyPayment") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: function () {
            return Promise.resolve({
              success: true,
              paymentStatus: parsed.verifyAction || (parsed.data && parsed.data.action) || "verified"
            });
          }
        });
      }
    }

    return Promise.reject(new Error("Unhandled route"));
  };

  return RestoSync.getTenantPaymentStatus("warung-sate-budi")
    .then(function (statusRes) {
      assertEqual(statusRes.success, true, "getTenantPaymentStatus success");
      assert(Boolean(statusRes.latestPayment), "latestPayment must be returned");
      assertEqual(statusRes.latestPayment.status, "pending", "latestPayment status");

      const lastReq = mockHistory[0];
      assert(lastReq.url.indexOf("action=getTenantPaymentStatus") !== -1, "Query param action");
      assert(lastReq.url.indexOf("tenantId=warung-sate-budi") !== -1, "Query param tenantId");

      return RestoSync.getPaymentsAdmin("pending");
    })
    .then(function (adminRes) {
      assertEqual(adminRes.success, true, "getPaymentsAdmin success");
      assertEqual(adminRes.payments.length, 2, "admin payments count");

      const lastReq = mockHistory[1];
      assert(lastReq.url.indexOf("action=getPayments") !== -1, "Query param action=getPayments");
      assert(lastReq.url.indexOf("apiKey=MOCK-ADMIN-SECRET-KEY") !== -1, "Query param apiKey included");
      assert(lastReq.url.indexOf("statusFilter=pending") !== -1, "Query param statusFilter included");

      return RestoSync.verifyPaymentAdmin("PAY-001", "approve", "");
    })
    .then(function (verifyRes) {
      assertEqual(verifyRes.success, true, "verifyPaymentAdmin success");

      const lastReq = mockHistory[2];
      assertEqual(lastReq.options.method, "POST", "verifyPaymentAdmin uses POST");
      const body = JSON.parse(lastReq.options.body);
      assertEqual(body.action, "verifyPayment", "body action");
      assertEqual(body.apiKey, "MOCK-ADMIN-SECRET-KEY", "body apiKey");
      assertEqual(body.paymentId, "PAY-001", "body paymentId");

      // Verify offline fallbacks
      fetch = function () {
        return Promise.reject(new Error("Network disconnect"));
      };

      return Promise.all([
        RestoSync.getTenantPaymentStatus("warung-sate-budi"),
        RestoSync.getPaymentsAdmin("pending"),
        RestoSync.verifyPaymentAdmin("PAY-001", "reject", "Foto buram")
      ]);
    })
    .then(function (offlineResults) {
      assertEqual(offlineResults[0].success, false, "Offline getTenantPaymentStatus returns false");
      assertEqual(offlineResults[1].success, false, "Offline getPaymentsAdmin returns false");
      assertEqual(offlineResults[2].success, false, "Offline verifyPaymentAdmin returns false");
    });
});

// -----------------------------------------------------------------------------
// Execute Tests
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  let asyncErr = null;
  let completed = false;
  try {
    const ret = t.fn();
    if (ret && typeof ret.then === "function") {
      ret.then(
        function () { completed = true; },
        function (err) { asyncErr = err || new Error("Rejected"); completed = true; }
      );
      if (typeof drainMicrotasks === "function") {
        drainMicrotasks();
      }
      if (!completed) {
        throw new Error("Async test did not settle during drainMicrotasks()");
      }
      if (asyncErr) {
        throw asyncErr;
      }
    }
    passed++;
    print("PASS: " + t.name);
  } catch (err) {
    failed++;
    print("FAIL: " + t.name + " -> " + (err && err.message ? err.message : String(err)));
  }
}

print("SUMMARY: " + passed + " passed, " + failed + " failed");
if (failed > 0) {
  throw new Error("Test suite failed: " + failed + " failures");
}
