# Design Spec — Tahap 1: Sinkronisasi Tenant Real-Time, Perbaikan Lifecycle SaaS & Paket Harga Baru

**Tanggal:** 2026-11-10  
**Status:** Final Draft (Sudah Melewati Builder Check & Keputusan Partner 1A/2A/3A — Siap Persetujuan Akhir)  
**Scope:** Tahap 1 dari 3 (Tahap 2: Gembok Fitur Premium & Bukti Bayar; Tahap 3: QRIS Dinamis & Bridge Ojol/Qpon)

---

## 1. Intent & Latar Belakang

Berdasarkan simulasi dan pengujian langsung terhadap alur multi-tenant SaaS (`super_admin_saas.html`, `resto_hub.html`, `owner_settings_saas.html`, `cashier_pos_register.html`, `assets/js/resto-sync.js`, dan `backend/Kode.gs`), ditemukan ketidaksesuaian antara pengaturan di Portal Super Admin dengan realita di aplikasi tenant:

1. **Hapus semua tenant memunculkan ulang data dummy:** `getAllTenants()` dan `getAllTenantsSafe()` memeriksa `list.length > 0`, sehingga array kosong `[]` pasca-penghapusan dianggap belum terinisialisasi dan otomatis menanam ulang 3 dummy tenant (`harapan-corner`, `kopi-senja`, `warung-bu-siti`).
2. **Masa berlaku tidak sinkron di aplikasi tenant / lintas perangkat:**
   - Direktori tenant baru disimpan hanya di `localStorage` browser Admin, belum di Google Sheets Cloud (`Kode.gs`). Saat link tenant dibuka di perangkat/browser lain, `getTenantInfo()` jatuh ke fallback tanpa `expiresAt`, sehingga `resto_hub.html` menampilkan `"Aktif Selamanya"`.
   - `RestoSync.getLicenseData()` mengembalikan nilai statis/hardcoded (`isPro: true`, `tierLabel: "RASH Enterprise Tier"`, `expiry: "31 Desember 2028"`, `maxTables: 999`), serta elemen banner di `owner_settings_saas.html` masih menampilkan teks statis (`RASH-PRO-88219`, `Grand Fusion Bistro Jakarta`).
   - Super Admin hanya menyediakan tombol `+30 Hari` (`handleRenewTenant`), belum memiliki editor masa aktif/tanggal/paket per klien.
3. **Pengaturan jumlah meja (`tablesCount`) tidak diikuti:** `initDefaultTables()` selalu membuat 12 meja dari `RESTO_TABLES` meskipun tenant didaftarkan dengan jumlah meja berbeda (misal 6 atau 8 meja).
4. **Paket harga perlu disederhanakan sesuai model komersial terbaru.**

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals (Tahap 1)
1. **Penghapusan Tenant Permanen:** Menghapus seluruh tenant menyisakan 0 klien (tampilan *empty state*), tanpa otomatis mengisi ulang dummy tenant. Dummy hanya di-seed 1x saat inisialisasi awal pertama kali, ditambah tombol opsional *"Muat Contoh Demo"* di *empty state*.
2. **Direktori Tenant Cloud (`Kode.gs` Sheet `Tenants` + `RestoSync` Sync):** Pengaturan tenant (nama, PIC, paket, status, tanggal `expiresAt`, `isLifetime`, `tablesCount`, hash PIN, dll.) disinkronkan antara Portal Super Admin dan seluruh perangkat klien melalui Google Apps Script (`RESTO_CLOUD_CONFIG.GAS_URL`).
3. **Keamanan Kredensial & PIN Publik (`Keputusan 1A`):**
   - Endpoint publik `getTenantPublicInfo` **tidak mengembalikan** `cashierPin`, `ownerPin`, maupun custom `apiKey` secara plaintext. Endpoint publik hanya mengembalikan metadata operasional publik + `cashierPinHash` & `ownerPinHash` (SHA-256).
   - `resto_hub.html` tidak lagi memajang angka PIN secara terbuka di layar — diganti pengingat aman *"Gunakan PIN Kasir / Owner yang telah ditetapkan oleh Pemilik / Admin RASH"*.
   - `verifyPosPin()` dan `verifyOwnerPin()` menghapus bypass `|| clean === "1234"` (hanya mencocokkan hash PIN tenant atau Pintu Darurat `9999` / `9119`).
