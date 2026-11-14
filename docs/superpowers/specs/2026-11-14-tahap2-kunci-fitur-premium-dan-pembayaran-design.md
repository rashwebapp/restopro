# Tahap 2: Penguncian Fitur Premium Non-Master & Sistem Pembayaran Bukti Transfer Praktis Design Spec

> **Status:** Draft / Proposed for Review  
> **Tanggal:** 2026-11-14  
> **Target:** Resto Pro Multi-Tenant SaaS Engine (Tahap 2 dari 3)  
> **Dependencies:** Tahap 1 (`assets/js/resto-sync.js`, `backend/Kode.gs`, `v2.7.0`)  

---

## 1. Intent & The Why

### 1.1 Latar Belakang & Masalah
Pada **Tahap 1**, kita telah berhasil menyinkronkan status tenant (`trial`, `monthly`, `lifetime`, `active`, `expired`, `suspended`), memastikan penghapusan tenant permanen tidak memunculkan data dummy, serta memberlakukan batas tegas **maksimal 4 meja aktif untuk tenant yang belum membayar**.

Namun pada aplikasi klien non-Master saat ini:
1. **Fitur-Fitur Premium Masih Terbuka Bebas:** Modul tingkat lanjut seperti Analitik BI (grafik jam sibuk, omset, dan profit margin), CRM & Member Loyalty Points, Manajemen Reservasi Meja Restoran, Ekspor CSV Pembukuan Keuangan, dan Backup/Restore Database Penuh masih bisa diakses oleh tenant gratis (`trial`), pending, maupun expired.
2. **Tidak Ada Alur Pembayaran Terintegrasi di Aplikasi:** Tenant yang ingin beralih dari *Free Trial* ke *Bulanan* atau *Lifetime* belum memiliki sarana pembayaran langsung di dalam aplikasi.
3. **Admin RASH Belum Memiliki Panel Verifikasi Pembayaran:** Belum ada rekaman transaksi pembayaran masuk di Google Sheets, upload bukti struk transfer ke Google Drive, maupun tombol persetujuan 1-klik di Super Admin SaaS untuk mengaktifkan lisensi tenant secara instan lintas terminal.

### 1.2 Tujuan (Intent)
Membangun sistem komersialisasi SaaS yang adil, aman, dan mandiri:
- **Operasional Kasir Dasar Tetap Berfungsi:** Restoran belum bayar tetap dapat berjualan kasir meja 1–4, pesan menu, dan cetak struk tanpa gangguan.
- **Fitur Bernilai Tinggi Terkunci:** Modul analitik, CRM, reservasi, ekspor data, backup database, dan meja >4 terkunci secara seragam dengan visual gembok profesional dan ajakan upgrade yang jelas.
- **Jalur Pembayaran Praktis Tanpa Midtrans (Upgrade-Ready):** Menyediakan antarmuka checkout transfer bank/QRIS manual ber-upload bukti transfer ke Google Drive & sheet `Payments` Google Sheets, dengan panel persetujuan 1-klik di Super Admin yang otomatis memperpanjang masa berlaku tenant lintas terminal. Struktur data dirancang modular dan 100% siap dihubungkan ke Webhook Midtrans di masa depan.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
1. **Fitur Pro Terkunci Rapi:** Memberikan mekanisme proteksi fitur pro (`PRO_FEATURES`) yang konsisten di `owner_settings_saas.html` dan `assets/js/resto-sync.js` untuk tenant `!isPaidActive && !isMaster`.
2. **Visual Gembok Elegan & Non-Destructive:** Modul pro yang terkunci menampilkan kartu ringkasan atau overlay semi-transparan dengan keterangan keuntungan fitur pro dan tombol *"Buka Akses Pro Sekarang"*, tanpa merusak layout antarmuka.
3. **Formulir Pembayaran & Upload Bukti di Aplikasi:** Modal pembayaran di Hub dan Owner Settings yang menampilkan pilihan paket, detail rekening tujuan transfer (BCA/Mandiri/QRIS), upload gambar foto/screenshot struk transfer dari kamera/galeri, dan status verifikasi (*Pending*, *Verified*, *Rejected*).
4. **Penyimpanan Cloud Aman (Drive & Sheets):** Backend `backend/Kode.gs` menerima upload Base64, menyimpan berkas ke Google Drive (`ROOT_FOLDER_ID`), dan mencatat data transaksi di sheet `Payments`.
5. **Panel Verifikasi 1-Klik di Super Admin:** Super Admin SaaS memiliki tab baru *"Persetujuan Pembayaran"* untuk memeriksa preview foto bukti, menyetujui (1-klik memperpanjang masa aktif tenant dan membuka fitur pro), atau menolak (dengan alasan yang tampil di klien).

