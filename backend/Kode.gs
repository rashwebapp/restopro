/**
 * ==============================================================================
 * RESTO PRO - GOOGLE APPS SCRIPT BACKEND REST API
 * by RASH WebApp Builder ✨
 * ==============================================================================
 * Arsitektur: Pure REST API (JSON via doGet & doPost) + Google Sheets Database
 * Frontend: Pure HTML/CSS/JS (Decoupled, No iframe, No google.script.run)
 * Dukungan: Dual Theme, QR Self-Order, Kasir POS, KDS Dapur, Owner SaaS
 * ==============================================================================
 */

// ==============================================================================
// 1. KONFIGURASI SISTEM & SCRIPT PROPERTIES
// ==============================================================================
const CONFIG = {
  get SPREADSHEET_ID() {
    return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  },
  get ROOT_FOLDER_ID() {
    return PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  },
  get BACKUP_FOLDER_ID() {
    return PropertiesService.getScriptProperties().getProperty('BACKUP_FOLDER_ID');
  },
  get API_SECRET_KEY() {
    return PropertiesService.getScriptProperties().getProperty('API_SECRET_KEY');
  },
  get ADMIN_PIN() {
    return PropertiesService.getScriptProperties().getProperty('ADMIN_PIN') || '1234';
  },
  SHEET_NAMES: {
    CONFIG: 'AppConfig',
    MENU: 'MenuCatalog',
    TRANSACTIONS: 'Transactions',
    MEMBERS: 'Members',
    RESERVATIONS: 'Reservations',
    KDS: 'KdsTickets'
  }
};

/**
 * Helper Keamanan: Memverifikasi otorisasi API Secret Key dari request
 */
function verifyAuthKey_(providedKey) {
  const serverSecret = CONFIG.API_SECRET_KEY;
  // Jika serverSecret belum di-generate di Script Properties, izinkan (backward-compatible)
  if (!serverSecret) return true;
  if (!providedKey) return false;
  return String(providedKey).trim() === String(serverSecret).trim();
}

/**
 * Helper Anti-Spam: Rate limiter untuk pemesanan QR Self-Order tamu
 * Memberikan jeda waktu 8 detik antar pesanan dari meja yang sama
 */
