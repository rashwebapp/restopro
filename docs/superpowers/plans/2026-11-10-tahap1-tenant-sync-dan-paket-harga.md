# Tahap 1: Sinkronisasi Tenant Real-Time, Batas 4 Meja Belum Bayar & Paket Harga Baru Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyinkronkan seluruh pengaturan tenant SaaS (nama, paket, masa berlaku, PIN hash, status `suspended`/`expired`/`active`/`trial`, dan aturan **maksimal 4 meja untuk tenant belum membayar**) antara Super Admin, Cloud Google Sheets (`backend/Kode.gs`), dan seluruh layar klien secara konsisten.

**Architecture:** `assets/js/resto-sync.js` menjadi single source of truth untuk paket (`RESTO_SAAS_PLANS`), hash PIN SHA-256 deterministik, batas meja belum bayar (`4` meja), penegak akses (`enforceTenantAccessGuard`), dan sinkronisasi Cloud `Tenants` lewat `RESTO_CLOUD_CONFIG.GAS_URL`. `backend/Kode.gs` menyediakan sheet `Tenants` auto-created beserta endpoint publik aman (`getTenantPublicInfo`, `registerTrialTenant`) dan endpoint admin terproteksi `apiKey` (`getTenants`, `saveTenant`, `deleteTenant`), sementara seluruh file HTML memanggil sync startup & event `"TENANTS_UPDATED"`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Tailwind CSS CDN, Google Apps Script (`backend/Kode.gs`), JavaScriptCore (`jsc`) headless test harness.

**Spec:** `docs/superpowers/specs/2026-11-10-tahap1-tenant-sync-dan-paket-harga-design.md`

---

## Global Constraints

- Pure Vanilla HTML/CSS/JavaScript + Tailwind CSS CDN + Google Apps Script (`backend/Kode.gs`), tanpa build step / NPM dependencies baru.
- Seluruh teks UI berbahasa Indonesia yang jelas dan profesional.
- Pertahankan multi-tenant namespace isolation (`getStorageKey`) dan Master Core mode (`tenantId === "default"`).
- Tenant yang **belum membayar** (`plan === "trial"`, `status !== "active"`, atau langganan `isExpired`) dibatasi **maksimal 4 meja aktif** (`Meja 01`–`Meja 04`); tenant **sudah membayar aktif** (`monthly`/`lifetime` & `active` & `!isExpired`) serta Master (`default`) mendapat Unlimited (`maxTables = 999`) dengan jumlah meja awal mengikuti `tablesCount`.
- Endpoint publik `getTenantPublicInfo` dan `resto_hub.html` **tidak pernah** mengekspos plaintext PIN staf maupun custom `apiKey`; hanya menggunakan hash SHA-256 dengan salt `"RESTO_PRO_PIN_V1:" + tenantId + ":" + pin`.
- Status `suspended` memblokir penuh seluruh layar klien; status `expired` di Tahap 1 menampilkan peringatan & melabeli `isPro: false, isExpired: true` serta menurunkan batas meja ke `4`.
- Versi cache script (`?v=2.7.0`) dan `service-worker.js` (`resto-pro-v2.7.0`) diperbarui pada Task terakhir.

## Review Focus

