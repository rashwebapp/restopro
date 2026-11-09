# Desain Spesifikasi: Resto Pro by RASH WebApp Builder

Aplikasi Web Restaurant POS & QR Self-Order Touch-Friendly modern yang mengkhususkan diri pada masakan fusi autentik Timur Tengah (Arab), Malaysia, dan Thailand, serta minuman artisan.

---

## 1. Ringkasan & Tujuan Produk
- **Nama Aplikasi:** Resto Pro by RASH WebApp Builder ✨
- **Fokus Kuliner:** Fusi Autentik Timur Tengah (Arab), Malaysia, Thailand, & Minuman Artisan.
- **Tujuan:** Menyediakan pengalaman pemesanan mandiri nirsentuh tamu (QR Self-Order di ponsel) yang terhubung mulus dengan sistem kasir tablet/desktop (POS Register & Table Map).
- **Format Antarmuka:** 
  1. *Customer QR Self-Order Screen* (Tampilan Mobile 375–430px dengan Bottom Sheet, Filter Kategori, & Floating Cart).
  2. *Cashier POS Register & Table Map* (Tampilan Tablet/Desktop Landscape 1024–1440px+ dengan visual 12 meja, katalog ubin sentuh cepat, tiket struk kasir, dan pembayaran terpadu).
  3. *Hub Showcase / Device Frame Simulator* (`index.html`) yang memungkinkan pergantian mode perangkat langsung (Mobile Simulator vs Desktop Tablet POS) serta beralih Light/Dark mode.

---

## 2. Tema & Sistem Visual (Dual Theme Engine)
Sistem mendukung perpindahan instan via tombol Sun/Moon toggle (tersimpan di `localStorage`):

### A. Warm Light Mode
- **Background Utama:** Creamy Ivory / Warm Sand (`#FDFBF7`, `#F7F4EE`)
- **Permukaan Kartu/Container:** Pure White (`#FFFFFF`) & Soft Warm Cream (`#F4EFE6`)
- **Aksen Primer & Brand:** Terracotta Warm Saffron Gold (`#C2410C` / `#D97706`)
- **Status & Konfirmasi:** Forest Green (`#059669` / `#047857`)
- **Tipografi:** Teks Charcoal Hangat (`#1C1917`) & Muted Slate (`#78716C`)

### B. High-Contrast Modern Dark Mode
- **Background Utama:** Obsidian Slate (`#0F172A`)
- **Permukaan Kartu/Container:** Muted Steel Slate (`#1E293B`) & Elevated Dark Surface (`#334155`)
- **Aksen Primer & Glow:** Warm Glowing Amber Gold (`#F59E0B`)
- **Status & Konfirmasi:** Emerald Mint (`#10B981`)
- **Border:** Halus bergradasi (`rgba(255, 255, 255, 0.08)` hingga `#334155`)
- **Tipografi:** Crisp White (`#F8FAFC`) & Slate Gray (`#94A3B8`)

---

## 3. Data Menu & Kategori Dummy

### 1. Middle Eastern (Arabian Delights 🕌)
1. **Nasi Mandhi Daging Kambing (Mandhi Lamb Rice)** - Rp 65.000
   - Deskripsi: Nasi basmati bumbu rempah saffron dengan daging kambing panggang oven empuk beraroma kayu arang.
   - Pilihan: Porsi Nasi (Regular / Extra +Rp 10.000), Level Pedas (Lvl 0 - 5).
2. **Shawarma Ayam Panggang (Grilled Chicken Shawarma)** - Rp 35.000
   - Deskripsi: Daging ayam panggang berempah lada arab, acar mentimun, saus toum bawang putih di dalam balutan roti pita garing.
   - Pilihan: Level Pedas (Lvl 0 - 5), Extra Toum Garlic Sauce (+Rp 5.000).
3. **Sambosa Daging Keju (Beef & Cheese Samosa 3pcs)** - Rp 25.000
   - Deskripsi: Tiga pastry segitiga garing isi cacahan daging sapi cincang bumbu jintan dan lelehan keju mozzarella.
   - Pilihan: Level Pedas (Lvl 0 - 5).

### 2. Malaysian Favorites 🇲🇾
4. **Nasi Lemak Sambal Sotong Special** - Rp 45.000
   - Deskripsi: Nasi kukus santan pandan wangi disajikan dengan sambal cumi sotong pedas manis, kacang, teri krispi, dan telur rebus.
   - Pilihan: Porsi Nasi (Regular / Extra +Rp 7.000), Level Pedas (Lvl 0 - 5).