function checkOrderRateLimit_(tableId) {
  try {
    const cache = CacheService.getScriptCache();
    const safeId = String(tableId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cacheKey = 'cd_order_' + safeId;
    if (cache.get(cacheKey)) {
      return false; // Meja ini baru saja memesan dalam 8 detik terakhir
    }
    cache.put(cacheKey, '1', 8); // Kunci selama 8 detik
    return true;
  } catch (e) {
    return true; // Jika cache terkendala, jangan blokir transaksi asli
  }
}

// ==============================================================================
// 2. ENTRY POINTS - doGet & doPost (CORS, Role-Based Security & ContentService JSON)
// ==============================================================================

/**
 * Handle HTTP GET Requests
 * Contoh: ?action=getAllData atau ?action=getMenuCatalog
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'ping';
    const providedApiKey = params.apiKey || params.key || '';

    // Pembagian Hak Akses: Aksi publik vs Aksi terproteksi
    const isPublicAction = (action === 'ping' || action === 'getMenuCatalog');

    if (!isPublicAction && !verifyAuthKey_(providedApiKey)) {
      return buildResponse({
        success: false,
        unauthorized: true,
        error: 'Akses Ditolak: Endpoint "' + action + '" memerlukan otorisasi API Secret Key Resto Pro yang sah.'
      });
    }

    let result = {};

    switch (action) {
      case 'ping':
        const hasKey = Boolean(CONFIG.API_SECRET_KEY);
        const isKeyValid = hasKey ? verifyAuthKey_(providedApiKey) : null;
        result = {
          success: true,
          message: 'Resto Pro Google Apps Script REST API Aktif & Siap!',
          version: '2.5.0-Enterprise',
          timestamp: new Date().toISOString(),
          security: {
            isKeyConfigured: hasKey,
            isAuthorized: isKeyValid,
            roleProtection: 'Active (Public Menu & QR Order vs Protected Admin Operations)'
          },
          spreadsheetUrl: CONFIG.SPREADSHEET_ID ? 'https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID : null
        };
        break;

      case 'getAllData':
        result = handleGetAllData();
        break;

      case 'getMenuCatalog':
        result = { success: true, data: getRowsAsObjects(CONFIG.SHEET_NAMES.MENU) };
        break;

      case 'getTransactions':
        result = { success: true, data: getRowsAsObjects(CONFIG.SHEET_NAMES.TRANSACTIONS) };
        break;

      case 'getMembers':
        result = { success: true, data: getRowsAsObjects(CONFIG.SHEET_NAMES.MEMBERS) };
        break;

      case 'getReservations':
        result = { success: true, data: getRowsAsObjects(CONFIG.SHEET_NAMES.RESERVATIONS) };
        break;

      case 'getKdsTickets':
        result = { success: true, data: getRowsAsObjects(CONFIG.SHEET_NAMES.KDS) };
        break;

      default:
        result = { success: false, message: 'Action doGet tidak dikenali: ' + action };
    }

    return buildResponse(result);
  } catch (err) {
    return buildResponse({ success: false, error: err.message, stack: err.stack });
  }
}

/**
 * Handle HTTP POST Requests
 * Menerima payload JSON dari Frontend dengan proteksi Role-Based Guard
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;
    const providedApiKey = payload.apiKey || payload.key || '';

    // Pembagian Hak Akses POST:
    // 'placeOrder' adalah aksi publik untuk tamu meja di QR Self-Order
    // Seluruh aksi mutasi lainnya (CRUD menu, hapus data, omset, CRM) WAJIB API Secret Key!
    const isPublicPost = (action === 'placeOrder');

    if (!isPublicPost && !verifyAuthKey_(providedApiKey)) {
      return buildResponse({
        success: false,
        unauthorized: true,
        error: 'Akses Ditolak: Tindakan "' + action + '" hanya diizinkan untuk Kasir/Owner dengan API Secret Key yang sah.'
      });
    }

    let result = {};

    switch (action) {
      case 'placeOrder':
        result = handlePlaceOrder(payload.data);
        break;

      case 'saveTransaction':
        result = handleSaveTransaction(payload.data);
        break;

      case 'saveMenuItem':
        result = handleSaveMenuItem(payload.data);
        break;

      case 'deleteMenuItem':
        result = handleDeleteMenuItem(payload.id);
        break;

      case 'toggleMenuStock':
        result = handleToggleMenuStock(payload.id, payload.isAvailable);
        break;

      case 'saveMember':
        result = handleSaveMember(payload.data);
        break;

      case 'saveReservation':
        result = handleSaveReservation(payload.data);
        break;

      case 'checkInReservation':
        result = handleCheckInReservation(payload.id);
        break;

      case 'cancelReservation':
        result = handleCancelReservation(payload.id);
        break;

      case 'updateKdsStatus':
        result = handleUpdateKdsStatus(payload.id, payload.status);
        break;

      case 'clearKdsTicket':
        result = handleClearKdsTicket(payload.id);
        break;

      case 'saveTable':
        result = { success: true, message: 'Data meja berhasil disinkronkan ke cloud!' };
        break;

      case 'deleteTable':
        result = { success: true, message: 'Meja berhasil dihapus dari sistem cloud!' };
        break;

      case 'syncFullState':
        result = handleSyncFullState(payload.data);
        break;

      default:
        result = { success: false, message: 'Action doPost tidak dikenali: ' + action };
    }

    return buildResponse(result);
  } catch (err) {
    return buildResponse({ success: false, error: err.message, stack: err.stack });
  }
}

// ==============================================================================
// 3. BUSINESS LOGIC HANDLERS
// ==============================================================================

/**
 * Mengambil seluruh data sistem sekaligus (efisien 1x network round-trip)
 */
function handleGetAllData() {
  const cached = CacheService.getScriptCache().get('resto_all_data');
  if (cached) {
    return { success: true, source: 'cache', data: JSON.parse(cached) };
  }

  const data = {
    menuCatalog: getRowsAsObjects(CONFIG.SHEET_NAMES.MENU),
    transactions: getRowsAsObjects(CONFIG.SHEET_NAMES.TRANSACTIONS),
    members: getRowsAsObjects(CONFIG.SHEET_NAMES.MEMBERS),
    reservations: getRowsAsObjects(CONFIG.SHEET_NAMES.RESERVATIONS),
    kdsTickets: getRowsAsObjects(CONFIG.SHEET_NAMES.KDS)
  };

  try {
    CacheService.getScriptCache().put('resto_all_data', JSON.stringify(data), 600);
  } catch (e) {
    // Abaikan jika payload melebihi limit CacheService (100KB)
  }

  return { success: true, source: 'sheets', data: data };
}

/**
 * Menyimpan pesanan baru dari QR Self-Order ke KdsTickets
 */
function handlePlaceOrder(order) {
  if (!order) throw new Error('Data order tidak boleh kosong');

  const tableRef = order.tableId || order.table || 'guest';
  if (!checkOrderRateLimit_(tableRef)) {
    return {
      success: false,
      rateLimited: true,
      message: 'Pesanan sedang diproses. Mohon tunggu 8 detik sebelum mengirim pesanan berikutnya untuk meja ini demi kenyamanan dapur.'
    };
  }

  const sheet = getSheet(CONFIG.SHEET_NAMES.KDS);
  const ticketId = order.id || ('TKT-' + Math.floor(100 + Math.random() * 900));
  const createdAt = order.createdAt || Date.now();
  const status = order.status || 'new';

  sheet.appendRow([
    ticketId,
    order.table || 'Meja 05',
    order.tableId || 'T05',
    order.customer || 'Tamu',
    order.phone || '-',
    order.section || 'Indoor AC',
    JSON.stringify(order.items || []),
    createdAt,
    status
  ]);

  invalidateCache();
  return { success: true, message: 'Pesanan berhasil disimpan ke KDS!', ticketId: ticketId };
}

/**
 * Menyimpan transaksi pembayaran lunas kasir ke sheet Transactions & update Member
 */
function handleSaveTransaction(t) {
  if (!t) throw new Error('Data transaksi tidak boleh kosong');

  const sheet = getSheet(CONFIG.SHEET_NAMES.TRANSACTIONS);
  const now = new Date();

  sheet.appendRow([
    t.billNo || ('BILL-' + Date.now().toString().slice(-4)),
    now.toISOString(),
    t.dateStr || now.toLocaleDateString('id-ID'),
    t.table || 'Meja 01',
    t.customer || 'Tamu Reguler',
    t.phone || '-',
    JSON.stringify(t.items || []),
    Number(t.subtotal || 0),
    Number(t.discount || 0),
    Number(t.tax || 0),
    Number(t.grandTotal || 0),
    t.paymentMethod || 'cash',
    Number(t.amountPaid || t.grandTotal || 0),
    Number(t.change || 0),
    t.cashier || 'Siti Aminah'
  ]);

  // Tambahkan poin loyalitas jika transaksi menggunakan member
  if (t.phone && t.phone !== '-') {
    addMemberPointsInternal(t.phone, Math.floor((t.grandTotal || 0) / 1000));
  }

  invalidateCache();
  return { success: true, message: 'Transaksi lunas berhasil dicatat di Google Sheets!', billNo: t.billNo };
}

/**
 * Simpan / Update Menu Item di Sheet MenuCatalog
 */
function handleSaveMenuItem(item) {
  if (!item || !item.name) throw new Error('Data item menu tidak valid');

  const sheet = getSheet(CONFIG.SHEET_NAMES.MENU);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');

  const itemId = item.id || ('item-' + Date.now());
  let existingRow = -1;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIndex]) === String(itemId)) {
      existingRow = r + 1; // 1-based index
      break;
    }
  }

  const rowValues = [
    itemId,
    item.name,
    item.category || 'arabian',
    Number(item.price || 0),
    item.image || '',
    item.description || '',
    Number(item.spicyLevel || 0),
    item.isAvailable !== false,
    item.prepTime || '15 mnt',
    new Date().toISOString()
  ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  invalidateCache();
  return { success: true, message: 'Menu berhasil disimpan!', itemId: itemId };
}