1. **Offline / Jaringan Cloud Gagal:** Saat perangkat klien gagal fetch `syncTenantsFromCloud()`, cache lokal tetap dipertahankan tanpa menghapus sesi kasir yang sudah ada dan tanpa melempar uncaught Promise rejection.
2. **Input Tanggal Zona Waktu Lokal (`<input type="date">`):** Mengatur tanggal kedaluwarsa di Super Admin harus dikonversi ke akhir hari waktu lokal (`23:59:59`) sebelum `.toISOString()` agar hari tersebut tidak langsung terbaca expired oleh selisih jam UTC.
3. **Kollisi Data Meja saat Sync:** `syncTablesForTenant()` tidak boleh menimpa/memotong meja yang sedang memiliki pesanan aktif (`status === "occupied" || status === "bill_requested"`) secara paksa di kasir, namun untuk meja ke-5+ pada tenant belum bayar wajib ditandai terkunci (`isLockedByBilling: true`) / disembunyikan dari pemakaian meja baru.
4. **Regenerasi Dummy saat Kosong di Fallback Lokal (`super_admin_saas.html` & `resto-sync.js`):** Baik `RestoSync.getAllTenants()` maupun fallback `getAllTenantsSafe()` wajib mengecek `TENANTS_INIT_FLAG_KEY` agar penghapusan seluruh klien tetap menghasilkan array kosong `[]`.
5. **Kecocokan Hash SHA-256 Antara `RestoSync` dan `Kode.gs`:** Implementasi SHA-256 pure-JS di `RestoSync` dan `Utilities.computeDigest` di `Kode.gs` wajib menghasilkan hex lowercase 64-karakter yang identik persis (diverifikasi dengan test vektor standar `"abc"` ➔ `"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`).

---

### Task 1: Core Engine Paket Baru, Penghapusan Tenant Permanen, Hash PIN, Batas 4 Meja & Cloud Sync di `assets/js/resto-sync.js`

**Files:**
- Modify: `assets/js/resto-sync.js:1-420`, `assets/js/resto-sync.js:2104-2405`, `assets/js/resto-sync.js:2725-2957`
- Create: `tests/test_tahap1_core.js`

**Interfaces:**
- Produces in `RestoSync`:
  - `RESTO_SAAS_PLANS` (`trial`, `monthly`, `lifetime`)
  - `TENANTS_INIT_FLAG_KEY` (`"resto_pro_tenants_initialized_v1"`)
  - `sha256Hex(str)` & `hashTenantPin(tenantId, pin)`
  - `getAllTenants()`, `seedDemoTenants()`, `registerNewTenant(data)`, `updateTenant(tenantId, updates)`, `deleteTenant(tenantId)`
  - `getTenantInfo(targetTenantId)` (includes `notSynced: true` when absent for non-default)
  - `getLicenseData()` (includes `isMaster`, `isPro`, `isPaidActive`, `isLifetime`, `isExpired`, `isSuspended`, `notSynced`, `maxTables`, `tier`, `tierLabel`, `expiry`)
  - `initDefaultTables()`, `getUsableTables()`, `syncTablesForTenant()`, `canAddTable()`
  - `verifyPosPin(pin, tenantId)`, `verifyOwnerPin(pin, tenantId)`
  - `getMasterCloudConfig()`, `syncTenantsFromCloud(options)`, `registerTrialTenantPublic(data)`
  - `enforceTenantAccessGuard(docRef)`

- [ ] **Step 1: Write the failing test suite `tests/test_tahap1_core.js`**

Write `tests/test_tahap1_core.js` testing all 8 behaviors from Spec §6 + Review Focus:
- Test 1 (`testDeleteAllTenantsNoDummyRegen`): delete all tenants -> `localStorage` holds `"[]"`, `getAllTenants()` returns `[]`, `seedDemoTenants()` restores demos when invoked explicitly.
- Test 2 (`testThreeCommercialPlans`): verify `trial` (`price: 0`, `14` days, `maxTables: 4`), `monthly` (`price: 199000`, `30` days, `maxTables: 999`), `lifetime` (`price: 2999000`, `originalPrice: 3500000`, `isLifetime: true`, `expiresAt: null`, `maxTables: 999`).
- Test 3 (`testUnpaidFourTableLimitAndPaidLimit`): trial tenant registered with `tablesCount: 12` gets `maxTables === 4`, `initDefaultTables()` generates `4` tables, `getUsableTables()` returns at most `4` tables even if 12 tables exist in storage, `canAddTable() === false` at 4 tables; paid `monthly` tenant registered with `tablesCount: 6` gets `6` initial tables, `maxTables === 999`, `canAddTable() === true`; expired `monthly` tenant drops `isPaidActive === false`, `maxTables === 4`, and `getUsableTables().length <= 4`.
- Test 4 (`testCrossDeviceUnknownTenantNotLifetime`): opening unknown `?tenant=warung-baru` on clean storage gives `getTenantInfo().notSynced === true`, `isLifetime === false`, `getLicenseData().expiry === "Belum Tersinkronisasi"` (never `"Aktif Selamanya"`).
- Test 5 (`testSha256VectorAndPinVerification`): `RestoSync.sha256Hex("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`; changing tenant PIN from `"1234"` to `"5678"` (even with `cashierPin` stripped & only `cashierPinHash` present as on public client device) rejects `"1234"`, accepts `"5678"`, and accepts `"9999"`/`"9119"`.
- Test 6 (`testCloudSyncReconciliationAdminAndClient`):
  - Admin sync (`mode: "admin"`) with `cloudInitialized: true` overwrites local cache with Cloud list (evicts tenant deleted on another Admin browser).
  - Client sync (`mode: "tenant"`) with `notFound: true` + `cloudInitialized: true` evicts deleted tenant from local client cache; rejected fetch preserves existing local cache (`notSynced` false).