4. **Penegakan Status `Suspended` vs `Expired` (`Keputusan 2A`):**
   - Jika status tenant **`suspended`**, aplikasi klien langsung menampilkan layar kunci penuh *"Akun Restoran Ditangguhkan — Hubungi Admin RASH via WhatsApp"*.
   - Jika status tenant **`expired`**, di Tahap 1 `resto_hub.html` & `owner_settings_saas.html` menampilkan banner peringatan merah mencolok dan `getLicenseData()` jujur melaporkan `isExpired: true, isPro: false`, namun Kasir/KDS/QR tetap dapat beroperasi sementara hingga sistem Gembok + Upload Bukti Bayar hadir di Tahap 2.
5. **Realita Pengaturan & Kartu Lisensi di Seluruh Layar Tenant (`Keputusan 3A`):**
   - `owner_settings_saas.html` (non-Master) mengganti kotak input token offline lama dengan **Kartu Status Paket & Masa Aktif Real-Time dari Cloud** + tombol CTA **"Perpanjang / Hubungi Admin RASH"**.
   - Hanya paket `lifetime` (`isLifetime: true`) dan `Master (default)` yang menampilkan *"Aktif Selamanya"*. Jika tenant tidak ditemukan di lokal maupun Cloud (`notSynced`), UI tidak memalsukan *"Aktif Selamanya"*.
   - `initDefaultTables()` menghormati `tenant.tablesCount` sebagai jumlah meja awal tenant.
6. **3 Pilihan Paket Komersial Baru + Editor Masa Berlaku di Super Admin:**
   - **Free Trial 14 Hari** (`plan: "trial"`, `price: 0`, durasi 14 hari)
   - **Paket Bulanan** (`plan: "monthly"`, `price: 199000`, durasi 30 hari)
   - **Paket Lifetime** (`plan: "lifetime"`, harga coret `Rp 3.500.000` ➔ `Rp 2.999.000`, `isLifetime: true`, `expiresAt: null`)
   - Modal **Edit Tenant & Masa Berlaku** di `super_admin_saas.html` untuk mengubah paket, tanggal berakhir kustom (`YYYY-MM-DD`), status (`trial`/`active`/`suspended`), `tablesCount`, dan PIN tanpa harus menghapus lalu membuat ulang tenant.

### Non-Goals (Dikerjakan di Tahap 2 & Tahap 3)
- Belum mengimplementasikan gembok penuh seluruh fitur premium tenant dan alur unggah bukti pembayaran (Tahap 2).
- Belum membangun Konverter QRIS Dinamis EMVCo maupun integrasi GoFood / GrabFood / ShopeeFood / Qpon (Tahap 3).
- Tidak mengubah layout 2-Zona POS yang sudah berjalan di `cashier_pos_register.html`.

### Anti-Goals (Hal yang Harus Dihindari)
- Jangan membocorkan plaintext PIN staf atau `apiKey` pribadi ke endpoint QR Meja publik (`getTenantPublicInfo`).
- Jangan mencampur data transaksi operasional tenant (yang mungkin memakai `gasUrl` pribadi klien) dengan Direktori Tenant SaaS pusat (`RESTO_CLOUD_CONFIG`).
- Jangan pernah memblokir antarmuka secara sinkron/lama saat jaringan offline — gunakan *local-first + async Cloud refresh* dengan re-render otomatis.
- Jangan mematahkan mode **Master (`default`)** atau backward compatibility bagi tenant legacy yang memakai `"pro"` / `"basic"` / `"enterprise"`.

