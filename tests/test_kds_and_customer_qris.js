/**
 * Test Suite: Task 5 — Integrasi Layar Dapur KDS (Nada Bel & Tiket Ojol) & HP Tamu QR Self-Order
 * Targets:
 *   - kitchen_display_kds.html
 *   - customer_qr_self_order.html
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kds_and_customer_qris.js
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

var alertCalls = [];
var confirmCalls = [];
var lastAlertMessage = "";
var confirmReturnValue = true;

var alert = function (msg) {
  lastAlertMessage = String(msg);
  alertCalls.push(lastAlertMessage);
};

var confirm = function (msg) {
  confirmCalls.push(String(msg));
  return confirmReturnValue;
};

var prompt = function () { return ""; };

var activeIntervals = [];
var setInterval = function (cb, ms) {
  const id = activeIntervals.length + 1;
  activeIntervals.push({ id, cb, ms, cleared: false });
  return id;
};
var clearInterval = function (id) {
  const found = activeIntervals.find(i => i.id === id);
  if (found) found.cleared = true;
};

var setTimeout = function (cb) {
  if (typeof cb === "function") {
    try { cb(); } catch (e) {}
  }
  return 1;
};
var clearTimeout = function () {};
var requestAnimationFrame = function (cb) { if (typeof cb === "function") cb(); return 1; };

var navigator = {
  clipboard: {
    writeText: function () { return Promise.resolve(); }
  },
  serviceWorker: {
    register: function () { return Promise.resolve(); }
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
  return Promise.resolve({
    json: function () { return Promise.resolve({ success: true }); }
  });
};

var MOCK_THEME_MANAGER = {
  init: function () {},
  toggle: function () { return "dark"; },
  applyTheme: function () {}
};

var qrCodeCalls = [];
var MockQRCode = function (el, opts) {
  qrCodeCalls.push({ el, opts });
  if (el && typeof el.setAttribute === "function") {
    el.setAttribute("data-qr-text", opts && opts.text ? opts.text : "");
  }
};
MockQRCode.CorrectLevel = { M: 0, L: 1, H: 2, Q: 3 };

var window = {
  location: {
    search: "",
    href: "https://resto.example.com/",
    pathname: "/",
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
  reload: function () {},
  search: "",
  href: "https://resto.example.com/"
};

// Load dependencies
load("assets/js/resto-config.js");
load("assets/js/resto-data.js");
load("assets/js/resto-sync.js");

var kitchenBellCalls = 0;
var origPlayKitchenBell = RestoSync.playKitchenBell;
RestoSync.playKitchenBell = function () {
  kitchenBellCalls++;
  if (typeof origPlayKitchenBell === "function") {
    try { origPlayKitchenBell.apply(this, arguments); } catch (e) {}
  }
};

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
      tagName: String(tagName || "").toUpperCase(),
      attributes: Object.assign({}, attrs),
      dataset: datasetObj,
      parentNode: null,
      children: [],
      style: {},
      _eventListeners: Object.create(null),
      _value: initValue,
      _disabled: initDisabled,
      _src: attrs["src"] || "",
      _href: attrs["href"] || "",

      get id() { return currentId; },
      set id(val) {
        if (currentId && byId[currentId] === this) {
          delete byId[currentId];
        }
        currentId = String(val || "");
        if (currentId) byId[currentId] = this;
      },

      get value() { return this._value; },
      set value(val) { this._value = String(val === undefined || val === null ? "" : val); },

      get src() { return this._src; },
      set src(val) { this._src = String(val || ""); },

      get href() { return this._href; },
      set href(val) { this._href = String(val || ""); },

      get disabled() { return !!this._disabled; },
      set disabled(val) {
        this._disabled = !!val;
        if (this._disabled) this.attributes["disabled"] = "disabled";
        else delete this.attributes["disabled"];
      },

      get className() { return Array.from(classSet).join(" "); },
      set className(val) {
        classSet.clear();
        String(val || "").split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
      },

      classList: {
        contains(c) { return classSet.has(c); },
        add(c) { if (c) classSet.add(c); },
        remove(c) { classSet.delete(c); },
        toggle(c, force) {
          if (force === true) { classSet.add(c); return true; }
          if (force === false) { classSet.delete(c); return false; }
          if (classSet.has(c)) { classSet.delete(c); return false; }
          classSet.add(c); return true;
        }
      },

      getAttribute(k) {
        const lower = String(k || "").toLowerCase();
        if (lower === "class") return this.className;
        if (lower === "id") return this.id;
        if (lower === "value") return this.value;
        if (lower === "src") return this.src;
        if (lower === "href") return this.href;
        return Object.prototype.hasOwnProperty.call(this.attributes, lower) ? this.attributes[lower] : null;
      },
      setAttribute(k, v) {
        const lower = String(k || "").toLowerCase();
        const strVal = String(v);
        this.attributes[lower] = strVal;
        if (lower === "class") this.className = strVal;
        if (lower === "id") this.id = strVal;
        if (lower === "value") this.value = strVal;
        if (lower === "src") this.src = strVal;
        if (lower === "href") this.href = strVal;
        if (lower.indexOf("data-") === 0) {
          this.dataset[toCamelDatasetKey(lower)] = strVal;
        }
      },
      removeAttribute(k) {
        const lower = String(k || "").toLowerCase();
        delete this.attributes[lower];
        if (lower === "class") this.className = "";
        if (lower === "id") this.id = "";
        if (lower === "disabled") this.disabled = false;
        if (lower.indexOf("data-") === 0) {
          delete this.dataset[toCamelDatasetKey(lower)];
        }
      },

      addEventListener(ev, cb) {
        if (!this._eventListeners[ev]) this._eventListeners[ev] = [];
        this._eventListeners[ev].push(cb);
      },
      dispatchEvent(eventObj) {
        const evType = (eventObj && eventObj.type) || "click";
        const list = this._eventListeners[evType] || [];
        list.forEach(cb => {
          try { cb.call(this, eventObj); } catch (e) {}
        });
        if (typeof this["on" + evType] === "function") {
          try { this["on" + evType].call(this, eventObj); } catch (e) {}
        }
      },
      click() {
        this.dispatchEvent({ type: "click", target: this, preventDefault: function () {} });
      },

      get innerHTML() { return currentInnerHtml; },
      set innerHTML(htmlStr) {
        clearDynamicChildren(this);
        currentInnerHtml = String(htmlStr || "");
        this.children = [];
        registerInnerIds(this, currentInnerHtml);
      },

      get textContent() {
        return currentInnerHtml
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
      },
      set textContent(txt) {
        clearDynamicChildren(this);
        currentInnerHtml = String(txt === undefined || txt === null ? "" : txt)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        this.children = [];
      },

      appendChild(child) {
        if (child) {
          child.parentNode = this;
          this.children.push(child);
        }
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
      querySelector(s) {
        const list = this.querySelectorAll(s);
        return list.length > 0 ? list[0] : null;
      },
      querySelectorAll(s) {
        const sel = String(s || "").trim();
        const results = [];
        if (sel.charAt(0) === ".") {
          const cls = sel.slice(1);
          allElements.forEach(elNode => {
            if (elNode !== this && elNode.classList.contains(cls)) {
              results.push(elNode);
            }
          });
        }
        return results;
      }
    };

    if (currentId) {
      byId[currentId] = el;
    }
    allElements.push(el);

    if (innerText) {
      el.textContent = innerText;
    }

    return el;
  }

  const tagPattern = /<([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;
  while ((match = tagPattern.exec(stripped)) !== null) {
    const tagName = match[1];
    const attrString = match[2] || "";
    if (tagName.charAt(0) === "/" || tagName.charAt(0) === "!") continue;
    const attrs = extractAttributes(attrString);
    const el = makeElement(tagName, attrs, "");
    if (tagName.toLowerCase() === "html") {
      doc.documentElement = el;
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

function mountKds(options = {}) {
  const html = readFile("kitchen_display_kds.html");
  const doc = createDomFromHtml(html);
  const searchStr = options.search || "";

  window.location.search = searchStr;
  window.location.href = "https://resto.example.com/kitchen_display_kds.html" + searchStr;
  location.search = searchStr;
  location.href = "https://resto.example.com/kitchen_display_kds.html" + searchStr;

  const win = {
    location: {
      search: searchStr,
      href: "https://resto.example.com/kitchen_display_kds.html" + searchStr,
      pathname: "/kitchen_display_kds.html",
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
      getActiveStationFilter: function () { return typeof activeStationFilter !== "undefined" ? activeStationFilter : null; },
      setActiveStationFilter: function (s) { if (typeof activeStationFilter !== "undefined") activeStationFilter = s; },
      filterStation: typeof filterStation === "function" ? filterStation : undefined,
      renderKdsTickets: typeof renderKdsTickets === "function" ? renderKdsTickets : undefined,
      toggleItemCheck: typeof toggleItemCheck === "function" ? toggleItemCheck : undefined,
      markAllTicketItemsReady: typeof markAllTicketItemsReady === "function" ? markAllTicketItemsReady : undefined,
      showKdsToast: typeof showKdsToast === "function" ? showKdsToast : undefined,
      isSoundEnabled: function () { return typeof isSoundEnabled !== "undefined" ? isSoundEnabled : null; },
      toggleAudio: typeof toggleAudio === "function" ? toggleAudio : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "RESTO_CONFIG", "RESTO_TABLES", "MENU_ITEMS", "formatRupiah", "ThemeManager",
    "fetch", "alert", "confirm", "prompt", "navigator", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "requestAnimationFrame", "location", "console",
    "URLSearchParams", "QRCode",
    rawScript + "\n" + exportFooter
  );

  const loc = {
    search: searchStr,
    href: "https://resto.example.com/kitchen_display_kds.html" + searchStr,
    reload: function () {}
  };

  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    RESTO_CONFIG, RESTO_TABLES, MENU_ITEMS, formatRupiah, MOCK_THEME_MANAGER,
    fetch, alert, confirm, prompt, navigator, setTimeout, clearTimeout,
    setInterval, clearInterval, requestAnimationFrame, loc, console,
    URLSearchParams, MockQRCode
  );

  doc.dispatchDOMContentLoaded();
  return { doc, win, api };
}

function mountCustomerQr(options = {}) {
  const html = readFile("customer_qr_self_order.html");
  const doc = createDomFromHtml(html);
  const searchStr = options.search || "";

  window.location.search = searchStr;
  window.location.href = "https://resto.example.com/customer_qr_self_order.html" + searchStr;
  location.search = searchStr;
  location.href = "https://resto.example.com/customer_qr_self_order.html" + searchStr;

  const win = {
    location: {
      search: searchStr,
      href: "https://resto.example.com/customer_qr_self_order.html" + searchStr,
      pathname: "/customer_qr_self_order.html",
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
      getCart: function () { return typeof cart !== "undefined" ? cart : []; },
      setCart: function (c) { if (typeof cart !== "undefined") cart = c; },
      addToCart: function (item) {
        if (typeof cart !== "undefined") {
          cart.push(item);
          if (typeof updateCartUI === "function") updateCartUI();
        }
      },
      updateCartUI: typeof updateCartUI === "function" ? updateCartUI : undefined,
      openCheckoutModal: typeof openCheckoutModal === "function" ? openCheckoutModal : undefined,
      closeCheckoutModal: typeof closeCheckoutModal === "function" ? closeCheckoutModal : undefined,
      submitOrderToKitchen: typeof submitOrderToKitchen === "function" ? submitOrderToKitchen : undefined,
      openGuestQrisModal: typeof openGuestQrisModal === "function" ? openGuestQrisModal : undefined,
      closeGuestQrisModal: typeof closeGuestQrisModal === "function" ? closeGuestQrisModal : undefined,
      confirmGuestQrisPayment: typeof confirmGuestQrisPayment === "function" ? confirmGuestQrisPayment : undefined,
      getCurrentTableId: function () { return typeof currentTableId !== "undefined" ? currentTableId : null; },
      getCurrentTableName: function () { return typeof currentTableName !== "undefined" ? currentTableName : null; },
      selectTable: typeof selectTable === "function" ? selectTable : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "RESTO_CONFIG", "RESTO_TABLES", "MENU_ITEMS", "formatRupiah", "ThemeManager",
    "fetch", "alert", "confirm", "prompt", "navigator", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "requestAnimationFrame", "location", "console",
    "URLSearchParams", "QRCode",
    rawScript + "\n" + exportFooter
  );

  const loc = {
    search: searchStr,
    href: "https://resto.example.com/customer_qr_self_order.html" + searchStr,
    reload: function () {}
  };

  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    RESTO_CONFIG, RESTO_TABLES, MENU_ITEMS, formatRupiah, MOCK_THEME_MANAGER,
    fetch, alert, confirm, prompt, navigator, setTimeout, clearTimeout,
    setInterval, clearInterval, requestAnimationFrame, loc, console,
    URLSearchParams, MockQRCode
  );

  doc.dispatchDOMContentLoaded();
  return { doc, win, api };
}

// -----------------------------------------------------------------------------
// 3. Test Runner & Assertion Helpers
// -----------------------------------------------------------------------------
var testResults = [];

function assert(cond, msg) {
  if (!cond) {
    throw new Error("Assertion failed: " + msg);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ": " : "") + "Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual));
  }
}

function runTest(name, fn) {
  try {
    fn();
    testResults.push({ name: name, passed: true });
    print("  [PASS] " + name);
  } catch (err) {
    testResults.push({ name: name, passed: false, error: err });
    print("  [FAIL] " + name + " -> " + err.message);
  }
}

// -----------------------------------------------------------------------------
// 4. Test Cases Execution
// -----------------------------------------------------------------------------
print("===============================================================================");
print("RUNNING TESTS: Task 5 — Layar Dapur KDS (Nada Bel & Ojol) & Tamu QRIS Dinamis");
print("===============================================================================");

// Test 1: Event ONLINE_ORDER_RECEIVED di KDS memicu playKitchenBell, toast, dan render tiket badge QPON & delivery info
runTest("1. Event ONLINE_ORDER_RECEIVED di KDS memicu playKitchenBell, toast notifikasi, dan render tiket badge platform (QPON & Takeaway)", function () {
  localStorage.clear();
  RestoSync.init();
  kitchenBellCalls = 0;

  const { doc, api } = mountKds();

  // Reset KDS tickets dengan pesanan QPON & Takeaway
  const qponTicket = {
    id: "ORD-QPON-TEST-1",
    orderType: "qpon",
    channel: "QPON Online",
    orderRef: "QP-8801",
    table: "[QPON Online] #QP-8801",
    tableId: "ORD-QPON-TEST-1",
    customer: "Siti Rahmawati",
    driverName: "Budi Santoso",
    driverPlate: "B 1234 KDS",
    packagingNotes: "Paper box + sambal pisah",
    createdAt: Date.now() - 60000,
    status: "new",
    section: "🛵 QPON Online • Bungkus 📦",
    items: [
      { name: "Nasi Mandhi Ayam", qty: 2, price: 65000, station: "kitchen", completed: false }
    ]
  };

  const takeawayTicket = {
    id: "ORD-TAKEAWAY-TEST-2",
    orderType: "takeaway",
    channel: "Takeaway",
    orderRef: "TK-9902",
    table: "[Takeaway] #TK-9902",
    tableId: "ORD-TAKEAWAY-TEST-2",
    customer: "Ahmad Dani",
    driverName: "",
    driverPlate: "",
    packagingNotes: "Bungkus plastik rapi",
    createdAt: Date.now() - 30000,
    status: "new",
    section: "🛍️ Takeaway • Bungkus 📦",
    items: [
      { name: "Roti Canai Kari Kambing", qty: 1, price: 45000, station: "kitchen", completed: false }
    ]
  };

  RestoSync.saveKdsTickets([qponTicket, takeawayTicket]);

  const initialBellCount = kitchenBellCalls;

  // Emit event ONLINE_ORDER_RECEIVED
  RestoSync.emit("ONLINE_ORDER_RECEIVED", {
    platform: "qpon",
    platformRef: "QP-8801",
    customerName: "Siti Rahmawati",
    totalAmount: 130000
  });

  // 1. playKitchenBell() dipanggil
  assert(kitchenBellCalls > initialBellCount, "RestoSync.playKitchenBell() harus dipanggil saat ONLINE_ORDER_RECEIVED");

  // 2. Toast menampilkan notifikasi pesanan online
  const toastMsgEl = doc.getElementById("kdsEventMessage");
  assert(toastMsgEl !== null, "#kdsEventMessage harus ada di DOM KDS");
  assert(toastMsgEl.textContent.indexOf("PESANAN ONLINE BARU: QPON #QP-8801") !== -1,
    "Toast KDS harus menampilkan alert pesanan online QPON baru, dapat: " + toastMsgEl.textContent);

  // 3. Grid tiket dirender dengan badge platform yang tepat
  const grid = doc.getElementById("ticketsGridContainer");
  assert(grid !== null, "#ticketsGridContainer harus ada");
  const html = grid.innerHTML;

  assert(html.indexOf("🟣 QPON") !== -1, "Tiket QPON harus menampilkan badge platform '🟣 QPON'");
  assert(html.indexOf("#8B5CF6") !== -1, "Badge QPON harus menggunakan aksen warna ungu #8B5CF6");
  assert(html.indexOf("🛍️ TAKEAWAY") !== -1, "Tiket Takeaway harus menampilkan badge platform '🛍️ TAKEAWAY'");
  assert(html.indexOf("#0284C7") !== -1, "Badge Takeaway harus menggunakan warna biru langit #0284C7");

  // 4. Informasi driver, plat, dan packaging notes tampil di tiket
  assert(html.indexOf("Budi Santoso") !== -1, "Nama driver 'Budi Santoso' harus tampil di tiket");
  assert(html.indexOf("B 1234 KDS") !== -1, "Plat driver 'B 1234 KDS' harus tampil di tiket");
  assert(html.indexOf("Paper box + sambal pisah") !== -1, "Catatan bungkus harus tampil di tiket delivery");
});

// Test 2: Filter stasiun delivery di KDS menyaring tiket pesanan online termasuk platform qpon
runTest("2. Filter stasiun delivery di KDS menyaring tiket pesanan online termasuk platform qpon", function () {
  localStorage.clear();
  RestoSync.init();

  const { doc, api } = mountKds();

  const tickets = [
    {
      id: "TICKET-DINEIN-1",
      orderType: "dinein",
      table: "Meja 01",
      customer: "Tamu Reguler",
      createdAt: Date.now(),
      status: "new",
      section: "Indoor AC",
      items: [{ name: "Nasi Lemak", qty: 1, station: "kitchen", completed: false }]
    },
    {
      id: "TICKET-QPON-1",
      orderType: "qpon",
      table: "[QPON Online] #QP-5555",
      customer: "Pelanggan Qpon",
      createdAt: Date.now(),
      status: "new",
      section: "🛵 Delivery Online",
      items: [{ name: "Nasi Mandhi", qty: 1, station: "kitchen", completed: false }]
    },
    {
      id: "TICKET-GOFOOD-1",
      orderType: "gofood",
      table: "[GoFood] #GF-1234",
      customer: "Pelanggan GoFood",
      createdAt: Date.now(),
      status: "new",
      section: "🛵 GoFood Delivery",
      items: [{ name: "Shawarma", qty: 1, station: "kitchen", completed: false }]
    }
  ];

  RestoSync.saveKdsTickets(tickets);

  // Switch ke stasiun delivery
  api.filterStation("delivery");

  const badge = doc.getElementById("activeTicketCountBadge");
  assert(badge !== null, "#activeTicketCountBadge harus ada");
  assertEqual(badge.textContent, "2 Pesanan Aktif", "Hanya 2 tiket delivery (qpon & gofood) yang boleh lolos filter delivery");

  const gridHtml = doc.getElementById("ticketsGridContainer").innerHTML;
  assert(gridHtml.indexOf("QP-5555") !== -1, "Tiket QPON harus tampil di stasiun delivery");
  assert(gridHtml.indexOf("GF-1234") !== -1, "Tiket GoFood harus tampil di stasiun delivery");
  assertEqual(gridHtml.indexOf("Meja 01"), -1, "Tiket dine-in biasa TIDAK boleh tampil di stasiun delivery");
});

// Test 3: Modal #guestQrisModal di customer_qr_self_order.html merender QRIS dinamis ber-nominal belanjaan & countdown 15m
runTest("3. Modal #guestQrisModal di customer_qr_self_order.html merender QRIS dinamis ber-nominal total belanjaan tamu & countdown 15 menit", function () {
  localStorage.clear();
  RestoSync.init();

  const { doc, api } = mountCustomerQr({ search: "?table=T05" });

  // Tambahkan item menu ke keranjang
  api.addToCart({
    id: "arabian-mandhi-ayam",
    name: "Nasi Mandhi Ayam",
    unitPrice: 65000,
    qty: 1,
    modifiers: { spiciness: 2 }
  });
  api.addToCart({
    id: "drinks-teh-tarik",
    name: "Teh Tarik Klasik",
    unitPrice: 15000,
    qty: 1,
    modifiers: { drinkTemp: "Dingin (Es)" }
  });

  // Subtotal = 80.000, PB1 (10%) = 8.000, Grand Total = 88.000
  assert(typeof api.openGuestQrisModal === "function", "openGuestQrisModal harus didefinisikan sebagai fungsi");

  api.openGuestQrisModal();

  const modal = doc.getElementById("guestQrisModal");
  assert(modal !== null, "Elemen #guestQrisModal harus ada di DOM customer_qr_self_order.html");
  assert(!modal.classList.contains("hidden"), "Modal #guestQrisModal harus tampil (tidak memiliki class 'hidden')");

  // Header modal
  const headerEl = doc.getElementById("guestQrisModalHeader");
  assert(headerEl !== null, "Elemen #guestQrisModalHeader harus ada");
  assert(headerEl.textContent.indexOf("Pembayaran QRIS Dinamis") !== -1,
    "Header modal harus memuat 'Pembayaran QRIS Dinamis', dapat: " + headerEl.textContent);
  assert(headerEl.textContent.indexOf("Meja 05") !== -1,
    "Header modal harus memuat identitas meja 'Meja 05', dapat: " + headerEl.textContent);

  // Badge nominal
  const amountBadge = doc.getElementById("guestQrisAmountBadge");
  assert(amountBadge !== null, "Elemen #guestQrisAmountBadge harus ada");
  assertEqual(amountBadge.textContent, "Rp 88.000", "Badge nominal QRIS tamu harus menampilkan 'Rp 88.000'");

  // Image QRIS
  const qrisImg = doc.getElementById("guestQrisImage");
  assert(qrisImg !== null, "Elemen #guestQrisImage harus ada");
  assert(qrisImg.src.indexOf("api.qrserver.com") !== -1, "Image QRIS harus menggunakan URL generator api.qrserver.com");
  assert(qrisImg.src.indexOf("540588000") !== -1, "Payload QRIS dalam URL harus memuat Tag 54 dengan nominal 88000 (540588000)");

  // Countdown 15 menit
  const countdownEl = doc.getElementById("guestQrisCountdown");
  assert(countdownEl !== null, "Elemen #guestQrisCountdown harus ada");
  assertEqual(countdownEl.textContent, "15:00", "Countdown awal pembayaran QRIS harus 15:00 (15 menit)");

  // Konfirmasi pembayaran selesai
  assert(typeof api.confirmGuestQrisPayment === "function", "confirmGuestQrisPayment harus didefinisikan sebagai fungsi");
  api.confirmGuestQrisPayment();

  // Setelah konfirmasi, modal tertutup
  assert(modal.classList.contains("hidden"), "Modal #guestQrisModal harus ditutup setelah konfirmasi pembayaran");
});

// Test 4: Keranjang awal di customer_qr_self_order.html terverifikasi 0 item dan sticky bar tersembunyi
runTest("4. Keranjang awal di customer_qr_self_order.html terverifikasi 0 item dan sticky bar tersembunyi secara default", function () {
  localStorage.clear();
  RestoSync.init();

  const { doc, api } = mountCustomerQr({ search: "?table=T02" });

  const cart = api.getCart();
  assertEqual(cart.length, 0, "Keranjang awal tamu harus 0 item (bersih)");

  const badge = doc.getElementById("cartBadgeCount");
  assert(badge !== null, "#cartBadgeCount harus ada");
  assertEqual(badge.textContent, "0", "Badge jumlah keranjang awal harus '0'");

  const totalPrice = doc.getElementById("cartTotalPrice");
  assert(totalPrice !== null, "#cartTotalPrice harus ada");
  assertEqual(totalPrice.textContent, "Rp 0", "Total harga keranjang awal harus 'Rp 0'");

  const cartBar = doc.getElementById("stickyCartBar");
  assert(cartBar !== null, "#stickyCartBar harus ada");
  assert(cartBar.classList.contains("translate-y-full"),
    "Sticky cart bar awal WAJIB tersembunyi dengan class 'translate-y-full'");
});

// -----------------------------------------------------------------------------
// 5. Test Summary
// -----------------------------------------------------------------------------
var passedCount = testResults.filter(t => t.passed).length;
var failedCount = testResults.filter(t => !t.passed).length;

print("===============================================================================");
print("HASIL: " + passedCount + " passed, " + failedCount + " failed, total " + testResults.length);
print("===============================================================================");

if (failedCount > 0) {
  throw new Error(failedCount + " test(s) failed in Task 5 suite!");
}
