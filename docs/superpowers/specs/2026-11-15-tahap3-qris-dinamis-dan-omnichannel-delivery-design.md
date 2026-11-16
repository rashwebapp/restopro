# Tahap 3: QRIS Dinamis Otomatis EMVCo (CRC16) & Omnichannel Online Order Delivery Bridge Design Spec

> **Status:** Draft / Proposed for Review  
> **Tanggal:** 2026-11-15  
> **Target:** Resto Pro Multi-Tenant SaaS Engine (Tahap 3 dari 3 — Tahap Pamungkas)  
> **Dependencies:** Tahap 1 (`ab408cf`), Tahap 2 (`09241f4`), `assets/js/resto-sync.js`, `backend/Kode.gs`  

---

## 1. Intent & The Why

### 1.1 Latar Belakang & Masalah
Resto Pro telah berhasil menyelesaikan:
- **Tahap 1:** Fondasi multi-tenant Cloud, sinkronisasi lisensi, proteksi kuota 4 meja bagi akun gratis/trial, dan 3 paket langganan komersial.
- **Tahap 2:** Penguncian fitur premium bagi akun belum berbayar, formulir pembayaran manual (BCA, Mandiri, QRIS) dengan upload bukti ke Google Drive + database `Payments`, dan panel persetujuan 1-klik di Super Admin SaaS.

Namun untuk operasional transaksi kasir dan pesanan bungkus harian restoran/warung UMKM:
1. **QRIS Kasir Masih Bersifat Statis / Mockup:** Tombol pembayaran QRIS di layar kasir saat ini masih menampilkan gambar tiruan (*mockup* barcode statis) yang belum memuat nominal transaksi sebenarnya. Pelanggan harus mengetik nominal manual di aplikasi e-wallet mereka, yang rawan salah ketik (uang kurang atau salah transfer) dan memperlambat antrean kasir.
2. **Belum Ada Generator QRIS Dinamis Mandiri (Rp0 Biaya):** Jika menggunakan agregator payment gateway (seperti Midtrans/Xendit/Doku), UMKM dikenakan biaya potongan transaksi (MDR) plus biaya administrasi dan integrasi API yang rumit. Resto Pro membutuhkan konverter matematika standar Bank Indonesia (EMVCo MPM TLV + CRC16-CCITT) murni di browser tanpa ketergantungan API pihak ketiga.
3. **Pesanan Ojol (GoFood, GrabFood, ShopeeFood & Qpon) Masih Simulasi Lokal:** Formulir pesanan delivery di kasir belum tersimpan ke Google Sheets di Cloud, dan belum ada jalur penerima pesanan (*webhook / public endpoint*) agar pesanan dari luar (misal promo voucher Qpon di Lynk.id) dapat langsung masuk otomatis ke kasir dan dapur KDS.

### 1.2 Tujuan (Intent)
1. **QRIS Dinamis Mandiri EMVCo (Rp0 Biaya API):**
   - Pemilik resto cukup memasukkan kode string QRIS Statis toko mereka **satu kali** di Layar Pengaturan Owner.
   - Sistem secara cerdas mengonversi QRIS statis menjadi **QRIS Dinamis resmi** dengan menyisipkan nominal tagihan (Tag 54) dan menghitung ulang Checksum CRC16-CCITT (Tag 63) standar Bank Indonesia secara instan di peramban.
   - Barcode dinamis ber-nominal pas tampil di layar kasir, struk thermal, maupun layar pemesanan tamu (QR Self-Order).
