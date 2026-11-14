/**
 * Test Suite Tahap 2 — Task 3: Gembok Visual Modul Pro di owner_settings_saas.html
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_feature_gating.js
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
var alertCalls = [];
var confirmCalls = [];

var alert = function (msg) {
  lastAlertMessage = String(msg);
  alertCalls.push(lastAlertMessage);
};

var confirm = function (msg) {
  confirmCalls.push(String(msg));
  return confirmReturnValue;
};

var prompt = function () { return ""; };

var setTimeout = function () { return 1; };
var clearTimeout = function () {};
var requestAnimationFrame = function (cb) { if (typeof cb === "function") cb(); return 1; };

var navigator = {
  clipboard: {
    writeText: function () { return Promise.resolve(); }
  }
};

var fetch = function () {
  return Promise.reject(new Error("Offline mock"));
};

var MOCK_CLOUD_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/MOCK_MASTER_CLOUD/exec",
  API_SECRET_KEY: "MOCK-ADMIN-SECRET-KEY"
};

var MOCK_THEME_MANAGER = {
  init: function () {},
  toggle: function () { return "dark"; },
  applyTheme: function () {}
};

var window = {
  location: {
    search: "",
    href: "https://resto.example.com/owner_settings_saas.html",
    pathname: "/owner_settings_saas.html",
    hash: ""
  },
  history: {
    replaceState: function () {}
  },
  addEventListener: function () {},
  matchMedia: function () { return { matches: false }; },
  postMessage: function () {},
  RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
};

var location = {
  reload: function () {}
};

// Load shared scripts first (as HTML pages do)
load("assets/js/resto-config.js");
load("assets/js/resto-data.js");
load("assets/js/resto-sync.js");

window.RESTO_CLOUD_CONFIG = MOCK_CLOUD_CONFIG;

// -----------------------------------------------------------------------------
// 2. HTML Parser & DOM Harness with Element Traversal
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

  function matchesSelector(el, sel) {
    let s = sel.trim();
    if (!s) return false;

    // Check for :not(...) pseudo-class
    const notMatch = s.match(/^([^:]+):not\(([^)]+)\)$/);
    if (notMatch) {
      const baseSel = notMatch[1];
      const notSel = notMatch[2];
      return matchesSelector(el, baseSel) && !matchesSelector(el, notSel);
    }

    if (s.startsWith("#")) {
      return el.id === s.slice(1);
    }
    if (s.startsWith(".")) {
      return el.classList.contains(s.slice(1));
    }
    if (s.startsWith("[") && s.endsWith("]")) {
      const eqIdx = s.indexOf("=");
      if (eqIdx !== -1) {
        const attrKey = s.slice(1, eqIdx).trim().toLowerCase();
        let attrVal = s.slice(eqIdx + 1, -1).trim();
        if ((attrVal.startsWith('"') && attrVal.endsWith('"')) || (attrVal.startsWith("'") && attrVal.endsWith("'"))) {
          attrVal = attrVal.slice(1, -1);
        }
        return el.getAttribute(attrKey) === attrVal;
      } else {
        const attrKey = s.slice(1, -1).trim().toLowerCase();
        return el.getAttribute(attrKey) !== null;
      }
    }
    // Tag name match (case insensitive)
    return el.tagName.toLowerCase() === s.toLowerCase();
  }

  function queryAllFromRoot(rootEl, selector) {
    const parts = selector.split(",").map(p => p.trim()).filter(Boolean);
    const results = [];
    const seen = new Set();

    function visit(node) {
      if (!node || !node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        for (let p = 0; p < parts.length; p++) {
          if (matchesSelector(child, parts[p])) {
            if (!seen.has(child)) {
              seen.add(child);
              results.push(child);
            }
            break;
          }
        }
        visit(child);
      }
    }

    visit(rootEl);
    return results;
  }

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
    const initDisabled = Object.prototype.hasOwnProperty.call(attrs, "disabled");
    let currentId = attrs["id"] || "";
    let currentInnerHtml = "";

    const el = {
      tagName: String(tagName || "div").toUpperCase(),
      type: String(attrs["type"] || "").toLowerCase(),
      name: attrs["name"] || "",
      _attrs: attrs,
      _value: initValue,
      _textContent: innerText !== undefined && innerText !== null ? String(innerText) : "",
      disabled: initDisabled,
      href: attrs["href"] || "",
      children: [],
      options: [],
      style: {},
      parentNode: null,
      onclick: null,
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
      get value() { return this._value; },
      set value(v) { this._value = v === undefined || v === null ? "" : String(v); },
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
        if (key === "value") return this._value;
        if (key === "disabled") return this.disabled ? "" : null;
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      setAttribute(k, v) {
        const key = String(k).toLowerCase();
        this._attrs[key] = String(v);
        if (key === "id") this.id = String(v);
        if (key === "href") this.href = String(v);
        if (key === "value") this._value = String(v);
        if (key === "disabled") this.disabled = true;
      },
      removeAttribute(k) {
        const key = String(k).toLowerCase();
        delete this._attrs[key];
        if (key === "disabled") this.disabled = false;
      },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        if (child.id) byId[child.id] = child;
        if (child.innerHTML) registerInnerIds(child, child.innerHTML);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        child.parentNode = null;
        if (child.id && byId[child.id] === child) delete byId[child.id];
        clearDynamicChildren(child);
        return child;
      },
      remove() {
        if (this.parentNode && typeof this.parentNode.removeChild === "function") {
          this.parentNode.removeChild(this);
        }
      },
      querySelector(sel) {
        const res = this.querySelectorAll(sel);
        return res.length > 0 ? res[0] : null;
      },
      querySelectorAll(sel) {
        return queryAllFromRoot(this, sel);
      },
      click() {
        if (typeof this.onclick === "function") {
          this.onclick({ preventDefault: function () {}, stopPropagation: function () {} });
        } else if (this._attrs["onclick"]) {
          try {
            const fn = new Function("event", this._attrs["onclick"]);
            fn.call(this, { preventDefault: function () {}, stopPropagation: function () {} });
          } catch (e) {}
        }
      },
      focus() {},
      select() {},
      reset() {}
    };

    allElements.push(el);
    if (currentId) byId[currentId] = el;
    return el;
  }

  const doc = {
    title: "",
    _byId: byId,
    _elements: allElements,
    _eventListeners: Object.create(null),
    documentElement: null,
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
      if (s.startsWith("#") && s.indexOf(" ") === -1 && s.indexOf(",") === -1) {
        const found = byId[s.slice(1)];
        return found ? [found] : [];
      }
      return queryAllFromRoot(doc.body || { children: allElements }, s);
    }
  };

  doc.documentElement = makeElement("html", Object.create(null), "");
  doc.body = makeElement("body", Object.create(null), "");

  // Build tree hierarchy from HTML tags
  const tagRe = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;
  const stack = [doc.body];

  while ((match = tagRe.exec(stripped)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = full.indexOf("</") === 0;
    const isSelfClosing = full.slice(-2) === "/>" || ["input", "img", "br", "hr", "meta", "link"].indexOf(tag) !== -1;

    if (isClosing) {
      if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tag) {
        stack.pop();
      }
      continue;
    }

    const attrs = extractAttributes(match[2] || "");
    const el = makeElement(tag, attrs, "");
    const parent = stack[stack.length - 1];
    parent.appendChild(el);

    if (!isSelfClosing) {
      stack.push(el);
    }
  }

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

function mountOwnerSettings(options = {}) {
  const search = options.search || "";
  const href = "https://resto.example.com/owner_settings_saas.html" + search;
  window.location.search = search;
  window.location.href = href;
  window.location.pathname = "/owner_settings_saas.html";

  const html = readFile("owner_settings_saas.html");
  const doc = createDomFromHtml(html);
  const win = {
    location: { search: search, href: href, pathname: "/owner_settings_saas.html", hash: "" },
    history: { replaceState: function () {} },
    addEventListener: function () {},
    matchMedia: function () { return { matches: false }; },
    postMessage: function () {},
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
  };

  RestoSync.init();

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      updateLicenseBannerUI: typeof updateLicenseBannerUI === "function" ? updateLicenseBannerUI : undefined,
      updateProFeatureLockUI: typeof updateProFeatureLockUI === "function" ? updateProFeatureLockUI : undefined,
      exportActiveLedgerCSV: typeof exportActiveLedgerCSV === "function" ? exportActiveLedgerCSV : undefined,
      openMemberModal: typeof openMemberModal === "function" ? openMemberModal : undefined,
      openOwnerAddReservationModal: typeof openOwnerAddReservationModal === "function" ? openOwnerAddReservationModal : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "RESTO_CONFIG", "RESTO_TABLES", "formatRupiah", "ThemeManager",
    "fetch", "alert", "confirm", "prompt", "navigator", "setTimeout",
    "location", "console",
    rawScript + "\n" + exportFooter
  );
  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    RESTO_CONFIG, RESTO_TABLES, formatRupiah, MOCK_THEME_MANAGER,
    fetch, alert, confirm, prompt, navigator, setTimeout,
    location, console
  );

  // Expose exported functions to global scope so inline onclick="exportActiveLedgerCSV()" works in mock DOM
  for (let k in api) {
    if (typeof api[k] === "function") {
      win[k] = api[k];
      globalThis[k] = api[k];
    }
  }

  globalThis.document = doc;
  return { html, doc, win, api };
}

// -----------------------------------------------------------------------------
// 3. Test Runner
// -----------------------------------------------------------------------------
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERTION FAILED: " + (msg || "condition is false"));
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error("ASSERTION FAILED: " + (msg || "") + " (expected: " + JSON.stringify(expected) + ", got: " + JSON.stringify(actual) + ")");
  }
}

function resetAll() {
  localStorage.clear();
  sessionStorage.clear();
  lastAlertMessage = "";
  alertCalls = [];
  confirmCalls = [];
  confirmReturnValue = true;
  window.location.search = "";
  window.location.href = "https://resto.example.com/owner_settings_saas.html";
  window.RESTO_CLOUD_CONFIG = MOCK_CLOUD_CONFIG;
}

// -----------------------------------------------------------------------------
// 4. Test Cases
// -----------------------------------------------------------------------------

test("1. Unpaid trial tenant locks 4 full sections with overlay & data-pro-locked='true', while #sectionLedger table stays accessible", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  const expIso = new Date(Date.now() + 14 * 86400000).toISOString();
  RestoSync.registerNewTenant({
    id: "warung-trial-lock",
    name: "Warung Trial Lock",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: expIso,
    _skipCloud: true
  });

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-trial-lock" });
  doc.dispatchDOMContentLoaded();

  assert(typeof api.updateProFeatureLockUI === "function", "updateProFeatureLockUI must be defined as a function");

  const secAnalytics = doc.getElementById("sectionAnalyticsBI");
  const secCrm = doc.getElementById("sectionCrmMembers");
  const secRes = doc.getElementById("sectionReservations");
  const secBackup = doc.getElementById("sectionBackupRestore");
  const secLedger = doc.getElementById("sectionLedger");

  assert(Boolean(secAnalytics), "#sectionAnalyticsBI must exist");
  assert(Boolean(secCrm), "#sectionCrmMembers must exist");
  assert(Boolean(secRes), "#sectionReservations must exist");
  assert(Boolean(secBackup), "#sectionBackupRestore must exist");
  assert(Boolean(secLedger), "#sectionLedger must exist");

  // 4 sections locked
  assertEqual(secAnalytics.getAttribute("data-pro-locked"), "true", "#sectionAnalyticsBI must have data-pro-locked='true'");
  assertEqual(secCrm.getAttribute("data-pro-locked"), "true", "#sectionCrmMembers must have data-pro-locked='true'");
  assertEqual(secRes.getAttribute("data-pro-locked"), "true", "#sectionReservations must have data-pro-locked='true'");
  assertEqual(secBackup.getAttribute("data-pro-locked"), "true", "#sectionBackupRestore must have data-pro-locked='true'");

  // Overlays rendered
  const overlayAnalytics = secAnalytics.querySelector(".pro-feature-locked-overlay");
  const overlayCrm = secCrm.querySelector(".pro-feature-locked-overlay");
  const overlayRes = secRes.querySelector(".pro-feature-locked-overlay");
  const overlayBackup = secBackup.querySelector(".pro-feature-locked-overlay");

  assert(Boolean(overlayAnalytics), "#sectionAnalyticsBI must contain .pro-feature-locked-overlay");
  assert(Boolean(overlayCrm), "#sectionCrmMembers must contain .pro-feature-locked-overlay");
  assert(Boolean(overlayRes), "#sectionReservations must contain .pro-feature-locked-overlay");
  assert(Boolean(overlayBackup), "#sectionBackupRestore must contain .pro-feature-locked-overlay");

  assert(overlayAnalytics.textContent.indexOf("Fitur Khusus Resto Pro Berbayar") !== -1, "Overlay must display title 'Fitur Khusus Resto Pro Berbayar'");
  assert(overlayAnalytics.textContent.indexOf("Bulanan & Lifetime") !== -1, "Overlay subtitle must mention 'Bulanan & Lifetime'");
  assert(overlayAnalytics.textContent.indexOf("Buka Akses Pro Sekarang") !== -1, "Overlay CTA button must say 'Buka Akses Pro Sekarang'");

  // CTA button opens RestoSync.showProFeatureLockedModal
  const unlockBtn = doc.getElementById("btn-unlock-sectionAnalyticsBI") || overlayAnalytics.querySelector(".btn-unlock-pro");
  assert(Boolean(unlockBtn), "Overlay must have unlock CTA button");
  unlockBtn.click();
  const lockModal = doc.getElementById("proFeatureLockModal");
  assert(Boolean(lockModal), "Clicking overlay CTA button must trigger proFeatureLockModal");
  assertEqual(lockModal.classList.contains("hidden"), false, "Modal must be visible");

  // Interactive buttons inside locked section are disabled
  const analyticsButtons = secAnalytics.querySelectorAll("button:not(.btn-unlock-pro)");
  assert(analyticsButtons.length > 0, "There should be buttons inside secAnalytics");
  assertEqual(analyticsButtons[0].disabled, true, "Inner buttons in locked section must be disabled");

  // #sectionLedger is NOT locked, table and controls remain open
  assertEqual(secLedger.getAttribute("data-pro-locked") === "true", false, "#sectionLedger must NOT have data-pro-locked='true'");
  const overlayLedger = secLedger.querySelector(".pro-feature-locked-overlay");
  assertEqual(Boolean(overlayLedger), false, "#sectionLedger must NOT have full section overlay");
});

test("2. Gated export on unpaid tenant: #btnExportCsvLedger displays PRO badge and triggers proFeatureLockModal on click", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-gated-export",
    name: "Warung Gated Export",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    _skipCloud: true
  });

  const { doc } = mountOwnerSettings({ search: "?tenant=warung-gated-export" });
  doc.dispatchDOMContentLoaded();

  const exportBtn = doc.getElementById("btnExportCsvLedger");
  assert(Boolean(exportBtn), "#btnExportCsvLedger must exist in DOM");

  const proBadge = doc.getElementById("badgeExportCsvPro");
  assert(Boolean(proBadge), "#badgeExportCsvPro must exist inside export button");
  assertEqual(proBadge.classList.contains("hidden"), false, "#badgeExportCsvPro must be visible for unpaid tenant");

  // Click export on unpaid tenant -> triggers pro lock modal, does not export
  exportBtn.click();
  const lockModal = doc.getElementById("proFeatureLockModal");
  assert(Boolean(lockModal), "Clicking #btnExportCsvLedger on unpaid tenant must open #proFeatureLockModal");
  assertEqual(lockModal.classList.contains("hidden"), false, "#proFeatureLockModal must not be hidden");
  const modalTitle = doc.getElementById("proModalFeatureTitle");
  assert(modalTitle.textContent.indexOf("Ekspor Pembukuan Keuangan") !== -1, "Modal title must mention 'Ekspor Pembukuan Keuangan', got: " + modalTitle.textContent);
});

test("3. Master and Paid Active (Monthly & Lifetime) tenants unlock all 5 sections and enable normal CSV export without PRO badge", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  // Lifetime tenant active
  RestoSync.registerNewTenant({
    id: "resto-sultan-vip",
    name: "Resto Sultan VIP",
    plan: "lifetime",
    status: "active",
    tablesCount: 20,
    expiresAt: "2099-12-31T23:59:59.000Z",
    _skipCloud: true
  });

  const { doc } = mountOwnerSettings({ search: "?tenant=resto-sultan-vip" });
  doc.dispatchDOMContentLoaded();

  const secAnalytics = doc.getElementById("sectionAnalyticsBI");
  const secCrm = doc.getElementById("sectionCrmMembers");
  const secRes = doc.getElementById("sectionReservations");
  const secBackup = doc.getElementById("sectionBackupRestore");

  assertEqual(secAnalytics.getAttribute("data-pro-locked"), "false", "#sectionAnalyticsBI must have data-pro-locked='false'");
  assertEqual(secCrm.getAttribute("data-pro-locked"), "false", "#sectionCrmMembers must have data-pro-locked='false'");
  assertEqual(secRes.getAttribute("data-pro-locked"), "false", "#sectionReservations must have data-pro-locked='false'");
  assertEqual(secBackup.getAttribute("data-pro-locked"), "false", "#sectionBackupRestore must have data-pro-locked='false'");

  assertEqual(secAnalytics.querySelector(".pro-feature-locked-overlay"), null, "Unlocked section must not have overlay");
  assertEqual(secCrm.querySelector(".pro-feature-locked-overlay"), null, "Unlocked section must not have overlay");

  // Controls are enabled
  const analyticsButtons = secAnalytics.querySelectorAll("button");
  assert(analyticsButtons.length > 0, "Buttons exist in analytics");
  assertEqual(analyticsButtons[0].disabled, false, "Inner buttons in unlocked section must be enabled");

  // Export button has no PRO badge
  const proBadge = doc.getElementById("badgeExportCsvPro");
  assertEqual(proBadge.classList.contains("hidden"), true, "#badgeExportCsvPro must be hidden for paid active tenant");
});

test("4. Event reactivity: TENANTS_UPDATED and LICENSE_STATUS_CHANGED dynamically toggle locks without page reload", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  // Start unpaid
  RestoSync.registerNewTenant({
    id: "warung-upgrade-flow",
    name: "Warung Upgrade Flow",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    _skipCloud: true
  });

  const { doc } = mountOwnerSettings({ search: "?tenant=warung-upgrade-flow" });
  doc.dispatchDOMContentLoaded();

  const secAnalytics = doc.getElementById("sectionAnalyticsBI");
  assertEqual(secAnalytics.getAttribute("data-pro-locked"), "true", "Initially locked");

  // Simulate payment approval in background
  RestoSync.updateTenant("warung-upgrade-flow", {
    plan: "monthly",
    status: "active",
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });

  // Fire event
  RestoSync.emit("LICENSE_STATUS_CHANGED");

  assertEqual(secAnalytics.getAttribute("data-pro-locked"), "false", "After LICENSE_STATUS_CHANGED, section must be unlocked");
  assertEqual(secAnalytics.querySelector(".pro-feature-locked-overlay"), null, "Overlay must be removed");

  // Now simulate expiration
  RestoSync.updateTenant("warung-upgrade-flow", {
    status: "expired",
    expiresAt: new Date(Date.now() - 86400000).toISOString()
  });

  RestoSync.emit("TENANTS_UPDATED");

  assertEqual(secAnalytics.getAttribute("data-pro-locked"), "true", "After expiration and TENANTS_UPDATED, section must lock again");
  assert(Boolean(secAnalytics.querySelector(".pro-feature-locked-overlay")), "Overlay must re-appear");
});

// -----------------------------------------------------------------------------
// 5. Execute All Tests
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

print("===============================================================================");
print("RUNNING TESTS: Task 3 — Visual Pro Feature Locks on owner_settings_saas.html");
print("===============================================================================");

for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  try {
    t.fn();
    print("  [PASS] " + t.name);
    passed++;
  } catch (err) {
    print("  [FAIL] " + t.name);
    print("         " + (err && err.message ? err.message : String(err)));
    failed++;
  }
}

print("===============================================================================");
print("HASIL: " + passed + " passed, " + failed + " failed, total " + tests.length);
print("===============================================================================");

if (failed > 0) {
  throw new Error(failed + " test(s) failed.");
}
