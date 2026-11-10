/**
 * Test Suite Tahap 1 — Task 5: Operational Screens Cloud Sync, 4-Table Limit & Cache v2.7.0
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_operational_screens_sync.js
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

var fetchCalls = [];
var fetch = function (url) {
  fetchCalls.push(String(url));
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

var qrCodeCalls = [];
var MockQRCode = function (el, opts) {
  qrCodeCalls.push({ el: el, opts: opts });
  if (el && typeof el.setAttribute === "function") {
    el.setAttribute("data-qr-text", opts && opts.text ? opts.text : "");
  }
};
MockQRCode.CorrectLevel = { M: 0, L: 1, H: 2, Q: 3 };

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
  matchMedia: function () { return { matches: false }; },
  postMessage: function () {},
  print: function () {},
  RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
};

var location = {
  reload: function () {}
};

// Load shared scripts first (as HTML pages do)
load("assets/js/resto-config.js");
load("assets/js/resto-data.js");
load("assets/js/resto-sync.js");

const DEFAULT_RESTO_TABLES_SNAPSHOT = JSON.parse(JSON.stringify(RESTO_TABLES));
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

function toCamelDatasetKey(attrName) {
  return String(attrName || "")
    .replace(/^data-/, "")
    .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
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
      if (/^[a-zA-Z0-9]+$/.test(s)) {
        const targetTag = s.toUpperCase();
        return allElements.filter(el => el.tagName === targetTag);
      }
      const nestedClsMatch = s.match(/^#([a-zA-Z0-9_-]+)\s+\.([a-zA-Z0-9_-]+)$/);
      if (nestedClsMatch) {
        const cls = nestedClsMatch[2];
        return allElements.filter(el => el.classList.contains(cls));
      }
      const nestedTagMatch = s.match(/^#([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)$/);
      if (nestedTagMatch) {
        const targetTag = nestedTagMatch[2].toUpperCase();
        return allElements.filter(el => el.tagName === targetTag);
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
    const datasetObj = Object.create(null);
    Object.keys(attrs).forEach(k => {
      if (k.indexOf("data-") === 0) {
        datasetObj[toCamelDatasetKey(k)] = attrs[k];
      }
    });
    let currentId = attrs["id"] || "";
    let currentInnerHtml = "";

    const el = {
      tagName: String(tagName || "div").toUpperCase(),
      type: String(attrs["type"] || "").toLowerCase(),
      name: attrs["name"] || "",
      dataset: datasetObj,
      _attrs: attrs,
      _value: initValue,
      _textContent: innerText !== undefined && innerText !== null ? String(innerText) : "",
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
        if (currentInnerHtml === "") {
          this.children = [];
        }
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
      get innerText() { return this._textContent; },
      set innerText(v) {
        this.textContent = v;
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
        if (key.indexOf("data-") === 0) this.dataset[toCamelDatasetKey(key)] = String(v);
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

    if (tag === "input" || tag === "button" || tag === "textarea" || tag === "a" || tag === "h1" || attrs["id"]) {
      let innerText = "";
      if ((attrs["id"] || tag === "button" || tag === "h1") && !isSelfClosing) {
        const rest = stripped.slice(match.index + full.length);
        const closeIdx = rest.indexOf("</" + tag + ">");
        if (closeIdx !== -1 && closeIdx < 250) {
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

function resetDefaultGlobalTables() {
  RESTO_TABLES.length = 0;
  DEFAULT_RESTO_TABLES_SNAPSHOT.forEach(t => RESTO_TABLES.push(JSON.parse(JSON.stringify(t))));
}

function mountHtmlScreen(filePath, options = {}) {
  const search = options.search || "";
  const href = "https://resto.example.com/" + filePath + search;
  window.location.search = search;
  window.location.href = href;
  window.location.pathname = "/" + filePath;

  resetDefaultGlobalTables();

  const html = readFile(filePath);
  const doc = createDomFromHtml(html);
  const win = {
    location: { search: search, href: href, pathname: "/" + filePath, hash: "" },
    history: { replaceState: function () {} },
    addEventListener: function () {},
    matchMedia: function () { return { matches: false }; },
    postMessage: function () {},
    print: function () {},
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
  };

  RestoSync.init();

  const rawScript = extractInlineScript(html);
  const exportFooter = options.exportFooter || "return {};";
  const timerFn = options.runImmediateTimeouts
    ? function (fn) { if (typeof fn === "function") fn(); return 1; }
    : setTimeout;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "RESTO_CONFIG", "RESTO_TABLES", "MENU_ITEMS", "formatRupiah", "ThemeManager",
    "fetch", "alert", "confirm", "prompt", "navigator", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "requestAnimationFrame", "location", "console",
    "URLSearchParams", "QRCode",
    rawScript + "\n" + exportFooter
  );

  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    RESTO_CONFIG, RESTO_TABLES, MENU_ITEMS, formatRupiah, MOCK_THEME_MANAGER,
    fetch, alert, confirm, prompt, navigator, timerFn, clearTimeout,
    setInterval, clearInterval, requestAnimationFrame, location, console,
    URLSearchParams, MockQRCode
  );

  globalThis.document = doc;
  return { html, doc, win, api };
}

function mountCashierPos(options = {}) {
  return mountHtmlScreen("cashier_pos_register.html", Object.assign({}, options, {
    exportFooter: `
      return {
        getActiveTableId: function () { return activeTableId; },
        selectTable: typeof selectTable === "function" ? selectTable : undefined,
        renderTablesGrid: typeof renderTablesGrid === "function" ? renderTablesGrid : undefined,
        openTablePickerModal: typeof openTablePickerModal === "function" ? openTablePickerModal : undefined
      };
    `
  }));
}

function mountCustomerQr(options = {}) {
  return mountHtmlScreen("customer_qr_self_order.html", Object.assign({}, options, {
    exportFooter: `
      return {
        getCurrentTableId: function () { return currentTableId; },
        setCustomerTable: typeof setCustomerTable === "function" ? setCustomerTable : undefined,
        openTableSwitchModal: typeof openTableSwitchModal === "function" ? openTableSwitchModal : undefined,
        selectCustomerTable: typeof selectCustomerTable === "function" ? selectCustomerTable : undefined
      };
    `
  }));
}

function mountQrPrintSheet(options = {}) {
  return mountHtmlScreen("table_qr_print_sheet.html", Object.assign({}, options, {
    runImmediateTimeouts: true,
    exportFooter: `
      return {
        renderQrCards: typeof renderQrCards === "function" ? renderQrCards : undefined
      };
    `
  }));
}

function mountKdsScreen(options = {}) {
  return mountHtmlScreen("kitchen_display_kds.html", Object.assign({}, options, {
    exportFooter: `
      return {
        renderKdsTickets: typeof renderKdsTickets === "function" ? renderKdsTickets : undefined,
        filterStation: typeof filterStation === "function" ? filterStation : undefined
      };
    `
  }));
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
  fetchCalls = [];
  qrCodeCalls = [];
  confirmReturnValue = true;
  window.location.search = "";
  window.location.href = "https://resto.example.com/cashier_pos_register.html";
  window.RESTO_CLOUD_CONFIG = MOCK_CLOUD_CONFIG;
  resetDefaultGlobalTables();
  fetch = function (url) {
    fetchCalls.push(String(url));
    return Promise.reject(new Error("Offline mock"));
  };
  if (typeof RestoSync !== "undefined") {
    RestoSync.listeners = {};
  }
}

function seedEightStoredTablesForTenant(tenantId) {
  const prevSearch = window.location.search;
  window.location.search = "?tenant=" + encodeURIComponent(tenantId);
  const tables = [];
  for (let i = 1; i <= 8; i++) {
    const tbl = RestoSync._buildDefaultTableItem(i);
    if (i >= 5) {
      tbl.isCustom = true;
      tbl.name = "Meja VIP 0" + i;
    }
    tables.push(tbl);
  }
  RestoSync.saveTables(tables);
  window.location.search = prevSearch;
}

function mockCloudTenantFetch(tenantPayload) {
  fetch = function (url) {
    fetchCalls.push(String(url));
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          cloudInitialized: true,
          tenant: tenantPayload
        });
      }
    });
  };
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
// 4. Test Cases (Task 5: Operational Screens Sync, 4-Table Limit & v2.7.0)
// -----------------------------------------------------------------------------

test("1. cashier_pos_register.html limits unpaid tenant with 8 stored tables to 4 usable tables (T01..T04), displays Limit Belum Bayar chip, handles T03 vs T06 fallback", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-trial",
    name: "Warung Trial POS",
    pic: "Kasir Trial",
    city: "Bandung",
    plan: "trial",
    status: "trial",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });
  seedEightStoredTablesForTenant("warung-trial");

  // 1a. Mount with default / ?table=T03 -> stays T03, RESTO_TABLES capped at 4
  const pos1 = mountCashierPos({ search: "?tenant=warung-trial&table=T03" });
  pos1.doc.dispatchDOMContentLoaded();

  assertEqual(RESTO_TABLES.length, 4, "RESTO_TABLES must be limited to 4 usable tables for unpaid trial tenant");
  assertEqual(RESTO_TABLES.map(t => t.id).join(","), "T01,T02,T03,T04", "Usable tables must be T01..T04");
  assertEqual(pos1.api.getActiveTableId(), "T03", "Valid ?table=T03 must remain T03");

  const limitChip = pos1.doc.getElementById("posTableLimitNotice");
  assert(Boolean(limitChip), "#posTableLimitNotice chip must exist in #tablePickerModal header");
  assertEqual(limitChip.classList.contains("hidden"), false, "#posTableLimitNotice must be visible for unpaid tenant");
  assert(limitChip.textContent.indexOf("Limit Belum Bayar: Maks. 4 Meja") !== -1, "Notice chip must display 'Limit Belum Bayar: Maks. 4 Meja', got: " + limitChip.textContent);

  const occText = pos1.doc.getElementById("occupancyRateDisplay").textContent;
  assert(occText.indexOf("/ 4") !== -1, "Occupancy rate must reflect 4 usable tables, got: " + occText);

  // Attempting to select unusable T06 must NOT set activeTableId to T06
  pos1.api.selectTable("T06");
  assert(pos1.api.getActiveTableId() !== "T06", "selectTable('T06') must not select locked table T06 when capped at 4 tables");

  // 1b. Mount with ?table=T06 -> falls back safely to T01
  const pos2 = mountCashierPos({ search: "?tenant=warung-trial&table=T06" });
  pos2.doc.dispatchDOMContentLoaded();
  assertEqual(RESTO_TABLES.length, 4, "RESTO_TABLES must stay 4 for ?table=T06 unpaid");
  assertEqual(pos2.api.getActiveTableId(), "T01", "Unavailable ?table=T06 must fall back safely to T01");
  assertEqual(pos2.doc.getElementById("activeSelectorTableNum").textContent, "01", "Selector badge must show 01 after fallback");
});

test("2. cashier_pos_register.html Cloud sync triggers suspended guard, and upgrade to active monthly unlocks 8 tables & hides limit chip", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-pos-cloud",
    name: "Warung POS Cloud",
    pic: "Pak POS",
    city: "Yogyakarta",
    plan: "trial",
    status: "trial",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });
  seedEightStoredTablesForTenant("warung-pos-cloud");

  // 2a. Cloud returns suspended
  mockCloudTenantFetch({
    id: "warung-pos-cloud",
    name: "Warung POS Cloud",
    pic: "Pak POS",
    city: "Yogyakarta",
    plan: "trial",
    planName: "Free Trial (14 Hari)",
    status: "suspended",
    tablesCount: 8,
    isLifetime: false,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    cashierPinHash: RestoSync.hashTenantPin("warung-pos-cloud", "1234"),
    ownerPinHash: RestoSync.hashTenantPin("warung-pos-cloud", "1234")
  });

  const posSusp = mountCashierPos({ search: "?tenant=warung-pos-cloud" });
  posSusp.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();

  assert(fetchCalls.some(u => u.indexOf("action=getTenantPublicInfo") !== -1 && u.indexOf("warung-pos-cloud") !== -1), "POS must call syncTenantsFromCloud({ mode: 'tenant' })");
  assert(Boolean(posSusp.doc.getElementById("tenantSuspendedOverlay")), "Suspended Cloud response must render #tenantSuspendedOverlay in POS");

  // 2b. Cloud upgrades tenant to active monthly (8 tables)
  mockCloudTenantFetch({
    id: "warung-pos-cloud",
    name: "Warung POS Pro",
    pic: "Pak POS Pro",
    city: "Semarang",
    plan: "monthly",
    planName: "Paket Bulanan",
    status: "active",
    tablesCount: 8,
    isLifetime: false,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    cashierPinHash: RestoSync.hashTenantPin("warung-pos-cloud", "1234"),
    ownerPinHash: RestoSync.hashTenantPin("warung-pos-cloud", "1234")
  });

  const posUp = mountCashierPos({ search: "?tenant=warung-pos-cloud" });
  posUp.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();

  assertEqual(posUp.doc.getElementById("tenantSuspendedOverlay"), null, "Active upgrade must clear #tenantSuspendedOverlay");
  assertEqual(RESTO_TABLES.length, 8, "Cloud upgrade to active monthly (8 tables) must unlock all 8 RESTO_TABLES in POS");
  assertEqual(posUp.doc.getElementById("posTableLimitNotice").classList.contains("hidden"), true, "Paid active tenant must hide #posTableLimitNotice chip");
  assert(posUp.doc.getElementById("posBrandTitle").textContent.indexOf("Warung POS Pro") !== -1, "POS branding must refresh on TENANTS_UPDATED");
  assert(posUp.doc.getElementById("navQrPrintLink").href.indexOf("tenant=warung-pos-cloud") !== -1, "POS QR print link must preserve ?tenant=");
});

test("3. customer_qr_self_order.html falls back ?table=T05 -> T01 on unpaid 4-table tenant, limits switcher, refreshes branding, blocks suspended", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-trial",
    name: "Warung Trial QR",
    city: "Solo",
    plan: "trial",
    status: "trial",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    _skipCloud: true
  });
  seedEightStoredTablesForTenant("warung-trial");

  const qr = mountCustomerQr({ search: "?tenant=warung-trial&table=T05" });
  qr.doc.dispatchDOMContentLoaded();

  assertEqual(RESTO_TABLES.length, 4, "Customer QR RESTO_TABLES must be capped at 4 on unpaid tenant");
  assertEqual(qr.api.getCurrentTableId(), "T01", "?table=T05 on unpaid 4-table tenant must fall back safely to T01");
  assert(qr.doc.getElementById("headerTableIndicator").textContent.indexOf("Meja 01") !== -1, "Header indicator must display Meja 01");
  assert(qr.doc.getElementById("heroTableIndicator").textContent.indexOf("Meja 01") !== -1, "Hero indicator must display Meja 01");
  assertEqual(qr.doc.getElementById("headerRestoName").textContent, "Warung Trial QR", "Header resto name must match tenant");

  const fallbackNotice = qr.doc.getElementById("qrTableFallbackNotice");
  assert(Boolean(fallbackNotice), "#qrTableFallbackNotice must exist");
  assertEqual(fallbackNotice.classList.contains("hidden"), false, "Fallback notice must be visible when ?table=T05 was bypassed");
  assert(fallbackNotice.textContent.indexOf("Maks. 4 Meja") !== -1, "Fallback notice must explain 4-table limit");

  qr.api.openTableSwitchModal();
  const switchHtml = qr.doc.getElementById("tableSwitchGrid").innerHTML;
  assert(switchHtml.indexOf("T01") !== -1 && switchHtml.indexOf("T04") !== -1, "Table switcher must show T01..T04");
  assertEqual(switchHtml.indexOf("T05"), -1, "Table switcher must NOT show locked table T05");

  // Cloud TENANTS_UPDATED branding refresh & unlock to 8 tables
  mockCloudTenantFetch({
    id: "warung-trial",
    name: "Warung Trial Upgraded",
    city: "Solo",
    plan: "monthly",
    planName: "Paket Bulanan",
    status: "active",
    tablesCount: 8,
    isLifetime: false,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });

  const qrUp = mountCustomerQr({ search: "?tenant=warung-trial&table=T05" });
  qrUp.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assertEqual(qrUp.doc.getElementById("headerRestoName").textContent, "Warung Trial Upgraded", "TENANTS_UPDATED must refresh customer QR branding");
  assertEqual(RESTO_TABLES.length, 8, "Cloud upgrade to monthly must unlock 8 tables on customer QR");

  // Cloud suspended blocks with #tenantSuspendedOverlay
  mockCloudTenantFetch({
    id: "warung-trial",
    name: "Warung Trial Upgraded",
    plan: "monthly",
    status: "suspended",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });
  const qrSusp = mountCustomerQr({ search: "?tenant=warung-trial&table=T01" });
  qrSusp.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assert(Boolean(qrSusp.doc.getElementById("tenantSuspendedOverlay")), "Suspended tenant must show #tenantSuspendedOverlay on customer_qr_self_order.html");
});

test("4. table_qr_print_sheet.html renders 4 cards when unpaid with limit notice & tenant URL, unlocks 8 on Cloud upgrade, blocks suspended", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-qr-cetak",
    name: "Warung QR Cetak",
    city: "Malang",
    plan: "trial",
    status: "trial",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });
  seedEightStoredTablesForTenant("warung-qr-cetak");

  const sheet1 = mountQrPrintSheet({ search: "?tenant=warung-qr-cetak" });
  sheet1.doc.dispatchDOMContentLoaded();

  const grid1 = sheet1.doc.getElementById("cardsGrid");
  assertEqual(grid1.children.length, 4, "Unpaid tenant must render only 4 QR cards, got: " + grid1.children.length);
  const sub1 = sheet1.doc.getElementById("cardsGridSubtitle");
  assert(Boolean(sub1), "#cardsGridSubtitle must exist");
  assertEqual(sub1.classList.contains("hidden"), false, "#cardsGridSubtitle must be visible on unpaid 4-table limit");
  assert(sub1.textContent.indexOf("Limit Belum Bayar: Maks. 4 Meja Aktif") !== -1, "Subtitle must show 'Limit Belum Bayar: Maks. 4 Meja Aktif'");

  const firstCardUrl = grid1.children[0].getAttribute("data-qr-url") || (qrCodeCalls[0] && qrCodeCalls[0].opts && qrCodeCalls[0].opts.text) || "";
  assert(firstCardUrl.indexOf("customer_qr_self_order.html?table=T01&tenant=warung-qr-cetak") !== -1, "QR URL must include ?table=T01&tenant=warung-qr-cetak, got: " + firstCardUrl);
  assert(sheet1.doc.getElementById("qrBackToOwnerLink").href.indexOf("tenant=warung-qr-cetak") !== -1, "Back link must preserve ?tenant=");

  // Cloud upgrade to active monthly (8 tables)
  mockCloudTenantFetch({
    id: "warung-qr-cetak",
    name: "Warung QR Pro",
    city: "Malang",
    plan: "monthly",
    planName: "Paket Bulanan",
    status: "active",
    tablesCount: 8,
    isLifetime: false,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });

  const sheet2 = mountQrPrintSheet({ search: "?tenant=warung-qr-cetak" });
  sheet2.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();

  assertEqual(sheet2.doc.getElementById("cardsGrid").children.length, 8, "Cloud upgrade to active monthly must unlock all 8 QR cards");
  assertEqual(sheet2.doc.getElementById("cardsGridSubtitle").classList.contains("hidden"), true, "Paid active tenant must hide unpaid limit notice");
  assert(sheet2.doc.getElementById("qrPrintPageTitle").textContent.indexOf("Warung QR Pro") !== -1, "Print page title must refresh after TENANTS_UPDATED");

  // Suspended blocks
  mockCloudTenantFetch({
    id: "warung-qr-cetak",
    name: "Warung QR Pro",
    plan: "monthly",
    status: "suspended",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });
  const sheet3 = mountQrPrintSheet({ search: "?tenant=warung-qr-cetak" });
  sheet3.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assert(Boolean(sheet3.doc.getElementById("tenantSuspendedOverlay")), "Suspended tenant must show #tenantSuspendedOverlay on table_qr_print_sheet.html");
});

test("5. kitchen_display_kds.html runs enforceTenantAccessGuard, triggers syncTenantsFromCloud, updates branding on TENANTS_UPDATED with XSS escaping", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-kds",
    name: "Warung KDS Awal",
    city: "Medan",
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });

  mockCloudTenantFetch({
    id: "warung-kds",
    name: '<img src=x onerror=alert(1)>Dapur KDS Pro',
    city: "Makassar",
    plan: "monthly",
    planName: "Paket Bulanan",
    status: "active",
    tablesCount: 8,
    isLifetime: false,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });

  const kds1 = mountKdsScreen({ search: "?tenant=warung-kds&station=kitchen" });
  kds1.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();

  assert(fetchCalls.some(u => u.indexOf("action=getTenantPublicInfo") !== -1 && u.indexOf("warung-kds") !== -1), "KDS must call syncTenantsFromCloud({ mode: 'tenant' })");
  const titleHtml = kds1.doc.getElementById("kdsBrandTitle").innerHTML;
  assertEqual(titleHtml.indexOf("<img"), -1, "kdsBrandTitle must escape XSS payload");
  assert(titleHtml.indexOf("Dapur KDS Pro") !== -1, "kdsBrandTitle must update on TENANTS_UPDATED");
  assert(kds1.doc.getElementById("kdsBrandSub").textContent.indexOf("Makassar") !== -1, "kdsBrandSub must update city on TENANTS_UPDATED");
  assert(kds1.doc.getElementById("navKdsPosLink").href.indexOf("tenant=warung-kds") !== -1, "KDS link back to POS must preserve ?tenant=");

  // Suspended tenant blocks KDS
  mockCloudTenantFetch({
    id: "warung-kds",
    name: "Dapur KDS Suspended",
    plan: "monthly",
    status: "suspended",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
  });
  const kds2 = mountKdsScreen({ search: "?tenant=warung-kds" });
  kds2.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assert(Boolean(kds2.doc.getElementById("tenantSuspendedOverlay")), "Suspended tenant must show #tenantSuspendedOverlay on kitchen_display_kds.html");
});

test("6. All 8 app HTML files load ?v=2.7.0 (zero 2.6.0) and service-worker.js uses CACHE_NAME resto-pro-v2.7.0", function () {
  const htmlFiles = [
    "index.html",
    "resto_hub.html",
    "super_admin_saas.html",
    "owner_settings_saas.html",
    "cashier_pos_register.html",
    "customer_qr_self_order.html",
    "kitchen_display_kds.html",
    "table_qr_print_sheet.html"
  ];

  htmlFiles.forEach(file => {
    const content = readFile(file);
    assertEqual(content.indexOf("2.6.0"), -1, file + " still contains 2.6.0");
    assert(content.indexOf("assets/js/resto-config.js?v=2.7.0") !== -1, file + " must load resto-config.js?v=2.7.0");
    assert(content.indexOf("assets/js/resto-data.js?v=2.7.0") !== -1, file + " must load resto-data.js?v=2.7.0");
    assert(content.indexOf("assets/js/resto-sync.js?v=2.7.0") !== -1, file + " must load resto-sync.js?v=2.7.0");
  });

  const sw = readFile("service-worker.js");
  assertEqual(sw.indexOf("2.6.0"), -1, "service-worker.js still contains 2.6.0");
  assert(sw.indexOf("resto-pro-v2.7.0") !== -1, "service-worker.js must set CACHE_NAME = 'resto-pro-v2.7.0'");
});

test("7. Live downgrade from active monthly (T06 selected) -> trial drops POS & Customer QR back to T01 (4 tables) and filters reservation dropdowns", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-turun",
    name: "Warung Turun",
    plan: "monthly",
    status: "active",
    tablesCount: 8,
    expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
    _skipCloud: true
  });
  seedEightStoredTablesForTenant("warung-turun");

  // 7a. Start POS with T06 selected on active monthly
  const pos = mountCashierPos({ search: "?tenant=warung-turun&table=T06" });
  pos.doc.dispatchDOMContentLoaded();
  assertEqual(RESTO_TABLES.length, 8, "Paid tenant must start with 8 tables in POS");
  assertEqual(pos.api.getActiveTableId(), "T06", "POS must keep T06 while paid");

  // Simulate Cloud downgrade to trial -> triggers TENANTS_UPDATED
  RestoSync.updateTenant("warung-turun", { plan: "trial", status: "trial", _skipCloud: true });
  assertEqual(RESTO_TABLES.length, 4, "POS RESTO_TABLES must drop to 4 after downgrade");
  assertEqual(pos.api.getActiveTableId(), "T01", "POS active table T06 must fall back safely to T01 after downgrade");
  assertEqual(pos.doc.getElementById("posTableLimitNotice").classList.contains("hidden"), false, "POS limit chip must appear after downgrade");
  const posResHtml = pos.doc.getElementById("resFormTable").innerHTML;
  assertEqual(posResHtml.indexOf("T06"), -1, "POS reservation dropdown must not contain locked T06");

  // 7b. Customer QR reservation dropdown & live downgrade
  const qr = mountCustomerQr({ search: "?tenant=warung-turun&table=T01" });
  qr.doc.dispatchDOMContentLoaded();
  const qrResHtml = qr.doc.getElementById("custResTable").innerHTML;
  assert(qrResHtml.indexOf("T01") !== -1 && qrResHtml.indexOf("T04") !== -1, "Customer reservation dropdown must include T01..T04");
  assertEqual(qrResHtml.indexOf("T07"), -1, "Customer reservation dropdown must NOT include locked T07");
});

test("8. XSS escaping on POS & Print Sheet, Master keeps all 12 tables, and offline fetch rejections do not throw", function () {
  resetAll();
  RestoSync.saveAllTenants([], { silent: true });
  RestoSync.registerNewTenant({
    id: "warung-xss-ops",
    name: '<img src=x onerror=alert(1)>Warung "XSS"',
    city: '<b>Surabaya</b>',
    plan: "trial",
    status: "trial",
    tablesCount: 4,
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    _skipCloud: true
  });
  window.location.search = "?tenant=warung-xss-ops";
  RestoSync.initDefaultTables();
  RestoSync.updateTable("T01", { name: '<script>evil()</script>Meja Satu' });

  // Offline fetch mock already rejects by default
  const pos = mountCashierPos({ search: "?tenant=warung-xss-ops" });
  pos.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assertEqual(pos.doc.getElementById("posBrandTitle").innerHTML.indexOf("<img"), -1, "POS brand title must escape <img");
  assertEqual(pos.doc.getElementById("tablesGridContainer").innerHTML.indexOf("<script"), -1, "POS table grid must escape <script");

  const sheet = mountQrPrintSheet({ search: "?tenant=warung-xss-ops" });
  sheet.doc.dispatchDOMContentLoaded();
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  const firstCardHtml = sheet.doc.getElementById("cardsGrid").children[0].innerHTML;
  assertEqual(firstCardHtml.indexOf("<img"), -1, "Print card must escape <img in tenant name");
  assertEqual(firstCardHtml.indexOf("<script"), -1, "Print card must escape <script in table name");

  // Master mode keeps all 12 tables and hides unpaid notice
  const masterSheet = mountQrPrintSheet({ search: "" });
  masterSheet.doc.dispatchDOMContentLoaded();
  assertEqual(masterSheet.doc.getElementById("cardsGrid").children.length, 12, "Master print sheet must render all 12 tables");
  assertEqual(masterSheet.doc.getElementById("cardsGridSubtitle").classList.contains("hidden"), true, "Master print sheet must hide unpaid limit notice");
});

// -----------------------------------------------------------------------------
// 5. Execute All Tests
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

print("===============================================================================");
print("RUNNING TESTS: Task 5 — Operational Screens Sync, 4-Table Limit & Cache v2.7.0");
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