### 2.2 Non-Goals (Ditunda / Bukan Bagian Tahap 2)
1. Integrasi API resmi Midtrans / Xendit / Payment Gateway otomatis lainnya (alur saat ini menggunakan upload bukti manual terotomasi di Sheets/Drive).
2. Integrasi QRIS dinamis EMVCo dan pemesanan online ojol (GoFood, GrabFood, ShopeeFood, Qpon) — ini adalah cakupan **Tahap 3**.

### 2.3 Anti-Goals
1. **Jangan Mematikan Operasional Dasar:** Restoran trial/unpaid tidak boleh dilarang menggunakan kasir meja 1–4 dan mengelola menu dasar.
2. **Jangan Menyimpan File Gambar di Sel Spreadsheet:** Sel Google Sheets hanya menyimpan URL Google Drive atau File ID, bukan string Base64 raksasa yang dapat merusak performa spreadsheet.
3. **Jangan Menyisakan Prompt Token Lisensi Manual Offline di Non-Master:** Modal kunci pro tidak boleh lagi meminta input kode lisensi manual offline (misal `RASH-PRO-...`), melainkan mengarahkan ke form pembayaran resmi.

---

## 3. Constraints

- **Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Tailwind CSS CDN, Google Apps Script (`backend/Kode.gs`), Google Sheets Database, Google Drive Storage.
- **Zero NPM Dependencies / No Build Step:** Semua berjalan langsung di browser dan Apps Script.
- **Bahasa Indonesia:** Semua label antarmuka, pesan validasi, status transaksi, dan modal menggunakan Bahasa Indonesia yang ramah dan profesional.
- **Multi-Tenant Isolation:** Data lokal tetap dipisahkan per tenant (`getStorageKey(tenantId, ...)`), dan akun Master (`default`) selalu memiliki akses penuh tanpa kunci.
- **Headless Test Compatibility:** Seluruh logika engine dan integrasi HTML dapat diuji secara otomatis dengan JavaScriptCore (`jsc`) headless test harness.

---

## 4. Evaluasi Pendekatan (Approaches)

| Pendekatan | Deskripsi | Kelebihan | Kekurangan | Putusan |
| :--- | :--- | :--- | :--- | :--- |
| **Opsi A: Upload Bukti Bayar di Web + Verifikasi 1-Klik Super Admin** | Tenant upload foto struk ke Google Drive via REST API GAS; transaksi masuk ke sheet `Payments`; Admin klik "Setujui" di Super Admin untuk auto-aktifkan tenant. | Sangat aman dari fraud, bukti tersimpan di Drive, riwayat transaksi tercatat rapi di Sheets, struktur data 100% kompatibel untuk webhook Midtrans masa depan. | Butuh konfirmasi manual 1-klik oleh Admin RASH (tidak instan detik itu juga). | **DIPILIH** (Disetujui oleh User) |
| **Opsi B: Upload Bukti + Auto-Aktif Sementara (Grace Period 24 Jam)** | Tenant upload bukti apa saja dan langsung dapat masa aktif 24 jam sementara admin memverifikasi. | Tenant langsung bisa pakai tanpa menunggu admin. | Rawan disalahgunakan dengan upload gambar palsu/kosong secara berulang. | Ditolak |
| **Opsi C: Tombol WhatsApp Manual Saja** | Tenant hanya diarahkan chat WhatsApp admin untuk kirim struk tanpa form upload web. | Sangat sederhana. | Tidak ada log transaksi di sistem, rawan terselip di chat WA, tidak ada otomasi perpanjangan di database. | Ditolak |

---

## 5. Rincian Desain & Arsitektur Teknis

