/**
 * Test Suite: Task 4 — Integrasi QRIS Dinamis & Manajemen Pesanan Online di Kasir POS
 * Target: cashier_pos_register.html
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_cashier_qris_and_online_orders.js
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
    ok: true,
    json: () => Promise.resolve({ success: true })
  });
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
    href: "https://resto.example.com/cashier_pos_register.html",
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

var location = {
  search: "",
  href: "https://resto.example.com/cashier_pos_register.html",
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

  const doc = {
    title: "",
    _byId: byId,
    _elements: allElements,
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
      if (s.startsWith("#deliveryFilterPills button")) {
        return allElements.filter(el => (el.tagName === "BUTTON") && el.classList.contains("delivery-pill"));
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
    const isSelfClosing = full.slice(-2) === "/>";
    if (isClosing) continue;
    const attrs = extractAttributes(match[2] || "");
    if (tag === "input" || tag === "button" || tag === "select" || tag === "textarea" || tag === "table" || tag === "tbody" || attrs["id"] || attrs["class"]) {
      let innerText = "";
      if ((attrs["id"] || tag === "button" || tag === "h1" || tag === "p" || tag === "span") && !isSelfClosing) {
        const rest = stripped.slice(match.index + full.length);
        const closeIdx = rest.indexOf("</" + tag + ">");
        if (closeIdx !== -1 && closeIdx < 250) {
          innerText = rest.slice(0, closeIdx).replace(/<[^>]+>/g, "").trim();
        }
      }
      makeElement(tag, attrs, innerText);
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
      setActiveTableId: function (t) { if (typeof activeTableId !== "undefined") activeTableId = t; },
      selectTable: typeof selectTable === "function" ? selectTable : undefined,
      getCurrentCalculatedTotals: function () { return typeof currentCalculatedTotals !== "undefined" ? currentCalculatedTotals : null; },
      setCurrentGrandTotal: function (amount) {
        if (typeof currentCalculatedTotals !== "undefined") currentCalculatedTotals.grandTotal = amount;
      },
      openPaymentModal: typeof openPaymentModal === "function" ? openPaymentModal : undefined,
      closePaymentModal: typeof closePaymentModal === "function" ? closePaymentModal : undefined,
      selectPaymentMethod: typeof selectPaymentMethod === "function" ? selectPaymentMethod : undefined,
      filterDeliveryOrders: typeof filterDeliveryOrders === "function" ? filterDeliveryOrders : undefined,
      renderOnlineOrdersList: typeof renderOnlineOrdersList === "function" ? renderOnlineOrdersList : undefined,
      triggerQuickOnlineOrder: typeof triggerQuickOnlineOrder === "function" ? triggerQuickOnlineOrder : undefined,
      submitManualDeliveryOrder: typeof submitManualDeliveryOrder === "function" ? submitManualDeliveryOrder : undefined,
      handoverDeliveryOrder: typeof handoverDeliveryOrder === "function" ? handoverDeliveryOrder : undefined,
      updateOrderStatus: typeof updateOrderStatus === "function" ? updateOrderStatus : undefined,
      getActiveDeliveryFilter: function () { return typeof activeDeliveryFilter !== "undefined" ? activeDeliveryFilter : null; },
      getPosQrisCountdownInterval: function () { return typeof posQrisCountdownInterval !== "undefined" ? posQrisCountdownInterval : null; },
      openPosModifierModal: typeof openPosModifierModal === "function" ? openPosModifierModal : undefined,
      closePosModifierModal: typeof closePosModifierModal === "function" ? closePosModifierModal : undefined,
      openTicketItemNotesModal: typeof openTicketItemNotesModal === "function" ? openTicketItemNotesModal : undefined,
      confirmPosAddToCart: typeof confirmPosAddToCart === "function" ? confirmPosAddToCart : undefined,
      addDishToTicket: typeof addDishToTicket === "function" ? addDishToTicket : undefined,
      addDishToTicketDirect: typeof addDishToTicketDirect === "function" ? addDishToTicketDirect : undefined,
      getCurrentTicketItems: function () { return typeof currentTicketItems !== "undefined" ? currentTicketItems : []; },
      renderTicketItems: typeof renderTicketItems === "function" ? renderTicketItems : undefined,
      renderTablesGrid: typeof renderTablesGrid === "function" ? renderTablesGrid : undefined,
      selectTable: typeof selectTable === "function" ? selectTable : undefined
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
    throw new Error("Assertion failed [" + msg + "]: expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

function runTest(name, fn) {
  try {
    fn();
    testResults.push({ name, pass: true });
    print("  [PASS] " + name);
  } catch (err) {
    testResults.push({ name, pass: false, error: err });
    print("  [FAIL] " + name);
    print("         " + (err && err.message ? err.message : err));
    if (err && err.stack) print("STACK: " + err.stack);
  }
}

print("===============================================================================");
print("RUNNING TESTS: Task 4 — Dynamic QRIS & Online Orders POS Integration");
print("===============================================================================");

// -----------------------------------------------------------------------------
// Test 1: Pemilihan metode QRIS menghasilkan string dinamis ber-nominal tagihan aktual meja
// -----------------------------------------------------------------------------
runTest("1. Pemilihan metode QRIS menghasilkan string dinamis ber-nominal tagihan aktual meja dan menyetel src #posQrisImage", function () {
  localStorage.clear();
  const sampleStaticQris = "00020101021126570011ID.CO.QRIS.WWW011893600918000000000002150000000000000000303UME51440014ID.CO.QRIS.WWW02150000000000000000303UME5204581253033605802ID5915WARUNG_CONTOH6007JAKARTA61051234062070703A0163042F91";
  RestoSync.saveTenantQris("warung-berkah", sampleStaticQris);

  const { doc, api } = mountCashierPos({ search: "?tenant=warung-berkah" });

  // Set nominal tagihan aktual meja aktif
  api.setActiveTableId("T03");
  api.setCurrentGrandTotal(75000);

  // Pilih metode pembayaran QRIS
  api.selectPaymentMethod("qris");

  const qrisImg = doc.getElementById("posQrisImage");
  assert(qrisImg !== null, "#posQrisImage must exist in DOM");
  assert(qrisImg.src.indexOf("https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=") === 0,
    "QR image src must use qrserver API with dynamic data");

  // Ekstrak data parameter dari URL src
  const encodedData = qrisImg.src.split("data=")[1];
  const dynamicQrisStr = decodeURIComponent(encodedData);

  assert(dynamicQrisStr.indexOf("000201010212") !== -1, "Dynamic QRIS must have Tag 01 set to 12 (Dynamic)");
  assert(dynamicQrisStr.indexOf("540575000") !== -1, "Dynamic QRIS must contain Tag 54 with amount 75000");
  assert(dynamicQrisStr.indexOf("5802ID") !== -1, "Dynamic QRIS must contain Country Code 5802ID");
  assert(dynamicQrisStr.indexOf("6304") !== -1, "Dynamic QRIS must contain Tag 6304 with CRC");

  // Periksa badge nominal
  const amountBadge = doc.getElementById("posQrisAmountBadge");
  assert(amountBadge !== null, "#posQrisAmountBadge must exist");
  assert(amountBadge.textContent.indexOf("75.000") !== -1, "Amount badge must display formatted Rp 75.000, got: " + amountBadge.textContent);

  // Periksa status info & notice
  const statusInfo = doc.getElementById("posQrisStatusInfo");
  assert(statusInfo !== null, "#posQrisStatusInfo must exist");
  assert(statusInfo.textContent.indexOf("Scan via BCA, GoPay, OVO, Dana, ShopeePay") !== -1, "Status info text must match spec");

  const unsetNotice = doc.getElementById("posQrisUnsetNotice");
  assert(unsetNotice !== null, "#posQrisUnsetNotice must exist in DOM");
  assert(unsetNotice.classList.contains("hidden"), "#posQrisUnsetNotice must be hidden when tenant has configured QRIS");

  // Periksa countdown dimulai dari 15:00
  const countdownEl = doc.getElementById("posQrisCountdown");
  assert(countdownEl !== null, "#posQrisCountdown must exist");
  assert(countdownEl.textContent.indexOf("15:00") !== -1, "Countdown must initialize at 15:00, got: " + countdownEl.textContent);
});

// -----------------------------------------------------------------------------
// Test 2: Fallback sample QRIS aktif saat getTenantQris kosong dengan notice ramah
// -----------------------------------------------------------------------------
runTest("2. Fallback sample QRIS aktif saat getTenantQris kosong dengan notice ramah ke Pengaturan Owner", function () {
  localStorage.clear();
  // Tenant baru tanpa QRIS tersimpan
  const { doc, api } = mountCashierPos({ search: "?tenant=warung-baru-belum-set-qris" });

  api.setActiveTableId("T01");
  api.setCurrentGrandTotal(45000);

  // Pilih QRIS
  api.selectPaymentMethod("qris");

  const unsetNotice = doc.getElementById("posQrisUnsetNotice");
  assert(unsetNotice !== null, "#posQrisUnsetNotice must exist");
  assert(!unsetNotice.classList.contains("hidden"), "#posQrisUnsetNotice must NOT have hidden class when QRIS unset");
  const link = doc.getElementById("posQrisSettingsLink");
  assert(link !== null, "#posQrisSettingsLink must exist");
  assert(link.href.indexOf("owner_settings_saas.html") !== -1 && link.href.indexOf("#sectionQrisSettings") !== -1,
    "Unset notice must link to owner_settings_saas.html#sectionQrisSettings");

  // QR Image tetap ter-generate via fallback tanpa crash
  const qrisImg = doc.getElementById("posQrisImage");
  assert(qrisImg !== null && qrisImg.src !== "", "Fallback QR image must still be generated");
  const dynamicQrisStr = decodeURIComponent(qrisImg.src.split("data=")[1]);
  assert(dynamicQrisStr.indexOf("540545000") !== -1, "Fallback dynamic QRIS must encode nominal 45000");

  // Menutup modal membersihkan timer countdown
  api.closePaymentModal();
  const intervalId = api.getPosQrisCountdownInterval();
  if (intervalId) {
    const found = activeIntervals.find(i => i.id === intervalId);
    assert(!found || found.cleared, "Countdown interval must be cleared on closePaymentModal()");
  }
});

// -----------------------------------------------------------------------------
// Test 3: Filter platform online delivery mendukung all, gofood, grabfood, shopeefood, qpon, takeaway
// -----------------------------------------------------------------------------
runTest("3. Filter platform online delivery mendukung all, gofood, grabfood, shopeefood, qpon, takeaway & badge warna", function () {
  localStorage.clear();
  const { doc, api } = mountCashierPos();

  const filterPills = doc.querySelectorAll("#deliveryFilterPills button");
  const pillTexts = filterPills.map(p => p.textContent.toLowerCase());

  assert(pillTexts.some(t => t.indexOf("semua") !== -1), "Filter pills must have 'Semua'");
  assert(pillTexts.some(t => t.indexOf("gofood") !== -1), "Filter pills must have 'GoFood'");
  assert(pillTexts.some(t => t.indexOf("grabfood") !== -1), "Filter pills must have 'GrabFood'");
  assert(pillTexts.some(t => t.indexOf("shopeefood") !== -1), "Filter pills must have 'ShopeeFood'");
  assert(pillTexts.some(t => t.indexOf("qpon") !== -1), "Filter pills must have 'Qpon'");
  assert(pillTexts.some(t => t.indexOf("takeaway") !== -1), "Filter pills must have 'Takeaway'");

  // Test filter Qpon
  api.filterDeliveryOrders("qpon");
  assertEqual(api.getActiveDeliveryFilter(), "qpon", "activeDeliveryFilter should be 'qpon'");

  // Test filter Takeaway
  api.filterDeliveryOrders("takeaway");
  assertEqual(api.getActiveDeliveryFilter(), "takeaway", "activeDeliveryFilter should be 'takeaway'");

  // Seed sample orders across platforms
  const sampleOrders = [
    {
      id: "ORD-QPON-001",
      orderRef: "QP-1001",
      platform: "qpon",
      channel: "qpon",
      channelLabel: "Qpon",
      customer: "Ahmad Qpon",
      driverName: "Kurir Qpon",
      driverPlate: "B 1234 QP",
      grandTotal: 50000,
      status: "cooking",
      items: [{ name: "Nasi Mandhi", qty: 1, price: 50000 }]
    },
    {
      id: "ORD-TAKEAWAY-001",
      orderRef: "TK-2001",
      platform: "takeaway",
      channel: "takeaway",
      channelLabel: "Takeaway",
      customer: "Ibu Siti",
      driverName: "Ambil Sendiri",
      driverPlate: "-",
      grandTotal: 30000,
      status: "ready",
      items: [{ name: "Teh Tarik", qty: 2, price: 15000 }]
    },
    {
      id: "ORD-GOFOOD-001",
      orderRef: "GF-3001",
      platform: "gofood",
      channel: "gofood",
      channelLabel: "GoFood",
      customer: "Budi GoFood",
      driverName: "Driver Gojek",
      driverPlate: "B 5555 GO",
      grandTotal: 65000,
      status: "completed",
      items: [{ name: "Nasi Lemak", qty: 1, price: 65000 }]
    }
  ];

  RestoSync.saveOnlineOrders(sampleOrders);

  // Render filter all
  api.filterDeliveryOrders("all");
  const container = doc.getElementById("onlineOrdersContainer");
  assert(container !== null, "#onlineOrdersContainer must exist");

  // Check badges in HTML
  assert(container.innerHTML.indexOf("#8B5CF6") !== -1, "Qpon order must have purple badge #8B5CF6");
  assert(container.innerHTML.indexOf("#0284C7") !== -1, "Takeaway order must have sky blue badge #0284C7");
  assert(container.innerHTML.indexOf("Sedang Dimasak") !== -1, "Cooking order must show status badge 'Sedang Dimasak'");
  assert(container.innerHTML.indexOf("Siap Diambil") !== -1, "Ready order must show status badge 'Siap Diambil'");
  assert(container.innerHTML.indexOf("Selesai") !== -1, "Completed order must show status badge 'Selesai'");
});

// -----------------------------------------------------------------------------
// Test 4: Penambahan pesanan online via triggerQuickOnlineOrder memanggil RestoSync.submitOnlineOrder
// -----------------------------------------------------------------------------
runTest("4. Penambahan pesanan online via triggerQuickOnlineOrder memanggil RestoSync.submitOnlineOrder dan memancarkan ONLINE_ORDER_RECEIVED", function () {
  localStorage.clear();
  const { doc, api } = mountCashierPos({ search: "?tenant=warung-berkah" });

  let submitCalled = false;
  let submittedPayload = null;
  const originalSubmit = RestoSync.submitOnlineOrder.bind(RestoSync);

  RestoSync.submitOnlineOrder = function (payload) {
    submitCalled = true;
    submittedPayload = payload;
    return originalSubmit(payload);
  };

  // Trigger quick order Qpon
  const newOrder = api.triggerQuickOnlineOrder("qpon");
  assert(submitCalled, "RestoSync.submitOnlineOrder must be called when triggerQuickOnlineOrder is executed");
  assert(submittedPayload !== null, "submittedPayload must not be null");
  assertEqual(submittedPayload.platform, "qpon", "Payload platform must be 'qpon'");

  // Periksa apakah daftar di kasir otomatis memuat pesanan baru
  const container = doc.getElementById("onlineOrdersContainer");
  assert(container.innerHTML.indexOf(newOrder.orderRef || newOrder.id) !== -1,
    "Online orders container must include new order ref");

  // Uji live listener ONLINE_ORDER_RECEIVED
  const testExternalOrder = {
    tenantId: "warung-berkah",
    id: "ORD-SHOPEEFOOD-9999",
    orderId: "ORD-SHOPEEFOOD-9999",
    orderRef: "SF-9999",
    platformRef: "SF-9999",
    platform: "shopeefood",
    channel: "shopeefood",
    channelLabel: "ShopeeFood",
    customer: "Maya Safitri",
    driverName: "Pak Driver",
    driverPlate: "B 9999 SF",
    grandTotal: 88000,
    status: "cooking",
    items: [{ name: "Ayam Panggang", qty: 2, price: 44000 }]
  };

  // Submit via RestoSync yang secara otomatis memancarkan ONLINE_ORDER_RECEIVED
  originalSubmit(testExternalOrder);

  assert(container.innerHTML.indexOf("SF-9999") !== -1,
    "Container must re-render reactively when ONLINE_ORDER_RECEIVED is emitted");

  // Restore original
  RestoSync.submitOnlineOrder = originalSubmit;
});

// -----------------------------------------------------------------------------
// Test 5: Penyelesaian pesanan online memanggil RestoSync.updateOnlineOrderStatus dengan status ready & completed
// -----------------------------------------------------------------------------
runTest("5. Penyelesaian pesanan online memanggil RestoSync.updateOnlineOrderStatus dengan status ready lalu completed", function () {
  localStorage.clear();
  const { doc, api } = mountCashierPos({ search: "?tenant=warung-berkah" });

  const orderId = "ORD-QPON-TEST-TRANSITION";
  const orderData = {
    id: orderId,
    orderId: orderId,
    orderRef: "QP-7788",
    platform: "qpon",
    channel: "qpon",
    channelLabel: "Qpon",
    customer: "Rizky Ramadhan",
    driverName: "Kurir Qpon",
    driverPlate: "B 7788 QPN",
    grandTotal: 83000,
    totalAmount: 83000,
    status: "cooking",
    items: [{ name: "Nasi Mandhi", qty: 1, price: 65000 }, { name: "Teh Tarik", qty: 1, price: 18000 }]
  };

  RestoSync.submitOnlineOrder(orderData);
  api.filterDeliveryOrders("all");

  const container = doc.getElementById("onlineOrdersContainer");
  assert(container.innerHTML.indexOf("Siap Diambil Driver") !== -1,
    "Cooking order must render 'Siap Diambil Driver' action button");

  // 1. Transisi dari cooking -> ready
  api.updateOrderStatus(orderId, "ready");

  const updatedOrders1 = RestoSync.getOnlineOrders();
  const o1 = updatedOrders1.find(o => o.id === orderId);
  assertEqual(o1.status, "ready", "Order status must transition to 'ready'");
  assert(container.innerHTML.indexOf("Serahkan ke Driver / Selesai") !== -1 || container.innerHTML.indexOf("Serahkan Driver") !== -1,
    "Ready order must render handover button");

  // 2. Transisi dari ready -> completed via handoverDeliveryOrder
  api.handoverDeliveryOrder(orderId);

  const updatedOrders2 = RestoSync.getOnlineOrders();
  const o2 = updatedOrders2.find(o => o.id === orderId);
  assertEqual(o2.status, "completed", "Order status must transition to 'completed'");

  // Periksa live event listener ONLINE_ORDER_STATUS_CHANGED
  RestoSync.emit("ONLINE_ORDER_STATUS_CHANGED", { orderId: orderId, status: "completed" });
  assert(container.innerHTML.indexOf("Selesai") !== -1 || container.innerHTML.indexOf("Lunas Online") !== -1,
    "Container must reflect completed state reactively");
});

// -----------------------------------------------------------------------------
// Test 6: Denah Meja Tampak di Layar (Kolom 1) & Fitur Catatan / Keterangan Pesanan Kasir
// -----------------------------------------------------------------------------
runTest("6. Denah Meja Tampak di Layar & Fitur Kustomisasi / Catatan Pesanan Kasir", function () {
  localStorage.clear();
  const { doc, api } = mountCashierPos({ search: "?tenant=warung-berkah" });

  // 1. Column 1 Table Grid & Floor Switcher visible
  const tablesContainer = doc.getElementById("tablesGridContainer");
  assert(Boolean(tablesContainer), "#tablesGridContainer must exist directly in main Column 1");
  const dineInPanel = doc.getElementById("posDineInPanel");
  assert(Boolean(dineInPanel), "#posDineInPanel must exist in Column 1");
  const tabDineInBtn = doc.getElementById("posTabDineInBtn");
  const tabDeliveryBtn = doc.getElementById("posTabDeliveryBtn");
  assert(Boolean(tabDineInBtn), "#posTabDineInBtn must exist");
  assert(Boolean(tabDeliveryBtn), "#posTabDeliveryBtn must exist");

  // 2. Modifier modal exists with fields
  const modifierModal = doc.getElementById("posModifierModal");
  assert(Boolean(modifierModal), "#posModifierModal must exist");
  const notesInput = doc.getElementById("posCookingNotesInput");
  assert(Boolean(notesInput), "#posCookingNotesInput must exist");
  const spiceGroup = doc.getElementById("posSpiceGroup");
  assert(Boolean(spiceGroup), "#posSpiceGroup must exist");
  const btnConfirm = doc.getElementById("btnConfirmPosModal");
  assert(Boolean(btnConfirm), "#btnConfirmPosModal must exist");

  // 3. Open modifier modal for a dish
  api.openPosModifierModal("mandhi-lamb");
  assertEqual(modifierModal.classList.contains("hidden"), false, "Modifier modal must show when opened");
  assertEqual(doc.getElementById("posModalDishName").textContent, "Nasi Mandhi Daging Kambing (Mandhi Lamb Rice)", "Dish name must be populated");

  // 4. Input notes and add to cart
  notesInput.value = "Jangan pakai bawang merah, kuah kari dipisah";
  api.confirmPosAddToCart();
  assertEqual(modifierModal.classList.contains("hidden"), true, "Modifier modal must hide after confirm");

  const ticketItems = api.getCurrentTicketItems();
  assertEqual(ticketItems.length, 1, "Ticket should have 1 item");
  assert(ticketItems[0].notes.indexOf("Jangan pakai bawang merah, kuah kari dipisah") !== -1,
    "Item notes in ticket must contain custom notes entered by cashier");

  // 5. Open ticket item notes modal for editing
  api.openTicketItemNotesModal(0);
  assertEqual(modifierModal.classList.contains("hidden"), false, "Modifier modal must open in edit mode from ticket");
  assertEqual(doc.getElementById("posModifierModalTitle").textContent, "Ubah Catatan & Keterangan", "Modal title must reflect edit mode");

  // Update notes
  notesInput.value = "Extra sambal merah";
  api.confirmPosAddToCart();
  assert(ticketItems[0].notes.indexOf("Extra sambal merah") !== -1,
    "Edited note must be reflected in ticket item");

  // 6. Direct 1-tap add with default notes
  api.addDishToTicketDirect("teh-tarik");
  assertEqual(ticketItems.length, 2, "Direct add should add second item to ticket");
  assert(ticketItems[1].notes.indexOf("Es Normal") !== -1, "Direct add drink should have default notes");
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
print("===============================================================================");
const passedCount = testResults.filter(r => r.pass).length;
const failedCount = testResults.filter(r => !r.pass).length;
print("HASIL: " + passedCount + " passed, " + failedCount + " failed, total " + testResults.length);
print("===============================================================================");

if (failedCount > 0) {
  throw new Error(failedCount + " tests failed!");
}
