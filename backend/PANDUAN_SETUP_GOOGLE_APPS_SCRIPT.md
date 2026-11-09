# Panduan Setup Backend: Google Apps Script & Google Sheets
## Resto Pro by RASH WebApp Builder ✨

Dokumen ini memandu Anda menghubungkan aplikasi web **Resto Pro** ke **Google Apps Script (GAS)** dan **Google Sheets** sebagai database cloud murni (*Pure REST API*).

---

## 📋 Mengapa Menggunakan Arsitektur Ini?
- **Gratis Selamanya:** Memanfaatkan kuota gratis Google Workspace / akun Gmail pribadi.
- **Database Visual:** Anda dapat melihat, mengedit, atau mencetak data penjualan langsung di Google Sheets secara live.
- **Zero-Maintenance:** Tidak perlu sewa VPS, database PostgreSQL, atau konfigurasi firewall.
- **Multi-Device Sync:** Pesanan dari ponsel tamu tersimpan langsung di Google Sheets dan terbaca di laptop kasir serta dapur secara real-time.

---

## 🚀 Langkah 1: Buat Proyek Google Apps Script Baru

1. Buka peramban (browser) dan kunjungi: **[script.google.com](https://script.google.com)** (pastikan sudah login dengan akun Google Anda).
2. Klik tombol **"+ Proyek Baru"** (*New Project*) di pojok kiri atas.
3. Beri nama proyek di kiri atas: ganti *"Proyek Tanpa Judul"* menjadi **"Resto Pro Backend API"**.

---

## 📝 Langkah 2: Salin Kode Backend (`Kode.gs`)

1. Pada editor teks Google Apps Script, hapus semua kode bawaan (`function myFunction() { ... }`).
2. Buka berkas [backend/Kode.gs](file:///Users/macbook/Documents/RASH%20WebApp/2.%20PROJECT/1.%20WebApp/app%20resto%20pro%20/backend/Kode.gs) di proyek ini.
3. Salin (**Ctrl+A** lalu **Ctrl+C**) seluruh isi kode dari berkas `Kode.gs`.
4. Tempelkan (**Ctrl+V**) ke dalam editor Google Apps Script.
5. Klik ikon **Simpan** (ikon disket atau **Ctrl+S**).

---

## ⚡ Langkah 3: Jalankan Inisialisasi Otomatis (`setupAppEnvironment`)

Fungsi ini akan secara otomatis membuat folder di Google Drive, membuat Spreadsheet database dengan 6 sheet terformat rapi, membangkitkan **API Secret Key** otorisasi admin, dan menyimpan semua ID konfigurasi:

1. Pada bilah atas editor Apps Script, di sebelah tombol *"Debug"*, terdapat dropdown pilihan fungsi yang ingin dijalankan.
2. Pilih fungsi: **`setupAppEnvironment`**.
3. Klik tombol **"Jalankan"** (*Run*).
4. **Pemberian Izin (Hanya Sekali):**
   - Akan muncul jendela popup *"Authorization Required"* ➔ Klik **"Review permissions"**.
   - Pilih akun Google Anda.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **"Advanced"** (di kiri bawah) lalu klik **"Go to Resto Pro Backend API (unsafe)"**.
   - Klik **"Allow"** untuk mengizinkan script mengakses Google Drive dan Google Sheets Anda.
5. Tunggu 5-10 detik hingga muncul status *"Execution completed"*.
6. Buka panel **Execution log** (di bawah editor):
   - Anda akan melihat tautan Google Spreadsheet dan Folder Drive yang baru dibuat.
   - Anda juga akan melihat **`🔑 API SECRET KEY : RP-SEC-XXXXXXXXXX`**. **Salin kunci ini!** (Kunci ini dipakai untuk otorisasi Kasir/Owner di aplikasi).

---

## 🌐 Langkah 4: Publikasikan (Deploy) sebagai Web App

Agar frontend Resto Pro dapat berkomunikasi dengan Google Sheets via HTTP `fetch()`:

1. Di pojok kanan atas editor Apps Script, klik tombol biru **"Deploy"** ➔ pilih **"New deployment"**.
2. Klik ikon gerigi ⚙️ di sebelah *"Select type"* ➔ pilih **"Web app"**.
3. Isi konfigurasi deployment persis seperti berikut:
   - **Description:** `Resto Pro REST API v1`
   - **Execute as:** **`Me (email Anda)`** *(Penting: jangan pilih User accessing the web app)*
   - **Who has access:** **`Anyone`** *(Penting: agar frontend dapat berkomunikasi tanpa login akun Google)*
4. Klik tombol **"Deploy"**.
5. Salin URL yang muncul di bagian **Web app URL**:
   Contoh format URL:  
   `https://script.google.com/macros/s/AKfycbzXXXXXXXXXXXXXXXXXXXXX/exec`

---

## 🔗 Langkah 5: Tempelkan Web App URL & API Secret Key ke Resto Pro

1. Buka aplikasi **Resto Pro** Anda di browser: buka [index.html](file:///Users/macbook/Documents/RASH%20WebApp/2.%20PROJECT/1.%20WebApp/app%20resto%20pro%20/index.html) atau langsung ke [owner_settings_saas.html](file:///Users/macbook/Documents/RASH%20WebApp/2.%20PROJECT/1.%20WebApp/app%20resto%20pro%20/owner_settings_saas.html).
2. Di Layar Owner SaaS, scroll ke **Section 7: Backend Google Apps Script & Google Sheets**.
3. Masukkan **Google Apps Script Web App Deployment URL** (yang berakhiran `/exec`).
4. Masukkan **API Secret Key** yang Anda dapatkan pada Langkah 3 (contoh: `RP-SEC-XXXXXXXXXX`).
5. Klik **"Simpan Konfigurasi Cloud & Kunci"**.
6. Klik tombol **"Uji Koneksi & Otorisasi Key"** ➔ sistem akan memverifikasi koneksi dan memvalidasi keaslian kunci rahasia secara otomatis.
7. Anda dapat menekan **"Upload Data Lokal ke Sheets (Push)"** untuk mengirim seluruh katalog menu dan transaksi bawaan ke spreadsheet Anda!

---

## ⚡ Langkah 5 (Paling Praktis): Auto-Connect via `assets/js/resto-config.js`

Agar Anda **tidak perlu memasukkan URL atau API Key secara manual di browser pada setiap perangkat**, Resto Pro menyediakan berkas konfigurasi sentral:

1. Buka berkas **`assets/js/resto-config.js`** di teks editor Anda.
2. Cukup isi dua baris variabel di dalamnya:
   ```javascript
   const RESTO_CLOUD_CONFIG = {
     GAS_URL: "https://script.google.com/macros/s/AKfycbz.../exec", // URL Web App Anda
     API_SECRET_KEY: "RP-SEC-XXXXXXXXXX",                         // API Key Anda
     ENABLE_AUTO_CLOUD_SYNC: true
   };
   ```
3. Simpan berkas (`Ctrl+S`).
4. **Selesai!** Seluruh layar (QR Tamu, Kasir POS, KDS Dapur, hingga Owner) akan **langsung otomatis terhubung 100%** ke Google Sheets tanpa perlu ada yang memasukkan kunci lagi di browser perangkat mana pun!

### 🔗 Opsi Alternatif: Magic Link Setup Kasir
Jika membuka di tablet kasir baru tanpa mengubah berkas kode:
1. Di layar Owner SaaS (Section 7), klik tombol **"Salin Magic Link Kasir/Dapur"**.
2. Kirim tautan tersebut via WhatsApp ke tablet kasir.
3. Begitu tautan dibuka di tablet kasir, konfigurasi cloud langsung tersimpan otomatis seketika!

---

## 🛡️ Arsitektur Keamanan: Role-Based Protection & Anti-Spam

Untuk menjaga keamanan penuh dari pihak yang tidak bertanggung jawab yang mungkin melihat URL Web App melalui *Inspect Element* browser:

1. **Pemisahan Peran (Role-Based Separation):**
   - **Tamu di Meja (Layar QR Self-Order):** Hanya memiliki hak akses publik terbatas, yaitu melihat katalog menu (`getMenuCatalog`) dan mengirim pesanan makanannya (`placeOrder`).
   - **Tamu DILARANG KERAS di Sisi Server:** Mengubah harga hidangan, menghapus menu, melihat laporan keuangan/omset, melihat data nomor telepon member CRM, atau menimpa database. Setiap percobaan memanggil aksi ini tanpa API Secret Key akan **langsung ditolak server** (`401 Unauthorized`).
2. **Kunci Rahasia Tersimpan di Script Properties:**
   - Kunci rahasia `API_SECRET_KEY` disimpan di `PropertiesService.getScriptProperties()` Google Apps Script, tidak pernah ditulis di dalam lembar Google Sheets atau di kode sumber terbuka.
3. **Anti-Spam Rate Limiter:**
   - Membatasi agar satu meja tidak bisa mengirim pesanan beruntun dalam waktu kurang dari 8 detik menggunakan `CacheService`.
4. **Cara Melihat atau Mengganti Kunci:**
   - Jika Anda lupa kuncinya, di editor Apps Script pilih fungsi **`showApiKey`** lalu klik **Run**, kunci Anda akan tercetak di Execution Log.
   - Jika ingin merotasi/mengganti kunci baru, pilih fungsi **`rotateApiKey`** lalu klik **Run**. Perbarui juga kunci di dashboard Resto Pro Anda.

---

## 📊 Struktur Sheet Database yang Dihasilkan

Setelah setup berhasil, file Google Spreadsheet Anda akan memiliki 6 sheet:

| Nama Sheet | Fungsi Data |
| :--- | :--- |
| **`AppConfig`** | Menyimpan kunci konfigurasi, ID Drive, tarif pajak PB1, dan setelan printer. |
| **`MenuCatalog`** | Master hidangan: ID, Nama, Kategori, Harga, URL Foto, Level Pedas, dan Status Stok. |
| **`Transactions`** | Riwayat transaksi kasir lunas: No Bill, Meja, Tamu, Subtotal, Diskon, Pajak, Grand Total, Metode Bayar, Kasir. |
| **`Members`** | Direktori CRM pelanggan: Nama, WhatsApp, Tier, Saldo Poin Loyalitas, Total Kunjungan & Belanja. |
| **`Reservations`** | Jadwal booking meja tamu: ID Res, Meja, Tamu, WhatsApp, Tanggal, Jam, Pax, Catatan & Pre-orders. |
| **`KdsTickets`** | Antrean tiket pesanan dapur yang sedang dimasak dan disiapkan. |

---

## ❓ FAQ & Troubleshooting

### 1. Muncul error CORS saat melakukan fetch dari frontend
- Pastikan saat Deploy Web App Anda memilih **Who has access: "Anyone"**. Jika memilih *"Only myself"*, browser akan memblokir request.
- Pastikan URL yang digunakan berakhiran `/exec`, bukan `/edit`.

### 2. Saya mengubah kode di `Kode.gs`, tapi perubahannya belum terlihat
- Di Google Apps Script, setiap kali Anda mengubah kode, Anda harus membuat versi baru:  
  Klik **Deploy** ➔ **Manage deployments** ➔ Klik ikon pensil ✏️ ➔ Ubah Version ke **"New version"** ➔ Klik **Deploy**.

### 3. Apakah data tetap aman jika internet di resto terputus?
- **YA, 100% AMAN!** Resto Pro menggunakan arsitektur *Hybrid Offline-First*. Jika jaringan internet padam, aplikasi kasir dan QR tetap berjalan lancar menggunakan penyimpanan lokal browser (`localStorage`). Begitu koneksi internet pulih, kasir dapat menekan tombol sinkronisasi untuk mem-push data ke Google Sheets.