2. **Omnichannel Online Delivery Bridge (GoFood, GrabFood, ShopeeFood, Qpon):**
   - Menyediakan database sheet baru `OnlineOrders` di Google Sheets (`backend/Kode.gs`).
   - Menyediakan endpoint REST API / Webhook di Google Apps Script untuk menerima pesanan online otomatis dari pihak ketiga / form promosi web.
   - Memperbarui tab pesanan online di Kasir POS dengan filter platform, kartu ringkasan order, dan kontrol status pesanan (*Pending ➔ Dimasak ➔ Siap Diambil Driver ➔ Selesai*).
   - Menghubungkan pesanan online ke Layar Dapur KDS dengan lonceng berdering otomatis dan kartu tiket berwarna khas per platform (🟢 GoFood, 🟢 GrabFood, 🔴 ShopeeFood, 🟣 Qpon).

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
1. **EMVCo MPM QRIS Generator Engine:** Modul konverter client-side di `assets/js/resto-sync.js` (atau modul pendamping) yang membedah format TLV (*Tag-Length-Value*), mengubah Tag `01` dari `11` ke `12`, menginjeksi Tag `54` (Transaction Amount), mengatur Tag `58` (`ID`), dan menghitung checksum CRC16 standar polynomial `0x1021` uppercase 4 digit.
2. **Owner QRIS Configuration:** Antarmuka di `owner_settings_saas.html` bagi pemilik restoran untuk menyimpan string QRIS statis toko mereka, melihat pratinjau barcode, dan mencoba simulasi nominal tes (misal Rp 10.000).
3. **Cashier POS & Guest Self-Order Integration:** Layar kasir (`cashier_pos_register.html`) dan layar tamu (`customer_qr_self_order.html`) merender QRIS dinamis ber-nominal tagihan aktual lengkap dengan hitung mundur kedaluwarsa 15 menit.
4. **Cloud Database `OnlineOrders` di `backend/Kode.gs`:** Skema tabel otomatis untuk merekam pesanan delivery online dengan status siklus hidup pesanan lengkap.
5. **Endpoints GAS Online Orders:** Action `submitOnlineOrder`, `getOnlineOrders`, dan `updateOnlineOrderStatus` di `backend/Kode.gs`.
6. **KDS & Kasir Live Dispatch:** Sinyal real-time `ONLINE_ORDER_RECEIVED` via BroadcastChannel dan polling cloud berkala agar dapur KDS dan kasir langsung menampilkan pesanan baru seketika.

### 2.2 Non-Goals
1. Tidak menghubungkan API berbayar resmi korporat Gojek Partner / GrabFood B2B Enterprise yang membutuhkan sertifikasi server jutaan rupiah. Kita menggunakan pola **Omnichannel Webhook Bridge + Rapid Cashier Input Dispatch** yang ramah UMKM.
2. Tidak memproses auto-disbursement penarikan saldo e-wallet ke rekening bank (pembayaran QRIS langsung masuk ke rekening bank / e-wallet pemilik resto sendiri sesuai QRIS terdaftar mereka).

### 2.3 Anti-Goals
1. **Jangan Mengubah / Merusak QRIS Statis Asli Pemilik:** Konverter hanya menyusun ulang string turunan untuk transaksi aktif tanpa mengubah master string QRIS yang disimpan pemilik.
2. **Jangan Bergantung pada API Server Eksternal untuk Hitung CRC16:** Kalkulasi CRC16 wajib dieksekusi 100% lokal di browser JavaScript demi kecepatan kilat (0 ms latensi) dan tetap bekerja saat offline.
3. **Jangan Membebani Spreadsheet dengan Polling Berlebih:** Polling pesanan online diatur efisien dan bersahabat dengan batas kuota harian Google Apps Script.

---

## 3. Constraints & Pedoman Global
- **Tech Stack:** Pure Vanilla JavaScript (ES6+), HTML5, Tailwind CSS CDN, Google Apps Script (`backend/Kode.gs`), Google Sheets, Web Audio API untuk lonceng KDS.
- **Anggaran Nol (Rp0):** Tanpa API berbayar, tanpa server VPS, tanpa framework berat npm/node di frontend.
- **Identitas Resmi RASH WebApp:**
  - WhatsApp CS: `085174273313`
  - Lynk.id Storefront: `https://lynk.id/rabiasultan`
- **Keamanan Data & Multi-Tenant:** Data QRIS dan pesanan online diisolasi per tenant (`tenantId`). Tenant Master (`default`) dan tenant aktif memiliki akses penuh.
- **Headless Test Compatibility:** Seluruh fungsi konversi EMVCo TLV, checksum CRC16, dan integrasi pesanan online dapat diuji via harness JavaScriptCore (`jsc`) secara otomatis.

---

## 4. Rincian Desain & Arsitektur Teknis

