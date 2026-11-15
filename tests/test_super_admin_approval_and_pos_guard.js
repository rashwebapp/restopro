/**
 * Test Suite Tahap 2 — Task 5: Panel Persetujuan Pembayaran di super_admin_saas.html
 * dan POS Pro Feature Guard di cashier_pos_register.html
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_approval_and_pos_guard.js
 */

// -----------------------------------------------------------------------------
// 1. Storage, Globals & Mock Browser Environment
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

var console = {
  log: function () {},
  warn: function () {},
  error: function () {}
};

var lastAlertMessage = "";
var confirmReturnValue = true;
var promptReturnValue = "";
var alertCalls = [];
var confirmCalls = [];
var promptCalls = [];

var alert = function (msg) {
  lastAlertMessage = String(msg);
  alertCalls.push(lastAlertMessage);
};

var confirm = function (msg) {
  confirmCalls.push(String(msg));
  return confirmReturnValue;
};

var prompt = function (msg, defaultVal) {
  promptCalls.push({ message: String(msg), defaultValue: defaultVal });
  return promptReturnValue;
};

var timeoutQueue = [];
var setTimeout = function (cb) {
  if (typeof cb === "function") {
    timeoutQueue.push(cb);
    try { cb(); } catch (e) {}
  }
  return 1;
};
var clearTimeout = function () {};
var setInterval = function () { return 1; };
var clearInterval = function () {};
var requestAnimationFrame = function (cb) { if (typeof cb === "function") cb(); return 1; };

var navigator = {
  clipboard: {
    writeText: function () { return Promise.resolve(); }
  }
};

var URLSearchParams = function (searchStr) {
  const map = Object.create(null);
  const clean = String(searchStr || "").replace(/^\?/, "");
  if (clean) {
    clean.split("&").forEach(pair => {
      if (!pair) return;
      const idx = pair.indexOf("=");
      const k = decodeURIComponent((idx >= 0 ? pair.slice(0, idx) : pair).replace(/\+/g, " "));
      const v = decodeURIComponent((idx >= 0 ? pair.slice(idx + 1) : "").replace(/\+/g, " "));
      map[k] = v;
    });
  }
  return {
    get(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    has(k) { return Object.prototype.hasOwnProperty.call(map, k); }
  };
};

var MOCK_CLOUD_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/MOCK_MASTER_CLOUD/exec",
  API_SECRET_KEY: "MOCK-ADMIN-SECRET-KEY"
};

var fetchCalls = [];
var fetch = function (url) {
  fetchCalls.push(String(url));
  return Promise.reject(new Error("Offline mock"));
};

var MOCK_THEME_MANAGER = {
  init: function () {},
  toggle: function () { return "dark"; },
  applyTheme: function () {}
};

var MockQRCode = function (el, opts) {
  if (el && typeof el.setAttribute === "function") {
    el.setAttribute("data-qr-text", opts && opts.text ? opts.text : "");
  }
};
MockQRCode.CorrectLevel = { M: 0, L: 1, H: 2, Q: 3 };

var window = {
  location: {
    search: "",
    href: "https://resto.example.com/super_admin_saas.html",
    pathname: "/super_admin_saas.html",
    hash: ""
  },
  history: { replaceState: function () {} },
  addEventListener: function () {},
  matchMedia: function () { return { matches: false }; },
  postMessage: function () {},
  print: function () {},
  RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
};

var location = {
  search: "",
  href: "https://resto.example.com/super_admin_saas.html",
  reload: function () {}
};

// Load shared modules
load("assets/js/resto-config.js");
load("assets/js/resto-data.js");
load("assets/js/resto-sync.js");

window.RESTO_CLOUD_CONFIG = MOCK_CLOUD_CONFIG;

// -----------------------------------------------------------------------------
// 2. Headless DOM Mock Engine
// -----------------------------------------------------------------------------
function extractAttributes(attrStr) {
  const attrs = Object.create(null);
  const re = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ""));
    attrs[key] = val;
  }
  return attrs;
}