- Test 7 (`testSuspendedAndExpiredLicenseStates`): `status: "suspended"` triggers `enforceTenantAccessGuard()` overlay on non-Master; Master `"default"` never suspended & `maxTables === 999`.
- Test 8 (`testUpdateTenantExpiryAndSelfServeCollision`): `updateTenant` sets custom expiry / switches between `trial` -> `monthly` -> `lifetime`; `registerTrialTenantPublic` on duplicate slug resolves to cloud-returned unique slug `kopi-senja-XXXX` when cloud responds `{ success: true, tenant: ... }`.

- [ ] **Step 2: Run test to verify RED failure**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap1_core.js`
Expected: FAIL (missing `RESTO_SAAS_PLANS`, `sha256Hex`, `getUsableTables`, etc., and deletion regenerating dummy tenants).

- [ ] **Step 3: Implement core changes in `assets/js/resto-sync.js`**

Implement each method in `assets/js/resto-sync.js`:
1. `RESTO_SAAS_PLANS` + `TENANTS_INIT_FLAG_KEY`.
2. Pure-JS `sha256Hex(str)` and `hashTenantPin(tenantId, pin)`.
3. Fixed `getAllTenants()`, `saveAllTenants()`, `seedDemoTenants()`, `registerNewTenant(data)`, `updateTenant(tenantId, updates)`, `deleteTenant(tenantId)` (note: update default 3 demo tenants in `seedDemoTenants()` to align with new package names `monthly`/`trial`/`lifetime` as clean demo examples, e.g. `harapan-corner` `monthly`, `kopi-senja` `trial`, `warung-bu-siti` `lifetime`).
4. Updated `getTenantInfo(targetTenantId)` returning `{ ..., notSynced: true, plan: "unknown", expiresAt: null, isLifetime: false }` when missing.
5. Updated `verifyPosPin(pin, tenantId)` and `verifyOwnerPin(pin, tenantId)` without `|| clean === "1234"` bypass when custom PIN/hash exists.
6. Updated `getLicenseData()`, `initDefaultTables()`, `getUsableTables()`, `syncTablesForTenant()`, `canAddTable()`.
7. Updated `getMasterCloudConfig()`, `pushTenantToCloud()`, `deleteTenantFromCloud()`, `syncTenantsFromCloud(options)`, `registerTrialTenantPublic(data)`, and `enforceTenantAccessGuard(doc)`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap1_core.js`
Expected: ALL tests pass (`0` failures), output pristine.

- [ ] **Step 5: Commit Task 1**

```bash
git add assets/js/resto-sync.js tests/test_tahap1_core.js
git commit -m "feat(tahap1): core SaaS plans, tenant persistence, SHA-256 PIN, 4-table limit & cloud sync"
```

---

### Task 2: Google Apps Script Backend `Tenants` Sheet & Endpoints (`backend/Kode.gs`)

**Files:**
- Modify: `backend/Kode.gs:15-246`, `backend/Kode.gs:670-914`
- Create: `tests/test_kode_gs_tenants.js`