---

## 3. Global Constraints

- Pure Vanilla HTML/CSS/JavaScript + Tailwind CSS CDN + Google Apps Script (`backend/Kode.gs`), tanpa build step / NPM dependencies baru.
- Seluruh teks UI berbahasa Indonesia yang jelas dan profesional.
- Wajib mempertahankan multi-tenant namespace isolation (`getStorageKey`) dan Master Core mode (`tenantId === "default"`).
- Fungsi SHA-256 harus tersedia sebagai helper pure-JS deterministik di `RestoSync` agar bekerja konsisten di browser maupun test suite headless (`jsc`), serta cocok dengan `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ...)` di Google Apps Script (`Kode.gs`).
- Pembungkus unit test wajib dapat dijalankan langsung secara headless via `jsc` + Python harness (mengikuti TDD Red-Green-Refactor) sebelum code dianggap selesai.
- Versi cache script (`?v=2.7.0`) dan `service-worker.js` diperbarui setelah semua file selesai.

---

## 4. Approaches Considered & Decisions

### Pilihan Sinkronisasi Direktori Tenant Lintas Perangkat
- **Pendekatan 1 (Dipilih): Cloud Tenant Directory di `backend/Kode.gs` (`Tenants` sheet) + Cache `localStorage` Perangkat.**
  - Admin mengelola tenant -> disimpan ke `localStorage` dan langsung dipush ke Cloud (`RESTO_CLOUD_CONFIG.GAS_URL`).
  - Endpoint `getTenants` (seluruh daftar) wajib `apiKey` admin; endpoint publik `getTenantPublicInfo` hanya mengembalikan metadata publik + hash PIN untuk satu `tenantId`.
- **Pendekatan 2 (Ditolak): Menyimpan masa berlaku & paket di URL query string.**
  - Tidak memungkinkan admin mengubah tanggal expired atau memblokir/suspend tenant secara jarak jauh setelah link dikirim kepada klien.

### Keputusan Teknis Kecil (*Engineering Calls — untuk Dicek Partner*)
1. **Kebijakan Rekonsiliasi Cloud vs Lokal (`syncTenantsFromCloud`):**
   - `Kode.gs` menyimpan flag `TENANTS_CLOUD_INITIALIZED` di `ScriptProperties`.
   - Untuk **Super Admin (`mode: 'admin'`)**: jika Cloud sudah terinisialisasi (`cloudInitialized: true`), data Cloud bersifat **authoritative** (menggantikan cache lokal sehingga penghapusan tenant di satu perangkat Admin tidak akan hidup kembali di perangkat Admin lain). Saat upgrade pertama kali (`cloudInitialized: false` & sheet masih 0 baris), jika Admin sudah memiliki tenant lokal non-kosong, data lokal didorong ke Cloud lalu `TENANTS_CLOUD_INITIALIZED` diset `true`.
   - Untuk **Perangkat Klien (`mode: 'tenant'`)**: jika Cloud terhubung (`cloudInitialized: true`) dan mengembalikan `notFound: true`, tenant tersebut dievakuasi (*evict*) dari cache lokal klien agar penghapusan oleh Super Admin juga berlaku di HP/tablet klien. Jika offline/gagal jaringan, cache lokal tetap dipertahankan agar kasir tidak mati total saat internet putus.
2. **Aturan 4 Meja untuk Tenant Belum Membayar (`tablesCount` vs Kuota `maxTables`):**
   - **Tenant yang BELUM membayar** (`plan === "trial"`, `status === "trial"`, atau langganan berbatas waktu yang sudah `isExpired`): maksimal **hanya 4 meja (`Meja 01` s/d `Meja 04`) yang bisa dipakai** (`maxTables = 4`). Jika di database meja terdapat lebih dari 4 meja, meja ke-5 ke atas dinonaktifkan/terkunci di POS Kasir, QR Self-Order, dan Cetak QR Meja, serta `+ Tambah Meja` memunculkan pesan agar melunasi paket berbayar.
   - **Tenant yang SUDAH membayar aktif** (`plan === "monthly"` atau `"lifetime"` dengan `status === "active"` dan `!isExpired`) serta **Master (`default`)**: `maxTables = 999` (Unlimited) dan jumlah meja awal yang dibuat oleh `initDefaultTables()` mengikuti `tablesCount` dari Super Admin (default `12`).