function createDomFromHtml(html) {
  const stripped = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  const byId = Object.create(null);
  const allElements = [];
  const radioGroups = Object.create(null);

  const doc = {
    title: "",
    _byId: byId,
    _elements: allElements,
    _radioGroups: radioGroups,
    _eventListeners: Object.create(null),
    body: null,
    addEventListener(type, cb) {
      if (!this._eventListeners[type]) this._eventListeners[type] = [];
      this._eventListeners[type].push(cb);
    },
    dispatchDOMContentLoaded() {
      const list = this._eventListeners["DOMContentLoaded"] || [];
      list.forEach(cb => cb());
    },
    createElement(tagName) {
      return makeElement(tagName, Object.create(null), "");
    },
    getElementById(id) {
      return byId[id] || null;
    },
    querySelector(sel) {
      const res = this.querySelectorAll(sel);
      return res.length > 0 ? res[0] : null;
    },
    querySelectorAll(sel) {
      const s = String(sel || "").trim();
      if (!s) return [];
      if (s.charAt(0) === "#" && s.indexOf(" ") === -1) {
        const found = byId[s.slice(1)];
        return found ? [found] : [];
      }
      if (s.charAt(0) === "." && s.indexOf(" ") === -1) {
        const cls = s.slice(1);
        return allElements.filter(el => el.classList.contains(cls));
      }
      return allElements.filter(el => el.tagName === s.toUpperCase());
    }
  };

  function registerInnerIds(parentEl, htmlSnippet) {
    const idRe = /<([a-zA-Z0-9-]+)([^>]*\bid\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*)>/gi;
    let m;
    while ((m = idRe.exec(String(htmlSnippet || ""))) !== null) {
      const idVal = m[3] !== undefined ? m[3] : m[4];
      if (idVal && !byId[idVal]) {
        const attrs = extractAttributes(m[2] || "");
        const stub = makeElement(m[1], attrs, "");
        stub.parentNode = parentEl;
        stub._dynamicChild = true;
      }
    }
  }

  function clearDynamicChildren(parentEl) {
    Object.keys(byId).forEach(k => {
      const node = byId[k];
      if (node && node.parentNode === parentEl && node._dynamicChild) {
        delete byId[k];
      }
    });
  }

  function makeElement(tagName, attrs, innerText) {
    const classSet = new Set(String(attrs["class"] || "").split(/\s+/).filter(Boolean));
    const initValue = attrs["value"] !== undefined ? String(attrs["value"]) : "";
    const initChecked = Object.prototype.hasOwnProperty.call(attrs, "checked");
    const initDisabled = Object.prototype.hasOwnProperty.call(attrs, "disabled");
    const type = String(attrs["type"] || "").toLowerCase();
    const name = attrs["name"] || "";

    let currentId = attrs["id"] || "";
    let currentInnerHtml = "";

    const el = {
      tagName: String(tagName || "div").toUpperCase(),
      type: type,
      name: name,
      _attrs: attrs,
      _value: initValue,
      _checked: initChecked,
      disabled: initDisabled,
      href: attrs["href"] || "",
      src: attrs["src"] || "",
      children: [],
      options: [],
      style: {},
      parentNode: null,
      get id() { return currentId; },
      set id(val) {
        if (currentId && byId[currentId] === this) {
          delete byId[currentId];
        }
        currentId = String(val || "");
        if (currentId) {
          byId[currentId] = this;
        }
      },
      get innerHTML() { return currentInnerHtml; },
      set innerHTML(val) {
        currentInnerHtml = val === undefined || val === null ? "" : String(val);
        this._textContent = currentInnerHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        clearDynamicChildren(this);
        registerInnerIds(this, currentInnerHtml);
      },
      get textContent() { return this._textContent; },
      set textContent(v) {
        this._textContent = v === undefined || v === null ? "" : String(v);
        currentInnerHtml = this._textContent;
      },
      get innerText() { return this._textContent; },
      set innerText(v) { this.textContent = v; },
      get value() { return this._value; },
      set value(v) { this._value = v === undefined || v === null ? "" : String(v); },
      get checked() { return this._checked; },
      set checked(v) { this._checked = Boolean(v); },
      get className() { return Array.from(classSet).join(" "); },
      set className(val) {
        classSet.clear();
        String(val || "").split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
      },
      classList: {
        add() {
          for (let i = 0; i < arguments.length; i++) classSet.add(arguments[i]);
        },
        remove() {
          for (let i = 0; i < arguments.length; i++) classSet.delete(arguments[i]);
        },
        contains(c) { return classSet.has(c); },
        toggle(c) {
          if (classSet.has(c)) { classSet.delete(c); return false; }
          classSet.add(c); return true;
        }
      },
      getAttribute(k) {
        const key = String(k).toLowerCase();
        if (key === "href") return this.href;
        if (key === "src") return this.src;
        if (key === "value") return this._value;
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      setAttribute(k, v) {
        const key = String(k).toLowerCase();
        this._attrs[key] = String(v);
        if (key === "id") { this.id = String(v); }
        if (key === "href") this.href = String(v);
        if (key === "src") this.src = String(v);
        if (key === "value") this._value = String(v);
      },
      removeAttribute(k) {
        delete this._attrs[String(k).toLowerCase()];
      },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        return child;
      },
      remove() {
        if (this.parentNode && this.parentNode.children) {
          const idx = this.parentNode.children.indexOf(this);
          if (idx !== -1) this.parentNode.children.splice(idx, 1);
        }
        if (this.id && byId[this.id] === this) {
          delete byId[this.id];
        }
      },
      focus() {},
      select() {},
      reset() {},
      click() {
        if (typeof this.onclick === "function") {
          return this.onclick({ preventDefault: () => {}, stopPropagation: () => {}, target: this });
        }
      }
    };

    if (currentId) byId[currentId] = el;
    allElements.push(el);
    return el;
  }

  const tagRe = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(stripped)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = full.indexOf("</") === 0;
    if (isClosing) continue;
    const attrs = extractAttributes(match[2] || "");
    if (tag === "input" || tag === "button" || tag === "select" || tag === "textarea" || tag === "table" || tag === "tbody" || attrs["id"]) {
      makeElement(tag, attrs, "");
    }
  }

  doc.body = makeElement("body", Object.create(null), "");
  return doc;
}