**Interfaces:**
- Consumes: PIN hash salt convention `"RESTO_PRO_PIN_V1:" + id + ":" + pin` (must equal `RestoSync.sha256Hex`)
- Produces HTTP Actions in `backend/Kode.gs`:
  - `doGet?action=getTenantPublicInfo&tenantId=<slug>` (public, strips plaintext PINs, phones, custom `apiKey`)
  - `doGet?action=getTenants&apiKey=<key>` (admin-only)
  - `doPost` `action: "saveTenant"` (admin-only upsert to sheet `Tenants`)
  - `doPost` `action: "deleteTenant"` (admin-only row delete by `id`)
  - `doPost` `action: "registerTrialTenant"` (public self-serve, forces `trial` / `tablesCount: 4` / auto-suffixes duplicate slug)

- [ ] **Step 1: Write the failing test `tests/test_kode_gs_tenants.js`**

Mock GAS globals (`SpreadsheetApp`, `PropertiesService`, `ContentService`, `CacheService`, `Utilities` SHA-256 using `RestoSync.sha256Hex` byte digest equivalent, `Logger`) and test:
1. `doGet({ parameter: { action: 'getTenantPublicInfo', tenantId: 'unknown' } })` -> `{ success: true, notFound: true, cloudInitialized: false }`.
2. `doPost` `saveTenant` without `apiKey` -> returns `{ success: false, unauthorized: true }`; WITH valid `apiKey` -> inserts row in `Tenants` sheet, sets `TENANTS_CLOUD_INITIALIZED='true'`, computes `cashierPinHash` & `ownerPinHash`.
3. `doGet` `getTenantPublicInfo` for saved tenant returns `cashierPinHash`, `ownerPinHash`, `plan`, `expiresAt`, `tablesCount`, `status`, `isLifetime` AND explicitly verifies `cashierPin === undefined`, `ownerPin === undefined`, `apiKey === undefined`, `phone === undefined`.
4. `doGet` `getTenants` without `apiKey` -> `unauthorized: true`; with `apiKey` -> returns all rows.
5. `doPost` `registerTrialTenant` with `"Kopi Senja"` when `kopi-senja` already exists (paid `active` or `trial`) -> creates unique slug `kopi-senja-XXXX` without modifying existing `kopi-senja` row, enforces `plan === "trial"`, `status === "trial"`, `price === 0`, `isLifetime === false`, `tablesCount === 4`.
6. `doPost` `deleteTenant` removes row so subsequent `getTenantPublicInfo` returns `{ success: true, notFound: true, cloudInitialized: true }` and `getTenants` returns `[]` without auto-reseeding dummy rows.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_tenants.js`
Expected: FAIL (`Action doGet tidak dikenali: getTenantPublicInfo`).

- [ ] **Step 3: Implement `Tenants` sheet helpers and endpoints in `backend/Kode.gs`**

Add `TENANTS: 'Tenants'` to `CONFIG.SHEET_NAMES`, add `sha256Hex_`, `getOrCreateTenantsSheet_`, `handleGetTenantPublicInfo`, `handleGetAllTenants`, `handleSaveTenant`, `handleDeleteTenant`, `handleRegisterTrialTenant`, wire into `doGet`/`doPost` including `isPublicAction` (`ping`, `getMenuCatalog`, `getTenantPublicInfo`) and `isPublicPost` (`placeOrder`, `registerTrialTenant`), and create optional initial `Tenants` header in `setupAppEnvironment()` too.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_tenants.js`
Expected: PASS, 0 failures.

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/Kode.gs tests/test_kode_gs_tenants.js
git commit -m "feat(tahap1): add Cloud Tenants directory & PIN hash endpoints to backend/Kode.gs"
```

---

### Task 3: Super Admin Console (`super_admin_saas.html`) & Trial Self-Serve (`index.html`)

**Files:**
- Modify: `super_admin_saas.html:105-490`, `super_admin_saas.html:757-1363`
- Modify: `index.html:550-615`, `index.html:785-845`
- Create: `tests/test_super_admin_and_self_serve.js`

**Interfaces:**
- Consumes from `RestoSync`: `RESTO_SAAS_PLANS`, `TENANTS_INIT_FLAG_KEY`, `getAllTenants()`, `seedDemoTenants()`, `registerNewTenant()`, `updateTenant()`, `deleteTenant()`, `renewTenantSubscription()`, `syncTenantsFromCloud({ mode: 'admin' })`, `registerTrialTenantPublic()`
- Produces in `super_admin_saas.html`:
  - Package selector cards (`trial`, `monthly`, `lifetime`) in `#newTenantModal` and `#editTenantModal`
  - `openEditTenantModal(tenantId)`, `closeEditTenantModal()`, `handleEditTenantSubmit(e)`, `quickAdjustEditExpiry(mode)` (`+14`, `+30`, `lifetime`, `expired`)
  - `handleLoadDemoTenants()` in `#emptyState`, `handleCloudRefreshTenants()`