### 5.1 Skema Database Sheet `Payments` (`backend/Kode.gs`)
Header kolom pada sheet baru `Payments`:
1. `id` (e.g. `PAY-202611-ABCD`)
2. `tenantId` (e.g. `harapan-corner`)
3. `tenantName` (e.g. `Harapan Corner`)
4. `plan` (`monthly` | `lifetime`)
5. `amount` (e.g. `199000` | `2999000`)
6. `bankTarget` (e.g. `BCA (123-456-7890 a.n RASH Builder)` | `QRIS RASH`)
7. `proofFileId` (Google Drive File ID)
8. `proofUrl` (Google Drive Preview/Thumbnail URL)
9. `senderName` (Nama pemilik rekening pengirim)
10. `senderBank` (Bank asal pengirim)
11. `status` (`pending` | `verified` | `rejected`)
12. `rejectReason` (Alasan penolakan jika ditolak)
13. `createdAt` (ISO 8601 Timestamp)
14. `verifiedAt` (ISO 8601 Timestamp)
15. `verifiedBy` (`admin` / user ID)

### 5.2 Endpoints Baru di `backend/Kode.gs`
1. `doPost` action `submitPaymentProof`:
   - Akses: Publik / Tenant (tidak butuh `apiKey` admin).
   - Parameter: `{ tenantId, plan, amount, bankTarget, senderName, senderBank, imageBase64, imageMimeType, fileName }`.
   - Proses:
     - Validasi `tenantId` dan data wajib.
     - Periksa pembayaran pending aktif untuk tenant ini. Jika sudah ada pembayaran dengan status `pending`, sistem memperbarui rekaman pending tersebut (update bukti gambar & nominal) atau menolak duplikasi antrean, agar tidak terjadi penumpukan transaksi pending ganda.
     - Simpan data Base64 ke folder Google Drive (`CONFIG.ROOT_FOLDER_ID`) sebagai file gambar: `BUKTI_<tenantId>_<timestamp>.jpg`.
     - Buat baris baru di sheet `Payments` dengan status `pending` (atau perbarui baris pending sebelumnya).
     - **Catatan Penting Database State:** Status tenant di sheet `Tenants` **TIDAK DIUBAH** saat upload bukti bayar. Status `pending` murni dicatat pada baris pembayaran di sheet `Payments`. Ini mencegah tenant aktif kehilangan akses pro mendadak saat memperpanjang lebih awal, dan mencegah tenant expired mendapatkan akses gratis sebelum admin menyetujui.
   - Return: `{ success: true, paymentId, status: "pending", message: "Bukti pembayaran berhasil diunggah. Menunggu verifikasi Admin RASH." }`.
2. `doGet` action `getPayments`:
   - Akses: Terproteksi `apiKey` (Super Admin).
   - Parameter: `{ apiKey, statusFilter }`.
   - Return: `{ success: true, payments: [...] }`.
3. `doGet` action `getTenantPaymentStatus`:
   - Akses: Publik / Tenant.
   - Parameter: `{ tenantId }`.
   - Return: `{ success: true, latestPayment: { id, plan, amount, bankTarget, status, rejectReason, createdAt, proofUrl } }`.
4. `doPost` action `verifyPayment`:
   - Akses: Terproteksi `apiKey` (Super Admin).
   - Parameter: `{ apiKey, paymentId, action: "approve" | "reject", rejectReason }`.
   - Proses jika `action === "approve"`:
     - Cari baris pembayaran di sheet `Payments`, ubah `status = 'verified'`, isi `verifiedAt`, `verifiedBy`.
     - Cari tenant di sheet `Tenants`.
     - Perbarui paket tenant: `plan = payment.plan`.
     - Hitung masa aktif baru:
       - Jika `monthly`: `expiresAt` ditambah 30 hari dari tanggal sekarang (atau dari expiry lama jika saat ini masih aktif belum expired), `status = 'active'`, `isLifetime = false`.
       - Jika `lifetime`: `expiresAt = null`, `status = 'active'`, `isLifetime = true`.
     - Perbarui kuota meja kustom: `tablesCount = Math.max(Number(tenant.tablesCount) || 12, 12)` (tidak pernah menurunkan kapasitas jika sebelumnya sudah diatur lebih tinggi dari 12).
     - *Catatan:* `maxTables` tetap dihitung dinamis di sisi engine `RestoSync.getLicenseData()` (`lic.isPaidActive ? 999 : 4`), sehingga skema kolom `TENANT_HEADERS` tetap terjaga tanpa migrasi header database.
   - Proses jika `action === "reject"`:
     - Ubah `status = 'rejected'` di sheet `Payments`, isi `rejectReason`, `verifiedAt`, `verifiedBy`.
     - Status tenant di sheet `Tenants` tetap pada status aslinya tanpa perlu rollback state.
   - Return: `{ success: true, updatedTenant: {...}, paymentStatus: "verified" | "rejected" }`.

