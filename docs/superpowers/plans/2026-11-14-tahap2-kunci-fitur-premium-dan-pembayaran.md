# Tahap 2: Penguncian Fitur Premium Non-Master & Sistem Pembayaran Bukti Transfer Praktis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengunci seluruh modul fitur premium non-Master untuk tenant yang belum membayar aktif (`trial`, `pending`, `expired`), mempertahankan operasional kasir meja 1–4, serta membangun alur pembayaran & upload bukti transfer ke Google Drive/Sheets dengan panel verifikasi 1-klik di Super Admin SaaS.

**Architecture:** `assets/js/resto-sync.js` menyediakan engine gating `PRO_FEATURES` dan client API pembayaran (`submitPaymentProof`, `getTenantPaymentStatus`, `verifyPaymentAdmin`). `backend/Kode.gs` mengelola sheet `Payments`, menyimpan file foto struk ke Google Drive (`ROOT_FOLDER_ID`), dan meng-upgrade status tenant di sheet `Tenants` saat disetujui tanpa merusak status tenant saat upload/reject. `owner_settings_saas.html` dan `resto_hub.html` menyediakan modal checkout upload bukti dan overlay gembok pro (dengan buku kas `#sectionLedger` tetap terbaca), `cashier_pos_register.html` memproteksi pendaftaran member/reservasi pro, dan `super_admin_saas.html` menyediakan tab persetujuan pembayaran 1-klik.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Tailwind CSS CDN, Google Apps Script (`backend/Kode.gs`), Google Drive, Google Sheets, JavaScriptCore (`jsc`) headless test harness.

**Spec:** `docs/superpowers/specs/2026-11-14-tahap2-kunci-fitur-premium-dan-pembayaran-design.md`

---

## Global Constraints

- Pure Vanilla HTML/CSS/JavaScript + Tailwind CSS CDN + Google Apps Script (`backend/Kode.gs`), tanpa build step / NPM dependencies baru.
- Seluruh teks UI, modal, toast, dan pesan error berbahasa Indonesia yang jelas, sopan, dan profesional.
- Pertahankan multi-tenant namespace isolation (`getStorageKey`) dan Master Core mode (`tenantId === "default"` selalu tidak terkunci).
- Operasional kasir meja 1–4, transaksi bayar, pesanan menu, QR self-order meja 1–4, KDS dapur, dan pembacaan riwayat transaksi harian buku kas (`#sectionLedger`) **tetap berfungsi gratis**.
- Modul pro yang dikunci saat `!isPaidActive && !isMaster`: Analitik BI (`#sectionAnalyticsBI`), CRM Member (`#sectionCrmMembers`), Reservasi Meja (`#sectionReservations`), Backup/Restore Database (`#sectionBackupRestore`), Ekspor CSV/Excel buku kas, serta pendaftaran member/reservasi di kasir POS.
- Upload foto bukti transfer dikompresi di client (< 1280px Canvas JPEG 0.75) dan disimpan ke Google Drive via GAS; sel Google Sheets hanya menyimpan URL/ID file Drive, bukan string Base64.
- Status tenant di sheet `Tenants` **tidak diubah** saat upload bukti bayar (status `pending` murni dicatat pada baris sheet `Payments`). Status tenant hanya diubah ke `active` saat Super Admin menyetujui (`approve`).
- Saat persetujuan perpanjangan bulanan disetujui, `expiresAt` ditambah 30 hari dari tanggal kedaluwarsa sebelumnya jika belum expired, atau 30 hari dari hari ini jika sudah expired. Kuota meja kustom `tablesCount` tidak boleh diturunkan (`Math.max(tablesCount, 12)`).

---

## Review Focus

1. **Perpanjangan Sebelum Expired (Akumulasi Hari):** Tenant `monthly` aktif yang membayar perpanjangan 5 hari sebelum expired harus mendapatkan masa aktif baru `expiresAt_lama + 30 hari` (bukan dihitung dari tanggal hari ini), sehingga hari aktif yang tersisa tidak hangus.
2. **Unggah Bukti Ganda saat Masih Pending:** Jika tenant mengunggah bukti bayar baru saat pembayaran sebelumnya masih berstatus `pending`, backend memperbarui baris pending yang sama (update foto & nominal) agar tidak terjadi antrean ganda di Super Admin.
3. **Resiliensi File Upload & Ukuran Payload:** Jika foto gagal disimpan ke Google Drive (misal kuota Google Drive penuh), backend melempar error JSON yang jelas tanpa merusak baris sheet `Payments`.
4. **Alasan Penolakan Kosong:** Jika Super Admin menolak bukti pembayaran tanpa mengetikkan alasan, sistem memberikan pesan default otomatis (*"Bukti pembayaran belum dapat diverifikasi. Silakan periksa nominal/rekening dan unggah ulang."*) agar tenant tidak bingung.
5. **Ketahanan Offline Modal Pembayaran:** Jika perangkat tenant kehilangan koneksi internet saat membuka modal checkout atau mengecek status pembayaran, antarmuka menampilkan pesan koneksi ramah tanpa menyebabkan JavaScript crash/freeze.