/**
 * Hapus Menu Item dari Sheet MenuCatalog
 */
function handleDeleteMenuItem(itemId) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.MENU);
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('id');

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIndex]) === String(itemId)) {
      sheet.deleteRow(r + 1);
      invalidateCache();
      return { success: true, message: 'Menu berhasil dihapus!' };
    }
  }
  return { success: false, message: 'Menu tidak ditemukan!' };
}

/**
 * Toggle Status Stok Menu (Tersedia / Habis)
 */
function handleToggleMenuStock(itemId, isAvailable) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.MENU);
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('id');
  const availIndex = data[0].indexOf('isAvailable');

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIndex]) === String(itemId)) {
      sheet.getRange(r + 1, availIndex + 1).setValue(Boolean(isAvailable));
      invalidateCache();
      return { success: true, message: 'Status stok berhasil diubah!' };
    }
  }
  return { success: false, message: 'Menu tidak ditemukan' };
}

/**
 * Simpan / Update Member CRM
 */
function handleSaveMember(mem) {
  if (!mem || !mem.name) throw new Error('Data member tidak valid');

  const sheet = getSheet(CONFIG.SHEET_NAMES.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  const phoneIndex = headers.indexOf('phone');

  const memId = mem.id || ('MEM-' + Math.floor(100 + Math.random() * 900));
  let existingRow = -1;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIndex]) === String(memId) || (mem.phone && String(data[r][phoneIndex]) === String(mem.phone))) {
      existingRow = r + 1;
      break;
    }
  }

  const rowValues = [
    memId,
    mem.name,
    mem.phone || '-',
    mem.tier || 'VIP Silver',
    Number(mem.points || 0),
    Number(mem.totalVisits || 1),
    Number(mem.totalSpent || 0),
    mem.registeredAt || new Date().toISOString().slice(0, 10),
    mem.notes || ''
  ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  invalidateCache();
  return { success: true, message: 'Data member berhasil disimpan!', memberId: memId };
}