3. **Benturan Slug pada Daftar Trial Mandiri (`index.html`):**
   - Karena form Trial di `index.html` ringkas tanpa input slug manual, jika slug dari nama restoran sudah ada di Cloud (status apa pun: `active`, `lifetime`, `trial`, maupun `suspended`), `registerTrialTenant` di `Kode.gs` (dan pendaftaran self-serve) tidak menolak dengan error dan tidak menimpa akun orang lain — melainkan otomatis menambahkan akhiran unik 4 karakter (misal `kopi-senja-4821`) dan mengarahkan pendaftar ke slug barunya.

---

## 5. Rancangan Teknis Komponen (Arsitektur Tahap 1)

### A. Konfigurasi Paket Baru (`RESTO_SAAS_PLANS` di `assets/js/resto-sync.js`)
Menyediakan konstanta sumber kebenaran tunggal untuk paket:
- `trial`: `{ id: "trial", name: "Free Trial (14 Hari)", price: 0, originalPrice: 0, durationDays: 14, isLifetime: false, maxTables: 4, isPaidPlan: false }`
- `monthly`: `{ id: "monthly", name: "Paket Bulanan", price: 199000, originalPrice: 199000, durationDays: 30, isLifetime: false, maxTables: 999, isPaidPlan: true }`
- `lifetime`: `{ id: "lifetime", name: "Paket Lifetime", price: 2999000, originalPrice: 3500000, durationDays: null, isLifetime: true, maxTables: 999, isPaidPlan: true }`
- Mapping kompatibilitas untuk tenant lama (`basic` / `pro` -> setara durasi 30 hari berbayar bila `status === "active"`; `enterprise` -> mengikuti `expiresAt` / `isLifetime` bila ada).

### B. Penanda Inisialisasi & Fix Penghapusan Tenant (`assets/js/resto-sync.js` & `super_admin_saas.html`)
- Gunakan key terpisah `TENANTS_INIT_FLAG_KEY = "resto_pro_tenants_initialized_v1"`.
- Saat `getAllTenants()` membaca `localStorage`:
  - Jika `raw !== null` dan valid JSON array (termasuk saat `list.length === 0`), **langsung kembalikan `list`** tanpa men-seed dummy.
  - Hanya jika `raw === null` **dan** flag `TENANTS_INIT_FLAG_KEY` belum `"true"`, barulah lakukan seed initial demo 1x dan set flag `"true"`.
- `deleteTenant(tenantId)` dan `deleteTenantSafe(tenantId)` menjaga flag `TENANTS_INIT_FLAG_KEY = "true"`, menyimpan daftar baru (termasuk `[]`), dan memanggil Cloud `deleteTenant`.
- Tambahkan `seedDemoTenants()` untuk tombol opsional *"Muat Contoh Demo"* pada *empty state* di `super_admin_saas.html`.