### 4.1 Spesifikasi Algoritma EMVCo QRIS (CRC16-CCITT)
Format QRIS Indonesia mengikuti standar EMVCo MPM:
- Struktur TLV: `TT` (2 digit Tag), `LL` (2 digit Panjang Karakter), `VV...` (Nilai data).
- Tahapan Transformasi String Statis ke Dinamis:
  1. Cari dan ubah Tag `01` (Point of Initiation Method): dari `010211` (Statis) menjadi `010212` (Dinamis).
  2. Format Tag `54` (Nominal Transaksi): misal nominal Rp 63.000 menjadi `540563000` (panjang 5 karakter: "63000").
  3. Sisipkan / pastikan Tag `58` bernilai `5802ID` (Country Code Indonesia) dan Tag `53` bernilai `5303360` (IDR Currency).
  4. Hapus 4 karakter nilai CRC lama setelah tag `6304`.
  5. Hitung CRC16-CCITT:
     - Algoritma: CRC-16/CCITT-FALSE (Polynomial `0x1021`, Initial Value `0xFFFF`).
     - Loop seluruh byte karakter string hingga `...6304`.
     - Hasil hex diubah menjadi 4 karakter huruf besar (misal `9B2F`).
  6. Gabungkan string utuh akhir: `...63049B2F`.
  7. Render barcode QR menggunakan SVG/Canvas lokal atau generator QR murni di browser.

### 4.2 Skema Database Sheet `OnlineOrders` (`backend/Kode.gs`)
Header kolom pada sheet baru `OnlineOrders`:
1. `orderId` (e.g. `ORD-GF-20261115-A101`)
2. `tenantId` (e.g. `harapan-corner`)
3. `platform` (`gofood` | `grabfood` | `shopeefood` | `qpon` | `takeaway`)
4. `platformRef` (e.g. `GF-8821`)
5. `customerName` (e.g. `Budi Santoso`)
6. `customerPhone` (e.g. `08123456789`)
7. `driverInfo` (e.g. `Pak Joko (B 1234 XYZ)`)
8. `itemsJson` (JSON array: `[{"id":"m1","name":"Nasi Mandhi","qty":2,"price":65000,"notes":"Pedas"}]`)
9. `subtotal` (e.g. `130000`)
10. `packagingFee` (e.g. `4000`)
11. `totalAmount` (e.g. `134000`)
12. `specialNotes` (e.g. `Box terpisah kuah, sendok 2 set`)
13. `status` (`pending` | `cooking` | `ready` | `completed` | `cancelled`)
14. `createdAt` (ISO 8601 Timestamp)
15. `updatedAt` (ISO 8601 Timestamp)

### 4.3 Endpoints Baru di `backend/Kode.gs`
1. `doPost` action `submitOnlineOrder`:
   - Menerima pesanan baru dari kasir maupun dari webhook publik luar (misal landing page promo).
   - Validasi data wajib: `tenantId`, `platform`, `items` (minimal 1 menu), `totalAmount`.
   - Menghasilkan `orderId` unik berformat `ORD-<PLATFORM>-<YYYYMMDD>-<HEX4>`.
   - Menambahkan baris baru ke sheet `OnlineOrders`.
   - Mengembalikan respons `{ success: true, orderId: "...", status: "pending" }`.
2. `doGet` action `getOnlineOrders`:
   - Mengambil daftar pesanan online untuk `tenantId` tertentu (dibatasi 50 transaksi terakhir agar hemat memori).
   - Mengembalikan daftar pesanan dengan parse `itemsJson` menjadi objek bersih.
3. `doPost` action `updateOnlineOrderStatus`:
   - Memperbarui status pesanan (`cooking`, `ready`, `completed`, `cancelled`).
   - Memperbarui kolom `updatedAt`.

### 4.4 Modul & Antarmuka yang Dimodifikasi
1. **`assets/js/resto-sync.js`:**
   - Menambahkan engine konversi QRIS EMVCo: `RestoSync.convertStaticQrisToDynamic(rawQris, amount, options)` dan `RestoSync.calculateCrc16(str)`.
   - Menambahkan penyimpanan & getter string QRIS per-tenant: `RestoSync.getTenantQris(tenantId)` dan `RestoSync.saveTenantQris(tenantId, qrisString)`.
   - Menambahkan method sinkronisasi pesanan online: `RestoSync.submitOnlineOrder(...)`, `RestoSync.getOnlineOrders(...)`, dan `RestoSync.updateOnlineOrderStatus(...)`.
   - Pemancar event: `ONLINE_ORDER_RECEIVED` dan `ONLINE_ORDER_STATUS_CHANGED`.
