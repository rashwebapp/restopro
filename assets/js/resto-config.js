/**
 * ==============================================================================
 * RESTO PRO - KONFIGURASI SENTRAL DATABASE CLOUD (AUTO-CONNECT)
 * by RASH WebApp Builder ✨
 * ==============================================================================
 * Cukup masukkan URL Web App dan API Secret Key Google Apps Script di sini
 * SATU KALI SAJA.
 * 
 * Setelah diisi, SELURUH LAYAR APLIKASI:
 * 1. Layar 1: Tamu Meja QR Self-Order (customer_qr_self_order.html)
 * 2. Layar 2: POS Kasir & Denah Meja (cashier_pos_register.html)
 * 3. Layar 3: Kitchen Display System KDS (kitchen_display_kds.html)
 * 4. Layar 4: Owner SaaS & Analytics (owner_settings_saas.html)
 * 5. Hub Showcase Simulator (index.html)
 * 
 * AKAN OTOMATIS TERHUBUNG LANGSUNG KE GOOGLE SHEETS & DRIVE ANDA!
 * Anda dan karyawan kasir/dapur TIDAK PERLU lagi mengetik atau menempelkan
 * URL maupun API Key secara manual di browser!
 * ==============================================================================
 */

const RESTO_CLOUD_CONFIG = {
  /**
   * 1. URL Web App Google Apps Script
   * Dapatkan setelah Deploy Web App di script.google.com (Wajib berakhiran /exec)
   * Contoh: "https://script.google.com/macros/s/AKfycbx.../exec"
   */
  GAS_URL: "https://script.google.com/macros/s/AKfycbx1aFsL6B9EhNjZq0jlPvQqNKWJGPGca75TViYsNaKbmZ0S8PzvEmbo_O9Hd52PIGnuPQ/exec",

  /**
   * 2. API Secret Key (Kunci Otorisasi Admin)
   * Dapatkan di Execution Log saat menjalankan setupAppEnvironment()
   */
  API_SECRET_KEY: "RP-SEC-09433C2CF9184910",

  /**
   * 3. Database Metadata (Tersimpan Aman)
   */
  SPREADSHEET_ID: "1am0pZ9BuFuMKWyjh8iBI3qQ5B9rXKQ0koN3mSYOwIKA",
  SPREADSHEET_URL: "https://docs.google.com/spreadsheets/d/1am0pZ9BuFuMKWyjh8iBI3qQ5B9rXKQ0koN3mSYOwIKA/edit",
  DRIVE_FOLDER_URL: "https://drive.google.com/drive/folders/1jzpJGlM5C3ywtJsouCR-PNNxaG_Jk-lR",

  /**
   * 4. Pengaturan Sinkronisasi Otomatis
   */
  ENABLE_AUTO_CLOUD_SYNC: true, // Otomatis simpan pesanan dan transaksi ke cloud
  AUTO_PULL_ON_STARTUP: false    // Tarik data cloud otomatis saat aplikasi pertama dibuka
};

// Pasang ke window agar dapat diakses oleh resto-sync.js
if (typeof window !== "undefined") {
  window.RESTO_CLOUD_CONFIG = RESTO_CLOUD_CONFIG;
}
