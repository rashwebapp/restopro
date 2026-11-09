# Resto Pro by RASH WebApp Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi web Restaurant POS & QR Self-Order modern, responsif, dan touch-friendly ("Resto Pro by RASH WebApp Builder") untuk masakan fusi Timur Tengah (Arab), Malaysia, dan Thailand, serta minuman artisan dengan Dual Theme (Warm Light Mode & Modern Dark Mode).

**Architecture:** Arsitektur modular berbasis client-side web application dengan Tailwind CSS, Material Symbols, dan vanilla JavaScript murni (tanpa dependensi berat). Terdiri dari modul data terpusat (`assets/js/resto-data.js`), stylesheet tema adaptif (`assets/css/resto-theme.css`), dua aplikasi mandiri (`customer_qr_self_order.html` & `cashier_pos_register.html`), serta showcase hub terpadu (`index.html`) yang memiliki simulator frame perangkat (Mobile Phone vs Tablet/Desktop POS).

**Tech Stack:** HTML5, CSS3, Tailwind CSS (via CDN with custom color extensions), Google Fonts (Plus Jakarta Sans & Inter), Google Material Symbols Outlined, Vanilla JavaScript ES6+.

**Spec:** `docs/superpowers/specs/2026-11-08-resto-pro-pos-design.md`

## Global Constraints
- **Dual Theme Support:** Warm Light Mode (`#FDFBF7`, aksen saffron emas `#D97706`, terracotta `#C2410C`, hijau hutan `#059669`) dan High-Contrast Modern Dark Mode (`#0F172A`, surface slate `#1E293B`, glowing gold `#F59E0B`, emerald `#10B981`).
- **Toggle Mode Gelap:** Tombol Sun/Moon selalu dapat diakses di header/floating bar dan tersimpan persisten di `localStorage`.
- **Menu Items Verbatim:** Semua 13 item menu, harga (Rp 65.000, Rp 35.000, dst), deskripsi, indikator pedas 🌶️, dan status "Sold Out" pada Mango Sticky Rice harus ditampilkan persis sesuai permintaan.
- **Bahasa Pengantar:** Antarmuka berbahasa Indonesia yang ramah, profesional, dan alami untuk operasional restoran di Indonesia.

## Review Focus
1. **Pergantian Tema:** Beralih antara Light dan Dark mode harus memperbarui seluruh elemen secara instan (termasuk modal, bottom sheet, badge, dan kartu ubin) tanpa flickering warna.
2. **Kustomisasi Modifier QR Order:** Pilihan level pedas (0-5), porsi nasi, suhu minuman, dan catatan dapur harus tersimpan rapi ke objek keranjang dan tertera jelas di ringkasan checkout.
3. **Status Sold Out:** Mango Sticky Rice tidak boleh bisa ditambahkan ke keranjang atau pesanan, menampilkan visual overlay yang elegan.
4. **Denah 12 Meja POS:** Setiap meja (01-12) menampilkan indikator warna yang akurat (Hijau = Kosong, Merah = Aktif + running total, Kuning = Minta Tagihan), dan mengklik meja harus memuat pesanan meja tersebut ke panel struk kasir.
5. **Kalkulasi & Pembayaran Kasir:** Subtotal, Diskon, Pajak PB1 10%, dan Total Pembayaran harus terhitung akurat secara real-time, mendukung simulasi pembayaran Tunai (dengan hitung kembalian otomatis), QRIS, dan Kartu Debit.

---

### Task 1: Modul Data Terpadu & Dual-Theme Engine
**Files:**
- Create: `assets/js/resto-data.js`
- Create: `assets/css/resto-theme.css`

- [ ] Definisikan 13 item menu fusi (Arab, Malaysia, Thailand, Minuman) dengan nama asli, harga, kategori, gambar kuliner menggugah selera, deskripsi, tingkat kepedasan, dan ketersediaan (Mango Sticky Rice: `isSoldOut: true`).
- [ ] Definisikan data 12 Meja dengan status default (Tersedia, Terisi dengan running bill, Minta Tagihan).
- [ ] Tulis utilitas format mata uang Rupiah (`formatRupiah(number)`).
- [ ] Definisikan variabel warna CSS untuk Warm Light Mode dan Modern Dark Mode serta animasi smooth transitions.
- [ ] Buat engine sinkronisasi tema (`ThemeManager`) yang mengontrol atribut `class="dark"` pada dokumen dan menyimpan ke `localStorage`.

### Task 2: Customer QR Self-Order Screen (Mobile View)
**Files:**
- Create: `customer_qr_self_order.html`