### C. Keamanan PIN Hashing (`RestoSync` & `Kode.gs`)
- Pure-JS helper `sha256Hex(str)` di `RestoSync` dan `sha256Hex_(str)` di `Kode.gs` dengan salt domain tetap `"RESTO_PRO_PIN_V1:" + tenantId + ":" + pin`.
- Saat `saveTenant` / `registerNewTenant` / `updateTenantPins` menyimpan tenant, sistem menghitung `cashierPinHash` dan `ownerPinHash`.
- `getTenantPublicInfo` hanya mengirim `cashierPinHash` dan `ownerPinHash` (plaintext PIN & `apiKey` dikosongkan sebelum dikirim).
- `verifyPosPin(pin, tenantId)` & `verifyOwnerPin(pin, tenantId)` memeriksa:
  1. `isEmergencyPin(clean)` (`9999` / `9119`) -> `true`.
  2. Jika di cache lokal ada plaintext PIN (mode Admin) atau `cashierPinHash` / `ownerPinHash` -> bandingkan dengan `sha256Hex("RESTO_PRO_PIN_V1:" + tid + ":" + clean)`.
  3. Hanya jika tenant belum memiliki PIN maupun hash sama sekali barulah fallback `"1234"`. Tidak ada bypass `|| clean === "1234"` bila PIN sudah diganti.

### D. Sinkronisasi Cloud `Tenants` di `backend/Kode.gs` & `RestoSync`
1. **`backend/Kode.gs`:**
   - Tambahkan sheet `TENANTS: 'Tenants'` via `getOrCreateTenantsSheet_()` dengan kolom:
     `id, name, pic, phone, cashierPhone, cashierPinHash, ownerPinHash, cashierPin, ownerPin, city, plan, planName, price, originalPrice, billingCycle, tablesCount, status, isLifetime, createdAt, expiresAt, gasUrl, licenseKey, updatedAt` *(catatan: `cashierPin`/`ownerPin` plaintext tidak pernah dikirim keluar dari `getTenantPublicInfo` — hanya dikembalikan pada `getTenants` yang terotentikasi `apiKey`)*.
   - `doGet` action:
     - `getTenantPublicInfo` (publik berdasarkan `tenantId`): mengembalikan profil publik aman (`id`, `name`, `pic`, `city`, `plan`, `planName`, `price`, `originalPrice`, `billingCycle`, `tablesCount`, `status`, `isLifetime`, `createdAt`, `expiresAt`, `gasUrl`, `licenseKey`, `cashierPinHash`, `ownerPinHash`) + `cloudInitialized: true`. Jika tidak ada, kembalikan `{ success: true, notFound: true, cloudInitialized: ... }`.
     - `getTenants` (wajib `verifyAuthKey_(apiKey)`): mengembalikan seluruh baris sheet `Tenants` + `cloudInitialized`.
   - `doPost` action:
     - `saveTenant` (wajib `verifyAuthKey_(apiKey)`): *upsert* berdasarkan `id`, otomatis set `TENANTS_CLOUD_INITIALIZED = 'true'`.
     - `deleteTenant` (wajib `verifyAuthKey_(apiKey)`): hapus baris berdasarkan `id`, otomatis set `TENANTS_CLOUD_INITIALIZED = 'true'`.
     - `registerTrialTenant` (publik untuk self-serve `index.html`): memaksa `plan = "trial"`, `price = 0`, `status = "trial"`, `isLifetime = false`, 14 hari kedaluwarsa, serta auto-append suffix unik bila slug sudah terpakai di sheet `Tenants`.
2. **`RestoSync` (`assets/js/resto-sync.js`):**
   - Helper `getMasterCloudConfig()` membaca `window.RESTO_CLOUD_CONFIG` pusat.
   - `syncTenantsFromCloud(options = { mode: 'tenant' | 'admin' })`: menjalankan kebijakan rekonsiliasi pada Bagian 4 dan memicu event `"TENANTS_UPDATED"`.
   - Seluruh layar (`resto_hub.html`, `owner_settings_saas.html`, `cashier_pos_register.html`, `table_qr_print_sheet.html`, `kitchen_display_kds.html`, `customer_qr_self_order.html`) memanggil `syncTenantsFromCloud` saat load dan me-re-render UI saat `"TENANTS_UPDATED"` terpicu.