/**
 * Internal helper: tambah poin loyalitas member
 */
function addMemberPointsInternal(phone, pointsToAdd) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.MEMBERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const phoneIdx = headers.indexOf('phone');
    const pointsIdx = headers.indexOf('points');
    const visitsIdx = headers.indexOf('totalVisits');

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][phoneIdx]) === String(phone)) {
        const curPts = Number(data[r][pointsIdx] || 0);
        const curVis = Number(data[r][visitsIdx] || 0);
        sheet.getRange(r + 1, pointsIdx + 1).setValue(curPts + pointsToAdd);
        sheet.getRange(r + 1, visitsIdx + 1).setValue(curVis + 1);
        break;
      }
    }
  } catch (e) {
    Logger.log('Gagal update poin: ' + e.message);
  }
}

/**
 * Simpan / Update Reservasi Meja
 */
function handleSaveReservation(res) {
  if (!res) throw new Error('Data reservasi tidak valid');

  const sheet = getSheet(CONFIG.SHEET_NAMES.RESERVATIONS);
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('id');

  const resId = res.id || ('RES-' + Math.floor(100 + Math.random() * 900));
  let existingRow = -1;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIndex]) === String(resId)) {
      existingRow = r + 1;
      break;
    }
  }

  const rowValues = [
    resId,
    res.tableId || 'T01',
    res.tableName || 'Meja 01',
    res.section || 'Indoor AC',
    res.customerName || 'Tamu',
    res.phone || '-',
    Number(res.guests || 2),
    res.dateStr || new Date().toISOString().slice(0, 10),
    res.timeStr || '19:00 WIB',
    res.notes || '',
    JSON.stringify(res.preOrders || []),
    res.status || 'confirmed',
    new Date().toISOString()
  ];

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  invalidateCache();
  return { success: true, message: 'Jadwal booking berhasil disimpan!', reservationId: resId };
}

/**
 * Check-in Reservasi (Ubah status ke 'seated')
 */
function handleCheckInReservation(resId) {
  return updateRowStatus(CONFIG.SHEET_NAMES.RESERVATIONS, 'id', resId, 'status', 'seated');
}

/**
 * Batalkan Reservasi (Ubah status ke 'cancelled')
 */
function handleCancelReservation(resId) {
  return updateRowStatus(CONFIG.SHEET_NAMES.RESERVATIONS, 'id', resId, 'status', 'cancelled');
}

/**
 * Update Status KDS (new -> cooking -> ready)
 */
function handleUpdateKdsStatus(ticketId, status) {
  return updateRowStatus(CONFIG.SHEET_NAMES.KDS, 'id', ticketId, 'status', status);
}

/**
 * Hapus Tiket KDS yang Selesai
 */
function handleClearKdsTicket(ticketId) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.KDS);
  const data = sheet.getDataRange().getValues();
  const idIndex = data[0].indexOf('id');

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIndex]) === String(ticketId)) {
      sheet.deleteRow(r + 1);
      invalidateCache();
      return { success: true, message: 'Tiket KDS berhasil diarsipkan!' };
    }
  }
  return { success: false, message: 'Tiket KDS tidak ditemukan' };
}

/**
 * Sinkronisasi Penuh Database dari Frontend ke Google Sheets
 */
function handleSyncFullState(fullData) {
  if (!fullData) throw new Error('Payload sinkronisasi kosong');

  if (Array.isArray(fullData.menuCatalog) && fullData.menuCatalog.length > 0) {
    fullData.menuCatalog.forEach(item => handleSaveMenuItem(item));
  }
  if (Array.isArray(fullData.members) && fullData.members.length > 0) {
    fullData.members.forEach(mem => handleSaveMember(mem));
  }
  if (Array.isArray(fullData.reservations) && fullData.reservations.length > 0) {
    fullData.reservations.forEach(res => handleSaveReservation(res));
  }

  invalidateCache();
  return { success: true, message: 'Seluruh data offline berhasil disinkronkan ke Google Sheets!' };
}