- [ ] **Step 1: Write failing tests in `tests/test_super_admin_and_self_serve.js`**

Extract inline scripts from `super_admin_saas.html` and `index.html` into headless DOM harness (with `RestoSync` loaded):
1. Deleting all tenants in `super_admin_saas.html` keeps `getAllTenantsSafe()` returning `[]` and shows `#emptyState` without regenerating dummy tenants; clicking demo load (`handleLoadDemoTenants`) seeds demos.
2. Submitting `#newTenantForm` with `planChoice = 'lifetime'` creates tenant with `price: 2999000`, `originalPrice: 3500000`, `isLifetime: true`, `expiresAt: null`; `renderAllTenants()` renders `"Rp 2.999.000"` + strikethrough `"Rp 3.500.000"` and `"Lifetime"` badge, with NO duplicate stray `"Hapus Klien"` markup!
3. Opening `openEditTenantModal(id)`, setting `<input type="date">` to `'2026-12-31'`, switching plan to `'monthly'`, status to `'active'`, `tablesCount` to `8`, submitting updates tenant with `expiresAt` matching local `2026-12-31 23:59:59`, updates KPI count and card DOM!
4. Submitting `index.html` `handleSelfServeRegister(e)` calls `RestoSync.registerTrialTenantPublic(...)`, resolves collision suffix from Cloud if returned, and redirects to `resto_hub.html?tenant=<finalSlug>`.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_and_self_serve.js`
Expected: FAIL (`openEditTenantModal` missing, `getAllTenantsSafe` regenerates dummies, duplicate HTML in `renderAllTenants`).

- [ ] **Step 3: Implement updates in `super_admin_saas.html` and `index.html`**

- Update `super_admin_saas.html`:
  - Header bar: add Cloud Sync button (`handleCloudRefreshTenants()`) + sync badge.
  - `#emptyState`: add button `"Muat Contoh Data Demo"` calling `handleLoadDemoTenants()`.
  - `#newTenantModal`: replace 3 package radio cards with **Trial 14 Hari (`Rp 0` • Maks. 4 Meja)**, **Paket Bulanan (`Rp 199.000/bln` • Unlimited)**, **Paket Lifetime (`~~Rp 3.500.000~~ Rp 2.999.000` • Selamanya)**; auto-cap visual hint `4` when `trial` selected.
  - Add `#editTenantModal` for editing existing tenants + date picker (`<input type="date">` with local `23:59:59` conversion) + status selector (`trial`, `active`, `suspended`) + quick expiry buttons (`+14 Hari`, `+30 Hari`, `Set Lifetime`, `Set Expired`).
  - Fix `getAllTenantsSafe()`, `deleteTenantSafe()`, `updateTenantSafe()`, `updateKpis()` (count lifetime as active & paid!), fix duplicate `"Hapus Klien"` lines in `renderAllTenants()`, and add `✏️ Edit` button on each tenant card.
  - Call `RestoSync.syncTenantsFromCloud({ mode: 'admin' })` inside `unlockPortal()` and re-render on `"TENANTS_UPDATED"`.