- [ ] Susun header mobile: Logo Resto Pro, indikator Table 05 Dine-in (Indoor AC) dengan pulsing dot, tombol Panggil Pelayan, dan tombol Sun/Moon toggle.
- [ ] Bangun bilah filter kategori horizontal (All Menu, Arabian Delights 🕌, Malaysian Favorites 🇲🇾, Thai Specialties 🇹🇭, Artisan Drinks 🍹).
- [ ] Buat grid menu 2-kolom touch-friendly menampilkan foto makanan, nama, deskripsi singkat, harga, indikator pedas (🌶️), dan tombol "+ Tambah" (atau overlay `Sold Out` untuk Mango Sticky Rice).
- [ ] Implementasikan Modal Modifier (Bottom Sheet) interaktif:
  - Pilihan Level Pedas (Lvl 0 - 5)
  - Pilihan Porsi Nasi (Regular / Extra Porsi +Rp 10.000)
  - Pilihan Suhu Minuman (Panas / Sedikit Es / Es Normal)
  - Kolom Catatan Masak (Kitchen Notes)
  - Stepper kuantitas (- / +) dan tombol Tambah ke Keranjang.
- [ ] Implementasikan Sticky Bottom Floating Cart Bar dengan ringkasan jumlah item dan harga, beranimasi naik saat keranjang terisi.
- [ ] Bangun Modal Checkout Lengkap:
  - Daftar rincian pesanan dengan modifier.
  - Form Nama Pemesan & Nomor WhatsApp (+150 poin loyalitas).
  - Rincian Subtotal, Pajak PB1 10%, dan Total Akhir.
  - Tombol aksi `🚀 Kirim Pesanan ke Dapur (Meja 05)` dan Toast konfirmasi sukses.

### Task 3: Cashier POS Register & Table Map (Tablet/Desktop View)
**Files:**
- Create: `cashier_pos_register.html`

- [ ] Bangun Top Navigation: Judul "Aplikasi Resto Pro by RASH WebApp Builder ✨", status kasir Shift 1, status koneksi cloud, jam realtime, dan tombol toggle Dark/Light Mode.
- [ ] Implementasikan Kolom Kiri: Visual Interactive Table Grid (Meja 01 s/d 12) dengan status warna:
  - Hijau: Kosong / Tersedia.
  - Merah: Aktif Open Bill (menampilkan running total Rp & durasi menit).
  - Kuning: Minta Tagihan (Bill Requested).
  - Interaksi klik meja untuk memuat data tagihan meja langsung ke panel struk kasir.
- [ ] Implementasikan Kolom Tengah: Quick-Touch Menu Tile Grid:
  - Tab kategori cepat & bar pencarian langsung.
  - Kartu ubin makanan touch-friendly dengan penambahan langsung 1-klik ke tiket kasir.
- [ ] Implementasikan Kolom Kanan: Order Ticket Panel:
  - Info meja aktif, kasir, dan nomor struk.
  - Daftar baris pesanan aktif dengan kontrol kuantitas (+/-) dan tombol hapus baris.
  - Input kode diskon / promosi serta CRM lookup pelanggan.
  - Perhitungan otomatis: Subtotal, Diskon, Pajak Restoran PB1 10%, dan Total Bayar.
  - Tombol aksi: `Split Bill`, `Kirim ke Dapur`, dan `Bayar Sekarang`.
- [ ] Implementasikan Modal Pembayaran Lengkap Kasir:
  - Tab metode: Tunai (Cash) dengan tombol pecahan instan & kembalian otomatis, QRIS Dinamis (gambar QR code), dan Kartu Debit.
  - Tombol `Selesaikan Pembayaran & Cetak Struk`.
  - Templat cetak struk kasir thermal yang rapi.

### Task 4: Interactive Showcase Hub (Device Switcher & Live Preview)
**Files:**
- Create: `index.html`

- [ ] Rancang portal utama dengan navigation header berfitur switch perangkat:
  - Mode 1: **Simulasi Mobile QR Self-Order** (di dalam mockup frame smartphone iPhone/Android elegan dengan status bar dan gestur sentuh).
  - Mode 2: **Tampilan Penuh Kasir POS Tablet/Desktop** (landscape view 100% responsif).
  - Tombol akses langsung untuk membuka masing-masing file dalam tab penuh (`customer_qr_self_order.html` & `cashier_pos_register.html`).
- [ ] Pasang kontrol sinkronisasi tema global (Light/Dark mode) yang berefek ke seluruh iframe dan wrapper portal.
- [ ] Sertakan ringkasan fitur, teknologi, panduan penggunaan, dan menu showcase masakan fusi.

### Task 5: Pengujian, Verifikasi, & Dokumentasi
- [ ] Uji responsivitas kedua layar pada breakpoint mobile (375px, 414px) dan desktop (1024px, 1440px).
- [ ] Verifikasi seluruh 13 item menu dan harga dummy sesuai spesifikasi.
- [ ] Uji penambahan item, modifikasi varian (pedas, porsi, es), pembukaan keranjang, dan pengiriman pesanan.
- [ ] Uji alur kasir: klik meja 01-12, tambah item ke struk kasir, hitung diskon dan pajak, serta proses checkout tunai / QRIS.