2. **`owner_settings_saas.html`:**
   - Section baru: "Pengaturan QRIS Toko (EMVCo Dinamis)".
   - Textarea input kode QRIS Statis warung, tombol simpan, tombol salin, dan uji coba konversi nominal.
   - Panel informasi Webhook Pemesanan Online untuk integrasi landing page / Qpon Lynk.id.
3. **`cashier_pos_register.html`:**
   - Pembayaran QRIS: Menampilkan barcode dinamis dari generator internal dengan nominal pas sesuai running bill meja, indikator waktu expired 15 menit, dan tombol cetak struk QRIS.
   - Tab Pesanan Online: Menampilkan daftar kartu pesanan aktif dengan badge platform warna khas, tombol input manual kilat, simulator pesanan 1-klik, dan tombol ubah status pesanan.
4. **`kitchen_display_kds.html`:**
   - Menampilkan tiket pesanan online dengan label platform mencolok (GoFood, GrabFood, ShopeeFood, Qpon, Takeaway).
   - Membunyikan nada bel khusus saat pesanan online baru diterima.
   - Tombol alur pengerjaan: *Mulai Masak ➔ Siap Diambil Driver ➔ Selesai*.
5. **`customer_qr_self_order.html`:**
   - Saat tamu memilih opsi pembayaran QRIS di modal checkout / bayar mandiri, tampilkan barcode QRIS dinamis ber-nominal pas tagihan meja mereka.

---

## 5. Rencana Pengujian Otomatis (TDD & Regresi)
1. **`tests/test_tahap3_qris_emvco.js`:**
   - Uji verifikasi CRC16-CCITT terhadap vektor data resmi EMVCo Bank Indonesia.
   - Uji parsing string QRIS statis ➔ dinamis dengan berbagai nominal (Rp 10.000, Rp 63.000, Rp 185.500).
   - Uji validasi tag `01` (`12`), tag `54` (amount), tag `58` (`ID`), dan tag `63` (CRC valid 4 hex).
   - Uji fallback ramah jika string QRIS statis belum diisi oleh pemilik toko.
2. **`tests/test_kode_gs_online_orders.js`:**
   - Uji pembuatan sheet `OnlineOrders` otomatis saat transaksi pertama.
   - Uji endpoint `submitOnlineOrder` dari berbagai platform (GoFood, GrabFood, ShopeeFood, Qpon).
   - Uji endpoint `getOnlineOrders` dengan filter per `tenantId`.
   - Uji endpoint `updateOnlineOrderStatus` (`cooking` ➔ `ready` ➔ `completed`).
3. **`tests/test_operational_online_orders_dispatch.js`:**
   - Uji integrasi Kasir POS: penambahan pesanan delivery online, perhitungan packaging fee, dan rendering badge platform.
   - Uji integrasi KDS Dapur: penerimaan event `ONLINE_ORDER_RECEIVED`, rendering kartu tiket online, dan pembaruan status masakan.
   - Uji sinkronisasi Owner Settings: penyimpanan konfigurasi QRIS dan pratinjau nominal tes.
4. **Regresi Seluruh Suite Sebelumnya (122 Tes):**
   - Menjalankan ke-10 file tes Tahap 1 & Tahap 2 untuk memastikan zero-regression (tetap 122+ tes lulus 100%).

---

## 6. Sizing & Tahapan Eksekusi
- **Kategori:** Large / Multi-Module Feature (Tahap Pamungkas).
- **Strategi Eksekusi:**
  - Branch terisolasi: `feat/tahap3-qris-dinamis-dan-omnichannel` via git worktree `.worktrees/tahap3`.
  - Mengikuti Test-Driven Development (TDD) murni: Tulis tes unit ➔ Implementasi kode ➔ Verifikasi 100% lulus ➔ Code review subagent ➔ Merge ke `main`.