- Update `index.html`:
  - Clarify *"Maks. 4 Meja Uji Coba"* inside `#selfServeModal`.
  - Update `handleSelfServeRegister(e)` to call `await RestoSync.registerTrialTenantPublic(...)` cleanly before redirect.

- [ ] **Step 4: Run test to verify GREEN & verify HTML/JS syntax**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_and_self_serve.js` + HTML balance check.
Expected: PASS, `0` unclosed HTML tags, `0` syntax errors.

- [ ] **Step 5: Commit Task 3**

```bash
git add super_admin_saas.html index.html tests/test_super_admin_and_self_serve.js
git commit -m "feat(tahap1): add 3 pricing plans, Edit Tenant modal, Cloud sync & safe self-serve"
```

---

### Task 4: Realita Hub (`resto_hub.html`) & Panel Owner Dinamis (`owner_settings_saas.html`)

**Files:**
- Modify: `resto_hub.html:145-190`, `resto_hub.html:428-560`
- Modify: `owner_settings_saas.html:130-198`, `owner_settings_saas.html:1635-1695`, `owner_settings_saas.html:2405-2470`, `owner_settings_saas.html:2685-2745`
- Create: `tests/test_hub_and_owner_reality.js`

**Interfaces:**
- Consumes from `RestoSync`: `getTenantInfo()`, `getLicenseData()`, `getUsableTables()`, `canAddTable()`, `syncTenantsFromCloud({ mode: 'tenant' })`, `enforceTenantAccessGuard()`
- Produces UI contracts:
  - `resto_hub.html`: `#displayCashierPin` / `#displayOwnerPin` masked `"••••"` (no plaintext PIN), real expiry / notSynced / suspended UI, table cap note (`Maks. 4 Meja (Belum Bayar)` when `!lic.isPaidActive`).
  - `owner_settings_saas.html`: `#licenseClientIdLabel`, `#licenseRestoNameLabel`, `#licenseExpiryLabel`, `#licenseTableLimitLabel`, Cloud Package Status Card replacing manual `#licenseKeyInput` for non-Master tenants, `#btnToggleSimLicense` hidden for non-Master tenants, `renderOwnerTables()` enforcing/badge-marking locked tables (`idx >= lic.maxTables`) for unpaid tenants.

- [ ] **Step 1: Write failing test `tests/test_hub_and_owner_reality.js`**