### 5.3 Engine Proteksi Fitur Pro di `assets/js/resto-sync.js`
1. **Konstanta Fitur Pro:**
   ```javascript
   RESTO_PRO_FEATURES: {
     ANALYTICS_BI: { id: "analytics_bi", name: "Analitik Bisnis & Margin Laba" },
     CRM_MEMBERS: { id: "crm_members", name: "CRM Pelanggan & Loyalty Points" },
     RESERVATIONS: { id: "reservations", name: "Manajemen Reservasi Meja Restoran" },
     EXPORT_LEDGER: { id: "export_ledger", name: "Ekspor Pembukuan Keuangan CSV/Excel" },
     BACKUP_RESTORE: { id: "backup_restore", name: "Backup & Restore Database Penuh" },
     TABLES_EXPANSION: { id: "tables_expansion", name: "Kapasitas Meja > 4 Meja Aktif" }
   }
   ```
2. **Fungsi Pemeriksaan Izin:**
   `RestoSync.isFeatureAllowed(featureId)`:
   - Mengembalikan `true` jika `lic.isMaster === true` ATAU `lic.isPaidActive === true`.
   - Mengembalikan `false` jika tenant `trial`, `pending`, `expired`, `suspended`, atau `notSynced`.
3. **Modal Penguncian Pro Modern (`showProFeatureLockedModal`):**
   - Menggantikan template modal lama yang sebelumnya memiliki input token manual `#proModalTokenInput`.
   - Menampilkan ikon gembok emas modern, nama fitur yang dikunci, penjelasan nilai bisnis fitur tersebut, dan tombol aksi utama:
     - Tombol 1: *"Langganan / Upgrade ke Resto Pro"* (membuka modal pembayaran langsung).
     - Tombol 2: *"Hubungi Tim RASH via WhatsApp"* (konsultasi).
4. **Fungsi REST API Pembayaran:**
   - `RestoSync.submitPaymentProof(payload)`
   - `RestoSync.getTenantPaymentStatus(tenantId)`
   - `RestoSync.getPaymentsAdmin()`
   - `RestoSync.verifyPaymentAdmin(paymentId, action, reason)`

### 5.4 Antarmuka Pengguna (UI/UX)

#### A. Panel Pengaturan Owner (`owner_settings_saas.html`)
1. **Gembok Visual pada 5 Modul Pro:**
   - **4 Modul Full Overlay:** `#sectionAnalyticsBI`, `#sectionCrmMembers`, `#sectionReservations`, `#sectionBackupRestore`.
     - Ketika `!isPaidActive && !isMaster`: konten section diberi class overlay gembok (`pro-feature-locked-overlay`): background semi-transparan, efek blur halus, tombol di dalam modul di-disable, serta badge elegan di tengah modul dengan tombol *"Buka Akses Pro Sekarang"*.
   - **1 Modul Parsial (Buku Kas `#sectionLedger`):**
     - Tabel riwayat transaksi & ringkasan omset harian **TETAP TERBUKA & DAPAT DILIHAT** oleh pemilik restoran non-berbayar agar operasional harian tetap terpantau.
     - Gembok pro **HANYA** diterapkan pada tombol *"Export CSV / Excel"* dengan badge `PRO` dan memicu `showProFeatureLockedModal("Ekspor Pembukuan Keuangan")` jika diklik saat belum berbayar aktif.
2. **Modal Checkout Pembayaran & Upload Bukti (`#paymentCheckoutModal`):**
   - Pilihan paket radio button:
     - **Bulanan:** `Rp 199.000 / bulan` (Fitur Pro Lengkap + Meja Unlimited).
     - **Lifetime Spesial:** ~~`Rp 3.500.000`~~ `Rp 2.999.000` (Sekali Bayar Selamanya).
   - Kotak informasi rekening resmi:
     - BCA: `123-456-7890` a.n RASH WebApp Builder.
     - Mandiri: `137-00-1234567-8` a.n RASH WebApp Builder.
     - QRIS Statis RASH.
   - Input nama pengirim & bank pengirim.
   - Drag-and-drop / file input upload foto bukti struk (dengan preview gambar instan).
   - Tombol kirim *"Kirim Bukti Pembayaran"*.
   - **Lifecycle Transaksi di Modal:**
     - Saat status `pending`: menampilkan banner kuning *"Bukti transfer Anda sedang diverifikasi oleh Tim Admin RASH. Mohon tunggu konfirmasi."*
     - Saat status `rejected`: menampilkan banner merah *"Bukti transfer sebelumnya ditolak: [Alasan Penolakan]. Silakan periksa kembali dan unggah ulang bukti yang valid."* bersama tombol *"Unggah Ulang Bukti Transfer"*.