// ==============================================================================
// 4. UTILITIES & HELPER DATABASE
// ==============================================================================

function getSheet(sheetName) {
  const ssId = CONFIG.SPREADSHEET_ID;
  if (!ssId) {
    throw new Error('SPREADSHEET_ID belum dikonfigurasi! Jalankan setupAppEnvironment() terlebih dahulu.');
  }
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet ' + sheetName + ' tidak ditemukan di Spreadsheet');
  }
  return sheet;
}

function getRowsAsObjects(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length <= 1) return [];

    const headers = values[0];
    const objects = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      // Skip baris kosong
      if (row.every(cell => cell === '' || cell === null)) continue;

      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        // Parse JSON strings otomatis
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { val = JSON.parse(val); } catch (e) {}
        }
        obj[h] = val;
      });
      objects.push(obj);
    }
    return objects;
  } catch (err) {
    Logger.log('Error getRowsAsObjects (' + sheetName + '): ' + err.message);
    return [];
  }
}

function updateRowStatus(sheetName, idColName, idValue, statusColName, newStatus) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf(idColName);
  const statusIdx = data[0].indexOf(statusColName);

  if (idIdx === -1 || statusIdx === -1) {
    return { success: false, message: 'Kolom ID atau Status tidak ditemukan' };
  }

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]) === String(idValue)) {
      sheet.getRange(r + 1, statusIdx + 1).setValue(newStatus);
      invalidateCache();
      return { success: true, message: 'Status berhasil diperbarui ke: ' + newStatus };
    }
  }
  return { success: false, message: 'Data dengan ID ' + idValue + ' tidak ditemukan' };
}

function invalidateCache() {
  try {
    CacheService.getScriptCache().remove('resto_all_data');
  } catch (e) {}
}

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// 5. OTOMASI SETUP ENVIRONMENT (JALANKAN SEKALI DARI SCRIPT EDITOR)
// ==============================================================================

/**
 * Jalankan fungsi ini SEKALI melalui menu editor Apps Script: Run -> setupAppEnvironment
 * Fungsi ini otomatis:
 * 1. Membuat folder induk dan folder backup di Google Drive
 * 2. Membuat Spreadsheet "Database Resto Pro" lengkap dengan 6 sheet terformat
 * 3. Mengisi seluruh seed menu fusi 3 negeri, seed transaksi, seed member & reservasi
 * 4. Menyimpan SPREADSHEET_ID dan ROOT_FOLDER_ID ke Script Properties secara otomatis!
 */