Test both `resto_hub.html` and `owner_settings_saas.html` scripts with `RestoSync`:
1. `resto_hub.html` for Trial tenant (`expiresAt` +14 days): displays `"Trial 14 Hari Gratis"`, `"s/d ..."`, `"Sisa 14 Hari Masa Aktif"`, table info mentions `"Maks. 4 Meja"`, `#displayCashierPin.textContent === "••••"` (NOT `"1234"`!).
2. `resto_hub.html` for unknown/unsynced tenant (`notSynced: true`): does NOT display `"Aktif Selamanya"` (shows `"Belum Tersinkronisasi"`).
3. `resto_hub.html` for `lifetime` tenant: displays `"Aktif Selamanya (Lifetime)"`.
4. `owner_settings_saas.html` `updateLicenseBannerUI()` for tenant `"warung-maju"` (trial): `#licenseRestoNameLabel` equals `"Warung Maju"`, `#licenseClientIdLabel` equals `warung-maju`, `#licenseExpiryLabel` never says `"31 Desember 2028"`, `#licenseTableLimitLabel` shows `"Maksimal 4 Meja (Belum Bayar)"`, manual token input wrapper hidden for non-Master, simulation toggle hidden for non-Master.
5. `owner_settings_saas.html` `openAddTableModal()` at 4 tables on unpaid tenant triggers locked modal instead of opening table creation modal.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_hub_and_owner_reality.js`
Expected: FAIL (plaintext PIN `"1234"` displayed, hardcoded `"Grand Fusion Bistro Jakarta"` & `"31 Desember 2028"` untouched, unknown tenant displays `"Aktif Selamanya"`).

- [ ] **Step 3: Implement updates in `resto_hub.html` and `owner_settings_saas.html`**

- Update `resto_hub.html`:
  - Hide plaintext PINs (`••••`) and change label helper to secure reminder.
  - Display real status for Master, Lifetime, Trial/Monthly active, Expired (red warning banner), Suspended (via `enforceTenantAccessGuard()`), and `notSynced`.
  - Display `Maks. 4 Meja Aktif (Belum Bayar)` when `!lic.isPaidActive` and `lic.isMaster === false`.
  - Trigger `RestoSync.syncTenantsFromCloud({ mode: 'tenant' })` & re-render on `"TENANTS_UPDATED"`.
- Update `owner_settings_saas.html`:
  - Replace hardcoded `RASH-PRO-88219`, `Grand Fusion Bistro Jakarta`, `31 Desember 2028` with dynamic IDs (`#licenseClientIdLabel`, `#licenseRestoNameLabel`, `#licenseExpiryLabel`).
  - Wrap `#licenseKeyInput` token form inside `#masterManualTokenBox` (hidden for non-Master) and show `#tenantCloudPlanBox` (real-time plan, status, CTA WhatsApp Admin RASH to extend/upgrade) for non-Master tenants; hide `#btnToggleSimLicense` for non-Master tenants.
  - Update `updateLicenseBannerUI()` to reflect `isMaster`, `isLifetime`, `isPaidActive`, `isExpired`, `isSuspended`, `notSynced`, and `maxTables === 4` clearly.
  - Update `renderOwnerTables()` to mark any existing tables beyond index `>= lic.maxTables` (`4`) as locked (`Terkunci - Belum Bayar`) when `!lic.isPaidActive`, and ensure `RestoSync.syncTenantsFromCloud({ mode: 'tenant' })` + `enforceTenantAccessGuard()` run on load and `"TENANTS_UPDATED"`.

- [ ] **Step 4: Run test to verify GREEN & verify HTML/JS syntax**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_hub_and_owner_reality.js` + HTML balance check.
Expected: PASS, 0 failures.

- [ ] **Step 5: Commit Task 4**

```bash
git add resto_hub.html owner_settings_saas.html tests/test_hub_and_owner_reality.js
git commit -m "feat(tahap1): dynamic Cloud license UI, masked Hub PINs & 4-table unpaid gating"
```

---

### Task 5: Enforce Cloud Sync & 4-Table Limit Across Operational Screens + Bump Cache Version (`v2.7.0`)

**Files:**
- Modify: `cashier_pos_register.html`
- Modify: `customer_qr_self_order.html`
- Modify: `table_qr_print_sheet.html`
- Modify: `kitchen_display_kds.html`
- Modify: `service-worker.js`
- Modify: script query `?v=2.7.0` on all 9 HTML files (`index.html`, `resto_hub.html`, `super_admin_saas.html`, `owner_settings_saas.html`, `cashier_pos_register.html`, `customer_qr_self_order.html`, `kitchen_display_kds.html`, `table_qr_print_sheet.html`)
- Create: `tests/test_operational_screens_sync.js`

**Interfaces:**
- Consumes from `RestoSync`: `syncTablesForTenant()`, `getUsableTables()`, `syncTenantsFromCloud({ mode: 'tenant' })`, `enforceTenantAccessGuard()`

- [ ] **Step 1: Write failing test `tests/test_operational_screens_sync.js`**

Verify via headless harness + file assertions:
1. All operational screens (`cashier_pos_register.html`, `customer_qr_self_order.html`, `table_qr_print_sheet.html`, `kitchen_display_kds.html`) call `enforceTenantAccessGuard()`, call `syncTenantsFromCloud({ mode: 'tenant' })`, listen for `"TENANTS_UPDATED"`, and use `getUsableTables()` (on table-facing screens) instead of unrestricted `RESTO_TABLES` when `!isPaidActive`.
2. Verify script cache versions across all HTML files and `service-worker.js` match `v2.7.0`.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_operational_screens_sync.js`
Expected: FAIL (`customer_qr_self_order.html`, `table_qr_print_sheet.html`, `cashier_pos_register.html` do not use `getUsableTables()` or `enforceTenantAccessGuard()`, script versions are still `2.6.0`).