#### B. Hub Restoran (`resto_hub.html`)
- Kartu informasi lisensi menampilkan status pembayaran terakhir jika berstatus `pending` (*Menunggu Verifikasi Pembayaran*).
- Tombol *"Perpanjang / Upgrade"* yang langsung memicu modal pembayaran.

#### C. Kasir POS (`cashier_pos_register.html`)
- Tombol *"Daftar Member Baru"* dan form *"Tambah Reservasi Meja"* pada kasir menampilkan peringatan/modal gembok pro ramah jika diklik oleh kasir tenant yang belum berbayar aktif, sementara fungsi inti kasir (meja 1–4, transaksi, kirim pesanan, bayar, cetak struk) tetap 100% lancar.

#### D. Super Admin SaaS (`super_admin_saas.html`)
- **Tab Baru: "Persetujuan Pembayaran" (`#tabPaymentsApproval`):**
  - Counter badge merah pada tab jika ada pembayaran pending (misal: `Pembayaran (2)`).
  - Tabel daftar transaksi:
    - ID Transaksi & Waktu.
    - Restoran (ID & Nama).
    - Paket Dipilih & Nominal (`Rp 199.000` / `Rp 2.999.000`).
    - Bank Pengirim & Nama Pengirim.
    - Tombol preview gambar bukti transfer (membuka modal gambar besar).
    - Tombol aksi:
      - **Setujui (Hijau):** Memicu konfirmasi 1-klik. Begitu diklik, backend GAS memperbarui database, status tenant berubah jadi `active`, masa berlaku otomatis bertambah (+30 hari atau Lifetime), dan baris berpindah ke riwayat disetujui.
      - **Tolak (Merah):** Membuka dialog input alasan penolakan (misal: *"Nominal transfer tidak sesuai"*), memperbarui status jadi `rejected`.

---

## 6. What's Left to the Builder (Keputusan Builder)
1. Penanganan kompresi foto di sisi klien (Canvas resize max 1280px) sebelum dikonversi ke Base64 agar pengiriman ke Apps Script ringan (< 1.5 MB) dan tidak melebihi kuota POST GAS.
2. Gaya CSS Tailwind untuk overlay gembok (`backdrop-blur-xs`, `border-amber-500/20`) agar serasi dengan Dual Theme (Light & Dark mode).
3. Polling interval atau tombol refresh manual status pembayaran di sisi klien untuk mendeteksi persetujuan admin secara instan.
4. Penyusunan test headless JavaScriptCore (`jsc`) yang komprehensif menguji skenario upload, verifikasi admin, penolakan admin, dan efek penguncian visual.

---

## 7. Rencana Pengujian (Test Plan Tahap 2)
1. **Test Backend (`tests/test_kode_gs_payments.js`):**
   - Submit bukti transfer menghasilkan ID file Drive & baris di sheet `Payments` dengan status `pending`.
   - Super Admin `verifyPayment` (approve) mengubah status pembayaran jadi `verified`, meng-upgrade status tenant ke `active`, dan menambah `expiresAt` (+30 hari atau lifetime).
   - Super Admin `verifyPayment` (reject) mencatat status `rejected` dan alasan penolakan.
2. **Test Core Engine (`tests/test_tahap2_payment_and_locks.js`):**
   - `RestoSync.isFeatureAllowed` bernilai `false` untuk seluruh `PRO_FEATURES` pada tenant unpaid/trial, dan `true` untuk paid/Master.
   - Flow `submitPaymentProof` dan `getTenantPaymentStatus` tersinkron.
3. **Test UI Owner Settings & Super Admin (`tests/test_owner_and_admin_payments.js`):**
   - 5 modul pro di Owner Settings memiliki atribut / overlay gembok saat `isPaidActive === false`.
   - Modal checkout menampilkan pilihan paket, validasi gambar, dan preview.
   - Super Admin menampilkan daftar bukti bayar dan tombol aksi persetujuan.
