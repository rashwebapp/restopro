/**
 * Test Suite Tahap 1 — Task 3: Super Admin Console (super_admin_saas.html) & Trial Self-Serve (index.html)
 *
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_and_self_serve.js
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

var setTimeout = function (fn) {
  // No-op delayed timers in synchronous test environment unless needed
  return 1;
};
var clearTimeout = function () {};

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
    href: "https://resto.example.com/super_admin_saas.html",
    pathname: "/super_admin_saas.html",
    hash: ""
  },
  history: {
    replaceState: function () {}
  },
  addEventListener: function () {},
  RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
};

// Load shared scripts first (as HTML pages do)
load("assets/js/resto-config.js");
load("assets/js/resto-data.js");
load("assets/js/resto-sync.js");

// Re-apply mock cloud config to window.RESTO_CLOUD_CONFIG
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
  const radioGroups = Object.create(null);

  const doc = {
    title: "",
    _byId: byId,
    _elements: allElements,
    _radioGroups: radioGroups,
    _eventListeners: Object.create(null),
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
      // Match input[name="..."][value="..."]:checked or input[name="..."]:checked or input[name="..."]
      const inputMatch = s.match(/^input\[name=["']([^"']+)["']\](?:\[value=["']([^"']+)["']\])?(:checked)?$/);
      if (inputMatch) {
        const name = inputMatch[1];
        const val = inputMatch[2];
        const needChecked = Boolean(inputMatch[3]);
        return (radioGroups[name] || []).filter(el => {
          if (val !== undefined && el.value !== val) return false;
          if (needChecked && !el.checked) return false;
          return true;
        });
      }
      // Match "#formId button[type="submit"]" or "button[type="submit"]"
      const submitMatch = s.match(/^(?:#([a-zA-Z0-9_-]+)\s+)?button\[type=["']submit["']\]$/);
      if (submitMatch) {
        const formId = submitMatch[1];
        return allElements.filter(el => {
          if (el.tagName !== "BUTTON") return false;
          if ((el.getAttribute("type") || "").toLowerCase() !== "submit") return false;
          if (formId && el._formId !== formId) return false;
          return true;
        });
      }
      return [];
    }
  };

  function makeElement(tagName, attrs, innerText) {
    const classSet = new Set(String(attrs["class"] || "").split(/\s+/).filter(Boolean));
    const initValue = attrs["value"] !== undefined ? String(attrs["value"]) : "";
    const initChecked = Object.prototype.hasOwnProperty.call(attrs, "checked");
    const initDisabled = Object.prototype.hasOwnProperty.call(attrs, "disabled");
    const type = String(attrs["type"] || "").toLowerCase();
    const name = attrs["name"] || "";

    const el = {
      tagName: String(tagName || "div").toUpperCase(),
      type: type,
      name: name,
      id: attrs["id"] || "",
      _attrs: attrs,
      _defaultValue: initValue,
      _defaultChecked: initChecked,
      _value: initValue,
      _checked: initChecked,
      disabled: initDisabled,
      href: attrs["href"] || "",
      innerHTML: "",
      _textContent: innerText !== undefined && innerText !== null ? String(innerText) : "",
      children: [],
      options: [],
      style: {},
      _formId: attrs._formId || "",
      get textContent() { return this._textContent; },
      set textContent(v) { this._textContent = v === undefined || v === null ? "" : String(v); },
      get value() { return this._value; },
      set value(v) { this._value = v === undefined || v === null ? "" : String(v); },
      get checked() { return this._checked; },
      set checked(v) {
        const next = Boolean(v);
        if (next && this.type === "radio" && this.name && radioGroups[this.name]) {
          radioGroups[this.name].forEach(other => {
            if (other !== this) other._checked = false;
          });
        }
        this._checked = next;
      },
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
        if (key === "id") { this.id = String(v); byId[this.id] = this; }
        if (key === "href") this.href = String(v);
        if (key === "value") this._value = String(v);
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      remove() {},
      focus() {},
      select() {},
      querySelector(sel) {
        if (sel === 'button[type="submit"]' && this.tagName === "FORM") {
          return allElements.find(c => c._formId === this.id && c.tagName === "BUTTON" && (c.getAttribute("type") || "").toLowerCase() === "submit") || null;
        }
        return doc.querySelector(sel);
      },
      reset() {
        if (this.tagName === "FORM") {
          allElements.forEach(item => {
            if (item._formId === this.id) {
              if (item.type === "radio" || item.type === "checkbox") {
                item._checked = item._defaultChecked;
              } else {
                item._value = item._defaultValue;
              }
            }
          });
        }
      }
    };

    allElements.push(el);
    if (el.id) byId[el.id] = el;
    if (el.tagName === "INPUT" && el.type === "radio" && el.name) {
      if (!radioGroups[el.name]) radioGroups[el.name] = [];
      radioGroups[el.name].push(el);
    }
    return el;
  }

  // Track active form ID so form.reset() & form.querySelector('button[type="submit"]') work cleanly
  const tagRe = /<\/?([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;
  let activeFormId = "";
  let activeSelectEl = null;

  while ((match = tagRe.exec(stripped)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = full.indexOf("</") === 0;
    const isSelfClosing = full.slice(-2) === "/>";

    if (isClosing) {
      if (tag === "form") activeFormId = "";
      if (tag === "select" && activeSelectEl) {
        if (!activeSelectEl._value && activeSelectEl.options.length > 0) {
          activeSelectEl._value = activeSelectEl.options[0].value;
          activeSelectEl._defaultValue = activeSelectEl._value;
        }
        activeSelectEl = null;
      }
      continue;
    }

    const attrs = extractAttributes(match[2] || "");
    if (activeFormId) attrs._formId = activeFormId;

    if (tag === "form") {
      const formEl = makeElement("form", attrs, "");
      if (!isSelfClosing) activeFormId = formEl.id;
      continue;
    }

    if (tag === "select") {
      const selEl = makeElement("select", attrs, "");
      if (!isSelfClosing) activeSelectEl = selEl;
      continue;
    }

    if (tag === "option" && activeSelectEl) {
      const optVal = attrs["value"] !== undefined ? attrs["value"] : "";
      const isSelected = Object.prototype.hasOwnProperty.call(attrs, "selected");
      activeSelectEl.options.push({ value: optVal, selected: isSelected });
      if (isSelected) {
        activeSelectEl._value = optVal;
        activeSelectEl._defaultValue = optVal;
      }
      continue;
    }

    if (tag === "input" || tag === "button" || tag === "textarea" || attrs["id"]) {
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
  const syncRef = options.omitRestoSync ? undefined : RestoSync;

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      getBaseUrl: typeof getBaseUrl === "function" ? getBaseUrl : undefined,
      checkSessionAuth: typeof checkSessionAuth === "function" ? checkSessionAuth : undefined,
      handlePinLogin: typeof handlePinLogin === "function" ? handlePinLogin : undefined,
      unlockPortal: typeof unlockPortal === "function" ? unlockPortal : undefined,
      lockPortal: typeof lockPortal === "function" ? lockPortal : undefined,
      getAllTenantsSafe: typeof getAllTenantsSafe === "function" ? getAllTenantsSafe : undefined,
      registerTenantSafe: typeof registerTenantSafe === "function" ? registerTenantSafe : undefined,
      updateTenantSafe: typeof updateTenantSafe === "function" ? updateTenantSafe : undefined,
      renewTenantSafe: typeof renewTenantSafe === "function" ? renewTenantSafe : undefined,
      deleteTenantSafe: typeof deleteTenantSafe === "function" ? deleteTenantSafe : undefined,
      getTenantInfoSafe: typeof getTenantInfoSafe === "function" ? getTenantInfoSafe : undefined,
      renderAllTenants: typeof renderAllTenants === "function" ? renderAllTenants : undefined,
      filterTenants: typeof filterTenants === "function" ? filterTenants : undefined,
      updateKpis: typeof updateKpis === "function" ? updateKpis : undefined,
      openNewTenantModal: typeof openNewTenantModal === "function" ? openNewTenantModal : undefined,
      closeNewTenantModal: typeof closeNewTenantModal === "function" ? closeNewTenantModal : undefined,
      handleCreateTenant: typeof handleCreateTenant === "function" ? handleCreateTenant : undefined,
      openEditTenantModal: typeof openEditTenantModal === "function" ? openEditTenantModal : undefined,
      closeEditTenantModal: typeof closeEditTenantModal === "function" ? closeEditTenantModal : undefined,
      handleEditTenantSubmit: typeof handleEditTenantSubmit === "function" ? handleEditTenantSubmit : undefined,
      quickAdjustEditExpiry: typeof quickAdjustEditExpiry === "function" ? quickAdjustEditExpiry : undefined,
      handleLoadDemoTenants: typeof handleLoadDemoTenants === "function" ? handleLoadDemoTenants : undefined,
      handleCloudRefreshTenants: typeof handleCloudRefreshTenants === "function" ? handleCloudRefreshTenants : undefined,
      confirmDeleteTenant: typeof confirmDeleteTenant === "function" ? confirmDeleteTenant : undefined,
      handleRenewTenant: typeof handleRenewTenant === "function" ? handleRenewTenant : undefined,
      showTenantSuccessModal: typeof showTenantSuccessModal === "function" ? showTenantSuccessModal : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "fetch", "alert", "confirm", "navigator", "setTimeout", "console",
    rawScript + "\n" + exportFooter
  );
  const api = factory(win, doc, localStorage, sessionStorage, syncRef, fetch, alert, confirm, navigator, setTimeout, console);
  return { html, doc, win, api };
}

function mountIndexPage() {
  const html = readFile("index.html");
  const doc = createDomFromHtml(html);
  const win = {
    location: {
      search: "",
      href: "https://resto.example.com/index.html",
      pathname: "/index.html",
      hash: ""
    },
    history: { replaceState: function () {} },
    addEventListener: function () {},
    RESTO_CLOUD_CONFIG: MOCK_CLOUD_CONFIG
  };

  const rawScript = extractInlineScript(html);
  const exportFooter = `
    return {
      openSelfServeModal: typeof openSelfServeModal === "function" ? openSelfServeModal : undefined,
      closeSelfServeModal: typeof closeSelfServeModal === "function" ? closeSelfServeModal : undefined,
      handleSelfServeRegister: typeof handleSelfServeRegister === "function" ? handleSelfServeRegister : undefined
    };
  `;

  const factory = new Function(
    "window", "document", "localStorage", "sessionStorage", "RestoSync",
    "fetch", "alert", "confirm", "navigator", "setTimeout", "console", "ThemeManager",
    rawScript + "\n" + exportFooter
  );
  const api = factory(win, doc, localStorage, sessionStorage, RestoSync, fetch, alert, confirm, navigator, setTimeout, console, MOCK_THEME_MANAGER);
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
  window.location.href = "https://resto.example.com/super_admin_saas.html";
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

function selectRadio(doc, name, value) {
  const radios = doc.querySelectorAll('input[name="' + name + '"]');
  const target = radios.find(r => r.value === value);
  assert(Boolean(target), "Radio input[name=" + name + "][value=" + value + "] must exist in HTML");
  target.checked = true;
  return target;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// -----------------------------------------------------------------------------
// 4. Test Cases (Task 3 Brief + Spec + Preflight Ruling)
// -----------------------------------------------------------------------------

test("1. Deleting all tenants in super_admin_saas keeps getAllTenantsSafe() empty and shows #emptyState without regenerating dummies; handleLoadDemoTenants seeds demos", function () {
  resetAll();
  const { html, doc, api } = mountSuperAdmin();

  // Verify PIN 9999 & 9119 unlock flow works
  doc.getElementById("masterPinInput").value = "9999";
  api.handlePinLogin({ preventDefault: function () {} });
  if (typeof drainMicrotasks === "function") drainMicrotasks();
  assertEqual(doc.getElementById("pinLockScreen").classList.contains("hidden"), true, "PIN 9999 must unlock portal");

  const initial = api.getAllTenantsSafe();
  assert(Array.isArray(initial) && initial.length === 3, "Initial seed must return 3 demo tenants");

  // Delete every tenant permanently
  confirmReturnValue = true;
  initial.forEach(t => {
    api.confirmDeleteTenant(t.id, t.name);
  });

  const afterDelete = api.getAllTenantsSafe();
  assertEqual(afterDelete.length, 0, "getAllTenantsSafe() must return [] after deleting all tenants");
  assertEqual(localStorage.getItem(RestoSync.TENANTS_INIT_FLAG_KEY), "true", "TENANTS_INIT_FLAG_KEY must remain 'true'");
  assertEqual(doc.getElementById("emptyState").classList.contains("hidden"), false, "#emptyState must be visible when 0 tenants");
  assertEqual(doc.getElementById("tenantsGrid").innerHTML, "", "#tenantsGrid must be empty");
  assertEqual(doc.getElementById("statTotalTenants").textContent, "0", "KPI total must be 0");

  // Even without RestoSync (fallback path), getAllTenantsSafe() MUST honor TENANTS_INIT_FLAG_KEY and NOT re-seed dummy rows!
  const fallbackMount = mountSuperAdmin({ omitRestoSync: true });
  const fallbackList = fallbackMount.api.getAllTenantsSafe();
  assertEqual(fallbackList.length, 0, "Fallback getAllTenantsSafe() must also honor TENANTS_INIT_FLAG_KEY and return []");

  // Verify #emptyState contains button calling handleLoadDemoTenants()
  assert(typeof api.handleLoadDemoTenants === "function", "handleLoadDemoTenants() must exist");
  assert(html.indexOf("handleLoadDemoTenants") !== -1, "#emptyState must include button calling handleLoadDemoTenants()");

  api.handleLoadDemoTenants();
  const afterDemo = api.getAllTenantsSafe();
  assertEqual(afterDemo.length, 3, "handleLoadDemoTenants() must seed 3 demo tenants");
  assertEqual(doc.getElementById("emptyState").classList.contains("hidden"), true, "#emptyState hides after demo seed");
  assertEqual(doc.getElementById("statTotalTenants").textContent, "3", "KPI total updates to 3");
});

test("2. Creating lifetime tenant via #newTenantForm sets Rp 2.999.000 / Rp 3.500.000 / isLifetime:true / expiresAt:null and renders clean card markup without duplicate Hapus Klien", function () {
  resetAll();
  const { html, doc, api } = mountSuperAdmin();

  // Delete initial demo tenants so we inspect a single rendered card cleanly
  api.getAllTenantsSafe().forEach(t => api.deleteTenantSafe(t.id));
  assertEqual(api.getAllTenantsSafe().length, 0, "Starts clean with 0 tenants");

  // Verify #newTenantModal contains the 3 commercial plans and NOT old basic/pro radios
  assertEqual(doc.querySelectorAll('input[name="planChoice"][value="trial"]').length, 1, "Must have trial plan radio");
  assertEqual(doc.querySelectorAll('input[name="planChoice"][value="monthly"]').length, 1, "Must have monthly plan radio");
  assertEqual(doc.querySelectorAll('input[name="planChoice"][value="lifetime"]').length, 1, "Must have lifetime plan radio");
  assertEqual(doc.querySelectorAll('input[name="planChoice"][value="basic"]').length, 0, "Old basic radio must be removed");
  assertEqual(doc.querySelectorAll('input[name="planChoice"][value="pro"]').length, 0, "Old pro radio must be removed");
  assert(html.indexOf("Maks. 4 Meja") !== -1, "#newTenantModal must mention Maks. 4 Meja for trial");
  assert(html.indexOf("199.000") !== -1, "#newTenantModal must show Rp 199.000 for monthly");
  assert(html.indexOf("3.500.000") !== -1 && html.indexOf("2.999.000") !== -1, "#newTenantModal must show strikethrough Rp 3.500.000 and Rp 2.999.000 for lifetime");

  api.openNewTenantModal();
  doc.getElementById("inputTenantName").value = "Sate Nusantara";
  doc.getElementById("inputTenantSlug").value = "sate-nusantara";
  doc.getElementById("inputTenantPic").value = "Pak Arif";
  doc.getElementById("inputTenantPhone").value = "081234567890";
  doc.getElementById("inputTenantCashierPin").value = "4321";
  doc.getElementById("inputTenantTables").value = "16";
  selectRadio(doc, "planChoice", "lifetime");

  api.handleCreateTenant({ preventDefault: function () {} });

  const list = api.getAllTenantsSafe();
  assertEqual(list.length, 1, "1 lifetime tenant created");
  const created = list[0];
  assertEqual(created.id, "sate-nusantara", "slug matches");
  assertEqual(created.plan, "lifetime", "plan is lifetime");
  assertEqual(created.price, 2999000, "lifetime price must be 2999000");
  assertEqual(created.originalPrice, 3500000, "lifetime originalPrice must be 3500000");
  assertEqual(created.isLifetime, true, "isLifetime must be true");
  assertEqual(created.expiresAt, null, "expiresAt must be null for lifetime");
  assertEqual(created.status, "active", "status must be active");
  assertEqual(created.tablesCount, 16, "tablesCount must be 16");

  const gridHtml = doc.getElementById("tenantsGrid").innerHTML;
  assert(gridHtml.indexOf("Rp 2.999.000") !== -1, "Card must render Rp 2.999.000");
  assert(gridHtml.indexOf("Rp 3.500.000") !== -1, "Card must render strikethrough Rp 3.500.000");
  assert(gridHtml.indexOf("Lifetime") !== -1, "Card must render Lifetime badge");
  assert(gridHtml.indexOf("openEditTenantModal") !== -1, "Card must include Edit button calling openEditTenantModal");

  // Verify NO duplicate stray "Hapus Klien" markup in renderAllTenants()
  const hapusMatches = gridHtml.match(/Hapus Klien/g) || [];
  assertEqual(hapusMatches.length, 1, "Single rendered card must contain 'Hapus Klien' exactly 1 time, found: " + hapusMatches.length);

  // Check balanced <div> tags inside rendered card
  const openDivs = (gridHtml.match(/<div\b/g) || []).length;
  const closeDivs = (gridHtml.match(/<\/div>/g) || []).length;
  assertEqual(openDivs, closeDivs, "Card HTML must have balanced <div> and </div> tags");

  // Success modal WhatsApp link must NOT format null expiresAt as 1/1/1970
  const waHref = decodeURIComponent(doc.getElementById("btnSendWhatsApp").href || "");
  assertEqual(waHref.indexOf("1/1/1970"), -1, "Lifetime WA link must never display 1/1/1970");
});

test("3. Edit Tenant Modal sets custom date 2026-12-31, switches plan/status/tablesCount, quickAdjustEditExpiry, and updates KPIs accurately", function () {
  resetAll();
  const { doc, api } = mountSuperAdmin();

  assert(typeof api.openEditTenantModal === "function", "openEditTenantModal must exist");
  assert(typeof api.closeEditTenantModal === "function", "closeEditTenantModal must exist");
  assert(typeof api.handleEditTenantSubmit === "function", "handleEditTenantSubmit must exist");
  assert(typeof api.quickAdjustEditExpiry === "function", "quickAdjustEditExpiry must exist");

  // Clear demos & create deterministic set: 1 trial, 1 lifetime, 1 suspended
  api.getAllTenantsSafe().forEach(t => api.deleteTenantSafe(t.id));
  api.registerTenantSafe({ id: "warung-test", name: "Warung Test", plan: "trial", tablesCount: 4, _skipCloud: true });
  api.registerTenantSafe({ id: "sate-life", name: "Sate Lifetime", plan: "lifetime", tablesCount: 10, _skipCloud: true });
  api.registerTenantSafe({ id: "warung-beku", name: "Warung Beku", plan: "monthly", status: "suspended", tablesCount: 8, _skipCloud: true });

  api.renderAllTenants();
  api.updateKpis();

  assertEqual(doc.getElementById("statTotalTenants").textContent, "3", "KPI total before edit");
  assertEqual(doc.getElementById("statActiveTenants").textContent, "1", "KPI active counts lifetime (excludes suspended)");
  assertEqual(doc.getElementById("statTrialTenants").textContent, "1", "KPI trial counts trial");

  // Open Edit Modal for warung-test
  api.openEditTenantModal("warung-test");
  assertEqual(doc.getElementById("editTenantModal").classList.contains("hidden"), false, "#editTenantModal must open");
  assertEqual(doc.getElementById("editTenantId").value, "warung-test", "editTenantId populated");
  assertEqual(doc.getElementById("editTenantName").value, "Warung Test", "editTenantName populated");

  // Test quickAdjustEditExpiry buttons
  api.quickAdjustEditExpiry("lifetime");
  assertEqual(doc.querySelector('input[name="editPlanChoice"]:checked').value, "lifetime", "quickAdjustEditExpiry('lifetime') selects lifetime plan");
  api.quickAdjustEditExpiry("expired");
  assert(Boolean(doc.getElementById("editTenantExpiresAt").value), "quickAdjustEditExpiry('expired') populates past date");
  api.quickAdjustEditExpiry("+14");
  assert(Boolean(doc.getElementById("editTenantExpiresAt").value), "quickAdjustEditExpiry('+14') populates +14d date");
  api.quickAdjustEditExpiry("+30");
  assert(Boolean(doc.getElementById("editTenantExpiresAt").value), "quickAdjustEditExpiry('+30') populates +30d date");

  // Set exact edit values: custom date '2026-12-31', plan 'monthly', status 'active', tablesCount 8
  doc.getElementById("editTenantName").value = "Warung Test Maju";
  doc.getElementById("editTenantTables").value = "8";
  selectRadio(doc, "editPlanChoice", "monthly");
  doc.getElementById("editTenantStatus").value = "active";
  doc.getElementById("editTenantExpiresAt").value = "2026-12-31";

  api.handleEditTenantSubmit({ preventDefault: function () {} });
  assertEqual(doc.getElementById("editTenantModal").classList.contains("hidden"), true, "#editTenantModal closes after submit");

  const updated = api.getTenantInfoSafe("warung-test");
  assertEqual(updated.name, "Warung Test Maju", "Tenant name updated");
  assertEqual(updated.plan, "monthly", "Tenant plan switched to monthly");
  assertEqual(updated.status, "active", "Tenant status set to active");
  assertEqual(updated.isLifetime, false, "Tenant isLifetime set to false");
  assertEqual(updated.tablesCount, 8, "Tenant tablesCount updated to 8");
  assertEqual(updated.price, 199000, "Monthly price 199000 applied");

  const d = new Date(updated.expiresAt);
  assertEqual(d.getFullYear(), 2026, "Expiry local year must be 2026");
  assertEqual(d.getMonth(), 11, "Expiry local month must be December (11)");
  assertEqual(d.getDate(), 31, "Expiry local date must be 31");
  assertEqual(d.getHours(), 23, "Expiry local hours must be 23 (end of day)");
  assertEqual(d.getMinutes(), 59, "Expiry local minutes must be 59");

  // KPIs & card DOM must reflect updated active tenant (2 active: sate-life + warung-test)
  assertEqual(doc.getElementById("statActiveTenants").textContent, "2", "KPI active count becomes 2");
  assertEqual(doc.getElementById("statTrialTenants").textContent, "0", "KPI trial count becomes 0");
  assertEqual(doc.getElementById("statMrr").textContent, "Rp 3.198.000", "KPI MRR updates to Rp 3.198.000");
  const gridHtml = doc.getElementById("tenantsGrid").innerHTML;
  assert(gridHtml.indexOf("Warung Test Maju") !== -1, "Card DOM displays updated name");
  assert(gridHtml.indexOf("8 Meja") !== -1, "Card DOM displays updated 8 Meja");
  assert(gridHtml.indexOf("Suspended") !== -1, "Card DOM displays Suspended badge for warung-beku");
});

test("4. Super Admin unlockPortal() & handleCloudRefreshTenants() sync from Cloud via RestoSync and re-render via TENANTS_UPDATED", async function () {
  resetAll();
  const { doc, api } = mountSuperAdmin();

  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          cloudInitialized: true,
          tenants: [
            {
              id: "cloud-resto-1",
              name: "Cloud Resto Satu",
              pic: "Bu Ani",
              phone: "08123450000",
              plan: "monthly",
              status: "active",
              tablesCount: 10,
              isLifetime: false,
              expiresAt: new Date(Date.now() + 20 * 86400000).toISOString()
            }
          ]
        });
      }
    });
  };

  // Unlock via secondary emergency PIN 9119
  doc.getElementById("masterPinInput").value = "9119";
  api.handlePinLogin({ preventDefault: function () {} });
  if (typeof drainMicrotasks === "function") drainMicrotasks();

  assertEqual(doc.getElementById("pinLockScreen").classList.contains("hidden"), true, "PIN 9119 must unlock portal");
  assertEqual(api.getAllTenantsSafe().length, 1, "Cloud authoritative list replaces local cache on unlock");
  assertEqual(api.getAllTenantsSafe()[0].id, "cloud-resto-1", "Cloud tenant synced");
  assert(doc.getElementById("tenantsGrid").innerHTML.indexOf("Cloud Resto Satu") !== -1, "Cloud tenant rendered on unlock");
  assertEqual(doc.getElementById("statTotalTenants").textContent, "1", "KPI updated after Cloud sync");

  assert(typeof api.handleCloudRefreshTenants === "function", "handleCloudRefreshTenants() must exist");
  await api.handleCloudRefreshTenants();
  assert(doc.getElementById("cloudSyncStatusText") !== null, "Header must include #cloudSyncStatusText badge");
});

test("5. index.html self-serve modal clarifies 4-table trial limit and awaits RestoSync.registerTrialTenantPublic collision slug before redirect", async function () {
  resetAll();
  const { html, doc, win, api } = mountIndexPage();

  // Check selfServeModal copy mentions Maks. 4 Meja Uji Coba (not 12 Barcode Meja)
  const selfServeSectionMatch = html.match(/id="selfServeModal"[\s\S]*?<\/form>/);
  assert(Boolean(selfServeSectionMatch), "#selfServeModal must exist in index.html");
  const modalHtml = selfServeSectionMatch[0];
  assert(modalHtml.indexOf("Maks. 4 Meja Uji Coba") !== -1, "#selfServeModal must clearly state 'Maks. 4 Meja Uji Coba'");
  assertEqual(modalHtml.indexOf("12 Barcode Meja"), -1, "#selfServeModal must NOT claim 12 tables for trial");

  // Seed existing kopi-senja monthly tenant locally
  RestoSync.registerNewTenant({ id: "kopi-senja", name: "Kopi Senja", plan: "monthly", _skipCloud: true });

  // Mock Cloud registerTrialTenant returning collision-resolved slug
  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          tenant: {
            id: "kopi-senja-4821",
            name: "Kopi Senja",
            pic: "Budi",
            phone: "081234567890",
            plan: "trial",
            planName: "Free Trial (14 Hari)",
            price: 0,
            originalPrice: 0,
            billingCycle: "trial",
            tablesCount: 4,
            status: "trial",
            isLifetime: false,
            expiresAt: new Date(Date.now() + 14 * 86400000).toISOString()
          }
        });
      }
    });
  };

  doc.getElementById("selfServeName").value = "Kopi Senja";
  doc.getElementById("selfServePic").value = "Budi";
  doc.getElementById("selfServePhone").value = "081234567890";

  const submitBtn = doc.getElementById("selfServeSubmitBtn");
  assert(Boolean(submitBtn), "#selfServeSubmitBtn must exist");
  assertEqual(submitBtn.disabled, false, "Submit button starts enabled");

  const regPromise = api.handleSelfServeRegister({ preventDefault: function () {} });
  assertEqual(submitBtn.disabled, true, "Submit button must be disabled while awaiting Cloud registration");
  await regPromise;
  assertEqual(submitBtn.disabled, false, "Submit button must be re-enabled after completion");

  assertEqual(win.location.href, "resto_hub.html?tenant=kopi-senja-4821", "Must redirect to Cloud collision-resolved slug");
  assertEqual(RestoSync.getTenantInfo("kopi-senja").plan, "monthly", "Existing kopi-senja tenant must remain untouched");
  assertEqual(RestoSync.getTenantInfo("kopi-senja-4821").plan, "trial", "New trial tenant saved under unique slug");
  assertEqual(RestoSync.getTenantInfo("kopi-senja-4821").tablesCount, 4, "Trial tenant capped at 4 tables");

  // Also test offline fallback collision suffix
  fetch = function () { return Promise.reject(new Error("Offline")); };
  doc.getElementById("selfServeName").value = "Kopi Senja";
  doc.getElementById("selfServePic").value = "Sari";
  doc.getElementById("selfServePhone").value = "081999888777";
  await api.handleSelfServeRegister({ preventDefault: function () {} });
  assert(win.location.href.indexOf("resto_hub.html?tenant=kopi-senja-") === 0, "Offline collision fallback must suffix slug");
  assertEqual(RestoSync.getTenantInfo("kopi-senja").plan, "monthly", "Existing kopi-senja must not be overwritten offline");
});

test("6. renderAllTenants escapes HTML/XSS and quotes in onclick attributes, and status filter handles suspended/expired/lifetime", function () {
  resetAll();
  const { doc, api } = mountSuperAdmin();
  api.getAllTenantsSafe().forEach(t => api.deleteTenantSafe(t.id));

  api.registerTenantSafe({
    id: "warung-xss",
    name: "Warung 'Oke' <img src=x onerror=\"alert(1)\">",
    pic: "Pak 'Budi'",
    phone: "0812345",
    plan: "trial",
    tablesCount: 4,
    _skipCloud: true
  });
  api.registerTenantSafe({
    id: "warung-exp",
    name: "Warung Expired",
    plan: "monthly",
    status: "active",
    expiresAt: "2020-01-01",
    _skipCloud: true
  });

  api.renderAllTenants();
  const gridHtml = doc.getElementById("tenantsGrid").innerHTML;
  assertEqual(gridHtml.indexOf("<img src=x"), -1, "Raw <img tag must never appear unescaped in tenant card");
  assert(gridHtml.indexOf("&lt;img src=x") !== -1, "Tenant name HTML must be escaped");
  assert(gridHtml.indexOf("confirmDeleteTenant(&quot;warung-xss&quot;") !== -1, "onclick args must be safely quoted/escaped");

  // Filter by expired
  doc.getElementById("tenantStatusFilter").value = "expired";
  api.filterTenants();
  assert(doc.getElementById("tenantsGrid").innerHTML.indexOf("Warung Expired") !== -1, "Expired filter matches past-date tenant");
  assertEqual(doc.getElementById("tenantsGrid").innerHTML.indexOf("Warung &#39;Oke&#39;"), -1, "Expired filter excludes active trial");
});

// -----------------------------------------------------------------------------
// 5. Execute All Tests
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

print("===============================================================================");
print("RUNNING TESTS: Task 3 — super_admin_saas.html & index.html");
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