- [ ] **Step 3: Implement updates in operational HTML screens & bump cache to `v2.7.0`**

1. `cashier_pos_register.html`: on startup & `"TENANTS_UPDATED"`, run `enforceTenantAccessGuard()`, `syncTablesForTenant()`, load `RESTO_TABLES` from `RestoSync.getUsableTables()`, re-render table grid & select valid active table (if `T03` or if >4 tables reduced to 4, keep valid ID in `RESTO_TABLES`). Display subtle chip/notice inside `#tablePickerModal` header when unpaid/trial (`Limit Belum Bayar: Maks. 4 Meja`).
2. `customer_qr_self_order.html`: load `RESTO_TABLES` from `RestoSync.getUsableTables()`, run `enforceTenantAccessGuard()` + `syncTenantsFromCloud({ mode: 'tenant' })`, update restaurant branding/table list on `"TENANTS_UPDATED"` (and fallback active table safely to first usable table e.g. `T01` if `?table=T05` is unavailable on a 4-table unpaid tenant!).
3. `table_qr_print_sheet.html`: use `RestoSync.getUsableTables()`, run `enforceTenantAccessGuard()` + `syncTenantsFromCloud({ mode: 'tenant' })`, re-render QR cards on `"TENANTS_UPDATED"` (and update `#cardsGrid` subtitle if limited to 4 tables).
4. `kitchen_display_kds.html`: run `enforceTenantAccessGuard()` + `syncTenantsFromCloud({ mode: 'tenant' })`, update KDS brand title/sub on `"TENANTS_UPDATED"`.
5. Update all `<script src="assets/js/resto-*.js?v=2.7.0">` and `service-worker.js` (`CACHE_NAME = 'resto-pro-v2.7.0'`).

- [ ] **Step 4: Run ALL tests + repository-wide JS/HTML checks to verify GREEN**

Run all 5 test suites via `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc` and verify 0 HTML/JS syntax errors across the entire worktree!

- [ ] **Step 5: Commit Task 5**

```bash
git add cashier_pos_register.html customer_qr_self_order.html table_qr_print_sheet.html kitchen_display_kds.html index.html resto_hub.html owner_settings_saas.html super_admin_saas.html service-worker.js tests/test_operational_screens_sync.js
git commit -m "feat(tahap1): enforce 4-table limit & cloud tenant sync on all operational screens (v2.7.0)"
```

---

## Self-Review Check

- **Spec coverage:** Every item in `docs/superpowers/specs/2026-11-10-tahap1-tenant-sync-dan-paket-harga-design.md` maps directly: G1 -> Task 1 & 3; G2 (`Kode.gs` + `RestoSync`) -> Task 1 & 2; G3 (Keamanan PIN 1A) -> Task 1, 2 & 4; G4 (`suspended` vs `expired` 2A) -> Task 1, 4 & 5; G5 (`tablesCount` & `maxTables=4` unpaid) -> Task 1, 3, 4 & 5; G6 (3 paket + Modal Edit) -> Task 1 & 3.
- **Type & signature consistency:** Names match across all tasks (`RESTO_SAAS_PLANS`, `TENANTS_INIT_FLAG_KEY`, `sha256Hex`, `seedDemoTenants`, `updateTenant`, `getUsableTables`, `syncTablesForTenant`, `syncTenantsFromCloud`, `registerTrialTenantPublic`, `enforceTenantAccessGuard`, `getTenantPublicInfo`, `saveTenant`, `deleteTenant`, `registerTrialTenant`).
- **Scope discipline:** Cleanly excludes Tahap 2 (full premium locks + upload payment proof) and Tahap 3 (EMVCo QRIS + Qpon/Ojol).