5. **Roti Canai Kari Daging (Flaky Flatbread with Beef Curry)** - Rp 30.000
   - Deskripsi: Roti canai renyah berlapis khas mamak disajikan dengan semangkuk kuah kari daging sapi kental kaya rempah.
   - Pilihan: Level Pedas (Lvl 0 - 5), Tambah 1 Keping Roti (+Rp 10.000).
6. **Laksa Penang Kuah Kental** - Rp 42.000
   - Deskripsi: Mie beras dalam kaldu ikan asam pedas kaya bunga kecombrang, daun kesum, nanas segar, dan udang.
   - Pilihan: Level Pedas (Lvl 0 - 5).

### 3. Thai Specialties 🇹🇭
7. **Tom Yum Goong Seafood Kuah Merah (Hot & Sour Seafood Soup)** - Rp 55.000
   - Deskripsi: Sup asam pedas Thailand dengan udang jumbo segar, cumi, jamur merang, serai, dan daun jeruk purut.
   - Pilihan: Level Pedas (Lvl 0 - 5), Tambah Nasi Melati (+Rp 6.000).
8. **Pad Thai Udang Jumbo (Stir-fried Noodles with Jumbo Prawns)** - Rp 48.000
   - Deskripsi: Kwetiau tumis khas Bangkok dengan asam jawa asli, telur bebek, tauge renyah, udang besar, dan taburan kacang tanah sangrai.
   - Pilihan: Level Pedas (Lvl 0 - 5).
9. **Mango Sticky Rice Santan Kental** - Rp 32.000 (**STATUS: Sold Out**)
   - Deskripsi: Ketan putih pulen dengan irisan mangga manis harum manis dan siraman santan kental gurih berwijen.
   - Badge: Overlay elegan `Sold Out` (tidak dapat ditambahkan ke keranjang).

### 4. Signature Beverages 🍹
10. **Authentic Teh Tarik Buih Melimpah** - Rp 18.000
    - Pilihan: Suhu (Panas / Es Normal / Sedikit Es), Tingkat Manis (Normal / Sedikit Manis).
11. **Thai Green Tea Susu Asli** - Rp 22.000
    - Pilihan: Suhu (Es Normal / Sedikit Es), Topping Jelly (+Rp 4.000).
12. **Qahwa Arabika Rempah Kapulaga (Arabic Spiced Coffee)** - Rp 25.000
    - Pilihan: Suhu (Panas Tradisional), Manis (Gula Pisah / Manis Sedang).
13. **Jus Kurma Susu Madu Segar** - Rp 24.000
    - Pilihan: Suhu (Dingin Segar).

---

## 4. Spesifikasi Layar 1: Customer QR Self-Order Screen (Mobile)
- **Header:** Logo Resto Pro, Indikator `Table 05 • Dine-in (Indoor AC)` dengan dot berkedip, tombol toggle Sun/Moon Dark/Light Mode, tombol Panggil Pelayan (Call Waiter bell).
- **Filter Kategori Horisontal (Pills):**
  - All Menu
  - Arabian Delights 🕌
  - Malaysian Favorites 🇲🇾
  - Thai Specialties 🇹🇭
  - Artisan Drinks 🍹
- **Grid Menu 2-Kolom:**
  - Foto hidangan resolusi tinggi yang menggugah selera.
  - Nama hidangan + deskripsi ringkas.
  - Ikon tingkat kepedasan (🌶️ / 🌶️🌶️).
  - Label harga berformat rupiah (`Rp 65.000`).
  - Tombol aksi "+ Tambah" (atau overlay `Habis / Sold Out` pada Mango Sticky Rice).
- **Modal Modifier Interaktif (Bottom Sheet):**
  - Foto & nama hidangan + harga dasar.
  - Pilihan Level Pedas (Pills: Lvl 0, Lvl 1, Lvl 2, Lvl 3, Lvl 4, Lvl 5 🔥).
  - Pilihan Porsi Nasi (Regular / Extra Porsi +Rp 10.000).
  - Pilihan Suhu Minuman (Panas / Sedikit Es / Es Normal).
  - Kolom Catatan Masak (contoh: "Tanpa bawang merah, kuah dipisah").
  - Stepper kuantitas (- / count / +) dan tombol `Tambah ke Pesanan • Rp XX.000`.