function extractInlineScript(html) {
  const matches = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const body = m[2] || "";
    if (!/\bsrc\s*=/.test(attrs) && body.indexOf("tailwind.config") === -1) {
      matches.push(body);
    }
  }
  return matches.join("\n;\n");
}

function mountSuperAdmin(options = {}) {
  const html = readFile("super_admin_saas.html");
  const doc = createDomFromHtml(html);
  const win = {
    location: {
      search: "",
      href: "https://resto.example.com/super_admin_saas.html",
      pathname: "/super_admin_saas.html",
      hash: ""
    },
    history: { replaceState: function () {} },
    addEventListener: function () {},
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
  };

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      switchAdminTab: typeof switchAdminTab === "function" ? switchAdminTab : undefined,
      loadPaymentsApprovalList: typeof loadPaymentsApprovalList === "function" ? loadPaymentsApprovalList : undefined,
      handleApprovePayment: typeof handleApprovePayment === "function" ? handleApprovePayment : undefined,
      handleRejectPayment: typeof handleRejectPayment === "function" ? handleRejectPayment : undefined,
      openProofImageModal: typeof openProofImageModal === "function" ? openProofImageModal : undefined,
      closeProofImageModal: typeof closeProofImageModal === "function" ? closeProofImageModal : undefined,
      filterPaymentStatus: typeof filterPaymentStatus === "function" ? filterPaymentStatus : undefined,
      filterPayments: typeof filterPayments === "function" ? filterPayments : undefined,
      unlockPortal: typeof unlockPortal === "function" ? unlockPortal : undefined,
      renderAllTenants: typeof renderAllTenants === "function" ? renderAllTenants : undefined
    };
  `;

  const factory = new Function(
    "window",
    "document",
    "localStorage",
    "sessionStorage",
    "RestoSync",
    "fetch",
    "alert",
    "confirm",
    "prompt",
    "navigator",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "location",
    "console",
    "URLSearchParams",
    rawScript + "\n" + exportFooter
  );

  const api = factory(
    win,
    doc,
    localStorage,
    sessionStorage,
    RestoSync,
    fetch,
    alert,
    confirm,
    prompt,
    navigator,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    location,
    console,
    URLSearchParams
  );

  return { doc, win, api };
}

function mountCashierPos(options = {}) {
  const html = readFile("cashier_pos_register.html");
  const doc = createDomFromHtml(html);
  const searchStr = options.search || "";

  window.location.search = searchStr;
  window.location.href = "https://resto.example.com/cashier_pos_register.html" + searchStr;
  location.search = searchStr;
  location.href = "https://resto.example.com/cashier_pos_register.html" + searchStr;

  const win = {
    location: {
      search: searchStr,
      href: "https://resto.example.com/cashier_pos_register.html" + searchStr,
      pathname: "/cashier_pos_register.html",
      hash: ""
    },
    history: { replaceState: function () {} },
    addEventListener: function () {},
    matchMedia: function () { return { matches: false }; },
    postMessage: function () {},
    print: function () {},
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
  };

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      getActiveTableId: function () { return typeof activeTableId !== "undefined" ? activeTableId : null; },
      selectTable: typeof selectTable === "function" ? selectTable : undefined,
      openCashierAddMemberModal: typeof openCashierAddMemberModal === "function" ? openCashierAddMemberModal : undefined,
      closeCashierAddMemberModal: typeof closeCashierAddMemberModal === "function" ? closeCashierAddMemberModal : undefined,
      openCashierReservationModal: typeof openCashierReservationModal === "function" ? openCashierReservationModal : undefined,
      closeCashierReservationModal: typeof closeCashierReservationModal === "function" ? closeCashierReservationModal : undefined,
      switchReservationTab: typeof switchReservationTab === "function" ? switchReservationTab : undefined
    };
  `;

  const factory = new Function(
    "window",
    "document",
    "localStorage",
    "sessionStorage",
    "RestoSync",
    "RESTO_CONFIG",
    "RESTO_TABLES",
    "MENU_ITEMS",
    "formatRupiah",
    "ThemeManager",
    "fetch",
    "alert",
    "confirm",
    "prompt",
    "navigator",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "requestAnimationFrame",
    "location",
    "console",
    "URLSearchParams",
    "QRCode",
    rawScript + "\n" + exportFooter
  );

  const loc = {
    search: searchStr,
    href: "https://resto.example.com/cashier_pos_register.html" + searchStr,
    reload: function () {}
  };

  const api = factory(
    win,
    doc,
    localStorage,
    sessionStorage,
    RestoSync,
    RESTO_CONFIG,
    RESTO_TABLES,
    MENU_ITEMS,
    formatRupiah,
    MOCK_THEME_MANAGER,
    fetch,
    alert,
    confirm,
    prompt,
    navigator,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame,
    loc,
    console,
    URLSearchParams,
    MockQRCode
  );

  return { doc, win, api };
}

