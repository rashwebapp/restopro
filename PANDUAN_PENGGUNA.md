# Buku Panduan Pengguna Lengkap (User Manual)
## Resto Pro by RASH WebApp Builder ✨

> **Aplikasi Web POS Restoran, QR Self-Order, KDS Dapur & SaaS Management Terpadu**  
> Edisi Khusus: Kuliner Fusi Timur Tengah (Arab) 🕌, Malaysia 🇲🇾, Thailand 🇹🇭 & Minuman Artisan 🍹.

---

## DAFTAR ISI
1. [Pendahuluan & Konsep Arsitektur](#1-pendahuluan--konsep-arsitektur)
2. [Layar 1: Tamu QR Self-Order & Reservasi Meja](#2-layar-1-tamu-qr-self-order--reservasi-meja)
3. [Layar 2: POS Kasir, Denah 12 Meja & Tender Pembayaran](#3-layar-2-pos-kasir-denah-12-meja--tender-pembayaran)
4. [Layar 3: Monitor Dapur Kitchen Display System (KDS)](#4-layar-3-monitor-dapur-kitchen-display-system-kds)
5. [Layar 4: Dashboard Owner SaaS, Business Intelligence & Backup](#5-layar-4-dashboard-owner-saas-business-intelligence--backup)
6. [Panduan Operasional Kasir Sehari-hari](#6-panduan-operasional-kasir-sehari-hari)
7. [Manajemen CRM Member & Poin Loyalitas](#7-manajemen-crm-member--poin-loyalitas)
8. [Manajemen Katalog Menu & Live Stock](#8-manajemen-katalog-menu--live-stock)
9. [Sistem Reservasi & Booking Jadwal Meja](#9-sistem-reservasi--booking-jadwal-meja)
10. [Pencadangan (Backup) & Pemulihan (Restore) Database](#10-pencadangan-backup--pemulihan-restore-database)
11. [Panduan Deployment ke Internet (GitHub Pages, Vercel, Netlify)](#11-panduan-deployment-ke-internet)

---

## 1. Pendahuluan & Konsep Arsitektur

Resto Pro dirancang khusus untuk memecahkan masalah kelambatan operasional restoran kasual dan modern. Aplikasi ini menggunakan arsitektur **Zero-Dependency Vanilla JavaScript**, artinya:
- **Tanpa Instalasi Backend Rumit:** Tidak memerlukan Node.js, PHP, MySQL, atau Docker. Cukup buka di browser (Chrome, Edge, Safari).
- **Sinkronisasi Real-Time Otomatis:** Menggunakan teknologi modern `BroadcastChannel API` dan fallback `StorageEvent Listener` di browser. Pesanan dari ponsel tamu langsung muncul di layar dapur dan kasir seketika tanpa perlu memuat ulang (*0ms lag*).
- **PWA (Progressive Web App):** Dapat diinstal sebagai aplikasi mandiri di tablet kasir (Windows / iPad / Android) dan smartphone staf.
- **Dual Theme Support:** Mendukung mode **Light Mode** (krem gading, safron emas, terakota hangat) dan **Dark Mode** (#0F172A slate kontras tinggi) dengan sakelar matahari/bulan.

---

## 2. Layar 1: Tamu QR Self-Order & Reservasi Meja
**Berkas:** `customer_qr_self_order.html`

### A. Membuka Meja Tertentu Melalui QR Code
Setiap meja di restoran dapat ditempelkan stiker QR code yang mengarah langsung ke URL dengan parameter meja:
- Meja 01: `customer_qr_self_order.html?table=T01`
- Meja 05: `customer_qr_self_order.html?table=T05`
- Meja 07 (Outdoor Garden): `customer_qr_self_order.html?table=T07`
- Meja 11 (VIP Room): `customer_qr_self_order.html?table=T11`

*Tips Uji Coba:* Tamu atau penguji juga dapat mengetuk indikator meja di bagian atas layar untuk memunculkan jendela pemilih meja (Meja 01 s/d 12).

### B. Menjelajahi Menu & Kategori
1. Geser bilah kategori (*Category Pills*): **Semua Menu**, **Arabian Delights 🕌**, **Malaysian Favorites 🇲🇾**, **Thai Specialties 🇹🇭**, dan **Artisan Drinks 🍹**.
2. Gunakan kolom pencarian langsung untuk mencari nama hidangan (contoh: ketik *"mandhi"* atau *"laksa"*).
3. Perhatikan badge status:
   - 🌶️ **Tingkat Pedas:** Ikon cabai menunjukkan level kepedasan khas.
   - 🚫 **Badge "Sold Out":** Menu yang stoknya habis di dashboard Owner akan otomatis tertutup overlay buram dan tombol *"+ Tambah"* dinonaktifkan.

### C. Kustomisasi Hidangan (Modifier Modal)
Saat mengetuk hidangan makanan atau minuman:
1. **Tingkat Pedas:** Pilih Level 0 (Tidak Pedas), Level 1 s/d Level 5 (Ekstra Pedas Menggelegar).
2. **Porsi Nasi:** Pilih Nasi Reguler atau Nasi Extra (+ Rp 5.000).
3. **Suhu Minuman:** Pilih Panas (*Hot*), Dingin Sedang (*Less Ice*), atau Dingin Normal.
4. **Catatan Khusus:** Ketik instruksi khusus untuk koki (contoh: *"kuah dipisah"*, *"tanpa bawang goreng"*).
5. Klik **"Tambah ke Pesanan"**.

### D. Checkout & Kirim Pesanan ke Dapur
1. Di bagian bawah layar terdapat **Sticky Cart Bar** yang menampilkan jumlah porsi dan total harga sementara.
2. Ketuk tombol **Checkout**.
3. Masukkan **Nama Pemesan** dan **Nomor WhatsApp**.
4. Periksa ringkasan rincian tagihan (Subtotal + PB1 10%).
5. Ketuk **"Kirim Pesanan ke Dapur"**.
6. Pesanan seketika terkirim ke KDS Dapur dan meja Anda di Kasir berubah warna merah.

### E. Reservasi Meja dari Smartphone Tamu
1. Ketuk ikon kursi (`event_seat`) di pojok kanan atas header.
2. Pilih Ruangan (*Indoor AC, Outdoor Garden, VIP Private Room*).
3. Pilih Tanggal dan Jam Kedatangan (Makan Siang / Makan Malam).
4. Masukkan Jumlah Orang (*Pax*), Nama, WhatsApp, dan catatan acara (arisan, ultah, baby chair).
5. Ketuk **"Konfirmasi Booking Meja"**. Permintaan langsung masuk ke POS Kasir dan Owner.

### F. Panggil Pelayan (Call Waiter)
Ketuk tombol bel pelayan (`room_service`) di header. Lonceng dapur dan notifikasi kasir akan berdering seketika.

---

## 3. Layar 2: POS Kasir, Denah 12 Meja & Tender Pembayaran
**Berkas:** `cashier_pos_register.html`

### A. Tampilan Denah 12 Meja Interaktif
Terdiri dari 12 meja yang merepresentasikan denah lantai resto:
- **Meja 01 – 06:** Ruang Utama Indoor AC (2 – 6 kursi).
- **Meja 07 – 10:** Nuansa Taman Terbuka Outdoor Garden (4 – 8 kursi).
- **Meja 11 – 12:** Ruang Rapat & Jamuan VIP Private Room (6 – 8 kursi).

#### Arti Kode Warna Meja:
| Warna | Status | Penjelasan |
| :--- | :--- | :--- |
| **Hijau (Emerald)** | *Kosong* | Meja bersih dan siap menerima tamu baru. |
| **Merah (Crimson)** | *Terisi* | Tamu sedang makan. Menampilkan total rupiah berjalan. |
| **Kuning (Amber Pulse)** | *Bill* | Tamu telah selesai makan dan meminta tagihan kasir. |
| **Ungu (Indigo)** | *Booking* | Meja memiliki jadwal reservasi aktif hari ini. |

*Gunakan tombol filter pill meja:* **Semua (12)**, **Kosong**, **Terisi**, **Bill**, dan **Booking** untuk memfilter denah meja seketika.

### B. Memproses Tiket & Input Pesanan Kasir
1. Ketuk salah satu meja di denah (contoh: Meja 03).
2. Panel tiket sebelah kanan akan menampilkan nomor meja dan daftar pesanan.
3. Untuk menambah menu pesanan manual dari kasir, ketuk ubin makanan pada kolom tengah (*Quick-Touch Food Tiles*).
4. Ubah kuantitas dengan tombol `+` atau `-`.

### C. Menghubungkan Member CRM & Diskon Kasir
1. Pada kotak **Pelanggan & CRM Member**, ketik nama atau nomor WhatsApp tamu (contoh: ketik *"0812"* atau *"Kevin"*).
2. Pilih member dari daftar autocomplete yang muncul. Saldo poin loyalitas dan tier member (VIP Gold / VIP Silver) akan ditampilkan.
3. Atau pilih diskon langsung dari dropdown:
   - *VIP Gold Member:* Diskon 10%
   - *VIP Silver Member:* Diskon 5%
   - *Promo Spesial:* Diskon 15%
4. Jika pelanggan belum terdaftar, kasir dapat langsung menekan **"+ Member Baru"** untuk mendaftarkannya tanpa keluar dari kasir.

### D. Fitur Split Bill (Bagi Rata Tagihan)
1. Ketuk tombol **Split Bill** di bawah tiket.
2. Atur jumlah orang yang ingin membagi tagihan (2 hingga 10 orang).
3. Sistem secara otomatis menghitung pecahan rupiah per orang hingga nominal terkecil.

### E. Proses Pembayaran (Tender) & Cetak Struk
1. Ketuk tombol hijau besar **"Bayar Sekarang (Tender)"**.
2. Pilih metode pembayaran:
   - **Tunai / Cash:**
     * Gunakan tombol nominal cepat: *Uang Pas*, *Rp 50.000*, *Rp 100.000*, *Rp 200.000*, *Rp 500.000*.
     * Atau ketik nominal uang yang diterima.
     * Sistem secara otomatis menghitung **Uang Kembalian** dengan teks hijau tebal.
   - **QRIS Dinamis:**
     * Menampilkan QRIS standar QRIS Nasional untuk di-scan oleh e-wallet (GoPay, OVO, Dana, BCA).
   - **Kartu Debit / EDC:**
     * Masukkan 4 digit terakhir kartu dan nomor referensi mesin EDC.
3. Ketuk **"Konfirmasi Lunas & Cetak Struk"**.
4. Kotak dialog printer browser akan terbuka terformat rapi sesuai ukuran kertas thermal 80mm atau 58mm.
5. Meja yang telah dibayar otomatis kembali berstatus **Kosong (Hijau)**.

### F. Riwayat Transaksi Lampau & Cetak Ulang Struk
1. Ketuk tombol **"Riwayat Struk"** di header kasir.
2. Pilih preset tanggal: **Hari Ini**, **Kemarin**, **7 Hari Terakhir**, **Bulan Ini**, **Semua**, atau **Pilih Tanggal Tertentu**.
3. Cari berdasarkan nama tamu atau nomor bill (contoh: *"BILL-1001"*).
4. Ketuk tombol **"Reprint"** untuk mencetak salinan struk kasir lampau (*Receipt Copy*).

### G. Laporan Tutup Shift Kasir (Z-Report)
Ketuk tombol **"Tutup Shift (Z-Report)"** di header kanan atas. Sistem merangkum total transaksi yang diselesaikan kasir hari itu dan otomatis mengekspor buku kas ke berkas CSV.

---

## 4. Layar 3: Monitor Dapur Kitchen Display System (KDS)
**Berkas:** `kitchen_display_kds.html`

Layar ini diletakkan pada tablet atau TV Android di area dapur/bar restoran:
1. **Pemberitahuan Suara Otomatis:** Setiap ada pesanan masuk dari QR atau Kasir, lonceng dapur 2-nada Web Audio API otomatis berbunyi.
2. **Filter Station Memasak:**
   - **Semua Station:** Memantau seluruh tiket resto.
   - **Dapur Utama:** Khusus hidangan makanan berat (Arabian Mandhi, Malaysian Lemak/Kari, Thai Tom Yum).
   - **Bar Minuman:** Khusus barista minuman (Teh Tarik, Thai Tea, Qahwa Arabika, Jus Kurma).
3. **Alur Status Tiket:**
   - **Baru (Bingkai Hijau):** Tiket baru masuk, koki bersiap.
   - **Mulai Masak (Bingkai Kuning):** Koki menekan tombol *"Mulai Masak"*. Timer terus berjalan. Status di ponsel tamu berubah menjadi *"Sedang Dimasak"*.
   - **Siap Saji (Bingkai Hijau Tua):** Koki menekan *"Siap Saji"*. Bel berbunyi di ponsel tamu dan kasir memberitahukan pelayan untuk mengantar makanan.
   - **Sajikan / Clear:** Tiket diselesaikan dan diarsipkan dari layar dapur.
4. **Peringatan Keterlambatan (Overdue Alert):** Jika tiket belum disajikan lebih dari 15 menit, bingkai tiket otomatis berubah menjadi merah berdenyut (*Red Pulse*) sebagai tanda prioritas darurat.

---

## 5. Layar 4: Dashboard Owner SaaS, Business Intelligence & Backup
**Berkas:** `owner_settings_saas.html`

### A. Lisensi RASH Enterprise & KPI Resto
- Menampilkan status lisensi SaaS Enterprise (12 meja aktif, garansi support s/d 2028).
- Validator aktivasi token lisensi via RASH Keynode.
- Kartu statistik performa omset hari ini, struk terbit, rata-rata belanja tamu (*ticket size*), dan okupansi meja.

### B. Business Intelligence & Sales Analytics (Section 2B)
- **Hourly Peak Hours Heatmap:** Grafik batang sebaran omset dari pukul 08:00 hingga 22:00 WIB untuk mengidentifikasi jam tersibuk makan siang (*lunch rush*) dan makan malam (*dinner rush*).
- **Top 5 Best-Sellers Leaderboard:** Peringkat 5 hidangan paling laris beserta total porsi dan total rupiah omsetnya.
- **Pangsa Penjualan Kuliner:** Persentase perolehan omset masakan Arab vs Malaysia vs Thailand vs Minuman Artisan.
- **Metode Pembayaran Terfavorit:** Grafik persentase transaksi Tunai vs QRIS vs Kartu Debit.
- **AI Smart Insights Engine:** Analisis kecerdasan bisnis otomatis yang memberikan rekomendasi stok bahan baku, promo jam sepi, dan penambahan staf koki.

### C. Buku Kas Transaksi Multi-Hari (Section 1)
- Filter riwayat penjualan berdasarkan tanggal.
- Tombol **"Ekspor Laporan (CSV / Excel)"** untuk pembukuan akuntansi.

### D. Manajemen Produk & Menu Dinamis (Section 2)
- Tambah menu baru dengan foto URL, harga, kategori, dan deskripsi.
- Tombol sakelar **Tersedia / Habis** langsung memperbarui status menu di HP tamu secara real-time.
- Edit harga dan hapus menu dengan konfirmasi aman.

### E. Direktori Pelanggan & CRM Member (Section 3)
- Database nomor WhatsApp, riwayat kunjungan, saldo poin loyalitas, dan status keanggotaan.
- Tambah dan edit data profil pelanggan.

### F. Manajemen Reservasi Meja (Section 5)
- Pantau seluruh jadwal booking meja tamu hari ini maupun hari mendatang.
- Tombol **Check-in Tamu** untuk mendudukkan tamu saat tiba di restoran.
- Tombol **Batalkan Booking** jika tamu tidak hadir.

### G. Pencadangan & Pemulihan Database JSON (Section 6)
- **Unduh Cadangan JSON:** Mengunduh seluruh transaksi, menu, member, dan tiket ke file `.json`.
- **Pulihkan Berkas JSON:** Mengunggah file cadangan untuk memulihkan seluruh data resto tanpa internet.
- **Reset Demo Pabrik:** Mengembalikan seluruh data ke data awal bawaan jika ingin memulai pelatihan baru.

### H. Backend Google Apps Script & Google Sheets Cloud (Section 7)
- **Koneksi Database Cloud Google Sheets:** Menghubungkan Resto Pro ke Google Sheets sebagai database utama melalui Web App Google Apps Script (`backend/Kode.gs`).
- **Keamanan Berlapis (Role-Based & API Secret Key):** Melindungi data resto dengan otorisasi kunci rahasia. Tamu di meja hanya diizinkan melihat menu dan mengirim pesanan meja, sedangkan aksi admin (CRUD menu, hapus data, melihat laporan keuangan) terkunci rapat.
- **Uji Koneksi & Validasi Key:** Memeriksa status URL Apps Script dan keabsahan API Secret Key.
- **Upload Data ke Sheets (Push):** Mengunggah seluruh katalog menu, transaksi, pelanggan, reservasi, dan tiket lokal ke Google Sheets dalam sekali klik.
- **Tarik Data dari Sheets (Pull):** Mengunduh seluruh data terbaru dari Google Sheets ke browser kasir dan owner secara instan.
- **Panduan Setup Lengkap:** Tersedia di berkas [backend/PANDUAN_SETUP_GOOGLE_APPS_SCRIPT.md](backend/PANDUAN_SETUP_GOOGLE_APPS_SCRIPT.md).

---

## 6. Integrasi Backend Google Apps Script & Google Sheets
Resto Pro dilengkapi backend Google Apps Script murni REST API (`backend/Kode.gs`) yang otomatis membuat folder Google Drive dan Google Spreadsheet lengkap dengan 6 lembar kerja (*sheet*):
1. **`AppConfig`**: Menyimpan nama restoran, logo, tarif PB1 (10%), service charge, dan status lisensi RASH.
2. **`MenuCatalog`**: Katalog 13 hidangan autentik Arab, Malaysia, Thailand & Artisan Drink lengkap dengan harga, foto, dan status ketersediaan.
3. **`Transactions`**: Seluruh data transaksi penjualan kasir (nomor bill, meja, nama tamu, rincian menu, metode pembayaran, diskon CRM, waktu transaksi).
4. **`Members`**: Database CRM pelanggan loyal, nomor WhatsApp, tier VIP, total kunjungan, dan saldo poin.
5. **`Reservations`**: Buku besar reservasi meja tamu (waktu booking, jumlah kursi, zona meja, status check-in).
6. **`KdsTickets`**: Antrean tiket pesanan dapur secara real-time.

> 💡 **Panduan Instalasi Langkah-demi-Langkah**: Buka berkas [backend/PANDUAN_SETUP_GOOGLE_APPS_SCRIPT.md](backend/PANDUAN_SETUP_GOOGLE_APPS_SCRIPT.md) untuk petunjuk langkah demi langkah mulai dari copy-paste script, 1-klik `setupAppEnvironment()`, hingga deploy Web App.

---

## 7. Panduan Deployment ke Internet

Aplikasi Resto Pro siap diunggah ke layanan hosting gratis maupun berbayar dalam hitungan menit:

### Opsi 1: GitHub Pages (Gratis & Cepat)
1. Buat repositori baru di GitHub (contoh: `resto-pro-pos`).
2. Masukkan seluruh file proyek ke repositori tersebut:
   ```bash
   git init
   git add .
   git commit -m "Initial Resto Pro Release"
   git branch -M main
   git remote add origin https://github.com/USERNAME/resto-pro-pos.git
   git push -u origin main
   ```
3. Di GitHub, buka menu **Settings** ➔ **Pages**.
4. Pada bagian **Branch**, pilih `main` dan folder `/(root)`, lalu klik **Save**.
5. Tunggu 1 menit, situs Anda sudah online di:  
   `https://USERNAME.github.io/resto-pro-pos/`

### Opsi 2: Vercel / Netlify (Drag & Drop)
1. Buka situs [vercel.com](https://vercel.com) atau [netlify.com](https://netlify.com).
2. Tarik (*drag and drop*) seluruh folder `app resto pro` ke jendela dashboard Netlify / Vercel.
3. Aplikasi Anda langsung aktif dengan domain HTTPS gratis!

---

## 8. Pusat Bantuan & Kontak Dukungan
Untuk kustomisasi menu, penambahan kuota meja, integrasi hardware printer thermal Bluetooth atau mesin EDC, silakan hubungi tim engineer:
- **WhatsApp Support:** [+62 812-XXXX-RASH](https://wa.me/6281200000000)
- **Pengembang:** RASH WebApp Builder ✨
- **Jaminan SLA:** < 15 Menit Tanggap Darurat Kasir