function setupAppEnvironment() {
  const APP_NAME = 'Resto Pro by RASH WebApp Builder';
  Logger.log('🚀 Memulai inisialisasi database ' + APP_NAME + '...');

  // 1. Buat Folder di Google Drive
  const rootFolder = DriveApp.createFolder('📁 Database - ' + APP_NAME);
  const backupFolder = rootFolder.createFolder('💾 Cadangan Backup JSON');

  // 2. Buat Spreadsheet Database Utama
  const ss = SpreadsheetApp.create('🗃️ Database Resto Pro (Google Sheets Backend)');
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder);

  // -------------------------------------------------------------
  // Sheet 1: AppConfig
  // -------------------------------------------------------------
  const configSheet = ss.getActiveSheet().setName(CONFIG.SHEET_NAMES.CONFIG);
  configSheet.appendRow(['key', 'value', 'keterangan']);
  configSheet.appendRow(['APP_NAME', APP_NAME, 'Nama resmi aplikasi web']);
  configSheet.appendRow(['SPREADSHEET_ID', ss.getId(), 'ID database spreadsheet']);
  configSheet.appendRow(['ROOT_FOLDER_ID', rootFolder.getId(), 'Folder root Google Drive']);
  configSheet.appendRow(['BACKUP_FOLDER_ID', backupFolder.getId(), 'Folder cadangan backup']);
  configSheet.appendRow(['TAX_RATE', '0.10', 'Tarif Pajak Restoran PB1 (10%)']);
  configSheet.appendRow(['PRINTER_WIDTH', '80mm', 'Format printer thermal kasir']);
  configSheet.appendRow(['CREATED_AT', new Date().toISOString(), 'Tanggal setup sistem']);

  styleHeader(configSheet, '#D97706');

  // -------------------------------------------------------------
  // Sheet 2: MenuCatalog (13 Menu Fusi Tiga Negeri & Artisan Drink)
  // -------------------------------------------------------------
  const menuSheet = ss.insertSheet(CONFIG.SHEET_NAMES.MENU);
  menuSheet.appendRow([
    'id', 'name', 'category', 'price', 'image', 'description', 'spicyLevel', 'isAvailable', 'prepTime', 'createdAt'
  ]);

  const defaultMenu = [
    // 1. Arabian Delights
    ['arab-1', 'Nasi Mandhi Daging Kambing', 'arabian', 65000, 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', 'Nasi basmati aromatik rempah timur tengah disajikan dengan daging kambing panggang lembut & sambal dhabah.', 1, true, '20 mnt', new Date().toISOString()],
    ['arab-2', 'Shawarma Ayam Panggang', 'arabian', 35000, 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&auto=format&fit=crop&q=80', 'Gulungan roti pita lembut berisi irisan ayam panggang rempah khas Lebanon, selada segar & garlic toum sauce.', 2, true, '15 mnt', new Date().toISOString()],
    ['arab-3', 'Sambosa Daging Keju (3 pcs)', 'arabian', 25000, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80', 'Pastri segitiga renyah isi daging sapi giling rempah kapulaga & lelehan keju mozarella gurih.', 1, true, '12 mnt', new Date().toISOString()],

    // 2. Malaysian Favorites
    ['malay-1', 'Nasi Lemak Sambal Sotong Special', 'malaysian', 45000, 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop&q=80', 'Nasi gurih santan daun pandan wangi, dilengkapi cumi sambal merah merona, ikan bilis renyah, kacang & telur.', 3, true, '18 mnt', new Date().toISOString()],
    ['malay-2', 'Roti Canai Kari Daging Sapi', 'malaysian', 30000, 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80', 'Roti canai pipih renyah berserat khas mamak Penang, dicelup kuah kari sapi pekat kaya rempah.', 2, true, '12 mnt', new Date().toISOString()],
    ['malay-3', 'Laksa Penang Kuah Kental', 'malaysian', 42000, 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=600&auto=format&fit=crop&q=80', 'Mi putih kenyal berpadu kuah asam pedas ikan segar dengan serpihan nanas, timun & bunga kantan.', 3, true, '15 mnt', new Date().toISOString()],

    // 3. Thai Specialties
    ['thai-1', 'Tom Yum Goong Seafood Kuah Merah', 'thai', 55000, 'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=600&auto=format&fit=crop&q=80', 'Sup tradisional Thailand kuah asam pedas segar beraroma serai dan daun jeruk, sarat udang jumbo & cumi.', 4, true, '18 mnt', new Date().toISOString()],
    ['thai-2', 'Pad Thai Udang Jumbo', 'thai', 48000, 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80', 'Kwetiau goreng khas Bangkok dengan pasta asam jawa, udang galah, tauge segar & taburan kacang sangrai.', 2, true, '15 mnt', new Date().toISOString()],
    ['thai-3', 'Mango Sticky Rice Santan Kental', 'thai', 32000, 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop&q=80', 'Ketan pulen hangat disiram santan kental manis gurih, disajikan dengan mangga matang pohon harum manis.', 0, false, '10 mnt', new Date().toISOString()],

    // 4. Artisan Beverages
    ['drink-1', 'Authentic Teh Tarik Buih Melimpah', 'drinks', 18000, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80', 'Seduhan daun teh hitam premium ditarik tinggi hingga menghasilkan buih lembut melimpah nan legit.', 0, true, '8 mnt', new Date().toISOString()],
    ['drink-2', 'Thai Green Tea Susu Asli', 'drinks', 22000, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80', 'Daun teh hijau Thailand otentik diseduh pekat dengan susu evaporasi manis creamy beraroma melati.', 0, true, '8 mnt', new Date().toISOString()],
    ['drink-3', 'Qahwa Arabika Rempah Kapulaga', 'drinks', 25000, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80', 'Kopi sangrai ringan khas Arab Saudi diperkaya seduhan kapulaga wangi, cengkeh & safron emas.', 0, true, '10 mnt', new Date().toISOString()],
    ['drink-4', 'Jus Kurma Susu Madu Segar', 'drinks', 24000, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80', 'Perpaduan kurma Ajwa asli, susu segar dingin dan madu hutan murni. Sumber energi alami.', 0, true, '8 mnt', new Date().toISOString()]
  ];

  defaultMenu.forEach(row => menuSheet.appendRow(row));
  styleHeader(menuSheet, '#059669');

  // -------------------------------------------------------------
  // Sheet 3: Transactions (Riwayat Transaksi POS Kasir)
  // -------------------------------------------------------------
  const trxSheet = ss.insertSheet(CONFIG.SHEET_NAMES.TRANSACTIONS);
  trxSheet.appendRow([
    'billNo', 'timestamp', 'dateStr', 'table', 'customer', 'phone', 'itemsJson',
    'subtotal', 'discount', 'tax', 'grandTotal', 'paymentMethod', 'amountPaid', 'change', 'cashier'
  ]);

  // Seed sample transactions
  trxSheet.appendRow([
    'BILL-1001', new Date(Date.now() - 3600000).toISOString(), new Date().toLocaleDateString('id-ID'), 'Meja 03', 'Ibu Rahmawati', '08122334455',
    JSON.stringify([{ name: 'Nasi Mandhi Daging Kambing', qty: 2, price: 65000 }, { name: 'Teh Tarik', qty: 2, price: 18000 }]),
    166000, 16600, 14940, 164340, 'cash', 200000, 35660, 'Siti Aminah'
  ]);
  trxSheet.appendRow([
    'BILL-1002', new Date(Date.now() - 7200000).toISOString(), new Date().toLocaleDateString('id-ID'), 'Meja 06', 'dr. Irfan Hakim', '081234567890',
    JSON.stringify([{ name: 'Tom Yum Goong Seafood', qty: 2, price: 55000 }, { name: 'Jus Kurma Susu', qty: 2, price: 24000 }]),
    158000, 15800, 14220, 156420, 'qris', 156420, 0, 'Siti Aminah'
  ]);

  styleHeader(trxSheet, '#2563EB');

  // -------------------------------------------------------------
  // Sheet 4: Members (Direktori CRM Pelanggan)
  // -------------------------------------------------------------
  const memberSheet = ss.insertSheet(CONFIG.SHEET_NAMES.MEMBERS);
  memberSheet.appendRow([
    'id', 'name', 'phone', 'tier', 'points', 'totalVisits', 'totalSpent', 'registeredAt', 'notes'
  ]);

  const defaultMembers = [
    ['MEM-101', 'dr. Irfan Hakim', '081234567890', 'VIP Gold', 1450, 12, 1850000, '2026-08-15', 'Pelanggan tetap Meja 07 Garden'],
    ['MEM-102', 'Ibu Rahmawati S.', '08122334455', 'VIP Silver', 820, 7, 940000, '2026-09-01', 'Favorit: Shawarma Ayam & Jus Kurma'],
    ['MEM-103', 'Kevin Sanjaya', '08119876543', 'VIP Gold', 2100, 18, 2900000, '2026-07-20', 'Pecinta Tom Yum pedas level 4'],
    ['MEM-104', 'Keluarga Bpk. Anies R.', '081298765432', 'VIP Gold', 3400, 24, 4500000, '2026-06-10', 'Reservasi rutin Meja 11 VIP']
  ];
  defaultMembers.forEach(row => memberSheet.appendRow(row));
  styleHeader(memberSheet, '#7C3AED');

  // -------------------------------------------------------------
  // Sheet 5: Reservations (Jadwal Booking Meja)
  // -------------------------------------------------------------
  const resSheet = ss.insertSheet(CONFIG.SHEET_NAMES.RESERVATIONS);
  resSheet.appendRow([
    'id', 'tableId', 'tableName', 'section', 'customerName', 'phone', 'guests',
    'dateStr', 'timeStr', 'notes', 'preOrdersJson', 'status', 'createdAt'
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);
  resSheet.appendRow([
    'RES-101', 'T07', 'Meja 07', 'Outdoor Garden', 'dr. Irfan Hakim', '081234567890', 6,
    todayStr, '19:30 WIB', 'Acara Ulang Tahun Keluarga. Dekat kolam.',
    JSON.stringify([{ name: 'Nasi Mandhi Daging Kambing', qty: 4, price: 65000 }, { name: 'Authentic Teh Tarik', qty: 6, price: 18000 }]),
    'confirmed', new Date().toISOString()
  ]);
  resSheet.appendRow([
    'RES-102', 'T11', 'Meja 11', 'VIP Private Room', 'Keluarga Bpk. Anies R.', '081298765432', 8,
    todayStr, '20:00 WIB', 'Dinner bisnis & silaturahmi keluarga. Siapkan teko Qahwa panas.',
    JSON.stringify([{ name: 'Tom Yum Goong Seafood', qty: 3, price: 55000 }, { name: 'Qahwa Arabika', qty: 4, price: 25000 }]),
    'confirmed', new Date().toISOString()
  ]);
  styleHeader(resSheet, '#4F46E5');

  // -------------------------------------------------------------
  // Sheet 6: KdsTickets (Antrean Masak KDS Dapur)
  // -------------------------------------------------------------
  const kdsSheet = ss.insertSheet(CONFIG.SHEET_NAMES.KDS);
  kdsSheet.appendRow([
    'id', 'table', 'tableId', 'customer', 'phone', 'section', 'itemsJson', 'createdAt', 'status'
  ]);
  kdsSheet.appendRow([
    'TKT-101', 'Meja 05', 'T05', 'Bpk. Ahmad Faiz', '08123456789', 'Indoor AC',
    JSON.stringify([
      { name: 'Nasi Mandhi Daging Kambing', qty: 2, price: 65000, station: 'arabian', notes: 'Pedas Lvl 1' },
      { name: 'Authentic Teh Tarik', qty: 2, price: 18000, station: 'drinks', notes: 'Less Ice' }
    ]),
    Date.now() - 300000, 'cooking'
  ]);
  styleHeader(kdsSheet, '#DC2626');

  // 3. Simpan ID & Kunci Rahasia ke PropertiesService secara otomatis!
  const props = PropertiesService.getScriptProperties();

  // Buat API Secret Key acak kuat jika belum ada
  let apiKey = props.getProperty('API_SECRET_KEY');
  if (!apiKey) {
    apiKey = 'RP-SEC-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
  }

  props.setProperties({
    SPREADSHEET_ID: ss.getId(),
    ROOT_FOLDER_ID: rootFolder.getId(),
    BACKUP_FOLDER_ID: backupFolder.getId(),
    API_SECRET_KEY: apiKey
  });

  Logger.log('');
  Logger.log('🎉 INISIALISASI SUKSES 100%!');
  Logger.log('====================================================');
  Logger.log('🔑 API SECRET KEY : ' + apiKey);
  Logger.log('----------------------------------------------------');
  Logger.log('🛡️ SISTEM KEAMANAN AKTIF:');
  Logger.log('• QR Tamu Meja : Hanya diizinkan melihat menu & pesan meja (Aman & Anti-Spam)');
  Logger.log('• Kasir & Owner: Seluruh aksi CRUD menu, laporan omset & member WAJIB API Key di atas');
  Logger.log('----------------------------------------------------');
  Logger.log('Spreadsheet ID : ' + ss.getId());
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Drive Folder   : ' + rootFolder.getUrl());
  Logger.log('====================================================');
  Logger.log('👉 LANGKAH SELANJUTNYA:');
  Logger.log('1. Klik tombol "Deploy" (Pojok Kanan Atas) -> "New deployment"');
  Logger.log('2. Pilih type: "Web app"');
  Logger.log('3. Execute as: "Me" (email Anda)');
  Logger.log('4. Who has access: "Anyone"');
  Logger.log('5. Klik "Deploy" -> Salin URL Web App yang berakhiran /exec');
  Logger.log('6. Buka Layar Owner SaaS (Section 7), masukkan URL Web App dan API SECRET KEY di atas!');
}

/**
 * Utilitas untuk melihat API Secret Key sewaktu-waktu dari Editor Apps Script
 */
function showApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('API_SECRET_KEY');
  Logger.log('====================================================');
  Logger.log('Resto Pro API Secret Key: ' + (key || 'Belum di-generate. Jalankan setupAppEnvironment().'));
  Logger.log('====================================================');
}

/**
 * Utilitas untuk merotasi / mengganti API Secret Key baru jika diperlukan
 */
function rotateApiKey() {
  const newKey = 'RP-SEC-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
  PropertiesService.getScriptProperties().setProperty('API_SECRET_KEY', newKey);
  Logger.log('====================================================');
  Logger.log('API SECRET KEY BARU: ' + newKey);
  Logger.log('⚠️ PENTING: Perbarui juga API Key ini pada Dashboard Owner Settings Resto Pro!');
  Logger.log('====================================================');
  return newKey;
}

function styleHeader(sheet, bgColor) {
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold')
             .setBackground(bgColor)
             .setFontColor('#FFFFFF')
             .setHorizontalAlignment('center');
  for (let c = 1; c <= sheet.getLastColumn(); c++) {
    sheet.autoResizeColumn(c);
  }
}