---

### Task 1: Core Engine Gating Fitur Pro & Client API Pembayaran di `assets/js/resto-sync.js`

**Files:**
- Modify: `assets/js/resto-sync.js`
- Create: `tests/test_tahap2_core_gating.js`

**Interfaces:**
- Produces in `RestoSync`:
  - `RESTO_PRO_FEATURES`: dictionary of pro features (`ANALYTICS_BI`, `CRM_MEMBERS`, `RESERVATIONS`, `EXPORT_LEDGER`, `BACKUP_RESTORE`, `TABLES_EXPANSION`).
  - `isFeatureAllowed(featureId)`: boolean check based on `isMaster || isPaidActive`.
  - `showProFeatureLockedModal(featureName, options)`: modern pro modal without offline token input, with checkout trigger (`OPEN_PAYMENT_MODAL`).
  - `submitPaymentProof(payload)`: async call to GAS `submitPaymentProof`.
  - `getTenantPaymentStatus(tenantId)`: async call to GAS `getTenantPaymentStatus`.
  - `getPaymentsAdmin(statusFilter)`: async call to GAS `getPayments` using `API_SECRET_KEY`.
  - `verifyPaymentAdmin(paymentId, action, rejectReason)`: async call to GAS `verifyPayment` using `API_SECRET_KEY`.

- [ ] **Step 1: Write failing test `tests/test_tahap2_core_gating.js`**

Cover:
1. `isFeatureAllowed` returns `true` for all `RESTO_PRO_FEATURES` on Master (`default`).
2. `isFeatureAllowed` returns `true` for active `monthly` and active `lifetime` tenants.
3. `isFeatureAllowed` returns `false` for `trial`, `pending`, `expired`, `suspended`, and `notSynced` tenants.
4. `showProFeatureLockedModal` produces HTML without `#proModalTokenInput` and dispatches `OPEN_PAYMENT_MODAL` on upgrade CTA.
5. `submitPaymentProof`, `getTenantPaymentStatus`, `verifyPaymentAdmin` make correct fetch payloads and handle offline fallbacks gracefully.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap2_core_gating.js`
Expected: FAIL (`RESTO_PRO_FEATURES` / `isFeatureAllowed` not defined).

- [ ] **Step 3: Implement Core Engine in `assets/js/resto-sync.js`**

Add `RESTO_PRO_FEATURES`, `isFeatureAllowed`, updated `showProFeatureLockedModal`, and payment client methods.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap2_core_gating.js`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit Task 1**

```bash
git add assets/js/resto-sync.js tests/test_tahap2_core_gating.js
git commit -m "feat(tahap2): pro features gating and payment client engine in resto-sync"
```

---

### Task 2: Cloud Backend Sheet `Payments`, Drive Upload & Endpoints di `backend/Kode.gs`

**Files:**
- Modify: `backend/Kode.gs`
- Create: `tests/test_kode_gs_payments.js`

**Interfaces:**
- Produces in `backend/Kode.gs`:
  - `CONFIG.SHEET_NAMES.PAYMENTS: 'Payments'`
  - `PAYMENT_HEADERS`: `['id', 'tenantId', 'tenantName', 'plan', 'amount', 'bankTarget', 'proofFileId', 'proofUrl', 'senderName', 'senderBank', 'status', 'rejectReason', 'createdAt', 'verifiedAt', 'verifiedBy']`
  - `getOrCreatePaymentsSheet_()`
  - Action `submitPaymentProof` (POST, public): parses Base64, saves to Drive (`CONFIG.ROOT_FOLDER_ID`), inserts/updates row in `Payments`. Does NOT change `Tenants.status`.
  - Action `getPayments` (GET, admin `verifyAuthKey_`): returns list of payments.
  - Action `getTenantPaymentStatus` (GET, public): returns latest payment for given `tenantId`.
  - Action `verifyPayment` (POST, admin `verifyAuthKey_`): approves or rejects payment; on approve updates `Tenants` row (`status = 'active'`, `plan`, new `expiresAt`, `tablesCount`).

