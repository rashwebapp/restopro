/**
 * Test Suite Tahap 3 — Task 3: Antarmuka Pengaturan QRIS Toko & Webhook di Owner Settings
 * (owner_settings_saas.html)
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_qris_and_online_setup.js
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
var clipboardWrittenText = "";

var alert = function (msg) {
  lastAlertMessage = String(msg);
  alertCalls.push(lastAlertMessage);
};

var confirm = function (msg) {
  confirmCalls.push(String(msg));
  return confirmReturnValue;
};

var prompt = function () { return ""; };

var setTimeout = function (cb) {
  if (typeof cb === "function") cb();
  return 1;
};
var clearTimeout = function () {};
var requestAnimationFrame = function (cb) { if (typeof cb === "function") cb(); return 1; };

var navigator = {
  clipboard: {
    writeText: function (txt) {
      clipboardWrittenText = String(txt);
      return Promise.resolve();
    }
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
  RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG,
  navigator: navigator
};

var location = {
  reload: function () {}
};

// Load shared scripts first
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
    const initValue = attrs["value"] !== undefined ? String(attrs["value"]) : (tagName.toLowerCase() === "textarea" && innerText ? String(innerText).trim() : "");
    const initDisabled = Object.prototype.hasOwnProperty.call(attrs, "disabled");
    const initReadonly = Object.prototype.hasOwnProperty.call(attrs, "readonly");
    let currentId = attrs["id"] || "";
    let currentInnerHtml = "";
    let currentSrc = attrs["src"] || "";

    const el = {
      tagName: String(tagName || "div").toUpperCase(),
      type: String(attrs["type"] || "").toLowerCase(),
      name: attrs["name"] || "",
      _attrs: attrs,
      _value: initValue,
      _textContent: innerText !== undefined && innerText !== null ? String(innerText) : "",
      disabled: initDisabled,
      readOnly: initReadonly,
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
      get src() { return currentSrc; },
      set src(v) {
        currentSrc = v === undefined || v === null ? "" : String(v);
        this._attrs["src"] = currentSrc;
      },
      get innerHTML() { return currentInnerHtml; },
      set innerHTML(val) {
        currentInnerHtml = val === undefined || val === null ? "" : String(val);
        this._textContent = currentInnerHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        clearDynamicChildren(this);
        registerInnerIds(this, currentInnerHtml);
      },
      get textContent() {
        if (this.children && this.children.length > 0) {
          const childText = this.children.map(c => c.textContent).filter(Boolean).join(" ");
          return (this._textContent ? this._textContent + " " : "") + childText;
        }
        return this._textContent;
      },
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
        if (key === "src") return this.src;
        if (key === "value") return this._value;
        if (key === "disabled") return this.disabled ? "" : null;
        if (key === "readonly") return this.readOnly ? "" : null;
        return Object.prototype.hasOwnProperty.call(this._attrs, key) ? this._attrs[key] : null;
      },
      setAttribute(k, v) {
        const key = String(k).toLowerCase();
        this._attrs[key] = String(v);
        if (key === "id") this.id = String(v);
        if (key === "href") this.href = String(v);
        if (key === "src") this.src = String(v);
        if (key === "value") this._value = String(v);
        if (key === "disabled") this.disabled = true;
        if (key === "readonly") this.readOnly = true;
        if (key === "class") this.className = String(v);
      },
      removeAttribute(k) {
        const key = String(k).toLowerCase();
        delete this._attrs[key];
        if (key === "disabled") this.disabled = false;
        if (key === "readonly") this.readOnly = false;
      },
      hasAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this._attrs, String(k).toLowerCase());
      },
      appendChild(child) {
        if (!child) return;
        child.parentNode = this;
        this.children.push(child);
        if (this.tagName === "SELECT" && child.tagName === "OPTION") {
          this.options.push(child);
        }
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
          this.children.splice(idx, 1);
          child.parentNode = null;
        }
      },
      querySelector(sel) {
        const list = queryAllFromRoot(this, sel);
        return list.length ? list[0] : null;
      },
      querySelectorAll(sel) {
        return queryAllFromRoot(this, sel);
      },
      addEventListener(evt, fn) {
        this["on" + evt] = fn;
      },
      removeEventListener(evt) {
        this["on" + evt] = null;
      },
      click() {
        if (typeof this.onclick === "function") {
          this.onclick({ target: this, preventDefault() {} });
        }
      }
    };

    if (currentId) {
      byId[currentId] = el;
    }
    allElements.push(el);
    return el;
  }

  const root = makeElement("body", {}, "");
  const stack = [root];

  const tagRe = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9-]+)([^>]*)>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRe.exec(stripped)) !== null) {
    const textChunk = stripped.substring(lastIndex, match.index);
    if (textChunk.trim()) {
      const top = stack[stack.length - 1];
      if (top) {
        top.textContent += textChunk;
      }
    }
    lastIndex = tagRe.lastIndex;

    const fullTag = match[0];
    if (fullTag.startsWith("<!--")) continue;

    const isClosing = match[1] === "/";
    const tag = match[2];
    const rawAttrs = match[3] || "";

    if (isClosing) {
      if (stack.length > 1) {
        const popped = stack.pop();
        if (popped.tagName.toLowerCase() !== tag.toLowerCase()) {
          // Soft match recovery
          let foundIdx = -1;
          for (let si = stack.length - 1; si >= 1; si--) {
            if (stack[si].tagName.toLowerCase() === tag.toLowerCase()) {
              foundIdx = si;
              break;
            }
          }
          if (foundIdx !== -1) {
            stack.splice(foundIdx);
          } else {
            stack.push(popped);
          }
        }
      }
      continue;
    }

    const attrs = extractAttributes(rawAttrs);
    const selfClosingTags = new Set([
      "input", "img", "br", "hr", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"
    ]);
    const isSelfClosing = rawAttrs.trim().endsWith("/") || selfClosingTags.has(tag.toLowerCase());

    const el = makeElement(tag, attrs, "");
    const parent = stack[stack.length - 1];
    parent.appendChild(el);

    if (!isSelfClosing) {
      stack.push(el);
    }
  }

  const doc = {
    _byId: byId,
    _allElements: allElements,
    body: root,
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null;
    },
    querySelector(sel) {
      if (sel.startsWith("#") && !sel.includes(" ") && !sel.includes(".")) {
        return this.getElementById(sel.slice(1));
      }
      const list = queryAllFromRoot(root, sel);
      return list.length ? list[0] : null;
    },
    querySelectorAll(sel) {
      return queryAllFromRoot(root, sel);
    },
    createElement(tag) {
      return makeElement(tag, {}, "");
    },
    addEventListener() {}
  };

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

function mountOwnerSettings(options) {
  options = options || {};
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
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG,
    navigator: navigator
  };

  RestoSync.init();

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      initQrisSettingsUI: typeof initQrisSettingsUI === "function" ? initQrisSettingsUI : undefined,
      handleSaveQrisSettings: typeof handleSaveQrisSettings === "function" ? handleSaveQrisSettings : undefined,
      handleLoadSampleQris: typeof handleLoadSampleQris === "function" ? handleLoadSampleQris : undefined,
      handleTestQrisConversion: typeof handleTestQrisConversion === "function" ? handleTestQrisConversion : undefined,
      initOnlineOrdersUI: typeof initOnlineOrdersUI === "function" ? initOnlineOrdersUI : undefined,
      copyOnlineWebhookUrl: typeof copyOnlineWebhookUrl === "function" ? copyOnlineWebhookUrl : undefined,
      renderOnlineOrdersStatsSummary: typeof renderOnlineOrdersStatsSummary === "function" ? renderOnlineOrdersStatsSummary : undefined,
      initSecurityPinsUI: typeof initSecurityPinsUI === "function" ? initSecurityPinsUI : undefined,
      handleSaveTenantPins: typeof handleSaveTenantPins === "function" ? handleSaveTenantPins : undefined,
      togglePinVisibility: typeof togglePinVisibility === "function" ? togglePinVisibility : undefined
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
var totalTests = 0;
var passedTests = 0;
var failedTests = 0;

function test(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    print("  [PASS] " + desc);
  } catch (e) {
    failedTests++;
    print("  [FAIL] " + desc + ": " + (e && e.message ? e.message : e));
    if (e && e.stack) {
      print("         " + e.stack.split("\n").slice(0, 3).join("\n         "));
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || "Assertion failed") + " — Expected: " + expected + ", Got: " + actual);
  }
}

// -----------------------------------------------------------------------------
// 4. Test Specifications
// -----------------------------------------------------------------------------
print("===============================================================================");
print("RUNNING TESTS: Task 3 — Antarmuka Pengaturan QRIS Toko & Webhook di Owner Settings");
print("===============================================================================");

test("1. Section #sectionQrisSettings dan #sectionOnlineOrdersWebhook ter-render rapi di DOM dengan elemen lengkap", function () {
  localStorage.clear();
  const { doc } = mountOwnerSettings({ search: "?tenant=warung-berkah" });

  // 1a. Section QRIS Settings
  const secQris = doc.getElementById("sectionQrisSettings");
  assert(Boolean(secQris), "#sectionQrisSettings must exist in DOM");
  assert(secQris.textContent.includes("Pengaturan QRIS Toko & Generator Dinamis (EMVCo)"), "QRIS section title must match specification");

  const qrisInput = doc.getElementById("qrisStaticInput");
  assert(Boolean(qrisInput), "#qrisStaticInput textarea must exist");

  const btnSave = doc.getElementById("btnSaveQris");
  assert(Boolean(btnSave), "#btnSaveQris button must exist");

  const btnSample = doc.getElementById("btnLoadSampleQris");
  assert(Boolean(btnSample), "#btnLoadSampleQris button must exist");

  const testAmount = doc.getElementById("qrisTestAmount");
  assert(Boolean(testAmount), "#qrisTestAmount input must exist");
  assertEqual(testAmount.value, "10000", "Default test amount must be 10000");

  const btnTestConvert = doc.getElementById("btnTestQrisConvert");
  assert(Boolean(btnTestConvert), "#btnTestQrisConvert button must exist");

  const dynamicOutput = doc.getElementById("qrisDynamicOutput");
  assert(Boolean(dynamicOutput), "#qrisDynamicOutput must exist");

  const dynamicPreview = doc.getElementById("qrisDynamicPreview");
  assert(Boolean(dynamicPreview), "#qrisDynamicPreview must exist");

  const resultBadge = doc.getElementById("qrisTestResultBadge");
  assert(Boolean(resultBadge), "#qrisTestResultBadge must exist");

  const saveFeedback = doc.getElementById("qrisSaveFeedback");
  assert(Boolean(saveFeedback), "#qrisSaveFeedback must exist");

  // 1b. Section Online Orders Webhook
  const secWebhook = doc.getElementById("sectionOnlineOrdersWebhook");
  assert(Boolean(secWebhook), "#sectionOnlineOrdersWebhook must exist in DOM");
  assert(secWebhook.textContent.includes("Jembatan Pesanan Online (GoFood, GrabFood, ShopeeFood, Lynk.id & Qpon)"), "Webhook section title must match specification");

  const webhookInput = doc.getElementById("onlineWebhookUrlInput");
  assert(Boolean(webhookInput), "#onlineWebhookUrlInput input must exist");
  assert(webhookInput.readOnly, "#onlineWebhookUrlInput must be readonly");

  const btnCopy = doc.getElementById("btnCopyWebhookUrl");
  assert(Boolean(btnCopy), "#btnCopyWebhookUrl button must exist");

  const statsSummary = doc.getElementById("onlineOrdersStatsSummary");
  assert(Boolean(statsSummary), "#onlineOrdersStatsSummary must exist");

  // Check documentation payload format sample in section text
  assert(secWebhook.textContent.includes("submitOnlineOrder"), "Section must document action submitOnlineOrder");
  assert(secWebhook.textContent.includes("packagingFee"), "Section documentation must include sample payload fields");
});

test("2. #btnSaveQris menyimpan string ke RestoSync.saveTenantQris dan #btnLoadSampleQris mengisi contoh resmi", function () {
  localStorage.clear();
  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-berkah" });

  const qrisInput = doc.getElementById("qrisStaticInput");
  const btnSample = doc.getElementById("btnLoadSampleQris");
  const btnSave = doc.getElementById("btnSaveQris");
  const saveFeedback = doc.getElementById("qrisSaveFeedback");

  // Load sample QRIS
  if (typeof api.handleLoadSampleQris === "function") {
    api.handleLoadSampleQris();
  } else if (btnSample && typeof btnSample.onclick === "function") {
    btnSample.click();
  }

  assert(qrisInput.value.length > 50, "Sample QRIS must be loaded into input");
  assert(qrisInput.value.startsWith("000201"), "Sample QRIS must start with 000201");
  assert(qrisInput.value.includes("6304"), "Sample QRIS must include 6304");

  // Save QRIS
  if (typeof api.handleSaveQrisSettings === "function") {
    api.handleSaveQrisSettings();
  } else if (btnSave && typeof btnSave.onclick === "function") {
    btnSave.click();
  }

  const savedInSync = RestoSync.getTenantQris("warung-berkah");
  assertEqual(savedInSync, qrisInput.value, "RestoSync.getTenantQris must return saved string");
  assert(!saveFeedback.classList.contains("hidden"), "Save feedback must be visible after save");
  assert(saveFeedback.textContent.includes("berhasil") || saveFeedback.textContent.includes("Berhasil"), "Save feedback must display success message");
});

test("3. #btnTestQrisConvert menghasilkan QRIS dinamis EMVCo valid, render preview QR, dan tampilkan badge", function () {
  localStorage.clear();
  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-berkah" });

  const sampleStatic = "00020101021126570011ID.CO.QRIS.WWW011893600918000000000002150000000000000000303UME51440014ID.CO.QRIS.WWW02150000000000000000303UME5204581253033605802ID5915WARUNG_CONTOH6007JAKARTA61051234062070703A0163042F91";
  
  const qrisInput = doc.getElementById("qrisStaticInput");
  const testAmount = doc.getElementById("qrisTestAmount");
  const dynamicOutput = doc.getElementById("qrisDynamicOutput");
  const dynamicPreview = doc.getElementById("qrisDynamicPreview");
  const resultBadge = doc.getElementById("qrisTestResultBadge");

  // Case A: Valid Static QRIS with 25000 amount
  qrisInput.value = sampleStatic;
  testAmount.value = "25000";

  if (typeof api.handleTestQrisConversion === "function") {
    api.handleTestQrisConversion();
  }

  assert(Boolean(dynamicOutput.value || dynamicOutput.textContent), "Dynamic QRIS output must be populated");
  const dynamicStr = dynamicOutput.value || dynamicOutput.textContent;
  assert(dynamicStr.startsWith("000201010212"), "Dynamic QRIS must have Tag 01 set to 12 (dynamic)");
  assert(dynamicStr.includes("540525000"), "Dynamic QRIS must contain Tag 54 with amount 25000");
  assert(resultBadge.textContent.includes("Valid EMVCo Dynamic QRIS"), "Badge must display 'Valid EMVCo Dynamic QRIS'");

  const previewSrc = dynamicPreview.tagName === "IMG" ? dynamicPreview.src : (dynamicPreview.querySelector("img") ? dynamicPreview.querySelector("img").src : "");
  assert(previewSrc.includes("https://api.qrserver.com/v1/create-qr-code/?size=180x180&data="), "QR preview image must point to qrserver API with encoded data");

  // Case B: Invalid Static QRIS
  qrisInput.value = "KODE_QRIS_SALAH";
  if (typeof api.handleTestQrisConversion === "function") {
    api.handleTestQrisConversion();
  }

  assert(!resultBadge.textContent.includes("Valid EMVCo Dynamic QRIS"), "Badge must not show valid for corrupt QRIS");
  assert(resultBadge.textContent.length > 5, "Badge must display friendly error message for invalid input");
});

test("4. Webhook URL mencantumkan tenantId dan parameter action=submitOnlineOrder secara tepat", function () {
  localStorage.clear();
  const { doc, api } = mountOwnerSettings({ search: "?tenant=resto-nusantara" });
  RestoSync.setGasUrl("https://script.google.com/macros/s/AKfycbx_test/exec");

  const webhookInput = doc.getElementById("onlineWebhookUrlInput");
  const btnCopy = doc.getElementById("btnCopyWebhookUrl");

  if (typeof api.initOnlineOrdersUI === "function") {
    api.initOnlineOrdersUI();
  }

  assert(Boolean(webhookInput.value), "Webhook URL must not be empty when GAS URL is set");
  assert(webhookInput.value.includes("https://script.google.com/macros/s/AKfycbx_test/exec"), "Webhook URL must include configured GAS URL");
  assert(webhookInput.value.includes("action=submitOnlineOrder"), "Webhook URL must have action=submitOnlineOrder parameter");
  assert(webhookInput.value.includes("tenantId=resto-nusantara"), "Webhook URL must include tenantId=resto-nusantara");

  clipboardWrittenText = "";
  if (typeof api.copyOnlineWebhookUrl === "function") {
    api.copyOnlineWebhookUrl();
  } else if (btnCopy && typeof btnCopy.onclick === "function") {
    btnCopy.click();
  }

  assertEqual(clipboardWrittenText, webhookInput.value, "Copying webhook URL must write the correct URL to clipboard");
});

test("5. Statistik Omset Online Delivery membaca dari RestoSync.getOnlineOrders(tenantId) dan merender 3 KPI", function () {
  localStorage.clear();

  const mockOrders = [
    {
      orderId: "ORD-GOFOOD-101",
      tenantId: "warung-berkah",
      platform: "gofood",
      platformRef: "GF-101",
      customerName: "Siti",
      items: [{ name: "Nasi Ayam", qty: 2, price: 25000 }],
      packagingFee: 2000,
      totalAmount: 52000,
      status: "cooking"
    },
    {
      orderId: "ORD-QPON-102",
      tenantId: "warung-berkah",
      platform: "qpon",
      platformRef: "QP-102",
      customerName: "Budi",
      items: [{ name: "Bebek Goreng", qty: 1, price: 45000 }],
      packagingFee: 3000,
      totalAmount: 48000,
      status: "completed"
    },
    {
      orderId: "ORD-GRABFOOD-103",
      tenantId: "warung-berkah",
      platform: "grabfood",
      platformRef: "GB-103",
      customerName: "Joko",
      items: [{ name: "Es Teh Manis", qty: 2, price: 10000 }],
      packagingFee: 1000,
      totalAmount: 21000,
      status: "delivered"
    }
  ];

  localStorage.setItem("online_orders_tenant_warung-berkah", JSON.stringify(mockOrders));

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-berkah" });

  if (typeof api.renderOnlineOrdersStatsSummary === "function") {
    api.renderOnlineOrdersStatsSummary();
  }

  const summaryEl = doc.getElementById("onlineOrdersStatsSummary");
  assert(Boolean(summaryEl), "#onlineOrdersStatsSummary must exist");

  const summaryText = summaryEl.textContent;
  // Total Pesanan: 3
  assert(summaryText.includes("3"), "Summary must reflect total count of 3 orders");
  // Selesai: 2 (completed + delivered)
  assert(summaryText.includes("2"), "Summary must reflect 2 completed orders");
  // Total Omset Delivery: 52000 + 48000 + 21000 = 121000 (or completed 48000+21000=69000 depending on calculation)
  assert(summaryText.includes("121.000") || summaryText.includes("69.000"), "Summary must display formatted omset delivery in Rupiah");
});

test("6. Load & Init: Halaman otomatis mengisi #qrisStaticInput dan #onlineWebhookUrlInput dari state tersimpan", function () {
  localStorage.clear();

  const savedQris = "00020101021153033605802ID5913WARUNG BERKAH63042222";
  RestoSync.saveTenantQris("warung-berkah", savedQris);
  RestoSync.setGasUrl("https://script.google.com/macros/s/AKfycbx_init/exec");

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-berkah" });

  if (typeof api.initQrisSettingsUI === "function") {
    api.initQrisSettingsUI();
  }
  if (typeof api.initOnlineOrdersUI === "function") {
    api.initOnlineOrdersUI();
  }

  const qrisInput = doc.getElementById("qrisStaticInput");
  assertEqual(qrisInput.value, savedQris, "#qrisStaticInput must be auto-populated with tenant QRIS");

  const webhookInput = doc.getElementById("onlineWebhookUrlInput");
  assert(webhookInput.value.includes("tenantId=warung-berkah"), "Webhook URL must be auto-populated with tenant ID");
});

test("7. Keamanan Akses: #sectionSecurityPins merender form ganti PIN dan handleSaveTenantPins memperbarui PIN Kasir & Owner", function () {
  localStorage.clear();
  RestoSync.registerNewTenant({
    id: "warung-berkah",
    name: "Warung Berkah",
    plan: "monthly",
    cashierPin: "1234",
    ownerPin: "1234",
    _skipCloud: true
  });

  const { doc, api } = mountOwnerSettings({ search: "?tenant=warung-berkah" });

  const sec = doc.getElementById("sectionSecurityPins");
  assert(Boolean(sec), "#sectionSecurityPins must exist in owner_settings_saas.html");

  const cashierInput = doc.getElementById("inputCashierPin");
  const ownerInput = doc.getElementById("inputOwnerPin");
  assert(Boolean(cashierInput), "#inputCashierPin must exist");
  assert(Boolean(ownerInput), "#inputOwnerPin must exist");

  if (typeof api.initSecurityPinsUI === "function") {
    api.initSecurityPinsUI();
  }
  assertEqual(cashierInput.value, "1234", "Initial cashier PIN must be populated");
  assertEqual(ownerInput.value, "1234", "Initial owner PIN must be populated");

  // Change PINs
  cashierInput.value = "4321";
  ownerInput.value = "9876";

  if (typeof api.handleSaveTenantPins === "function") {
    api.handleSaveTenantPins({ preventDefault: function () {} });
  }

  // Verify updated in RestoSync
  const updated = RestoSync.getTenantInfo("warung-berkah");
  assertEqual(updated.cashierPin, "4321", "Cashier PIN must be updated to 4321");
  assertEqual(updated.ownerPin, "9876", "Owner PIN must be updated to 9876");
  assertEqual(RestoSync.verifyPosPin("4321", "warung-berkah"), true, "New Cashier PIN 4321 must verify successfully");
  assertEqual(RestoSync.verifyOwnerPin("9876", "warung-berkah"), true, "New Owner PIN 9876 must verify successfully");
  assertEqual(RestoSync.verifyPosPin("1234", "warung-berkah"), false, "Old Cashier PIN 1234 must now fail");
});

print("===============================================================================");
print("HASIL: " + passedTests + " passed, " + failedTests + " failed, total " + totalTests);
print("===============================================================================");

if (failedTests > 0) {
  throw new Error(failedTests + " test(s) failed.");
}