### E. Realita Masa Berlaku, Penegakan `Suspended`, & UI Tenant
1. **`RestoSync.getLicenseData()`:**
   - Untuk Master (`default`): `isMaster: true, isPro: true, isLifetime: true, isExpired: false, isSuspended: false, tier: "enterprise", tierLabel: "Master Core Resto Pro", expiry: "Aktif Selamanya (Master)", maxTables: 999`.
   - Untuk Tenant: membaca `getTenantInfo()`:
     - `isLifetime = Boolean(t.isLifetime || t.plan === "lifetime")`
     - `isSuspended = t.status === "suspended"`
     - `isExpired = !isLifetime && !!t.expiresAt && new Date(t.expiresAt).getTime() <= Date.now()`
     - `notSynced = Boolean(t.notSynced)`
     - `isPaidActive = (t.plan === "monthly" || t.plan === "lifetime" || t.plan === "pro" || t.plan === "basic" || t.plan === "enterprise") && t.status === "active" && !isExpired && !isSuspended && !notSynced`
     - `isPro = !isSuspended && !isExpired && !notSynced`
     - `maxTables = isPaidActive ? 999 : 4` (untuk tenant yang belum membayar — termasuk `trial`, `status !== "active"`, maupun langganan yang sudah `expired` — meja yang dapat digunakan dibatasi **maksimal 4 meja**!)
     - `expiry` diformat akurat sesuai 4 status: Lifetime / Tanggal Indonesia / Sudah Berakhir / Belum Tersinkronisasi.
   - Helper `RestoSync.getUsableTables()` dan pembatasan di UI:
     - Saat `initDefaultTables()` menginisialisasi meja untuk tenant belum membayar (`!isPaidActive`), hanya dibuat paling banyak `Math.min(4, Number(t.tablesCount) || 4)` meja.
     - Pada `cashier_pos_register.html`, `customer_qr_self_order.html`, `table_qr_print_sheet.html`, dan `owner_settings_saas.html`: meja urutan ke-5 ke atas otomatis diblokir/terkunci (`getUsableTables()` memotong/menandai meja `idx >= lic.maxTables`) bila tenant belum membayar, dan `canAddTable()` menolak tambah meja ke-5 dengan modal info pembayaran/upgrade!
2. **Overlay Blokir `Suspended` (`RestoSync.enforceTenantAccessGuard()`):**
   - Dipanggil di seluruh layar klien (`resto_hub.html`, `cashier_pos_register.html`, `kitchen_display_kds.html`, `customer_qr_self_order.html`, `owner_settings_saas.html`, `table_qr_print_sheet.html`) saat inisialisasi dan saat `TENANTS_UPDATED`.
   - Jika `status === "suspended"` (non-Master), menampilkan overlay fullscreen non-dismissible bertuliskan *"Akun Restoran Ditangguhkan (Suspended)"* + tombol WhatsApp Admin RASH.
3. **`resto_hub.html` & `owner_settings_saas.html`:**
   - `resto_hub.html`: menghapus tampilan plaintext PIN (`#displayCashierPin`, `#displayOwnerPin` diganti petunjuk aman `••••`), menampilkan status nyata (Lifetime / Sisa X Hari / Expired Merah / Suspended / Belum Tersinkronisasi), dan menampilkan badge batas `Maks. 4 Meja` jika belum berbayar.
   - `owner_settings_saas.html`: banner `#licenseTierBadge`, `#licenseTierLabel`, `#licenseExpiryLabel`, `#licenseTableLimitLabel`, `#licenseClientIdLabel`, `#licenseRestoNameLabel` terikat dinamis ke data tenant nyata (`Maksimal 4 Meja (Belum Bayar)` vs `Unlimited Tables`); kotak input token manual lama (non-Master) diganti kartu status paket Cloud + tombol *"Hubungi Admin / Perpanjang Paket"*.