- **Sticky Bottom Floating Cart Bar:**
  - Menampilkan jumlah item & total harga rupiah.
  - Tombol `Lihat Keranjang (Checkout)`.
  - Animasi slide-up saat ada item di keranjang.
- **Modal Checkout Lengkap:**
  - Rincian item dengan modifier yang dipilih.
  - Input Nama Pelanggan & Nomor WhatsApp (mendapatkan poin loyalitas Resto Pro +150 Pts & nota digital via WA).
  - Rincian Subtotal, Pajak Restoran PB1 10%, dan Total Akhir.
  - Tombol konfirmasi `🚀 Kirim Pesanan ke Dapur (Meja 05)`.
  - Notifikasi Toast konfirmasi sukses pengiriman.

---

## 5. Spesifikasi Layar 2: Cashier POS Register & Table Map (Tablet/Desktop)
- **Top Bar:** 
  - Brand "Aplikasi Resto Pro by RASH WebApp Builder ✨"
  - Status Kasir: "Kasir: Siti Aminah • Shift 1 (08:00 - 16:00)"
  - Status Koneksi: "Online & Cloud Synced"
  - Toggle Dark/Light Mode (Sun/Moon).
- **Kolom Kiri: Visual 12 Meja Interaktif (Floor & Table Map):**
  - Meja 01 s/d 12 dengan status visual jelas:
    - **Hijau (Kosong / Tersedia):** Siap ditempati tamu baru.
    - **Merah (Aktif Open Bill):** Menampilkan running total rupiah & waktu duduk (contoh: Meja 03: Rp 145.000 - 32m).
    - **Kuning (Minta Tagihan / Bill Requested):** Tamu meminta pembayaran segera.
  - Klik meja langsung memuat pesanan aktif meja tersebut ke panel struk kasir!
- **Kolom Tengah: Quick-Touch Menu Catalog:**
  - Tab kategori cepat: [Semua, Arabian Delights, Malaysian, Thai, Minuman].
  - Bar pencarian instan (live search menu).
  - Ubin makanan responsif dengan foto, nama, badge pedas, dan tombol sentuh cepat `+ Tambah` yang langsung memasukkan item ke struk kasir.
- **Kolom Kanan: Order Ticket & Checkout Panel:**
  - Header tiket: Nomor Meja terpilih (contoh: Meja 05) & ID Transaksi.
  - Daftar baris pesanan dengan kuantitas, harga, catatan modifier, dan tombol hapus/ubah qty.
  - Input Diskon Promosi & CRM Member Lookup via nomor telepon.
  - Ringkasan Finansial: Subtotal, Diskon, Pajak Restoran PB1 10%, Total Pembayaran.
  - Tombol Aksi Cepat Kasir:
    - `Split Bill` (Bagi Tagihan).
    - `Kirim ke Dapur / KDS`.
    - `Bayar Sekarang` -> Membuka Modal Pembayaran Terintegrasi.
- **Modal Pembayaran Kasir (Tender & Checkout Modal):**
  - Pilihan metode: **Tunai (Cash)** dengan kalkulator kembalian otomatis & pecahan uang cepat (Rp 50.000, Rp 100.000, Uang Pas), **QRIS Dinamis** dengan QR code display, dan **Debit / Kartu EDC**.
  - Tombol `Selesaikan & Cetak Struk Kasir` (memicu format cetak struk thermal 58mm/80mm siap print).

---

## 6. Berkas & Struktur Proyek
- `index.html`: Showcase portal terpadu dengan switcher live preview (Mobile View vs Tablet/Desktop View) & dokumentasi fitur.
- `customer_qr_self_order.html`: Layar mandiri QR Self-Order pelanggan (Mobile View responsif).
- `cashier_pos_register.html`: Layar mandiri Kasir POS & Peta Meja (Tablet/Desktop Landscape responsif).
- `assets/js/resto-data.js`: Data store terpadu menu masakan Arab, Malaysia, Thai, minuman artisan, status 12 meja, dan fungsi format mata uang.
- `assets/css/resto-theme.css`: Variabel CSS untuk Dual-Theme (Light Ivory & Modern Dark Slate) serta animasi interaksi touch.
