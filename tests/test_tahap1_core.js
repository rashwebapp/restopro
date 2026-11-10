/**
 * Test Suite Tahap 1 — Core Engine (assets/js/resto-sync.js)
 * Jalankan via:
 *   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap1_core.js
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
    innerHTML: "",
    textContent: "",
    children: [],
    parentNode: null,
    setAttribute(k, v) {
      attrs[k] = String(v);
      if (k === "id") this.id = v;
    },
    getAttribute(k) {
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
    }
  };
  doc.body = createMockElement("body", doc);
  return doc;
}

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
  RESTO_CLOUD_CONFIG: RESTO_CLOUD_CONFIG
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
// Mini Assertion & Async Test Runner
// -----------------------------------------------------------------------------
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
// 8 Test Suites (Spec §6 + Task 1 Brief)
// -----------------------------------------------------------------------------

test("testDeleteAllTenantsNoDummyRegen", function () {
  resetTestEnv();

  // Initial seed runs once on clean storage
  const initial = RestoSync.getAllTenants();
  assert(Array.isArray(initial) && initial.length === 3, "Initial seed should produce 3 demo tenants");
  assertEqual(localStorage.getItem(RestoSync.TENANTS_INIT_FLAG_KEY), "true", "Init flag must be set to true");

  // Delete all tenants permanently
  initial.forEach(function (t) {
    RestoSync.deleteTenant(t.id);
  });

  assertEqual(localStorage.getItem(RestoSync.TENANTS_DIRECTORY_KEY), "[]", "localStorage must hold '[]' after deleting all");
  const afterDelete = RestoSync.getAllTenants();
  assertEqual(afterDelete.length, 0, "getAllTenants() must return [] without regenerating dummies");
  assertEqual(RestoSync.getAllTenants().length, 0, "Repeated getAllTenants() calls stay []");

  // Calling seedDemoTenants() explicitly restores demo tenants
  const seeded = RestoSync.seedDemoTenants();
  assertEqual(seeded.length, 3, "seedDemoTenants() should restore 3 demo tenants");
  assertEqual(RestoSync.getAllTenants().length, 3, "Restored tenants persisted");
});

test("testThreeCommercialPlans", function () {
  resetTestEnv();
  const plans = RestoSync.RESTO_SAAS_PLANS;
  assert(plans && typeof plans === "object", "RESTO_SAAS_PLANS must exist");

  assertEqual(plans.trial.price, 0, "trial price must be 0");
  assertEqual(plans.trial.durationDays, 14, "trial durationDays must be 14");
  assertEqual(plans.trial.maxTables, 4, "trial maxTables must be 4");
  assertEqual(plans.trial.isPaidPlan, false, "trial isPaidPlan must be false");

  assertEqual(plans.monthly.price, 199000, "monthly price must be 199000");
  assertEqual(plans.monthly.durationDays, 30, "monthly durationDays must be 30");
  assertEqual(plans.monthly.maxTables, 999, "monthly maxTables must be 999");
  assertEqual(plans.monthly.isPaidPlan, true, "monthly isPaidPlan must be true");

  assertEqual(plans.lifetime.price, 2999000, "lifetime price must be 2999000");
  assertEqual(plans.lifetime.originalPrice, 3500000, "lifetime originalPrice must be 3500000");
  assertEqual(plans.lifetime.isLifetime, true, "lifetime isLifetime must be true");
  assertEqual(plans.lifetime.durationDays, null, "lifetime durationDays must be null");
  assertEqual(plans.lifetime.maxTables, 999, "lifetime maxTables must be 999");
  assertEqual(plans.lifetime.isPaidPlan, true, "lifetime isPaidPlan must be true");

  const tTrial = RestoSync.registerNewTenant({ name: "Sate Trial", plan: "trial" });
  assertEqual(tTrial.price, 0, "Registered trial price");
  assertEqual(tTrial.isLifetime, false, "Registered trial isLifetime");
  assert(Boolean(tTrial.expiresAt), "Registered trial has expiresAt");

  const tMonthly = RestoSync.registerNewTenant({ name: "Sate Monthly", plan: "monthly" });
  assertEqual(tMonthly.price, 199000, "Registered monthly price");
  assertEqual(tMonthly.status, "active", "Registered monthly status");

  const tLifetime = RestoSync.registerNewTenant({ name: "Sate Lifetime", plan: "lifetime" });
  assertEqual(tLifetime.price, 2999000, "Registered lifetime price");
  assertEqual(tLifetime.originalPrice, 3500000, "Registered lifetime originalPrice");
  assertEqual(tLifetime.isLifetime, true, "Registered lifetime flag");
  assertEqual(tLifetime.expiresAt, null, "Registered lifetime expiresAt must be null");
});

test("testUnpaidFourTableLimitAndPaidLimit", function () {
  resetTestEnv();

  // Trial tenant registered with 12 tables -> capped to 4 usable tables
  const trialTenant = RestoSync.registerNewTenant({
    name: "Trial Dua Belas Meja",
    plan: "trial",
    tablesCount: 12
  });
  setActiveTenantUrl(trialTenant.id);

  let lic = RestoSync.getLicenseData();
  assertEqual(lic.isPaidActive, false, "Trial tenant isPaidActive must be false");
  assertEqual(lic.maxTables, 4, "Trial tenant maxTables must be 4");

  RestoSync.initDefaultTables();
  assertEqual(RestoSync.getTables().length, 4, "initDefaultTables() must generate 4 tables for trial tenant");
  assertEqual(RestoSync.getUsableTables().length, 4, "getUsableTables() must return 4 tables");
  assertEqual(RestoSync.canAddTable(), false, "canAddTable() must be false at 4 tables on trial");
  assertEqual(RestoSync.addTable({ name: "Meja 05" }), null, "addTable() must return null when capped at 4");

  // Even if 12 tables exist in storage, getUsableTables() returns max 4
  const twelveTables = [];
  for (let i = 1; i <= 12; i++) {
    const num = i < 10 ? "0" + i : "" + i;
    twelveTables.push({ id: "T" + num, name: "Meja " + num, seats: 4, section: "Indoor AC", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] });
  }
  RestoSync.saveTables(twelveTables);
  assertEqual(RestoSync.getUsableTables().length, 4, "getUsableTables() must slice to 4 even if 12 in storage");

  // Paid monthly tenant registered with 6 tables -> 6 initial tables, unlimited maxTables
  const paidTenant = RestoSync.registerNewTenant({
    name: "Resto Bulanan Enam Meja",
    plan: "monthly",
    tablesCount: 6
  });
  setActiveTenantUrl(paidTenant.id);

  lic = RestoSync.getLicenseData();
  assertEqual(lic.isPaidActive, true, "Active monthly tenant isPaidActive must be true");
  assertEqual(lic.maxTables, 999, "Active monthly tenant maxTables must be 999");

  RestoSync.initDefaultTables();
  assertEqual(RestoSync.getTables().length, 6, "initDefaultTables() generates 6 tables for paid tenant");
  assertEqual(RestoSync.getUsableTables().length, 6, "getUsableTables() returns all 6 tables for paid tenant");
  assertEqual(RestoSync.canAddTable(), true, "canAddTable() must be true for paid tenant");

  // Upgrade tablesCount to 8 while preserving occupied table on T02
  const curTables = RestoSync.getTables();
  curTables[1].status = "occupied";
  curTables[1].customer = "Tamu Aktif";
  curTables[1].runningTotal = 55000;
  curTables[1].items = [{ name: "Nasi Mandhi", qty: 1, price: 55000 }];
  RestoSync.saveTables(curTables);

  RestoSync.updateTenant(paidTenant.id, { tablesCount: 8, _skipCloud: true });
  RestoSync.syncTablesForTenant();
  const syncedTables = RestoSync.getTables();
  assertEqual(syncedTables.length, 8, "syncTablesForTenant() expands to 8 tables");
  assertEqual(syncedTables[1].status, "occupied", "syncTablesForTenant() preserves occupied table");
  assertEqual(syncedTables[1].customer, "Tamu Aktif", "syncTablesForTenant() preserves occupied customer");

  // When monthly tenant expires, drops to unpaid 4-table limit without clobbering active T02
  const pastDate = new Date(Date.now() - 86400000).toISOString();
  RestoSync.updateTenant(paidTenant.id, { expiresAt: pastDate, _skipCloud: true });
  lic = RestoSync.getLicenseData();
  assertEqual(lic.isExpired, true, "Expired monthly tenant must report isExpired: true");
  assertEqual(lic.isPro, false, "Expired monthly tenant must report isPro: false");
  assertEqual(lic.isPaidActive, false, "Expired monthly tenant must report isPaidActive: false");
  assertEqual(lic.maxTables, 4, "Expired monthly tenant maxTables must drop to 4");
  assert(RestoSync.getUsableTables().length <= 4, "Expired tenant getUsableTables() must be <= 4");

  // Shrink via syncTablesForTenant when T06 is occupied & T01..T04 are available:
  // T01..T04 must remain untouched, T05/T07/T08 trimmed, T06 preserved with isLockedByBilling:true
  const shrinkTestTables = RestoSync.getTables();
  shrinkTestTables[1].status = "available";
  shrinkTestTables[1].customer = "-";
  shrinkTestTables[1].runningTotal = 0;
  shrinkTestTables[1].items = [];
  shrinkTestTables[5].status = "occupied";
  shrinkTestTables[5].customer = "Tamu T06";
  shrinkTestTables[5].runningTotal = 90000;
  shrinkTestTables[5].items = [{ name: "Tom Yum", qty: 1, price: 90000 }];
  RestoSync.saveTables(shrinkTestTables);

  const afterShrink = RestoSync.syncTablesForTenant();
  assertEqual(afterShrink.length, 5, "Shrinking 8->4 with T06 occupied keeps T01..T04 + occupied T06 (5 total)");
  assertEqual(afterShrink[0].id, "T01", "T01 must stay intact");
  assertEqual(afterShrink[3].id, "T04", "T04 must stay intact");
  assertEqual(afterShrink[4].id, "T06", "Occupied T06 must not be clobbered");
  assertEqual(afterShrink[4].isLockedByBilling, true, "Excess T06 beyond 4-table unpaid limit marked isLockedByBilling:true");
  assertEqual(RestoSync.getUsableTables().length, 4, "getUsableTables() still strictly caps to 4 when unpaid");
});

test("testCrossDeviceUnknownTenantNotLifetime", function () {
  resetTestEnv();
  setActiveTenantUrl("warung-baru");

  const info = RestoSync.getTenantInfo();
  assertEqual(info.id, "warung-baru", "Should resolve tenant id warung-baru");
  assertEqual(info.notSynced, true, "Unknown tenant must have notSynced: true");
  assertEqual(info.isLifetime, false, "Unknown tenant must have isLifetime: false");

  const lic = RestoSync.getLicenseData();
  assertEqual(lic.notSynced, true, "License notSynced must be true");
  assertEqual(lic.isLifetime, false, "License isLifetime must be false");
  assertEqual(lic.isPaidActive, false, "Unknown tenant cannot be paid active");
  assertEqual(lic.expiry, "Belum Tersinkronisasi", "Unknown tenant expiry must be 'Belum Tersinkronisasi', never 'Aktif Selamanya'");
});

test("testSha256VectorAndPinVerification", function () {
  resetTestEnv();

  assertEqual(
    RestoSync.sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "SHA-256 standard vector 'abc'"
  );
  assertEqual(
    RestoSync.sha256Hex("Café ☕"),
    "0c3eecb944c2e450fd5306f55518b2c6bc0bd710732cf11c2baf282f95d594d4",
    "SHA-256 UTF-8 multi-byte vector"
  );
  assertEqual(
    RestoSync.hashTenantPin("warung-pin", "5678"),
    RestoSync.sha256Hex("RESTO_PRO_PIN_V1:warung-pin:5678"),
    "hashTenantPin salt convention"
  );

  const t = RestoSync.registerNewTenant({
    id: "warung-pin",
    name: "Warung PIN",
    plan: "monthly",
    cashierPin: "1234",
    ownerPin: "1234"
  });
  RestoSync.updateTenant(t.id, { cashierPin: "5678", ownerPin: "5678", _skipCloud: true });

  // Simulate public client device where plaintext PINs are stripped and only hashes exist
  const list = RestoSync.getAllTenants().map(function (item) {
    if (item.id === "warung-pin") {
      const copy = Object.assign({}, item);
      delete copy.cashierPin;
      delete copy.ownerPin;
      return copy;
    }
    return item;
  });
  RestoSync.saveAllTenants(list);

  assertEqual(RestoSync.verifyPosPin("1234", "warung-pin"), false, "Must reject old '1234' after PIN change");
  assertEqual(RestoSync.verifyPosPin("5678", "warung-pin"), true, "Must accept new '5678' via SHA-256 hash");
  assertEqual(RestoSync.verifyPosPin("9999", "warung-pin"), true, "Must accept master emergency PIN 9999");
  assertEqual(RestoSync.verifyPosPin("9119", "warung-pin"), true, "Must accept secondary emergency PIN 9119");

  assertEqual(RestoSync.verifyOwnerPin("1234", "warung-pin"), false, "Owner PIN must reject old '1234'");
  assertEqual(RestoSync.verifyOwnerPin("5678", "warung-pin"), true, "Owner PIN must accept new '5678'");
});

test("testCloudSyncReconciliationAdminAndClient", async function () {
  resetTestEnv();

  const cfg = RestoSync.getMasterCloudConfig();
  assertEqual(cfg.gasUrl, RESTO_CLOUD_CONFIG.GAS_URL, "Master Cloud URL must come from RESTO_CLOUD_CONFIG");
  assertEqual(cfg.apiKey, RESTO_CLOUD_CONFIG.API_SECRET_KEY, "Master Cloud API Key must come from RESTO_CLOUD_CONFIG");

  // 1. Admin mode: cloudInitialized: true overwrites local cache (evicts deleted tenant)
  RestoSync.registerNewTenant({ id: "tenant-lama", name: "Tenant Lama", plan: "monthly" });
  RestoSync.registerNewTenant({ id: "tenant-aktif", name: "Tenant Aktif", plan: "monthly" });

  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          cloudInitialized: true,
          tenants: [
            {
              id: "tenant-aktif",
              name: "Tenant Aktif Cloud",
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

  const adminRes = await RestoSync.syncTenantsFromCloud({ mode: "admin" });
  assertEqual(adminRes.success, true, "Admin sync should succeed");
  const afterAdmin = RestoSync.getAllTenants();
  assertEqual(afterAdmin.length, 1, "Admin sync with cloudInitialized:true must overwrite local cache");
  assertEqual(afterAdmin[0].id, "tenant-aktif", "Deleted tenant-lama must be evicted");

  // 2. Client mode: rejected fetch preserves existing local cache (notSynced remains false)
  setActiveTenantUrl("tenant-aktif");
  fetch = function () {
    return Promise.reject(new Error("Network offline"));
  };
  const offlineRes = await RestoSync.syncTenantsFromCloud({ mode: "tenant" });
  assertEqual(offlineRes.success, false, "Offline sync reports success:false without rejecting");
  assertEqual(RestoSync.getTenantInfo("tenant-aktif").notSynced, false, "Offline fetch must preserve cached tenant");

  // 3. Client mode: notFound: true + cloudInitialized: false preserves local cache
  setActiveTenantUrl("tenant-aktif");
  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          notFound: true,
          cloudInitialized: false
        });
      }
    });
  };
  const uninitRes = await RestoSync.syncTenantsFromCloud({ mode: "tenant" });
  assertEqual(uninitRes.evicted, false, "Must not evict when cloudInitialized is false");
  assertEqual(RestoSync.getTenantInfo("tenant-aktif").notSynced, false, "Local cache preserved when cloud uninitialized");

  // 4. Client mode: notFound: true + cloudInitialized: true evicts deleted tenant from local client cache
  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          notFound: true,
          cloudInitialized: true
        });
      }
    });
  };
  const evictRes = await RestoSync.syncTenantsFromCloud({ mode: "tenant" });
  assertEqual(evictRes.success, true, "Eviction sync resolves cleanly");
  assertEqual(RestoSync.getTenantInfo("tenant-aktif").notSynced, true, "Deleted tenant must be evicted from client cache");

  // 5. Admin mode: cloudInitialized: false pushes existing local tenants to Cloud
  setActiveTenantUrl("");
  RestoSync.registerNewTenant({ id: "tenant-upgrade", name: "Tenant Upgrade", plan: "monthly", _skipCloud: true });
  let pushedActions = [];
  fetch = function (url, opts) {
    if (opts && opts.method === "POST") {
      pushedActions.push(JSON.parse(opts.body));
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ success: true }); } });
    }
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({ success: true, cloudInitialized: false, tenants: [] });
      }
    });
  };
  const upgradeRes = await RestoSync.syncTenantsFromCloud({ mode: "admin" });
  assertEqual(upgradeRes.success, true, "Admin initial upgrade sync succeeds");
  assert(pushedActions.some(function (p) { return p.action === "saveTenant" && p.data && p.data.id === "tenant-upgrade"; }), "Must push local tenants on initial cloud upgrade");
});

test("testSuspendedAndExpiredLicenseStates", function () {
  resetTestEnv();

  const t = RestoSync.registerNewTenant({
    id: "warung-suspend",
    name: "Warung Suspend",
    plan: "monthly",
    status: "suspended"
  });
  setActiveTenantUrl(t.id);

  const lic = RestoSync.getLicenseData();
  assertEqual(lic.isSuspended, true, "Suspended tenant must report isSuspended: true");
  assertEqual(lic.isPro, false, "Suspended tenant must report isPro: false");
  assertEqual(lic.isPaidActive, false, "Suspended tenant must report isPaidActive: false");
  assertEqual(lic.maxTables, 4, "Suspended tenant maxTables must be 4");

  const mockDoc = createMockDocument();
  const guardRes = RestoSync.enforceTenantAccessGuard(mockDoc);
  assertEqual(guardRes.blocked, true, "enforceTenantAccessGuard must block suspended tenant");
  const overlay = mockDoc.getElementById("tenantSuspendedOverlay");
  assert(Boolean(overlay), "Suspended overlay element must be appended to body");
  assert(overlay.innerHTML.indexOf("Ditangguhkan") !== -1 || overlay.innerHTML.indexOf("Suspended") !== -1, "Overlay must display suspension message");

  // Safe no-op without DOM
  const headlessGuard = RestoSync.enforceTenantAccessGuard();
  assertEqual(headlessGuard.blocked, true, "Headless guard without DOM should still return blocked state safely");

  // Master ("default") is never suspended and keeps 999 tables
  setActiveTenantUrl("");
  const masterLic = RestoSync.getLicenseData();
  assertEqual(masterLic.isMaster, true, "Master must report isMaster: true");
  assertEqual(masterLic.isSuspended, false, "Master must never be suspended");
  assertEqual(masterLic.isPaidActive, true, "Master must be paid active");
  assertEqual(masterLic.maxTables, 999, "Master maxTables must be 999");

  const masterGuard = RestoSync.enforceTenantAccessGuard(mockDoc);
  assertEqual(masterGuard.blocked, false, "Master must not be blocked by access guard");
  assertEqual(mockDoc.getElementById("tenantSuspendedOverlay"), null, "Master guard removes any suspension overlay");
});

test("testUpdateTenantExpiryAndSelfServeCollision", async function () {
  resetTestEnv();

  const t = RestoSync.registerNewTenant({
    id: "warung-upgrade",
    name: "Warung Upgrade",
    plan: "trial",
    tablesCount: 10
  });
  assertEqual(t.plan, "trial", "Starts as trial");

  // Switch trial -> monthly with custom YYYY-MM-DD expiry
  const upd1 = RestoSync.updateTenant(t.id, {
    plan: "monthly",
    status: "active",
    expiresAt: "2026-12-31",
    _skipCloud: true
  });
  assertEqual(upd1.success, true, "updateTenant monthly succeeds");
  assertEqual(upd1.tenant.plan, "monthly", "Plan switched to monthly");
  assertEqual(upd1.tenant.price, 199000, "Monthly price applied");
  assertEqual(upd1.tenant.isLifetime, false, "Monthly isLifetime is false");
  const expLocal = new Date(upd1.tenant.expiresAt);
  assertEqual(expLocal.getFullYear(), 2026, "Expiry local year must be 2026");
  assertEqual(expLocal.getMonth(), 11, "Expiry local month must be December (11)");
  assertEqual(expLocal.getDate(), 31, "Expiry local date must be 31");

  // Switch monthly -> lifetime
  const upd2 = RestoSync.updateTenant(t.id, { plan: "lifetime", _skipCloud: true });
  assertEqual(upd2.tenant.plan, "lifetime", "Plan switched to lifetime");
  assertEqual(upd2.tenant.price, 2999000, "Lifetime price applied");
  assertEqual(upd2.tenant.originalPrice, 3500000, "Lifetime originalPrice applied");
  assertEqual(upd2.tenant.isLifetime, true, "Lifetime flag true");
  assertEqual(upd2.tenant.expiresAt, null, "Lifetime expiresAt must be null");

  // Self-serve collision resolved by Cloud returned unique slug
  RestoSync.registerNewTenant({ id: "kopi-senja", name: "Kopi Senja", plan: "monthly" });
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
            phone: "08123456789",
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

  const regRes = await RestoSync.registerTrialTenantPublic({
    name: "Kopi Senja",
    pic: "Budi",
    phone: "08123456789"
  });
  assertEqual(regRes.success, true, "Self-serve Cloud registration succeeds");
  assertEqual(regRes.slug, "kopi-senja-4821", "Resolves to Cloud unique slug");
  assertEqual(regRes.tenant.id, "kopi-senja-4821", "Returned tenant carries unique slug");
  assertEqual(RestoSync.getTenantInfo("kopi-senja").plan, "monthly", "Existing kopi-senja must NOT be overwritten");
  assertEqual(RestoSync.getTenantInfo("kopi-senja-4821").plan, "trial", "New collision tenant saved under unique slug");

  // Offline self-serve fallback collision also appends unique suffix without overwriting
  fetch = function () {
    return Promise.reject(new Error("Offline"));
  };
  const offlineSelfServe = await RestoSync.registerTrialTenantPublic({
    name: "Kopi Senja",
    pic: "Sari",
    phone: "081999888777"
  });
  assertEqual(offlineSelfServe.success, true, "Offline self-serve succeeds");
  assert(offlineSelfServe.slug !== "kopi-senja" && offlineSelfServe.slug.indexOf("kopi-senja-") === 0, "Offline collision gets unique suffix");
  assertEqual(RestoSync.getTenantInfo("kopi-senja").plan, "monthly", "Offline collision preserves existing kopi-senja");
});

test("testTenantCloudSyncEmitsAfterTableSync", async function () {
  resetTestEnv();

  const t = RestoSync.registerNewTenant({
    id: "warung-sync-table",
    name: "Warung Sync Table",
    plan: "trial",
    tablesCount: 4,
    _skipCloud: true
  });
  setActiveTenantUrl(t.id);
  RestoSync.initDefaultTables();
  assertEqual(RestoSync.getUsableTables().length, 4, "Starts with 4 usable tables on trial");

  let listenerFired = false;
  let observedUsableInListener = -1;
  let observedTablesInListener = -1;
  let observedPaidActiveInListener = false;

  RestoSync.on("TENANTS_UPDATED", function () {
    listenerFired = true;
    observedUsableInListener = RestoSync.getUsableTables().length;
    observedTablesInListener = RestoSync.getTables().length;
    observedPaidActiveInListener = RestoSync.getLicenseData().isPaidActive;
  });

  fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          cloudInitialized: true,
          tenant: {
            id: "warung-sync-table",
            name: "Warung Sync Table",
            plan: "monthly",
            status: "active",
            tablesCount: 8,
            isLifetime: false,
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
          }
        });
      }
    });
  };

  const syncRes = await RestoSync.syncTenantsFromCloud({ mode: "tenant" });
  assertEqual(syncRes.success, true, "Tenant Cloud sync must succeed");
  assertEqual(listenerFired, true, "TENANTS_UPDATED listener must fire");
  assertEqual(observedPaidActiveInListener, true, "Inside TENANTS_UPDATED, license must already be paid active");
  assertEqual(observedTablesInListener, 8, "Inside TENANTS_UPDATED, getTables() must already reflect 8 tables");
  assertEqual(observedUsableInListener, 8, "Inside TENANTS_UPDATED, getUsableTables() must already reflect 8 tables");
});

test("testAccessGuardEscapesHtmlAndUpdatesExistingOverlay", function () {
  resetTestEnv();

  const xssName = 'Warung <img src=x onerror="alert(1)"> & "Quote"';
  const t = RestoSync.registerNewTenant({
    id: "warung-xss",
    name: xssName,
    plan: "monthly",
    status: "suspended",
    _skipCloud: true
  });
  setActiveTenantUrl(t.id);

  const mockDoc = createMockDocument();
  const res1 = RestoSync.enforceTenantAccessGuard(mockDoc);
  assertEqual(res1.blocked, true, "Suspended tenant must be blocked");

  const overlay = mockDoc.getElementById("tenantSuspendedOverlay");
  assert(Boolean(overlay), "Overlay must exist");
  assertEqual(overlay.innerHTML.indexOf("<img"), -1, "Raw <img tag must NEVER appear unescaped in overlay HTML");
  assert(overlay.innerHTML.indexOf("&lt;img src=x") !== -1, "HTML tags must be escaped in overlay HTML");
  assert(overlay.innerHTML.indexOf("&amp;") !== -1, "Ampersand must be escaped in overlay HTML");

  // Re-running guard when #tenantSuspendedOverlay already exists must update displayed name
  RestoSync.updateTenant(t.id, { name: "Nama Baru Aman", status: "suspended", _skipCloud: true });
  RestoSync.enforceTenantAccessGuard(mockDoc);
  assert(overlay.innerHTML.indexOf("Nama Baru Aman") !== -1, "Existing overlay must update displayed tenant name");
  assertEqual(overlay.innerHTML.indexOf("&lt;img"), -1, "Old tenant name must be replaced on existing overlay");

  // Also verify child node textContent update path (browser DOM simulation)
  const browserMockDoc = createMockDocument();
  const existingOverlay = browserMockDoc.createElement("div");
  existingOverlay.id = "tenantSuspendedOverlay";
  const nameNode = browserMockDoc.createElement("strong");
  nameNode.id = "tenantSuspendedName";
  nameNode.textContent = "Old Name";
  const idNode = browserMockDoc.createElement("code");
  idNode.id = "tenantSuspendedId";
  idNode.textContent = "old-id";
  const waNode = browserMockDoc.createElement("a");
  waNode.id = "tenantSuspendedWaLink";
  existingOverlay.appendChild(nameNode);
  existingOverlay.appendChild(idNode);
  existingOverlay.appendChild(waNode);
  browserMockDoc.body.appendChild(existingOverlay);

  RestoSync.updateTenant(t.id, { name: "<img src=x>", status: "suspended", _skipCloud: true });
  RestoSync.enforceTenantAccessGuard(browserMockDoc);
  assertEqual(nameNode.textContent, "<img src=x>", "Browser child #tenantSuspendedName must receive literal textContent safely");
  assertEqual(idNode.textContent, "warung-xss", "Browser child #tenantSuspendedId must be updated");
  assert(String(waNode.getAttribute("href") || waNode.href || "").indexOf("https://wa.me/") === 0, "WhatsApp link href must be updated");
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
