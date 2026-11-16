# Tahap 3: QRIS Dinamis Otomatis EMVCo (CRC16) & Omnichannel Online Order Delivery Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan mesin konversi QRIS Dinamis standar Bank Indonesia (EMVCo MPM CRC16-CCITT) dan sistem penerima/jembatan pesanan online terpadu (GoFood, GrabFood, ShopeeFood, Qpon/Lynk.id) ke Google Sheets Cloud, Kasir POS, dan Layar Dapur KDS tanpa biaya API bulanan (Rp0).

**Architecture:** Modul murni client-side di `assets/js/resto-sync.js` untuk parsing TLV dan perhitungan CRC16 secara instan di peramban, dipadukan dengan database sheet `OnlineOrders` & REST API di `backend/Kode.gs` serta sinkronisasi event real-time `ONLINE_ORDER_RECEIVED` lintas layar (Kasir, KDS Dapur, QR Tamu, dan Pengaturan Owner).

**Tech Stack:** Pure Vanilla JavaScript (ES6+), HTML5, Tailwind CSS CDN, Google Apps Script (`backend/Kode.gs`), Google Sheets, Web Audio API, JavaScriptCore (`jsc`) headless test harness.

**Spec:** [`docs/superpowers/specs/2026-11-15-tahap3-qris-dinamis-dan-omnichannel-delivery-design.md`](file:///Users/macbook/Documents/RASH%20WebApp/2.%20PROJECT/1.%20WebApp/app%20resto%20pro%20/docs/superpowers/specs/2026-11-15-tahap3-qris-dinamis-dan-omnichannel-delivery-design.md)

---

## Global Constraints

- **Budget Floor:** Rp0 biaya langganan API eksternal; tidak menggunakan SDK agregator berbayar; kalkulasi CRC16 dieksekusi 100% lokal di browser.
- **Identitas Kontak Resmi:** WhatsApp CS `085174273313` (`https://wa.me/6285174273313`), Etalase Lynk.id `https://lynk.id/rabiasultan`.
- **Multi-Tenant Isolation:** Konfigurasi QRIS dan transaksi online orders diisolasi berdasarkan `tenantId`.
- **No Overwriting Past Data:** Sheet `OnlineOrders` dan `Tenants` tidak boleh menghapus histori transaksi lama.
- **Tag Validation:** Seluruh dokumen HTML yang dimodifikasi wajib tervalidasi dengan tag HTML yang seimbang tanpa syntax error.
- **Zero Regression:** Seluruh 122 tes otomatis dari Tahap 1 dan Tahap 2 wajib tetap lulus 100%.

---

## Review Focus

1. **Format String QRIS Statis Tidak Lengkap atau Rusak:** Ketika pemilik resto memasukkan string kosong, terlalu pendek, atau tanpa tag `6304`, konverter tidak boleh melempar unhandled error atau merusak UI, melainkan mengembalikan `{ success: false, reason: "..." }` dan menampilkan fallback ramah.
2. **Kalkulasi CRC16-CCITT Wajib Presisi Sesuai Standar Bank Indonesia:** Menggunakan polynomial `0x1021`, initial `0xFFFF`, tanpa kesalahan pergeseran bit (bit-shift) pada karakter ASCII multi-digit dan nominal besar (misal Rp 1.500.000).
3. **Mencegah Duplikasi Pesanan Online:** Endpoint `submitOnlineOrder` di `backend/Kode.gs` memeriksa nomor referensi unik `platformRef` agar pesanan yang sama tidak tercatat ganda saat koneksi jaringan tidak stabil.
4. **Isolasi Tiket Dapur KDS:** Tiket pesanan online yang masuk ke KDS hanya boleh tampil pada tenant yang bersangkutan dan memiliki tombol status yang tidak mengganggu denah meja Dine-In (karena delivery tidak memakai meja fisik resto).
5. **Kembalian 0 Keranjang QR Tamu:** Perubahan keranjang default 0 yang baru diperbaiki di `customer_qr_self_order.html` wajib tetap terjaga bersih saat fitur QRIS dinamis tamu diintegrasikan.

---

## File Structure & Decomposition

```
app resto pro/
├── assets/
│   └── js/
│       └── resto-sync.js              # Modul konversi EMVCo QRIS, CRC16, dan client API OnlineOrders
├── backend/
│   └── Kode.gs                        # Sheet OnlineOrders, endpoint submitOnlineOrder, getOnlineOrders, updateOnlineOrderStatus
├── owner_settings_saas.html           # Section konfigurasi QRIS toko & URL Webhook Lynk.id/Qpon
├── cashier_pos_register.html          # Modal pembayaran QRIS dinamis & Tab Manajemen Pesanan Online
├── kitchen_display_kds.html           # Penerima pesanan online KDS, nada lonceng delivery, & filter station
├── customer_qr_self_order.html        # Modal bayar mandiri QRIS dinamis di HP tamu
└── tests/
    ├── test_tahap3_qris_emvco.js                    # Tes unit matematika EMVCo TLV & CRC16
    ├── test_kode_gs_online_orders.js                # Tes endpoint GAS OnlineOrders
    ├── test_owner_qris_and_online_setup.js          # Tes UI & penyimpanan QRIS di Owner Settings
    ├── test_cashier_qris_and_online_orders.js       # Tes pembayaran QRIS kasir & tab pesanan online
    └── test_kds_and_customer_qris.js                # Tes lonceng tiket KDS & QRIS dinamis di HP tamu
```

---

## Task Decomposition

### Task 1: Modul Konversi EMVCo QRIS Dinamis & Algoritma CRC16-CCITT

**Files:**
- Modify: `assets/js/resto-sync.js`
- Test: `tests/test_tahap3_qris_emvco.js`

**Interfaces:**
- Produces:
  - `RestoSync.calculateCrc16(payload: string): string` -> 4-character uppercase hex string (e.g. `"9B2F"`)
  - `RestoSync.convertStaticQrisToDynamic(rawQris: string, amount: number, options?: object): { success: boolean, dynamicQris?: string, error?: string }`
  - `RestoSync.getTenantQris(tenantId: string): string`
  - `RestoSync.saveTenantQris(tenantId: string, qrisString: string): boolean`

- [ ] **Step 1: Write the failing unit tests for CRC16 and EMVCo TLV in `tests/test_tahap3_qris_emvco.js`**
  - Tes kalkulasi CRC16 terhadap vektor data resmi EMVCo Bank Indonesia (misal data uji `"000201010212...6304"`).
  - Tes konversi QRIS statis (`010211`) menjadi dinamis (`010212`), penyisipan Tag 54 dengan amount Rp 10.000 (`540510000`), Tag 58 (`ID`), Tag 53 (`360`), dan validasi 4-digit CRC hex.
  - Tes handling input invalid/rusak mengembalikan fallback aman.
  - Tes getter/setter `getTenantQris` dan `saveTenantQris` per-tenant.

- [ ] **Step 2: Run test to verify it fails**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap3_qris_emvco.js`
  Expected: FAIL with "RestoSync.calculateCrc16 is not a function"

- [ ] **Step 3: Implement CRC16-CCITT algorithm and TLV parser in `assets/js/resto-sync.js`**
  - Implementasi fungsi `calculateCrc16(str)` murni bitwise: polynomial `0x1021`, initial `0xFFFF`.
  - Implementasi fungsi `convertStaticQrisToDynamic(rawQris, amount, options)`:
    - Cari dan ganti `010211` ➔ `010212`.
    - Hapus tag 54 yang ada jika ada, lalu susun format tag 54 baru: `54` + `String(amount.toString().length).padStart(2, '0')` + `amount`.
    - Hapus 4 karakter setelah `6304`, hitung CRC16 dari string baru + `6304`, append hasilnya.
  - Implementasi `getTenantQris(tenantId)` dan `saveTenantQris(tenantId, qrisString)`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_tahap3_qris_emvco.js`
  Expected: PASS all tests.

- [ ] **Step 5: Commit Task 1**
  ```bash
  git add assets/js/resto-sync.js tests/test_tahap3_qris_emvco.js
  git commit -m "feat(qris): implementasi modul konversi EMVCo QRIS dinamis dan CRC16"
  ```

---

### Task 2: Backend Cloud Sheet `OnlineOrders` & REST API Endpoints

**Files:**
- Modify: `backend/Kode.gs`
- Test: `tests/test_kode_gs_online_orders.js`

**Interfaces:**
- Consumes: Google Sheets SpreadsheetApp API, JSON payloads
- Produces:
  - `doPost` action `"submitOnlineOrder"`: `{ success: true, orderId: string, status: "pending" }`
  - `doGet` action `"getOnlineOrders"`: `{ success: true, orders: Array<OnlineOrder> }`
  - `doPost` action `"updateOnlineOrderStatus"`: `{ success: true, orderId: string, status: string }`

- [ ] **Step 1: Write the failing unit tests in `tests/test_kode_gs_online_orders.js`**
  - Tes pembuatan sheet `OnlineOrders` otomatis jika belum ada.
  - Tes endpoint `submitOnlineOrder` dengan validasi parameter wajib (`tenantId`, `platform`, `items`, `totalAmount`).
  - Tes generate `orderId` unik berformat `ORD-<PLATFORM>-<YYYYMMDD>-<HEX>`.
  - Tes pencegahan duplikasi jika `platformRef` sama dalam satu tenant.
  - Tes endpoint `getOnlineOrders` dengan filter per `tenantId`.
  - Tes endpoint `updateOnlineOrderStatus` untuk transisi status `cooking` ➔ `ready` ➔ `completed`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_online_orders.js`
  Expected: FAIL with "Unknown action submitOnlineOrder"

- [ ] **Step 3: Implement sheet `OnlineOrders` and handlers in `backend/Kode.gs`**
  - Tambahkan inisialisasi sheet `OnlineOrders` dengan 15 kolom sesuai spesifikasi desain.
  - Implementasikan handler `submitOnlineOrder(payload)` di `doPost`.
  - Implementasikan handler `getOnlineOrders(params)` di `doGet`.
  - Implementasikan handler `updateOnlineOrderStatus(payload)` di `doPost`.
  - Tambahkan client helper di `assets/js/resto-sync.js`:
    - `RestoSync.submitOnlineOrder(orderData)`
    - `RestoSync.getOnlineOrders(tenantId)`
    - `RestoSync.updateOnlineOrderStatus(orderId, status)`

- [ ] **Step 4: Run test to verify it passes**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kode_gs_online_orders.js`
  Expected: PASS all tests.

- [ ] **Step 5: Commit Task 2**
  ```bash
  git add backend/Kode.gs assets/js/resto-sync.js tests/test_kode_gs_online_orders.js
  git commit -m "feat(backend): skema sheet OnlineOrders dan endpoint webhook REST API"
  ```

---

### Task 3: Antarmuka Pengaturan QRIS Toko & Webhook di Owner Settings

**Files:**
- Modify: `owner_settings_saas.html`
- Test: `tests/test_owner_qris_and_online_setup.js`

**Interfaces:**
- Consumes: `RestoSync.getTenantQris`, `RestoSync.saveTenantQris`, `RestoSync.convertStaticQrisToDynamic`
- Produces: Form input QRIS statis, pratinjau barcode live, simulator konversi nominal tes, kartu petunjuk webhook Lynk.id/Qpon.

- [ ] **Step 1: Write the failing tests in `tests/test_owner_qris_and_online_setup.js`**
  - Tes render Section Pengaturan QRIS Toko di `owner_settings_saas.html`.
  - Tes menyimpan string QRIS statis via form memanggil `RestoSync.saveTenantQris`.
  - Tes tombol "Uji Coba Nominal" mengubah input tes menjadi QRIS dinamis yang valid.
  - Tes rendering informasi Webhook URL untuk integrasi pesanan online Lynk.id/Qpon.

- [ ] **Step 2: Run test to verify it fails**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_qris_and_online_setup.js`
  Expected: FAIL with "Element #qrisStaticInput not found"

- [ ] **Step 3: Implement QRIS settings section & Webhook info card in `owner_settings_saas.html`**
  - Tambahkan kartu "Pengaturan QRIS Resto (EMVCo Dinamis)" dengan textarea input string, tombol simpan, tombol salin, dan simulator uji coba nominal.
  - Tambahkan kartu panduan "Jembatan Pesanan Online Lynk.id & Qpon" lengkap dengan URL Webhook dan contoh format JSON.
  - Hubungkan interaksi form ke `RestoSync.getTenantQris` dan `RestoSync.saveTenantQris`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_owner_qris_and_online_setup.js`
  Expected: PASS all tests.

- [ ] **Step 5: Commit Task 3**
  ```bash
  git add owner_settings_saas.html tests/test_owner_qris_and_online_setup.js
  git commit -m "feat(owner): section pengaturan QRIS toko dan panduan webhook online orders"
  ```

---

### Task 4: Integrasi QRIS Dinamis & Manajemen Pesanan Online di Kasir POS

**Files:**
- Modify: `cashier_pos_register.html`
- Test: `tests/test_cashier_qris_and_online_orders.js`

**Interfaces:**
- Consumes: `RestoSync.convertStaticQrisToDynamic`, `RestoSync.submitOnlineOrder`, `RestoSync.updateOnlineOrderStatus`
- Produces: Modal bayar QRIS dinamis ber-nominal running bill pas, timer 15 menit, tab kelola pesanan online terintegrasi Cloud.

- [ ] **Step 1: Write the failing tests in `tests/test_cashier_qris_and_online_orders.js`**
  - Tes pemilihan metode `qris` di Kasir merender QR dinamis dengan nominal tagihan aktif (bukan lagi mockup statis).
  - Tes jika tenant belum memasukkan QRIS statis, kasir menampilkan peringatan ramah dan petunjuk setup.
  - Tes tab pesanan online kasir memuat data pesanan dari Cloud dan simulator input kilat mengirim ke `RestoSync.submitOnlineOrder`.
  - Tes tombol update status pesanan ojol (*Mulai Masak*, *Siap Diambil Driver*, *Selesai*) memicu event `ONLINE_ORDER_STATUS_CHANGED`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_cashier_qris_and_online_orders.js`
  Expected: FAIL with "QRIS section still renders static mockup"

- [ ] **Step 3: Implement dynamic QRIS modal & online orders tab in `cashier_pos_register.html`**
  - Perbarui fungsi `selectPaymentMethod('qris')`: panggil konverter EMVCo dengan nominal tagihan aktif meja, render QRIS aktual, dan jalankan timer hitung mundur 15 menit.
  - Hubungkan form modal pesanan online (`onlineDeliveryOrderModal`) dan tombol cepat simulator (`quickSimulateAndClose`) agar memanggil `RestoSync.submitOnlineOrder` ke Cloud.
  - Render kartu pesanan delivery di tab kasir dengan badge status dan aksi transisi.

- [ ] **Step 4: Run test to verify it passes**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_cashier_qris_and_online_orders.js`
  Expected: PASS all tests.

- [ ] **Step 5: Commit Task 4**
  ```bash
  git add cashier_pos_register.html tests/test_cashier_qris_and_online_orders.js
  git commit -m "feat(pos): integrasi QRIS dinamis tagihan aktif dan tab kelola pesanan online"
  ```

---

### Task 5: Integrasi Layar Dapur KDS (Nada Bel & Tiket Ojol) & HP Tamu QR Self-Order

**Files:**
- Modify: `kitchen_display_kds.html`, `customer_qr_self_order.html`
- Test: `tests/test_kds_and_customer_qris.js`

**Interfaces:**
- Consumes: Event `ONLINE_ORDER_RECEIVED`, `ONLINE_ORDER_STATUS_CHANGED`, `RestoSync.convertStaticQrisToDynamic`
- Produces: Tiket KDS pesanan online dengan chime audio berdering otomatis, modal QRIS dinamis di HP tamu.

- [ ] **Step 1: Write the failing tests in `tests/test_kds_and_customer_qris.js`**
  - Tes penerimaan event `ONLINE_ORDER_RECEIVED` di KDS merender kartu tiket khusus delivery (terdapat badge platform 🟢 GoFood / 🟢 GrabFood / 🔴 ShopeeFood / 🟣 Qpon, nama driver, catatan packaging).
  - Tes KDS membunyikan lonceng pesanan saat event diterima.
  - Tes di `customer_qr_self_order.html`: saat tamu memilih opsi bayar QRIS, tampil modal QRIS dinamis dengan nominal tagihan belanjaan tamu.
  - Tes keranjang awal di `customer_qr_self_order.html` tetap kosong (0) secara default.

- [ ] **Step 2: Run test to verify it fails**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kds_and_customer_qris.js`
  Expected: FAIL with "KDS handler for ONLINE_ORDER_RECEIVED not registered"

- [ ] **Step 3: Implement KDS online order handling & Guest QR dynamic payment**
  - Di `kitchen_display_kds.html`:
    - Daftarkan listener `RestoSync.on('ONLINE_ORDER_RECEIVED', ...)` dan `RestoSync.on('ONLINE_ORDER_STATUS_CHANGED', ...)`.
    - Tambahkan pemutar audio chime Web Audio API untuk pesanan delivery baru.
    - Render kartu tiket delivery dengan styling warna platform yang jelas.
  - Di `customer_qr_self_order.html`:
    - Tambahkan modal pembayaran QRIS dinamis jika tamu memilih tender QRIS.
    - Pastikan `cart = []` tetap terjaga sebagai keranjang awal bersih.

- [ ] **Step 4: Run test to verify it passes**
  Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_kds_and_customer_qris.js`
  Expected: PASS all tests.

- [ ] **Step 5: Commit Task 5**
  ```bash
  git add kitchen_display_kds.html customer_qr_self_order.html tests/test_kds_and_customer_qris.js
  git commit -m "feat(kds,guest): tiket ojol ber-chime di KDS dan pembayaran QRIS dinamis tamu"
  ```

---

### Task 6: Regresi Menyeluruh (Zero-Regression), Validasi HTML & Final Merge

**Files:**
- Test: Seluruh file di `tests/test_*.js`
- Validate: `owner_settings_saas.html`, `cashier_pos_register.html`, `kitchen_display_kds.html`, `customer_qr_self_order.html`

- [ ] **Step 1: Jalankan seluruh suite tes otomatis (Tahap 1, Tahap 2, dan Tahap 3)**
  - Eksekusi seluruh 15+ suite tes via `jsc`.
  - Pastikan seluruh tes (122 tes lama + tes baru) lulus 100% tanpa ada kegagalan sama sekali.

- [ ] **Step 2: Validasi keseimbangan tag seluruh file HTML yang diubah**
  - Jalankan script parser HTML Python untuk memastikan tidak ada tag yang tidak tertutup atau rusak.

- [ ] **Step 3: Subagent Final Review**
  - Luncurkan read-only subagent reviewer untuk memeriksa seluruh branch perbedaan kode (diff) terhadap spesifikasi desain Tahap 3.

- [ ] **Step 4: Fast-forward Merge ke `main` & Push ke GitHub**
  - Gabungkan branch fitur ke `main`.
  - Berikan rincian perubahan ke pemilik di layar dan minta konfirmasi sebelum menjalankan `git push`.