// -----------------------------------------------------------------------------
// 3. Mini Test Runner
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message ? message + " — " : "") + "Expected [" + expected + "], got [" + actual + "]");
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    print("  [PASS] " + name);
    passed++;
  } catch (err) {
    print("  [FAIL] " + name + "\n         " + (err && err.message ? err.message : err));
    failed++;
  }
}

function resetEnvironment() {
  localStorage.clear();
  sessionStorage.clear();
  alertCalls = [];
  confirmCalls = [];
  promptCalls = [];
  fetchCalls = [];
  confirmReturnValue = true;
  promptReturnValue = "";
  lastAlertMessage = "";
}

// -----------------------------------------------------------------------------
// 4. Test Suite Execution
// -----------------------------------------------------------------------------
print("===============================================================================");
print("RUNNING TESTS: Task 5 — Super Admin Approval & POS Pro Feature Guard");
print("===============================================================================");

async function main() {

  await runTest("1. super_admin_saas.html renders tabs, pending badge, payments table, and proof image modal", async function () {
    resetEnvironment();
    sessionStorage.setItem("resto_pro_super_admin_unlocked", "true");

    // Mock payments data in RestoSync
    const mockPayments = [
      {
        id: "PAY-202611-001",
        tenantId: "warung-berkah",
        tenantName: "Warung Berkah",
        plan: "monthly",
        amount: 199000,
        senderBank: "BCA",
        senderName: "Budi Santoso",
        proofUrl: "https://drive.google.com/open?id=MOCK_PROOF_001",
        status: "pending",
        createdAt: "2026-11-15T08:00:00Z"
      },
      {
        id: "PAY-202611-002",
        tenantId: "kafe-senja",
        tenantName: "Kafe Senja",
        plan: "lifetime",
        amount: 2999000,
        senderBank: "Mandiri",
        senderName: "Siti Rahma",
        proofUrl: "https://drive.google.com/open?id=MOCK_PROOF_002",
        status: "verified",
        createdAt: "2026-11-14T10:00:00Z"
      }
    ];

    RestoSync.getPaymentsAdmin = async function () {
      return { success: true, payments: mockPayments };
    };

    const app = mountSuperAdmin();
    app.doc.dispatchDOMContentLoaded();
    if (typeof drainMicrotasks === "function") drainMicrotasks();

    // Check tab navigation elements
    const tabTenants = app.doc.getElementById("tabTenantsList");
    const tabPayments = app.doc.getElementById("tabPaymentsApproval");
    const badgePending = app.doc.getElementById("badgePendingPaymentsCount");
    const panelTenants = app.doc.getElementById("panelTenantsList");
    const panelPayments = app.doc.getElementById("panelPaymentsApproval");

    assert(Boolean(tabTenants), "#tabTenantsList must exist");
    assert(Boolean(tabPayments), "#tabPaymentsApproval must exist");
    assert(Boolean(badgePending), "#badgePendingPaymentsCount must exist");
    assert(Boolean(panelTenants), "#panelTenantsList must exist");
    assert(Boolean(panelPayments), "#panelPaymentsApproval must exist");

    // Initially tenants tab is active, payments panel is hidden
    assert(!panelTenants.classList.contains("hidden"), "#panelTenantsList should initially be visible");
    assert(panelPayments.classList.contains("hidden"), "#panelPaymentsApproval should initially be hidden");

    // Switch tab to payments
    assert(typeof app.api.switchAdminTab === "function", "switchAdminTab function must be available");
    await app.api.switchAdminTab("payments");
    if (typeof drainMicrotasks === "function") drainMicrotasks();

    assert(panelTenants.classList.contains("hidden"), "#panelTenantsList should be hidden after switching to payments");
    assert(!panelPayments.classList.contains("hidden"), "#panelPaymentsApproval should be visible after switching to payments");

    // Verify pending badge shows 1
    assert(!badgePending.classList.contains("hidden"), "#badgePendingPaymentsCount should be visible when pending > 0");
    assert(badgePending.textContent.indexOf("1") !== -1, "Badge text should contain pending count 1, got: " + badgePending.textContent);

    // Verify payments table rendered rows
    const tableEl = app.doc.getElementById("paymentsTableBody") || app.doc.getElementById("tablePaymentsList");
    assert(Boolean(tableEl), "#paymentsTableBody or #tablePaymentsList must exist");
    assert(tableEl.innerHTML.indexOf("PAY-202611-001") !== -1, "Table must render PAY-202611-001");
    assert(tableEl.innerHTML.indexOf("Warung Berkah") !== -1, "Table must render Warung Berkah");
    assert(tableEl.innerHTML.indexOf("PAY-202611-002") !== -1, "Table must render PAY-202611-002");

    // Verify proof modal opens and closes
    const proofModal = app.doc.getElementById("proofImageModal");
    const proofImg = app.doc.getElementById("proofImagePreview");
    assert(Boolean(proofModal), "#proofImageModal must exist");
    assert(Boolean(proofImg), "#proofImagePreview must exist");

    assert(typeof app.api.openProofImageModal === "function", "openProofImageModal must be available");
    app.api.openProofImageModal("https://drive.google.com/open?id=MOCK_PROOF_001");
    assert(!proofModal.classList.contains("hidden"), "Modal should be visible after openProofImageModal");
    assertEqual(proofImg.getAttribute("src"), "https://drive.google.com/open?id=MOCK_PROOF_001", "Image preview src must match");

    assert(typeof app.api.closeProofImageModal === "function", "closeProofImageModal must be available");
    app.api.closeProofImageModal();
    assert(proofModal.classList.contains("hidden"), "Modal should be hidden after closeProofImageModal");
  });

  await runTest("2. Clicking Setujui executes RestoSync.verifyPaymentAdmin(id, 'approve') and refreshes", async function () {
    resetEnvironment();
    sessionStorage.setItem("resto_pro_super_admin_unlocked", "true");

    const app = mountSuperAdmin();
    app.doc.dispatchDOMContentLoaded();

    let verifiedCalls = [];
    RestoSync.verifyPaymentAdmin = async function (id, action, reason) {
      verifiedCalls.push({ id, action, reason });
      return { success: true, paymentStatus: "verified" };
    };

    let getPaymentsCalled = 0;
    RestoSync.getPaymentsAdmin = async function () {
      getPaymentsCalled++;
      return {
        success: true,
        payments: [
          {
            id: "PAY-202611-001",
            tenantId: "warung-berkah",
            tenantName: "Warung Berkah",
            plan: "monthly",
            amount: 199000,
            senderBank: "BCA",
            senderName: "Budi Santoso",
            proofUrl: "https://drive.google.com/open?id=MOCK_PROOF_001",
            status: "pending"
          }
        ]
      };
    };

    await app.api.switchAdminTab("payments");
    assertEqual(getPaymentsCalled, 1, "getPaymentsAdmin should be called upon switching tab");

    // Trigger approve
    assert(typeof app.api.handleApprovePayment === "function", "handleApprovePayment must be available");
    await app.api.handleApprovePayment("PAY-202611-001");

    assertEqual(verifiedCalls.length, 1, "verifyPaymentAdmin must be called once");
    assertEqual(verifiedCalls[0].id, "PAY-202611-001", "Payment ID must match");
    assertEqual(verifiedCalls[0].action, "approve", "Action must be 'approve'");

    // Verifies alert or toast confirmed approval
    assert(alertCalls.some(m => m.toLowerCase().indexOf("disetujui") !== -1 || m.toLowerCase().indexOf("berhasil") !== -1) ||
           lastAlertMessage.length > 0, "Confirmation alert/toast should be triggered");

    // Verifies payments list reloaded
    assert(getPaymentsCalled >= 2, "getPaymentsAdmin should be re-called to refresh table");
  });

  await runTest("3. Clicking Tolak prompts for reason and executes verifyPaymentAdmin(id, 'reject', reason)", async function () {
    resetEnvironment();
    sessionStorage.setItem("resto_pro_super_admin_unlocked", "true");

    const app = mountSuperAdmin();
    app.doc.dispatchDOMContentLoaded();

    let verifiedCalls = [];
    RestoSync.verifyPaymentAdmin = async function (id, action, reason) {
      verifiedCalls.push({ id, action, reason });
      return { success: true, paymentStatus: "rejected", rejectReason: reason };
    };

    RestoSync.getPaymentsAdmin = async function () {
      return {
        success: true,
        payments: [
          {
            id: "PAY-202611-003",
            tenantId: "soto-seger",
            tenantName: "Soto Seger",
            plan: "monthly",
            amount: 199000,
            senderBank: "BRI",
            senderName: "Agus",
            proofUrl: "https://drive.google.com/open?id=MOCK_PROOF_003",
            status: "pending"
          }
        ]
      };
    };

    await app.api.switchAdminTab("payments");

    // Case 3a: User provides rejection reason
    promptReturnValue = "Bukti transfer buram tidak terbaca";
    assert(typeof app.api.handleRejectPayment === "function", "handleRejectPayment must be available");
    await app.api.handleRejectPayment("PAY-202611-003");

    assertEqual(promptCalls.length, 1, "prompt must be shown asking for rejection reason");
    assertEqual(verifiedCalls.length, 1, "verifyPaymentAdmin must be called");
    assertEqual(verifiedCalls[0].id, "PAY-202611-003", "Payment ID must match");
    assertEqual(verifiedCalls[0].action, "reject", "Action must be 'reject'");
    assertEqual(verifiedCalls[0].reason, "Bukti transfer buram tidak terbaca", "Reject reason must match prompt return");

    // Case 3b: User cancels prompt (null) -> does NOT call verifyPaymentAdmin
    promptReturnValue = null;
    verifiedCalls = [];
    await app.api.handleRejectPayment("PAY-202611-003");
    assertEqual(verifiedCalls.length, 0, "verifyPaymentAdmin must not be called when prompt cancelled");
  });

  await runTest("4. In cashier_pos_register.html, clicking member registration or reservation on unpaid tenant triggers pro modal & keeps core POS operational", async function () {
    resetEnvironment();

    // Register an unpaid trial tenant
    RestoSync.saveAllTenants([], { silent: true });
    RestoSync.registerNewTenant({
      id: "warung-unpaid-pos",
      name: "Warung Unpaid POS",
      pic: "Pak Budi",
      city: "Bandung",
      plan: "trial",
      status: "trial",
      tablesCount: 4,
      expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      _skipCloud: true
    });

    // Mock modal call on RestoSync
    let lockedModalCalls = [];
    RestoSync.showProFeatureLockedModal = function (featureName, opts) {
      lockedModalCalls.push({ featureName, opts });
    };

    const pos = mountCashierPos({ search: "?tenant=warung-unpaid-pos" });
    pos.doc.dispatchDOMContentLoaded();

    // Verify unpaid status
    assertEqual(RestoSync.isFeatureAllowed("crm_members"), false, "crm_members must be false for unpaid tenant");
    assertEqual(RestoSync.isFeatureAllowed("reservations"), false, "reservations must be false for unpaid tenant");

    // 4a. Try open cashier add member modal
    const memberModal = pos.doc.getElementById("cashierAddMemberModal");
    assert(Boolean(memberModal), "#cashierAddMemberModal must exist");

    pos.api.openCashierAddMemberModal();

    assertEqual(lockedModalCalls.length, 1, "showProFeatureLockedModal must be called for CRM member");
    assert(lockedModalCalls[0].featureName.indexOf("CRM") !== -1 || lockedModalCalls[0].featureName.indexOf("Member") !== -1,
      "Feature name should mention CRM / Member, got: " + lockedModalCalls[0].featureName);
    assert(memberModal.classList.contains("hidden"), "#cashierAddMemberModal must remain hidden for unpaid tenant");

    // 4b. Try open cashier reservation modal
    const resModal = pos.doc.getElementById("cashierReservationModal");
    assert(Boolean(resModal), "#cashierReservationModal must exist");

    pos.api.openCashierReservationModal();

    assertEqual(lockedModalCalls.length, 2, "showProFeatureLockedModal must be called for reservation");
    assert(lockedModalCalls[1].featureName.indexOf("Reservasi") !== -1,
      "Feature name should mention Reservasi, got: " + lockedModalCalls[1].featureName);
    assert(resModal.classList.contains("hidden"), "#cashierReservationModal must remain hidden for unpaid tenant");

    // 4c. Core POS remains 100% operational
    assertEqual(RESTO_TABLES.length, 4, "Usable tables must be capped at 4 for unpaid tenant");
    assert(["T01", "T02", "T03", "T04"].indexOf(pos.api.getActiveTableId()) !== -1, "Default table must be within usable tables T01..T04");

    // Select table T02
    pos.api.selectTable("T02");
    assertEqual(pos.api.getActiveTableId(), "T02", "Table T02 should be selectable");
  });

  await runTest("5. Master / Paid tenant in cashier_pos_register.html allows member registration & reservations smoothly", async function () {
    resetEnvironment();

    // Default tenant (Master) has all features allowed
    const posMaster = mountCashierPos({ search: "" });
    posMaster.doc.dispatchDOMContentLoaded();

    assertEqual(RestoSync.isFeatureAllowed("crm_members"), true, "crm_members must be true for master tenant");
    assertEqual(RestoSync.isFeatureAllowed("reservations"), true, "reservations must be true for master tenant");

    const memberModal = posMaster.doc.getElementById("cashierAddMemberModal");
    posMaster.api.openCashierAddMemberModal();
    assert(!memberModal.classList.contains("hidden"), "#cashierAddMemberModal must be visible for Master tenant");
    posMaster.api.closeCashierAddMemberModal();
    assert(memberModal.classList.contains("hidden"), "#cashierAddMemberModal should close properly");

    const resModal = posMaster.doc.getElementById("cashierReservationModal");
    posMaster.api.openCashierReservationModal();
    assert(!resModal.classList.contains("hidden"), "#cashierReservationModal must be visible for Master tenant");
    posMaster.api.closeCashierReservationModal();
    assert(resModal.classList.contains("hidden"), "#cashierReservationModal should close properly");
  });

  print("===============================================================================");
  print("HASIL: " + passed + " passed, " + failed + " failed, total " + (passed + failed));
  print("===============================================================================");

  if (failed > 0) {
    throw new Error(failed + " test(s) failed.");
  }
}

main().catch(function (err) {
  print("FATAL ERROR: " + (err && err.message ? err.message : err));
  throw err;
});