### F. Pembaruan UI `super_admin_saas.html` & `index.html`
1. **`super_admin_saas.html`:**
   - Pilihan 3 paket pada Pendaftaran Klien Baru & Modal Edit:
     - **Trial 14 Hari** (`Rp 0` • `Maks. 4 Meja`)
     - **Paket Bulanan** (`Rp 199.000/bln` • `Unlimited Meja`)
     - **Paket Lifetime** (`Rp 3.500.000` dicoret ➔ **`Rp 2.999.000`** • `Unlimited Meja`)
   - Modal **Edit Tenant & Atur Masa Berlaku (`#editTenantModal`)**: ubah nama, PIC, WA pemilik/kasir, PIN kasir/owner, jumlah meja (`tablesCount`), paket, status (`trial`/`active`/`suspended`), tanggal expired (`<input type="date">`), serta tombol cepat `+14 Hari`, `+30 Hari`, `Set Lifetime`, `Set Expired`.
   - Tombol **"Sinkron Cloud"** + indikator status sync + tombol **"Muat Contoh Demo"** hanya di *empty state*.
2. **`index.html`:**
   - Form daftar mandiri Trial 14 Hari (`Maks. 4 Meja Uji Coba`) mengirim ke `registerTrialTenant` Cloud (menggunakan slug unik final dari Cloud jika terhubung, atau fallback lokal dengan unique suffix) sebelum me-redirect ke `resto_hub.html?tenant=<slug_final>`.

---

## 6. Rencana Pengujian TDD (`jsc` Headless Suite)

Suite pengujian otomatis di `tests/test_tahap1_tenant_lifecycle.js` dijalankan via `jsc` sebelum & sesudah implementasi:
1. Hapus semua tenant (`deleteTenant` pada seluruh item) ➔ `getAllTenants()` mengembalikan `[]`, tidak ada regenerasi dummy; flag init tetap `true`.
2. Hitung & validasi 3 paket (`trial`: 14 hari Rp 0 `maxTables: 4`, `monthly`: 30 hari Rp 199.000 `maxTables: 999`, `lifetime`: `isLifetime: true`, `price: 2999000`, `originalPrice: 3500000`, `expiresAt: null`, `maxTables: 999`).
3. Simulasi batas 4 meja tenant belum membayar:
   - Tenant `trial` didaftarkan dengan `tablesCount: 12` ➔ `initDefaultTables()` & `getUsableTables()` hanya mengizinkan maksimal **4 meja** (`Meja 01` s/d `Meja 04`), `canAddTable()` mengembalikan `false`.
   - Tenant `monthly` berbayar didaftarkan dengan `tablesCount: 6` ➔ `initDefaultTables()` membuat **6 meja** dan `canAddTable()` mengembalikan `true` (`maxTables: 999`).
   - Tenant `monthly` yang menjadi `isExpired: true` ➔ `getLicenseData().maxTables` turun ke `4` & `getUsableTables()` membatasi hanya 4 meja aktif.
4. Simulasi lintas perangkat (Admin device -> Cloud mock -> Client device kosong): verifikasi `getTenantInfo`, `getLicenseData`, `resto_hub` tidak menampilkan `"Aktif Selamanya"` untuk trial/bulanan maupun PIN plaintext, dan `owner_settings_saas` menampilkan data tenant nyata.
5. Uji hashing PIN: setelah PIN diganti dari `1234` ke `5678`, `verifyPosPin("1234")` bernilai `false`, `verifyPosPin("5678")` bernilai `true`, dan `verifyPosPin("9999")` bernilai `true`.
6. Uji rekonsiliasi Cloud: saat Cloud menghapus tenant, perangkat klien mengevaluasi `notFound: true` & mengevakuasi cache lokal.
7. Uji penegakan `suspended` vs `expired`: `status === "suspended"` memicu guard terblokir; `expired` menetapkan `isPro: false, isExpired: true` dengan status kedaluwarsa.
8. Uji self-serve `registerTrialTenant` dengan nama restoran yang sudah ada menghasilkan slug baru berakhiran unik tanpa menimpa akun lama.