- [ ] **Step 1: Write failing test `tests/test_kode_gs_payments.js`**

Cover:
1. `submitPaymentProof` saves file to Drive mock, creates `Payments` row with `pending`, leaves `Tenants` status unchanged.
2. Submitting again while `pending` updates the existing pending row instead of creating duplicate pending rows (Review Focus #2).
3. `getTenantPaymentStatus` returns the latest payment object.
4. `verifyPayment` with `approve` on monthly tenant:
   - Sets payment row `status = 'verified'`, sets `verifiedAt`.
   - If tenant was still active with 5 days left, extends `expiresAt` by 30 days from previous expiry (Review Focus #1).
   - If tenant was expired, sets `expiresAt` to 30 days from today.
   - Sets tenant `status = 'active'`.
   - Preserves custom `tablesCount` if > 12.
5. `verifyPayment` with `reject`:
   - Sets payment row `status = 'rejected'`, records `rejectReason` (or default if blank - Review Focus #4).
   - Leaves `Tenants` status untouched.
6. Error handling when Drive fails returns clean error response without corrupted rows (Review Focus #3).

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_payments.js`
Expected: FAIL (Payments sheet & endpoints not defined).

- [ ] **Step 3: Implement Backend Endpoints & Drive Helper in `backend/Kode.gs`**

Add `CONFIG.SHEET_NAMES.PAYMENTS`, `getOrCreatePaymentsSheet_`, Base64 Drive saver, and handler functions for `submitPaymentProof`, `getPayments`, `getTenantPaymentStatus`, `verifyPayment`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_payments.js`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/Kode.gs tests/test_kode_gs_payments.js
git commit -m "feat(tahap2): payments sheet, drive upload, and verification endpoints in Kode.gs"
```

---

### Task 3: Gembok Visual Modul Pro di `owner_settings_saas.html`

**Files:**
- Modify: `owner_settings_saas.html`
- Create: `tests/test_owner_feature_gating.js`

**Interfaces:**
- Consumes: `RestoSync.isFeatureAllowed(...)`, `RestoSync.showProFeatureLockedModal(...)`
- Produces in `owner_settings_saas.html`:
  - `updateProFeatureLockUI()`: applies/removes overlay gembok dynamically.
  - Full section overlay with lock badge & CTA on `#sectionAnalyticsBI`, `#sectionCrmMembers`, `#sectionReservations`, `#sectionBackupRestore`.
  - Selective gating on `#sectionLedger`: table & daily omset remain readable; `#btnExportCsvLedger` is gated with `PRO` badge.
  - Intercept click handlers on pro action buttons when locked.

- [ ] **Step 1: Write failing test `tests/test_owner_feature_gating.js`**

Cover:
1. When tenant is `trial` / unpaid:
   - `#sectionAnalyticsBI`, `#sectionCrmMembers`, `#sectionReservations`, `#sectionBackupRestore` have `data-pro-locked="true"` and render lock overlay.
   - `#sectionLedger` table is NOT locked/hidden; transactions can be read.
   - Clicking `#btnExportCsvLedger` on unpaid tenant triggers pro modal.
2. When tenant is active `monthly` or active `lifetime` or Master:
   - All 5 sections have `data-pro-locked="false"`, overlays removed, export button works.
3. Event `TENANTS_UPDATED` or `LICENSE_STATUS_CHANGED` dynamically toggles lock state without page reload.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_feature_gating.js`
Expected: FAIL (sections not locked on unpaid tenant).

- [ ] **Step 3: Implement Visual Gating in `owner_settings_saas.html`**

Add overlay styling/markup, implement `updateProFeatureLockUI()`, hook into `DOMContentLoaded` and `RestoSync.on('TENANTS_UPDATED', ...)` / `RestoSync.on('LICENSE_STATUS_CHANGED', ...)`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_feature_gating.js`
Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add owner_settings_saas.html tests/test_owner_feature_gating.js
git commit -m "feat(tahap2): visual pro feature locks on owner settings modules"
```

---

### Task 4: Modal Checkout Pembayaran & Upload Bukti di `owner_settings_saas.html` & `resto_hub.html`

**Files:**
- Modify: `owner_settings_saas.html`
- Modify: `resto_hub.html`
- Create: `tests/test_payment_checkout_flow.js`

**Interfaces:**
- Consumes: `RestoSync.submitPaymentProof(...)`, `RestoSync.getTenantPaymentStatus(...)`
- Produces in `owner_settings_saas.html` & `resto_hub.html`:
  - `#paymentCheckoutModal`: package selector (`monthly` / `lifetime`), bank info (BCA, Mandiri, QRIS), image upload with client canvas resize & preview, sender name & bank input.
  - Payment status notification banner in Hub and Owner Settings:
    - `pending`: banner "Bukti transfer sedang diverifikasi Admin RASH".
    - `rejected`: banner "Bukti transfer sebelumnya ditolak: [Alasan]. Unggah ulang." + retry button.
  - Re-usable function `openPaymentCheckoutModal(defaultPlan)`.

- [ ] **Step 1: Write failing test `tests/test_payment_checkout_flow.js`**

Cover:
1. `openPaymentCheckoutModal()` opens `#paymentCheckoutModal` and sets package price accurately.
2. Selecting image populates preview and prepares Base64 payload.
3. Submitting valid form calls `RestoSync.submitPaymentProof` and updates UI to `pending` state.
4. When `getTenantPaymentStatus` returns `rejected`, modal displays `rejectReason` and allows re-upload.
5. In `resto_hub.html`, "Perpanjang / Upgrade" button triggers checkout modal, and pending banner displays when `pending`.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_payment_checkout_flow.js`
Expected: FAIL (`#paymentCheckoutModal` not found).

- [ ] **Step 3: Implement Checkout Modal & Hub Payment Triggers**

Add modal HTML, client-side canvas image resize logic, form submission handler, status polling/sync in `owner_settings_saas.html` and `resto_hub.html`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_payment_checkout_flow.js`
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add owner_settings_saas.html resto_hub.html tests/test_payment_checkout_flow.js
git commit -m "feat(tahap2): payment checkout modal and proof upload flow"
```

---

### Task 5: Panel Persetujuan Pembayaran di `super_admin_saas.html` & POS Guard di `cashier_pos_register.html`

**Files:**
- Modify: `super_admin_saas.html`
- Modify: `cashier_pos_register.html`
- Create: `tests/test_super_admin_approval_and_pos_guard.js`

**Interfaces:**
- Consumes: `RestoSync.getPaymentsAdmin(...)`, `RestoSync.verifyPaymentAdmin(...)`, `RestoSync.isFeatureAllowed(...)`
- Produces:
  - In `super_admin_saas.html`:
    - Tab `#tabPaymentsApproval` with counter badge for pending payments.
    - Payments data table with filter (`Semua`, `Pending`, `Disetujui`, `Ditolak`).
    - Proof image modal preview (`#proofImageModal`).
    - 1-click "Setujui" button: calls `verifyPaymentAdmin(id, 'approve')`, refreshes tenants & payments.
    - "Tolak" button with rejection reason prompt dialog: calls `verifyPaymentAdmin(id, 'reject', reason)`.
  - In `cashier_pos_register.html`:
    - Guard on `#btnRegisterMember` / member creation and `#btnOpenReservationModal` / reservation creation when `!isPaidActive && !isMaster`, displaying friendly pro notice.

- [ ] **Step 1: Write failing test `tests/test_super_admin_approval_and_pos_guard.js`**

Cover:
1. `super_admin_saas.html` renders payments list, displays pending badge, and opens proof image modal.
2. Clicking "Setujui" executes `verifyPaymentAdmin(id, 'approve')` and updates tenant status.
3. Clicking "Tolak" with reason executes `verifyPaymentAdmin(id, 'reject', reason)`.
4. In `cashier_pos_register.html`, clicking member registration or reservation on unpaid tenant triggers pro notice toast/modal while standard sales & table 1-4 checkout function normally.

- [ ] **Step 2: Run test to verify RED**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_approval_and_pos_guard.js`
Expected: FAIL (Payments approval tab and POS guards not found).

- [ ] **Step 3: Implement Approval Tab & POS Guard**

Implement `#tabPaymentsApproval` in `super_admin_saas.html` and member/reservation pro guards in `cashier_pos_register.html`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_approval_and_pos_guard.js`
Expected: PASS.

- [ ] **Step 5: Run Full Repository Test Suite (Tahap 1 + Tahap 2)**

Run all test suites across the repository to verify zero regressions:
```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap1_core.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_tenants.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_and_self_serve.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_hub_and_owner_reality.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_operational_screens_sync.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap2_core_gating.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_payments.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_feature_gating.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_payment_checkout_flow.js
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_super_admin_approval_and_pos_guard.js
```
Expected: All 10 suites PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add super_admin_saas.html cashier_pos_register.html tests/test_super_admin_approval_and_pos_guard.js
git commit -m "feat(tahap2): super admin payment approval panel and POS cashier pro guards"
```
