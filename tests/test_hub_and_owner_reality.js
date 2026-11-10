/**
 * Test Suite Tahap 1 — Task 4: Realita Hub (resto_hub.html) & Panel Owner Dinamis (owner_settings_saas.html)
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_hub_and_owner_reality.js
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
    href: "https://resto.example.com/resto_hub.html",
    pathname: "/resto_hub.html",
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
// 2. HTML Parser & Lightweight DOM Harness for Headless Testing
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

  const doc = {
    title: "",
    _byId: byId,
    _elements: allElements,
    _eventListeners: Object.create(null),
    documentElement: null,
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
      const nestedClsMatch = s.match(/^#([a-zA-Z0-9_-]+)\s+\.([a-zA-Z0-9_-]+)$/);
      if (nestedClsMatch) {
        const cls = nestedClsMatch[2];
        return allElements.filter(el => el.classList.contains(cls));
      }
      return [];
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
        if (this.id === "tenantSuspendedOverlay" || this.id === "proFeatureLockModal") {
          clearDynamicChildren(this);
          registerInnerIds(this, currentInnerHtml);
        }
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
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      setAttribute(k, v) {
        const key = String(k).toLowerCase();
        this._attrs[key] = String(v);
        if (key === "id") this.id = String(v);
        if (key === "href") this.href = String(v);
        if (key === "value") this._value = String(v);
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
      focus() {},
      select() {},
      querySelector() { return null; },
      reset() {}
    };

    allElements.push(el);
    if (currentId) byId[currentId] = el;
    return el;
  }

  const tagRe = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;
  let activeSelectEl = null;

  while ((match = tagRe.exec(stripped)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = full.indexOf("</") === 0;
    const isSelfClosing = full.slice(-2) === "/>";

    if (isClosing) {
      if (tag === "select" && activeSelectEl) {
        if (!activeSelectEl._value && activeSelectEl.options.length > 0) {
          activeSelectEl._value = activeSelectEl.options[0].value;
        }
        activeSelectEl = null;
      }
      continue;
    }

    const attrs = extractAttributes(match[2] || "");

    if (tag === "select") {
      const selEl = makeElement("select", attrs, "");
      if (!isSelfClosing) activeSelectEl = selEl;
      continue;
    }

    if (tag === "option" && activeSelectEl) {
      const optVal = attrs["value"] !== undefined ? attrs["value"] : "";
      const isSelected = Object.prototype.hasOwnProperty.call(attrs, "selected");
      activeSelectEl.options.push({ value: optVal, selected: isSelected });
      if (isSelected) activeSelectEl._value = optVal;
      continue;
    }

    if (tag === "input" || tag === "button" || tag === "textarea" || tag === "a" || attrs["id"]) {
      // Extract simple inner text for static elements with an ID if immediately closed
      let innerText = "";
      if (attrs["id"] && !isSelfClosing) {
        const rest = stripped.slice(match.index + full.length);
        const closeIdx = rest.indexOf("</" + tag + ">");
        if (closeIdx !== -1 && closeIdx < 200) {
          innerText = rest.slice(0, closeIdx).replace(/<[^>]+>/g, "").trim();
        }
      }
      makeElement(tag, attrs, innerText);
    }
  }

  doc.documentElement = makeElement("html", Object.create(null), "");
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

function mountRestoHub(options = {}) {
  const search = options.search || "";
  const href = "https://resto.example.com/resto_hub.html" + search;
  window.location.search = search;
  window.location.href = href;
  window.location.pathname = "/resto_hub.html";

  const html = readFile("resto_hub.html");
  const doc = createDomFromHtml(html);
  const win = {
    location: { search: search, href: href, pathname: "/resto_hub.html", hash: "" },
    history: { replaceState: function () {} },
    addEventListener: function () {},
    matchMedia: function () { return { matches: false }; },
    postMessage: function () {},
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
  };

  // Simulate <script src="assets/js/resto-sync.js"> initializing defaults for this page's tenant
  RestoSync.init();

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      initRestoHub: typeof initRestoHub === "function" ? initRestoHub : undefined,
      renderRestaurantInfo: typeof renderRestaurantInfo === "function" ? renderRestaurantInfo : undefined,
      renderOperationalLinks: typeof renderOperationalLinks === "function" ? renderOperationalLinks : undefined,
      copyRestoHubLink: typeof copyRestoHubLink === "function" ? copyRestoHubLink : undefined,
      showToast: typeof showToast === "function" ? showToast : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "ThemeManager", "fetch", "alert", "prompt", "navigator", "setTimeout",
    "requestAnimationFrame", "console",
    rawScript + "\n" + exportFooter
  );
  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    MOCK_THEME_MANAGER, fetch, alert, prompt, navigator, setTimeout,
    requestAnimationFrame, console
  );

  // Also keep global document pointed at doc for RestoSync guards when omitted
  globalThis.document = doc;
  return { html, doc, win, api };
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

  // Simulate <script src="assets/js/resto-sync.js"> initializing defaults for this page's tenant
  RestoSync.init();

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      updateLicenseBannerUI: typeof updateLicenseBannerUI === "function" ? updateLicenseBannerUI : undefined,
      handleActivateToken: typeof handleActivateToken === "function" ? handleActivateToken : undefined,
      toggleSimulationLicense: typeof toggleSimulationLicense === "function" ? toggleSimulationLicense : undefined,
      renderOwnerTables: typeof renderOwnerTables === "function" ? renderOwnerTables : undefined,
      openAddTableModal: typeof openAddTableModal === "function" ? openAddTableModal : undefined,
      openEditTableModal: typeof openEditTableModal === "function" ? openEditTableModal : undefined,
      handleDeleteOwnerTable: typeof handleDeleteOwnerTable === "function" ? handleDeleteOwnerTable : undefined,
      applyOwnerTenantBranding: typeof applyOwnerTenantBranding === "function" ? applyOwnerTenantBranding : undefined
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

  globalThis.document = doc;
  return { html, doc, win, api };
}

// -----------------------------------------------------------------------------
// 3. Test Helpers & Runner
// -----------------------------------------------------------------------------
function resetAll() {
  localStorage.clear();
  sessionStorage.clear();
  lastAlertMessage = "";
  alertCalls = [];
  confirmCalls = [];
  confirmReturnValue = true;
  window.location.search = "";
  window.location.href = "https://resto.example.com/resto_hub.html";
  window.RESTO_CLOUD_CONFIG = MOCK_CLOUD_CONFIG;
  fetch = function () {
    return Promise.reject(new Error("Offline mock"));
  };
  if (typeof RestoSync !== "undefined") {
    RestoSync.listeners = {};
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "Mismatch") + " — expected: " + JSON.stringify(expected) + ", actual: " + JSON.stringify(actual));
  }
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// -----------------------------------------------------------------------------
// 4. Test Cases (Task 4 Brief + Spec 1A/2A/3A + 4-Table Gating)
// -----------------------------------------------------------------------------

test("1. resto_hub.html Trial tenant shows Trial 14 Hari Gratis, s/d date, Sisa 14 Hari Masa Aktif, Maks. 4 Meja, and masks PINs as ••••", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  const expIso = new Date(Date.now() + 14 * 86400000).toISOString();
  RestoSync.registerNewTenant({
    id: "warung-maju",
    name: "Warung Maju",
    pic: "Pak Budi",
    city: "Bandung",
    plan: "trial",
    status: "trial",
    tablesCount: 12,
    cashierPin: "5678",
    ownerPin: "8899",
    expiresAt: expIso,
    _skipCloud: true
  });

  const { html, doc } = mountRestoHub({ search: "?tenant=warung-maju" });
  doc.dispatchDOMContentLoaded();

  assertEqual(doc.getElementById("restaurantTitle").textContent, "Warung Maju", "Restaurant title must match tenant name");
  assertEqual(doc.getElementById("tenantIdDisplay").textContent, "warung-maju", "Tenant ID display must match slug");
  assert(doc.getElementById("tenantPlanBadge").textContent.indexOf("Trial 14 Hari Gratis") !== -1, "Trial plan badge must display 'Trial 14 Hari Gratis', got: " + doc.getElementById("tenantPlanBadge").textContent);
  assert(doc.getElementById("tenantExpiryDisplay").textContent.indexOf("s/d ") === 0, "Trial expiry must start with 's/d ', got: " + doc.getElementById("tenantExpiryDisplay").textContent);
  assertEqual(doc.getElementById("tenantDaysRemaining").textContent, "Sisa 14 Hari Masa Aktif", "Remaining days must be 'Sisa 14 Hari Masa Aktif'");
  assert(doc.getElementById("tenantTablesDisplay").textContent.indexOf("Maks. 4 Meja") !== -1, "Trial tables info must mention 'Maks. 4 Meja', got: " + doc.getElementById("tenantTablesDisplay").textContent);

  assertEqual(doc.getElementById("displayCashierPin").textContent, "••••", "Cashier PIN must be masked as ••••");
  assertEqual(doc.getElementById("displayOwnerPin").textContent, "••••", "Owner PIN must be masked as ••••");
  assertEqual(html.indexOf("(1234)"), -1, "resto_hub.html must NOT display '(1234)' PIN hints");
  assertEqual(doc.getElementById("btnSuperAdminNav").classList.contains("hidden"), true, "Super Admin nav button must remain hidden for non-Master tenant");
});

test("2. resto_hub.html for unknown/unsynced tenant (notSynced: true) never shows Aktif Selamanya and shows Belum Tersinkronisasi", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });

  const { doc } = mountRestoHub({ search: "?tenant=warung-asing" });
  doc.dispatchDOMContentLoaded();

  const expiryText = doc.getElementById("tenantExpiryDisplay").textContent;
  assertEqual(expiryText.indexOf("Aktif Selamanya"), -1, "Unsynced tenant must NEVER display 'Aktif Selamanya'");
  assert(expiryText.indexOf("Belum Tersinkronisasi") !== -1, "Unsynced tenant must display 'Belum Tersinkronisasi', got: " + expiryText);
  assert(doc.getElementById("tenantPlanBadge").textContent.indexOf("Belum Tersinkronisasi") !== -1, "Unsynced plan badge must show 'Belum Tersinkronisasi'");
  assert(doc.getElementById("tenantTablesDisplay").textContent.indexOf("Maks. 4 Meja") !== -1, "Unsynced tenant must be capped at Maks. 4 Meja");
  assertEqual(doc.getElementById("displayCashierPin").textContent, "••••", "Unsynced tenant must mask cashier PIN");
});

test("3. resto_hub.html for lifetime tenant displays Aktif Selamanya (Lifetime) and full tablesCount", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-bu-siti",
    name: "Warung Bu Siti",
    pic: "Bu Siti",
    city: "Surabaya",
    plan: "lifetime",
    status: "active",
    isLifetime: true,
    tablesCount: 10,
    expiresAt: null,
    _skipCloud: true
  });

  const { doc } = mountRestoHub({ search: "?tenant=warung-bu-siti" });
  doc.dispatchDOMContentLoaded();

  assertEqual(doc.getElementById("tenantExpiryDisplay").textContent, "Aktif Selamanya (Lifetime)", "Lifetime expiry must show 'Aktif Selamanya (Lifetime)'");
  assertEqual(doc.getElementById("tenantStatusText").textContent, "Akun Aktif", "Lifetime status must show 'Akun Aktif'");
  assert(doc.getElementById("tenantTablesDisplay").textContent.indexOf("10 Meja") !== -1, "Lifetime tenant must show configured 10 tables");
  assertEqual(doc.getElementById("tenantTablesDisplay").textContent.indexOf("Belum Bayar"), -1, "Lifetime tenant must NOT show Belum Bayar");
});

test("4. owner_settings_saas.html updateLicenseBannerUI() renders dynamic tenant info, 4-table unpaid limit, hides manual token box & sim toggle for non-Master, and shows WhatsApp Cloud CTA", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  const expIso = new Date(Date.now() + 14 * 86400000).toISOString();
  RestoSync.registerNewTenant({
    id: "warung-maju",
    name: "Warung Maju",
    pic: "Pak Budi",
    city: "Bandung",
    plan: "trial",
    status: "trial",
    tablesCount: 10,
    expiresAt: expIso,
    _skipCloud: true
  });

  const { html, doc } = mountOwnerSettings({ search: "?tenant=warung-maju" });
  doc.dispatchDOMContentLoaded();

  assertEqual(html.indexOf("Grand Fusion Bistro Jakarta"), -1, "owner_settings_saas.html must not contain hardcoded 'Grand Fusion Bistro Jakarta'");
  assertEqual(html.indexOf("RASH-PRO-88219"), -1, "owner_settings_saas.html must not contain hardcoded 'RASH-PRO-88219'");

  assertEqual(doc.getElementById("licenseRestoNameLabel").textContent, "Warung Maju", "#licenseRestoNameLabel must equal 'Warung Maju'");
  assertEqual(doc.getElementById("licenseClientIdLabel").textContent, "warung-maju", "#licenseClientIdLabel must equal 'warung-maju'");

  const expiryText = doc.getElementById("licenseExpiryLabel").textContent;
  assertEqual(expiryText.indexOf("31 Desember 2028"), -1, "#licenseExpiryLabel must never say '31 Desember 2028'");
  assertEqual(expiryText.indexOf("Aktif Selamanya"), -1, "Trial #licenseExpiryLabel must not say 'Aktif Selamanya'");

  const limitText = doc.getElementById("licenseTableLimitLabel").textContent;
  assert(limitText.indexOf("Maksimal 4 Meja (Belum Bayar)") !== -1, "#licenseTableLimitLabel must show 'Maksimal 4 Meja (Belum Bayar)', got: " + limitText);

  const manualBox = doc.getElementById("masterManualTokenBox");
  const cloudPlanBox = doc.getElementById("tenantCloudPlanBox");
  const simBtn = doc.getElementById("btnToggleSimLicense");
  assert(Boolean(manualBox), "#masterManualTokenBox must exist");
  assert(Boolean(cloudPlanBox), "#tenantCloudPlanBox must exist");
  assert(Boolean(simBtn), "#btnToggleSimLicense must exist");

  assertEqual(manualBox.classList.contains("hidden"), true, "#masterManualTokenBox must be hidden for non-Master tenant");
  assertEqual(cloudPlanBox.classList.contains("hidden"), false, "#tenantCloudPlanBox must be visible for non-Master tenant");
  assertEqual(simBtn.classList.contains("hidden"), true, "#btnToggleSimLicense must be hidden for non-Master tenant");

  const waBtn = doc.getElementById("btnTenantUpgradeWa");
  assert(Boolean(waBtn), "#btnTenantUpgradeWa CTA link must exist inside #tenantCloudPlanBox");
  assert(waBtn.href.indexOf("https://wa.me/6282286452105") === 0, "WhatsApp CTA must point to 6282286452105");
  assert(waBtn.href.indexOf("warung-maju") !== -1, "WhatsApp CTA text must include tenant ID warung-maju");
});

test("5. owner_settings_saas.html openAddTableModal() at 4 tables on unpaid tenant triggers #proFeatureLockModal instead of opening #tableFormModal", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-maju",
    name: "Warung Maju",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    _skipCloud: true
  });

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-maju" });
  doc.dispatchDOMContentLoaded();

  assertEqual(RestoSync.getTables().length, 4, "Initial trial tables should be 4");
  assertEqual(RestoSync.canAddTable(), false, "canAddTable() must be false at 4 tables on trial");

  api.openAddTableModal();

  assertEqual(doc.getElementById("tableFormModal").classList.contains("hidden"), true, "#tableFormModal must stay hidden when 4-table cap is reached");
  const lockModal = doc.getElementById("proFeatureLockModal");
  assert(Boolean(lockModal), "#proFeatureLockModal must be rendered when limit is reached");
  assertEqual(lockModal.classList.contains("hidden"), false, "#proFeatureLockModal must be visible");
  const descText = doc.getElementById("proModalFeatureDesc").textContent;
  assertEqual(descText.indexOf("Masukkan token lisensi"), -1, "Non-Master locked modal must NOT prompt for offline license token");
  assert(descText.indexOf("Admin RASH") !== -1, "Non-Master locked modal must direct tenant to Admin RASH");
});

test("6. owner_settings_saas.html renderOwnerTables() marks existing tables idx >= 4 as Terkunci - Belum Bayar with disabled QR/edit actions", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-maju",
    name: "Warung Maju",
    plan: "trial",
    status: "trial",
    tablesCount: 6,
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    _skipCloud: true
  });

  // Simulate 6 tables already existing in storage (e.g. downgraded from paid to trial or expired)
  window.location.search = "?tenant=warung-maju";
  const sixTables = [];
  for (let i = 1; i <= 6; i++) {
    const tbl = RestoSync._buildDefaultTableItem(i);
    if (i === 5) { tbl.name = "VIP Teras"; tbl.isCustom = true; }
    if (i === 6) { tbl.status = "occupied"; }
    sixTables.push(tbl);
  }
  RestoSync.saveTables(sixTables);

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-maju" });
  doc.dispatchDOMContentLoaded();

  const gridHtml = doc.getElementById("ownerTablesGrid").innerHTML;
  assert(gridHtml.indexOf("Terkunci - Belum Bayar") !== -1, "Tables beyond index 4 must be marked 'Terkunci - Belum Bayar'");
  assert(gridHtml.indexOf("customer_qr_self_order.html?tenant=warung-maju&table=T01") !== -1 || gridHtml.indexOf("table=T01") !== -1, "Table T01 must keep active QR link");
  assertEqual(gridHtml.indexOf("openEditTableModal('T05')"), -1, "Locked table T05 must NOT have enabled openEditTableModal action");
  assertEqual(gridHtml.indexOf("openEditTableModal('T06')"), -1, "Locked table T06 must NOT have enabled openEditTableModal action");
  assertEqual(gridHtml.indexOf("table=T05"), -1, "Locked table T05 must NOT have clickable QR preview link");

  // Also test calling openEditTableModal('T05') directly does not open #tableFormModal
  api.openEditTableModal("T05");
  assertEqual(doc.getElementById("tableFormModal").classList.contains("hidden"), true, "Locked table T05 must not open edit modal");
});

test("7. Expired red warning banner & Suspended access guard trigger on load and via Cloud sync TENANTS_UPDATED across Hub & Owner", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-telat",
    name: "Warung Telat",
    plan: "monthly",
    status: "active",
    tablesCount: 8,
    expiresAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    _skipCloud: true
  });

  // 7a. Expired tenant on resto_hub.html
  const hubExp = mountRestoHub({ search: "?tenant=warung-telat" });
  hubExp.doc.dispatchDOMContentLoaded();
  const hubBanner = hubExp.doc.getElementById("hubExpiredBanner");
  assert(Boolean(hubBanner), "resto_hub.html must have #hubExpiredBanner");
  assertEqual(hubBanner.classList.contains("hidden"), false, "#hubExpiredBanner must be visible for expired tenant");
  assert(hubExp.doc.getElementById("tenantTablesDisplay").textContent.indexOf("Maks. 4 Meja") !== -1, "Expired tenant on Hub must show Maks. 4 Meja");

  // 7b. Expired tenant on owner_settings_saas.html
  const ownerExp = mountOwnerSettings({ search: "?tenant=warung-telat" });
  ownerExp.doc.dispatchDOMContentLoaded();
  const ownerBanner = ownerExp.doc.getElementById("ownerExpiredWarningBanner");
  assert(Boolean(ownerBanner), "owner_settings_saas.html must have #ownerExpiredWarningBanner");
  assertEqual(ownerBanner.classList.contains("hidden"), false, "#ownerExpiredWarningBanner must be visible for expired tenant");
  assert(ownerExp.doc.getElementById("licenseTableLimitLabel").textContent.indexOf("Maksimal 4 Meja (Belum Bayar)") !== -1, "Expired tenant in Owner panel must drop limit to 4");

  // 7c. Cloud sync updates active trial tenant -> suspended on Hub & Owner
  RestoSync.registerNewTenant({
    id: "warung-cloud",
    name: "Warung Cloud",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });

  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          cloudInitialized: true,
          tenant: {
            id: "warung-cloud",
            name: "Warung Cloud",
            pic: "Owner Cloud",
            city: "Jakarta",
            plan: "monthly",
            planName: "Paket Bulanan",
            status: "suspended",
            tablesCount: 8,
            isLifetime: false,
            expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
            cashierPinHash: RestoSync.hashTenantPin("warung-cloud", "9876"),
            ownerPinHash: RestoSync.hashTenantPin("warung-cloud", "9876")
          }
        });
      }
    });
  };

  const hubCloud = mountRestoHub({ search: "?tenant=warung-cloud" });
  hubCloud.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assert(Boolean(hubCloud.doc.getElementById("tenantSuspendedOverlay")), "Cloud sync returning suspended must trigger #tenantSuspendedOverlay on resto_hub.html");
  assertEqual(hubCloud.doc.getElementById("displayCashierPin").textContent, "••••", "Cashier PIN must remain masked after Cloud sync");

  const ownerCloud = mountOwnerSettings({ search: "?tenant=warung-cloud" });
  ownerCloud.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assert(Boolean(ownerCloud.doc.getElementById("tenantSuspendedOverlay")), "Cloud sync returning suspended must trigger #tenantSuspendedOverlay on owner_settings_saas.html");
});

test("8. Master (default) keeps manual token box & simulation toggle visible and Owner XSS escaping protects branding & tables", function () {
  resetAll();
  const masterMount = mountOwnerSettings({ search: "" });
  masterMount.doc.dispatchDOMContentLoaded();

  assertEqual(masterMount.doc.getElementById("masterManualTokenBox").classList.contains("hidden"), false, "Master must see #masterManualTokenBox");
  assertEqual(masterMount.doc.getElementById("tenantCloudPlanBox").classList.contains("hidden"), true, "Master must hide #tenantCloudPlanBox");
  assertEqual(masterMount.doc.getElementById("btnToggleSimLicense").classList.contains("hidden"), false, "Master must see #btnToggleSimLicense");
  assert(masterMount.doc.getElementById("licenseExpiryLabel").textContent.indexOf("Aktif Selamanya (Master)") !== -1, "Master expiry must show Aktif Selamanya (Master)");

  // XSS escaping test on non-Master tenant
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-xss",
    name: '<img src=x onerror=alert(1)>Warung "Aman"',
    pic: '<script>evil()</script>',
    plan: "monthly",
    status: "active",
    tablesCount: 2,
    expiresAt: new Date(Date.now() + 25 * 86400000).toISOString(),
    _skipCloud: true
  });

  const xssMount = mountOwnerSettings({ search: "?tenant=warung-xss" });
  xssMount.doc.dispatchDOMContentLoaded();
  const titleHtml = xssMount.doc.getElementById("ownerDashboardTitle").innerHTML;
  assertEqual(titleHtml.indexOf("<img"), -1, "ownerDashboardTitle innerHTML must escape <img XSS payloads");
  assert(titleHtml.indexOf("&lt;img") !== -1, "Escaped &lt;img should be present in ownerDashboardTitle");

  // Also check XSS escaping in renderOwnerTables()
  RestoSync.addTable({ name: '<img src=x onerror=alert(9)>Meja X', seats: 4, section: '<b>VIP</b>' });
  xssMount.api.renderOwnerTables();
  const tablesGridHtml = xssMount.doc.getElementById("ownerTablesGrid").innerHTML;
  assertEqual(tablesGridHtml.indexOf("<img"), -1, "ownerTablesGrid innerHTML must escape <img XSS payloads in table names");
  assert(tablesGridHtml.indexOf("&lt;img") !== -1, "Escaped &lt;img should be present in ownerTablesGrid");

  // Live Cloud upgrade re-render via TENANTS_UPDATED (trial -> monthly active 8 tables)
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-naik",
    name: "Warung Naik",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    _skipCloud: true
  });
  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          cloudInitialized: true,
          tenant: {
            id: "warung-naik",
            name: "Warung Naik Pro",
            pic: "Owner Pro",
            city: "Semarang",
            plan: "monthly",
            planName: "Paket Bulanan",
            status: "active",
            tablesCount: 8,
            isLifetime: false,
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
            cashierPinHash: RestoSync.hashTenantPin("warung-naik", "1234"),
            ownerPinHash: RestoSync.hashTenantPin("warung-naik", "1234")
          }
        });
      }
    });
  };
  const liveOwner = mountOwnerSettings({ search: "?tenant=warung-naik" });
  liveOwner.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assertEqual(liveOwner.doc.getElementById("licenseRestoNameLabel").textContent, "Warung Naik Pro", "TENANTS_UPDATED must refresh resto name");
  assert(liveOwner.doc.getElementById("licenseTableLimitLabel").textContent.indexOf("Unlimited Tables") !== -1, "TENANTS_UPDATED to monthly active must unlock Unlimited Tables");
  assertEqual(RestoSync.getTables().length, 8, "Cloud upgrade to 8 tables must sync table list");
});

test("9. Fix Round 1: unpaid/pending lifetime tenant never renders Aktif Selamanya (Lifetime) or Akun Aktif; paid active lifetime still does", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-life-pending",
    name: "Warung Life Pending",
    plan: "lifetime",
    status: "pending",
    isLifetime: true,
    tablesCount: 10,
    expiresAt: null,
    _skipCloud: true
  });

  // Hub checks for pending lifetime
  const hubPending = mountRestoHub({ search: "?tenant=warung-life-pending" });
  hubPending.doc.dispatchDOMContentLoaded();
  assertEqual(hubPending.doc.getElementById("tenantExpiryDisplay").textContent.indexOf("Aktif Selamanya"), -1, "Pending lifetime on Hub must NOT show 'Aktif Selamanya'");
  assertEqual(hubPending.doc.getElementById("tenantStatusText").textContent, "Menunggu Pembayaran", "Pending lifetime on Hub must show 'Menunggu Pembayaran'");
  assert(hubPending.doc.getElementById("tenantExpiryDisplay").textContent.indexOf("Menunggu Aktivasi") !== -1, "Pending lifetime expiry on Hub should show waiting activation/confirmation");
  assert(hubPending.doc.getElementById("tenantTablesDisplay").textContent.indexOf("Maks. 4 Meja") !== -1, "Pending lifetime on Hub must stay capped at Maks. 4 Meja");

  // Owner checks for pending lifetime
  const ownerPending = mountOwnerSettings({ search: "?tenant=warung-life-pending" });
  ownerPending.doc.dispatchDOMContentLoaded();
  assertEqual(ownerPending.doc.getElementById("licenseExpiryLabel").textContent.indexOf("Aktif Selamanya"), -1, "Pending lifetime in Owner must NOT show 'Aktif Selamanya'");
  assert(ownerPending.doc.getElementById("licenseExpiryLabel").textContent.indexOf("Menunggu Aktivasi") !== -1, "Pending lifetime in Owner must show waiting activation");
  assert(ownerPending.doc.getElementById("licenseTableLimitLabel").textContent.indexOf("Maksimal 4 Meja (Belum Bayar)") !== -1, "Pending lifetime in Owner must show Maksimal 4 Meja (Belum Bayar)");
  assertEqual(ownerPending.doc.getElementById("btnTenantUpgradeWa").href.indexOf("Lifetime%20Aktif"), -1, "Pending lifetime WhatsApp CTA must NOT claim 'Lifetime Aktif'");

  // Verify paid active lifetime still shows Aktif Selamanya (Lifetime) on both Hub & Owner
  RestoSync.updateTenant("warung-life-pending", { status: "active", _skipCloud: true });
  const hubActive = mountRestoHub({ search: "?tenant=warung-life-pending" });
  hubActive.doc.dispatchDOMContentLoaded();
  assertEqual(hubActive.doc.getElementById("tenantExpiryDisplay").textContent, "Aktif Selamanya (Lifetime)", "Active lifetime on Hub must still show 'Aktif Selamanya (Lifetime)'");
  assertEqual(hubActive.doc.getElementById("tenantStatusText").textContent, "Akun Aktif", "Active lifetime on Hub must show 'Akun Aktif'");

  const ownerActive = mountOwnerSettings({ search: "?tenant=warung-life-pending" });
  ownerActive.doc.dispatchDOMContentLoaded();
  assertEqual(ownerActive.doc.getElementById("licenseExpiryLabel").textContent, "Aktif Selamanya (Lifetime)", "Active lifetime in Owner must show 'Aktif Selamanya (Lifetime)'");
  assert(ownerActive.doc.getElementById("licenseTableLimitLabel").textContent.indexOf("Unlimited Tables") !== -1, "Active lifetime in Owner must unlock Unlimited Tables");
});

test("10. Fix Round 1: deleting early tables on downgraded unpaid tenant unlocks former #5/#6 tables shifted to idx 0..3 even if isLockedByBilling is true", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-geser",
    name: "Warung Geser",
    plan: "trial",
    status: "trial",
    tablesCount: 6,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });

  window.location.search = "?tenant=warung-geser";
  const sixTables = [];
  for (let i = 1; i <= 6; i++) {
    const tbl = RestoSync._buildDefaultTableItem(i);
    if (i >= 5) {
      tbl.isLockedByBilling = true;
      tbl.isCustom = true;
      tbl.name = "Meja VIP 0" + i;
    }
    sixTables.push(tbl);
  }
  RestoSync.saveTables(sixTables);

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-geser" });
  doc.dispatchDOMContentLoaded();

  // Delete T01 and T02 -> T05 & T06 shift into indices 2 & 3 (now 4 tables total: T03, T04, T05, T06)
  confirmReturnValue = true;
  api.handleDeleteOwnerTable("T01");
  api.handleDeleteOwnerTable("T02");

  const remaining = RestoSync.getTables();
  assertEqual(remaining.length, 4, "4 tables should remain after deleting T01 and T02");
  assertEqual(RestoSync.getUsableTables().length, 4, "All 4 remaining tables must be usable via getUsableTables()");

  const gridHtml = doc.getElementById("ownerTablesGrid").innerHTML;
  assertEqual(gridHtml.indexOf("Terkunci - Belum Bayar"), -1, "No table at idx 0..3 may remain locked after shifting down");
  assert(gridHtml.indexOf("openEditTableModal('T05')") !== -1, "T05 at idx 2 must have active edit button");
  assert(gridHtml.indexOf("openEditTableModal('T06')") !== -1, "T06 at idx 3 must have active edit button");

  // Calling openEditTableModal('T05') must open #tableFormModal instead of lock modal
  api.openEditTableModal("T05");
  assertEqual(doc.getElementById("tableFormModal").classList.contains("hidden"), false, "openEditTableModal('T05') must open #tableFormModal when T05 is at idx < 4");
  assertEqual(doc.getElementById("tableFormEditId").value, "T05", "Editing T05 must populate #tableFormEditId");
});

// -----------------------------------------------------------------------------
// 5. Execute All Tests
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

print("===============================================================================");
print("RUNNING TESTS: Task 4 — resto_hub.html & owner_settings_saas.html");
print("===============================================================================");

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
    print("  [PASS] " + t.name);
  } catch (err) {
    failed++;
    print("  [FAIL] " + t.name + " -> " + (err && err.message ? err.message : String(err)));
  }
}

print("===============================================================================");
print("HASIL: " + passed + " passed, " + failed + " failed, total " + tests.length);
print("===============================================================================");
if (failed > 0) {
  throw new Error("Test suite failed: " + failed + " failures");
}
