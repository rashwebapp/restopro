/**
 * Test Suite Tahap 2 — Task 4: Modal Checkout Pembayaran & Upload Bukti di
 * owner_settings_saas.html & resto_hub.html
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_payment_checkout_flow.js
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

var timeoutQueue = [];
var setTimeout = function (cb, ms) {
  if (typeof cb === "function") {
    timeoutQueue.push(cb);
    // In headless mock, execute immediately or synchronously when drained
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

var MOCK_CLOUD_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/MOCK_MASTER_CLOUD/exec",
  API_SECRET_KEY: "MOCK-ADMIN-SECRET-KEY"
};

var fetch = function () {
  return Promise.reject(new Error("Offline mock"));
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

// Mock FileReader and Image for canvas compression simulation
function MockFileReader() {
  this.onload = null;
  this.onerror = null;
  this.readAsDataURL = function (blobOrFile) {
    var self = this;
    var res = (blobOrFile && blobOrFile._base64Mock) ? blobOrFile._base64Mock : "data:image/jpeg;base64,TU9DS19JTUFHRV9EQVRB";
    if (typeof self.onload === "function") {
      self.onload({ target: { result: res } });
    }
  };
}
var FileReader = MockFileReader;

function MockImage() {
  this.width = 1600;
  this.height = 1200;
  this._src = "";
  var self = this;
  Object.defineProperty(this, "src", {
    set: function (val) {
      this._src = val;
      if (typeof self.onload === "function") {
        self.onload();
      }
    },
    get: function () { return this._src; }
  });
}
var Image = MockImage;

// Load shared scripts first (as HTML pages do)
load("assets/js/resto-config.js");
load("assets/js/resto-data.js");
load("assets/js/resto-sync.js");

window.RESTO_CLOUD_CONFIG = MOCK_CLOUD_CONFIG;

// -----------------------------------------------------------------------------
// 2. DOM Harness for Headless Testing
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
    const initValue = attrs["value"] !== undefined ? String(attrs["value"]) : "";
    const initDisabled = Object.prototype.hasOwnProperty.call(attrs, "disabled");
    const initChecked = Object.prototype.hasOwnProperty.call(attrs, "checked");
    let currentId = attrs["id"] || "";
    let currentInnerHtml = "";
    let currentSrc = attrs["src"] || "";

    const el = {
      tagName: String(tagName || "div").toUpperCase(),
      type: String(attrs["type"] || "").toLowerCase(),
      name: attrs["name"] || "",
      _attrs: attrs,
      _value: initValue,
      _checked: initChecked,
      _textContent: innerText !== undefined && innerText !== null ? String(innerText) : "",
      parentNode: null,
      children: [],
      files: [],
      style: {
        display: ""
      },
      classList: {
        add(cls) {
          String(cls).split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
          el._attrs["class"] = Array.from(classSet).join(" ");
        },
        remove(cls) {
          String(cls).split(/\s+/).filter(Boolean).forEach(c => classSet.delete(c));
          el._attrs["class"] = Array.from(classSet).join(" ");
        },
        contains(cls) {
          return classSet.has(cls);
        },
        toggle(cls, force) {
          const has = classSet.has(cls);
          const next = force !== undefined ? Boolean(force) : !has;
          if (next) classSet.add(cls);
          else classSet.delete(cls);
          el._attrs["class"] = Array.from(classSet).join(" ");
          return next;
        }
      },
      getAttribute(k) {
        const lk = String(k).toLowerCase();
        if (lk === "class") return Array.from(classSet).join(" ");
        if (lk === "value") return el._value;
        if (lk === "src") return currentSrc;
        return Object.prototype.hasOwnProperty.call(el._attrs, lk) ? el._attrs[lk] : null;
      },
      setAttribute(k, v) {
        const lk = String(k).toLowerCase();
        const sv = String(v);
        el._attrs[lk] = sv;
        if (lk === "id") {
          if (currentId && byId[currentId] === el) delete byId[currentId];
          currentId = sv;
          byId[currentId] = el;
        } else if (lk === "class") {
          classSet.clear();
          sv.split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
        } else if (lk === "value") {
          el._value = sv;
        } else if (lk === "src") {
          currentSrc = sv;
        } else if (lk === "disabled") {
          el.disabled = true;
        }
      },
      removeAttribute(k) {
        const lk = String(k).toLowerCase();
        delete el._attrs[lk];
        if (lk === "id" && currentId) {
          delete byId[currentId];
          currentId = "";
        } else if (lk === "class") {
          classSet.clear();
        } else if (lk === "disabled") {
          el.disabled = false;
        }
      },
      hasAttribute(k) {
        return el.getAttribute(k) !== null;
      },
      appendChild(child) {
        if (!child) return child;
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = el;
        el.children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = el.children.indexOf(child);
        if (idx !== -1) el.children.splice(idx, 1);
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

    if (tagName.toLowerCase() === "canvas") {
      el.getContext = function (type) {
        return {
          drawImage: function () {},
          fillRect: function () {},
          clearRect: function () {}
        };
      };
      el.toDataURL = function (type, quality) {
        return "data:image/jpeg;base64,TU9DS19DQU5WQVNfQ09NUFJFU1NFRF9EQVRB";
      };
    }

    Object.defineProperty(el, "id", {
      get() { return currentId; },
      set(v) { el.setAttribute("id", v); }
    });

    Object.defineProperty(el, "className", {
      get() { return Array.from(classSet).join(" "); },
      set(v) { el.setAttribute("class", v); }
    });

    Object.defineProperty(el, "value", {
      get() { return el._value; },
      set(v) { el._value = String(v); }
    });

    Object.defineProperty(el, "checked", {
      get() { return Boolean(el._checked); },
      set(v) {
        el._checked = Boolean(v);
        if (v && el.type === "radio" && el.name) {
          allElements.forEach(other => {
            if (other !== el && other.type === "radio" && other.name === el.name) {
              other._checked = false;
            }
          });
        }
      }
    });

    Object.defineProperty(el, "disabled", {
      get() { return Boolean(el._disabled); },
      set(v) {
        el._disabled = Boolean(v);
        if (v) el._attrs["disabled"] = "";
        else delete el._attrs["disabled"];
      }
    });
    el._disabled = initDisabled;

    Object.defineProperty(el, "src", {
      get() { return currentSrc; },
      set(v) { currentSrc = String(v); el._attrs["src"] = currentSrc; }
    });

    Object.defineProperty(el, "textContent", {
      get() {
        if (currentInnerHtml) {
          return currentInnerHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
        }
        if (el.children.length > 0) {
          return el.children.map(c => c.textContent).join(" ");
        }
        if (el._rawHtml) {
          return el._rawHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
        }
        return el._textContent;
      },
      set(v) {
        el._textContent = String(v);
        currentInnerHtml = "";
        el._rawHtml = "";
        el.children = [];
      }
    });

    Object.defineProperty(el, "innerHTML", {
      get() {
        if (currentInnerHtml) return currentInnerHtml;
        if (el._rawHtml) return el._rawHtml;
        return el._textContent;
      },
      set(v) {
        currentInnerHtml = String(v);
        el._rawHtml = "";
        clearDynamicChildren(el);
        registerInnerIds(el, currentInnerHtml);
      }
    });

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
        const popped = stack.pop();
        if (popped._startIndex !== undefined) {
          popped._rawHtml = stripped.substring(popped._startIndex, match.index);
        }
      }
      continue;
    }

    const attrs = extractAttributes(match[2] || "");
    const el = makeElement(tag, attrs, "");
    el._startIndex = tagRe.lastIndex;
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
      openPaymentCheckoutModal: typeof openPaymentCheckoutModal === "function" ? openPaymentCheckoutModal : undefined,
      closePaymentCheckoutModal: typeof closePaymentCheckoutModal === "function" ? closePaymentCheckoutModal : undefined,
      setPaymentPlan: typeof setPaymentPlan === "function" ? setPaymentPlan : undefined,
      handlePaymentProofFileSelect: typeof handlePaymentProofFileSelect === "function" ? handlePaymentProofFileSelect : undefined,
      submitPaymentProofForm: typeof submitPaymentProofForm === "function" ? submitPaymentProofForm : undefined,
      checkTenantPaymentStatus: typeof checkTenantPaymentStatus === "function" ? checkTenantPaymentStatus : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "RESTO_CONFIG", "RESTO_TABLES", "formatRupiah", "ThemeManager",
    "fetch", "alert", "confirm", "prompt", "navigator", "setTimeout",
    "location", "console", "FileReader", "Image",
    rawScript + "\n" + exportFooter
  );
  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    RESTO_CONFIG, RESTO_TABLES, formatRupiah, MOCK_THEME_MANAGER,
    fetch, alert, confirm, prompt, navigator, setTimeout,
    location, console, MockFileReader, MockImage
  );

  Object.assign(win, api);
  Object.assign(globalThis, api);
  globalThis.window = win;
  globalThis.document = doc;
  return { html, doc, win, api };
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

  RestoSync.init();

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      initRestoHub: typeof initRestoHub === "function" ? initRestoHub : undefined,
      renderRestaurantInfo: typeof renderRestaurantInfo === "function" ? renderRestaurantInfo : undefined,
      openPaymentCheckoutModal: typeof openPaymentCheckoutModal === "function" ? openPaymentCheckoutModal : undefined,
      closePaymentCheckoutModal: typeof closePaymentCheckoutModal === "function" ? closePaymentCheckoutModal : undefined,
      setPaymentPlan: typeof setPaymentPlan === "function" ? setPaymentPlan : undefined,
      handlePaymentProofFileSelect: typeof handlePaymentProofFileSelect === "function" ? handlePaymentProofFileSelect : undefined,
      submitPaymentProofForm: typeof submitPaymentProofForm === "function" ? submitPaymentProofForm : undefined,
      checkTenantPaymentStatus: typeof checkTenantPaymentStatus === "function" ? checkTenantPaymentStatus : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "ThemeManager", "fetch", "alert", "prompt", "navigator", "setTimeout",
    "requestAnimationFrame", "console", "FileReader", "Image",
    rawScript + "\n" + exportFooter
  );
  const api = factory(
    win, doc, localStorage, sessionStorage, RestoSync,
    MOCK_THEME_MANAGER, fetch, alert, prompt, navigator, setTimeout,
    requestAnimationFrame, console, MockFileReader, MockImage
  );

  Object.assign(win, api);
  Object.assign(globalThis, api);
  globalThis.window = win;
  globalThis.document = doc;
  return { html, doc, win, api };
}

// -----------------------------------------------------------------------------
// 3. Test Runner & Helpers
// -----------------------------------------------------------------------------
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
// 4. Test Cases
// -----------------------------------------------------------------------------

test("1. openPaymentCheckoutModal() opens #paymentCheckoutModal and sets package prices correctly (monthly & lifetime) with official banks", function () {
  resetAll();
  const mockTenant = {
    id: "harapan-corner",
    name: "Harapan Corner",
    plan: "trial",
    status: "trial",
    isPaidActive: false,
    tablesCount: 12
  };
  localStorage.setItem("resto_current_tenant_id", "harapan-corner");
  localStorage.setItem("resto_tenants_cache", JSON.stringify([mockTenant]));

  const { doc, win, api } = mountOwnerSettings({ search: "?tenant=harapan-corner" });

  const modal = doc.getElementById("paymentCheckoutModal");
  assert(modal, "#paymentCheckoutModal must exist in owner_settings_saas.html");
  assert(modal.classList.contains("hidden"), "Modal should be initially hidden");

  // Check official banks exist in modal content
  const modalText = modal.innerHTML;
  assert(modalText.indexOf("123-456-7890") !== -1, "Official BCA account 123-456-7890 must be displayed in modal");
  assert(modalText.indexOf("137-00-1234567-8") !== -1, "Official Mandiri account 137-00-1234567-8 must be displayed in modal");
  assert(modalText.indexOf("RASH WebApp Builder") !== -1, "Account holder 'RASH WebApp Builder' must be displayed");
  assert(modalText.indexOf("QRIS") !== -1, "QRIS indicator must be displayed");

  // Call openPaymentCheckoutModal('monthly')
  assert(typeof api.openPaymentCheckoutModal === "function", "openPaymentCheckoutModal must be exported");
  api.openPaymentCheckoutModal("monthly");
  assert(!modal.classList.contains("hidden"), "Modal should be visible after openPaymentCheckoutModal()");

  const monthlyRadio = doc.getElementById("planMonthly") || doc.querySelector("input[value='monthly']");
  assert(monthlyRadio, "Radio option for monthly package must exist");
  assert(monthlyRadio.checked, "Monthly radio should be checked when opened with 'monthly'");

  const amountDisplay = doc.getElementById("paymentPlanPrice") || doc.getElementById("paymentAmountDisplay");
  assert(amountDisplay, "Element displaying payment amount must exist");
  assert(amountDisplay.textContent.indexOf("199.000") !== -1, "Monthly price 199.000 must be displayed, got: " + amountDisplay.textContent);

  // Switch to lifetime
  api.openPaymentCheckoutModal("lifetime");
  const lifetimeRadio = doc.getElementById("planLifetime") || doc.querySelector("input[value='lifetime']");
  assert(lifetimeRadio, "Radio option for lifetime package must exist");
  assert(lifetimeRadio.checked, "Lifetime radio should be checked when opened with 'lifetime'");
  assert(amountDisplay.textContent.indexOf("2.999.000") !== -1, "Lifetime price 2.999.000 must be displayed, got: " + amountDisplay.textContent);
});

test("2. Image selection prepares Base64 payload and populates preview", function () {
  resetAll();
  const mockTenant = {
    id: "harapan-corner",
    name: "Harapan Corner",
    plan: "trial",
    status: "trial",
    isPaidActive: false
  };
  localStorage.setItem("resto_current_tenant_id", "harapan-corner");
  localStorage.setItem("resto_tenants_cache", JSON.stringify([mockTenant]));

  const { doc, api } = mountOwnerSettings({ search: "?tenant=harapan-corner" });

  const fileInput = doc.getElementById("paymentProofFile");
  assert(fileInput, "#paymentProofFile must exist");
  const preview = doc.getElementById("paymentProofPreview");
  assert(preview, "#paymentProofPreview must exist");

  // Simulate file change
  const mockFile = {
    name: "struk_transfer.jpg",
    type: "image/jpeg",
    size: 54321,
    _base64Mock: "data:image/jpeg;base64,TU9DS19TVFJVU19UUkFOU0ZFUg=="
  };
  fileInput.files = [mockFile];

  assert(typeof api.handlePaymentProofFileSelect === "function", "handlePaymentProofFileSelect must be exported");
  api.handlePaymentProofFileSelect({ target: fileInput });

  // Preview element should contain image src or innerHTML with the base64 / preview image
  const previewHtml = preview.innerHTML;
  const previewImg = preview.querySelector("img") || (preview.tagName === "IMG" ? preview : null);
  const hasPreviewData = (previewImg && previewImg.src && previewImg.src.indexOf("data:image") !== -1) ||
                         (previewHtml && previewHtml.indexOf("data:image") !== -1) ||
                         (previewHtml && previewHtml.indexOf("struk_transfer.jpg") !== -1);
  assert(hasPreviewData, "Preview container should display the uploaded image or filename");
});

test("3. Submitting valid form calls RestoSync.submitPaymentProof and updates UI to pending state", function () {
  resetAll();
  const mockTenant = {
    id: "harapan-corner",
    name: "Harapan Corner",
    plan: "trial",
    status: "trial",
    isPaidActive: false
  };
  localStorage.setItem("resto_current_tenant_id", "harapan-corner");
  localStorage.setItem("resto_tenants_cache", JSON.stringify([mockTenant]));

  let submittedPayload = null;
  RestoSync.submitPaymentProof = function (payload) {
    submittedPayload = payload;
    return Promise.resolve({
      success: true,
      paymentId: "PAY-TEST-001",
      status: "pending",
      message: "Bukti transfer berhasil diunggah"
    });
  };

  const { doc, api } = mountOwnerSettings({ search: "?tenant=harapan-corner" });

  api.openPaymentCheckoutModal("monthly");

  const senderNameInput = doc.getElementById("paymentSenderName");
  assert(senderNameInput, "#paymentSenderName must exist");
  senderNameInput.value = "Budi Hartono";

  const senderBankInput = doc.getElementById("paymentSenderBank");
  assert(senderBankInput, "#paymentSenderBank must exist");
  senderBankInput.value = "BCA";

  const fileInput = doc.getElementById("paymentProofFile");
  fileInput.files = [{
    name: "bukti.jpg",
    type: "image/jpeg",
    _base64Mock: "data:image/jpeg;base64,VkFMTERfUFJPT0ZfREFUQQ=="
  }];
  api.handlePaymentProofFileSelect({ target: fileInput });

  // Call submission
  assert(typeof api.submitPaymentProofForm === "function", "submitPaymentProofForm must be exported");
  const submitPromise = api.submitPaymentProofForm();

  // Wait for submission completion if async
  return Promise.resolve(submitPromise).then(function () {
    assert(submittedPayload !== null, "RestoSync.submitPaymentProof should have been called");
    assertEqual(submittedPayload.tenantId, "harapan-corner", "Tenant ID should match");
    assertEqual(submittedPayload.plan, "monthly", "Plan should be monthly");
    assertEqual(submittedPayload.amount, 199000, "Amount should be 199000");
    assertEqual(submittedPayload.senderName, "Budi Hartono", "Sender name should match");
    assertEqual(submittedPayload.senderBank, "BCA", "Sender bank should match");

    // Check status banner in Owner Settings
    const statusBanner = doc.getElementById("paymentStatusBanner");
    assert(statusBanner, "#paymentStatusBanner must exist in owner_settings_saas.html");
    assert(!statusBanner.classList.contains("hidden"), "Status banner should be visible for pending status");
    const bannerText = statusBanner.textContent;
    assert(
      bannerText.indexOf("sedang diverifikasi oleh Tim Admin RASH") !== -1 ||
      bannerText.indexOf("sedang diverifikasi Admin RASH") !== -1,
      "Banner should show pending verification message, got: " + bannerText
    );
  });
});

test("4. When getTenantPaymentStatus returns rejected, modal / banner displays rejectReason and allows re-upload", function () {
  resetAll();
  const mockTenant = {
    id: "harapan-corner",
    name: "Harapan Corner",
    plan: "trial",
    status: "trial",
    isPaidActive: false
  };
  localStorage.setItem("resto_current_tenant_id", "harapan-corner");
  localStorage.setItem("resto_tenants_cache", JSON.stringify([mockTenant]));

  RestoSync.getTenantPaymentStatus = function () {
    return Promise.resolve({
      success: true,
      latestPayment: {
        id: "PAY-REJ-999",
        plan: "monthly",
        amount: 199000,
        status: "rejected",
        rejectReason: "Nominal transfer kurang Rp 50.000, mohon periksa mutasi",
        createdAt: new Date().toISOString()
      }
    });
  };

  const { doc, api } = mountOwnerSettings({ search: "?tenant=harapan-corner" });

  assert(typeof api.checkTenantPaymentStatus === "function", "checkTenantPaymentStatus must be exported");
  return Promise.resolve(api.checkTenantPaymentStatus()).then(function () {
    const statusBanner = doc.getElementById("paymentStatusBanner");
    assert(statusBanner, "#paymentStatusBanner must exist");
    assert(!statusBanner.classList.contains("hidden"), "Status banner should be visible when rejected");

    const bannerText = statusBanner.textContent;
    assert(
      bannerText.indexOf("ditolak") !== -1,
      "Banner should indicate payment was rejected, got: " + bannerText
    );
    assert(
      bannerText.indexOf("Nominal transfer kurang Rp 50.000") !== -1,
      "Banner should display rejectReason, got: " + bannerText
    );

    // Re-upload button should exist
    const reuploadBtn = doc.getElementById("btnReuploadPaymentProof") || statusBanner.querySelector("button");
    assert(reuploadBtn, "Re-upload button must exist in rejected banner");

    const modal = doc.getElementById("paymentCheckoutModal");
    assert(modal.classList.contains("hidden"), "Modal initially closed before re-upload click");

    reuploadBtn.click();
    assert(!modal.classList.contains("hidden"), "Re-upload button click should open #paymentCheckoutModal");
  });
});

test("5. In resto_hub.html, 'Perpanjang / Upgrade' triggers checkout modal, and pending banner displays when payment is pending", function () {
  resetAll();
  const mockTenant = {
    id: "harapan-corner",
    name: "Harapan Corner",
    plan: "trial",
    status: "trial",
    isPaidActive: false
  };
  localStorage.setItem("resto_current_tenant_id", "harapan-corner");
  localStorage.setItem("resto_tenants_cache", JSON.stringify([mockTenant]));

  RestoSync.getTenantPaymentStatus = function () {
    return Promise.resolve({
      success: true,
      latestPayment: {
        id: "PAY-PEND-123",
        plan: "lifetime",
        amount: 2999000,
        status: "pending",
        createdAt: new Date().toISOString()
      }
    });
  };

  const { doc, api } = mountRestoHub({ search: "?tenant=harapan-corner" });

  const modal = doc.getElementById("paymentCheckoutModal");
  assert(modal, "#paymentCheckoutModal must exist in resto_hub.html");
  assert(modal.classList.contains("hidden"), "Modal initially hidden in Hub");

  // Upgrade button in license card
  const upgradeBtn = doc.getElementById("btnHubUpgrade") || doc.querySelector("button[onclick*='openPaymentCheckoutModal']");
  assert(upgradeBtn, "CTA 'Perpanjang / Upgrade' button must exist in resto_hub.html");

  upgradeBtn.click();
  assert(!modal.classList.contains("hidden"), "Clicking upgrade button in resto_hub.html should open #paymentCheckoutModal");

  // Test pending banner display in resto_hub.html
  assert(typeof api.checkTenantPaymentStatus === "function", "checkTenantPaymentStatus must be exported in resto_hub.html");
  return Promise.resolve(api.checkTenantPaymentStatus()).then(function () {
    const hubBanner = doc.getElementById("paymentStatusBanner");
    assert(hubBanner, "#paymentStatusBanner must exist in resto_hub.html");
    assert(!hubBanner.classList.contains("hidden"), "Hub status banner should be visible for pending status");

    const text = hubBanner.textContent;
    assert(
      text.indexOf("sedang diverifikasi") !== -1,
      "Hub status banner should indicate pending verification, got: " + text
    );
  });
});

// -----------------------------------------------------------------------------
// 5. Execute All Tests
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

print("===============================================================================");
print("RUNNING TESTS: Task 4 — Modal Checkout Pembayaran & Upload Bukti");
print("===============================================================================");

function runNextTest(idx) {
  if (idx >= tests.length) {
    print("===============================================================================");
    print("HASIL: " + passed + " passed, " + failed + " failed, total " + tests.length);
    print("===============================================================================");
    if (failed > 0) {
      throw new Error("Terdapat " + failed + " test gagal!");
    }
    return;
  }

  const t = tests[idx];
  try {
    const res = t.fn();
    if (res && typeof res.then === "function") {
      res.then(() => {
        passed++;
        print("  [PASS] " + t.name);
        runNextTest(idx + 1);
      }).catch(err => {
        failed++;
        print("  [FAIL] " + t.name);
        print("         " + (err && err.stack ? err.stack : String(err)));
        runNextTest(idx + 1);
      });
    } else {
      passed++;
      print("  [PASS] " + t.name);
      runNextTest(idx + 1);
    }
  } catch (err) {
    failed++;
    print("  [FAIL] " + t.name);
    print("         " + (err && err.stack ? err.stack : String(err)));
    runNextTest(idx + 1);
  }
}

runNextTest(0);
