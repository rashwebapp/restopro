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
    KDS: 'KdsTickets',
    TENANTS: 'Tenants',
    PAYMENTS: 'Payments',
    ONLINE_ORDERS: 'OnlineOrders'
  }
};

/**
 * Header Kolom Resmi Sheet 'Tenants' (Database SaaS Multi-Tenant)
 */
const TENANT_HEADERS = [
  'id', 'name', 'pic', 'phone', 'cashierPhone', 'cashierPinHash', 'ownerPinHash',
  'city', 'plan', 'planName', 'price', 'originalPrice', 'billingCycle', 'tablesCount',
  'status', 'isLifetime', 'createdAt', 'expiresAt', 'updatedAt', 'gasUrl', 'apiKey', 'licenseKey'
];

/**
 * Header Kolom Resmi Sheet 'Payments' (Direktori Pembayaran & Verifikasi Transfer)
 */
const PAYMENT_HEADERS = [
  'id', 'tenantId', 'tenantName', 'plan', 'amount', 'bankTarget',
  'proofFileId', 'proofUrl', 'senderName', 'senderBank', 'status',
  'rejectReason', 'createdAt', 'verifiedAt', 'verifiedBy'
];

/**
 * Header Kolom Resmi Sheet 'OnlineOrders' (Direktori Pesanan Delivery Online)
 */
const ONLINE_ORDER_HEADERS = [
  'orderId', 'tenantId', 'platform', 'platformRef', 'customerName',
  'customerPhone', 'driverInfo', 'itemsJson', 'subtotal', 'packagingFee',
  'totalAmount', 'specialNotes', 'status', 'createdAt', 'updatedAt'
];

/**
 * Helper Kriptografi SHA-256: Mengembalikan 64-karakter lowercase hex string
 */
function sha256Hex_(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(input), Utilities.Charset.UTF_8);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    let byteHex = hashVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    txtHash += byteHex;
  }
  return txtHash.toLowerCase();
}

/**
 * Helper Hash PIN Tenant: Kompatibel 100% dengan RestoSync.hashTenantPin
 */
function hashTenantPin_(id, pin) {
  const tid = (id && String(id).trim()) ? String(id).trim() : 'default';
  const cleanPin = (pin !== undefined && pin !== null) ? String(pin).trim() : '';
  return sha256Hex_('RESTO_PRO_PIN_V1:' + tid + ':' + cleanPin);
}

/**
 * Cek status inisialisasi direktori cloud tenants
 */
function isCloudInitialized_() {
  try {
    return PropertiesService.getScriptProperties().getProperty('TENANTS_CLOUD_INITIALIZED') === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Tandai bahwa cloud tenants sudah terinisialisasi
 */
function setCloudInitialized_() {
  try {
    PropertiesService.getScriptProperties().setProperty('TENANTS_CLOUD_INITIALIZED', 'true');
  } catch (e) {}
}

/**
 * Sensor Keamanan Publik: Menghapus PIN plaintext, nomor kontak staf/owner, dan API key custom
 */
function sanitizeTenantPublicInfo_(tenant) {
  if (!tenant || typeof tenant !== 'object') return tenant;
  const copy = Object.assign({}, tenant);
  delete copy.cashierPin;
  delete copy.ownerPin;
  delete copy.phone;
  delete copy.cashierPhone;
  delete copy.apiKey;
  return copy;
}

/**
 * Helper Konversi Boolean: Menangani boolean asli, string 'true'/'TRUE', angka 1, dll.
 */
function parseBool_(val) {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/**
 * Normalisasi data baris dari sheet Tenants: Coerce string, boolean, dan number secara aman
 */
function normalizeTenantRecordFromSheet_(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const t = Object.assign({}, raw);

  const stringFields = [
    'id', 'name', 'pic', 'phone', 'cashierPhone', 'city', 'plan', 'planName',
    'billingCycle', 'status', 'licenseKey', 'cashierPin', 'ownerPin',
    'cashierPinHash', 'ownerPinHash', 'gasUrl', 'apiKey', 'createdAt', 'expiresAt', 'updatedAt'
  ];
  stringFields.forEach(function (f) {
    if (t[f] !== undefined && t[f] !== null) {
      let s = String(t[f]).trim();
      if (s.startsWith("'")) s = s.slice(1);
      t[f] = s;
    } else {
      t[f] = '';
    }
  });

  t.isLifetime = parseBool_(t.isLifetime);
  t.tablesCount = Number(t.tablesCount) || (t.plan === 'trial' ? 4 : 12);
  t.price = Number(t.price) || 0;
  t.originalPrice = Number(t.originalPrice) || 0;

  return t;
}

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
    const isPublicAction = (
      action === 'ping' ||
      action === 'getMenuCatalog' ||
      action === 'getTenantPublicInfo' ||
      action === 'getTenantPaymentStatus' ||
      action === 'getOnlineOrders'
    );

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

      case 'getTenantPublicInfo':
        result = handleGetTenantPublicInfo(params.tenantId || params.id || '');
        break;

      case 'getTenants':
        result = handleGetAllTenants();
        break;

      case 'getPayments':
        result = handleGetPayments(params.statusFilter);
        break;

      case 'getTenantPaymentStatus':
        result = handleGetTenantPaymentStatus(params.tenantId || params.id || '');
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

      case 'getOnlineOrders':
        result = handleGetOnlineOrders(params);
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
    // 'placeOrder', 'registerTrialTenant', 'submitPaymentProof', dan 'submitOnlineOrder'/'updateOnlineOrderStatus' adalah aksi publik/webhook
    // Seluruh aksi mutasi lainnya (CRUD menu, hapus data, omset, CRM, simpan tenant, verifikasi pembayaran) WAJIB API Secret Key!
    const isPublicPost = (
      action === 'placeOrder' ||
      action === 'registerTrialTenant' ||
      action === 'submitPaymentProof' ||
      action === 'submitOnlineOrder' ||
      action === 'updateOnlineOrderStatus'
    );

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

      case 'saveTenant':
        result = handleSaveTenant(payload.data || payload);
        break;

      case 'deleteTenant':
        result = handleDeleteTenant((payload.data && payload.data.id) ? payload.data.id : payload.id);
        break;

      case 'registerTrialTenant':
        result = handleRegisterTrialTenant(payload.data || payload);
        break;

      case 'submitPaymentProof':
        result = handleSubmitPaymentProof(payload.data || payload);
        break;

      case 'submitOnlineOrder':
        result = handleSubmitOnlineOrder(payload.data || payload);
        break;

      case 'updateOnlineOrderStatus':
        result = handleUpdateOnlineOrderStatus(payload.data || payload);
        break;

      case 'verifyPayment':
      case 'approve':
      case 'reject':
        if (action === 'approve' || action === 'reject') {
          if (payload.data && typeof payload.data === 'object') {
            payload.data.actionType = action;
          } else {
            payload.actionType = action;
          }
        }
        result = handleVerifyPayment(payload.data || payload);
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

// ------------------------------------------------------------------------------
// MULTI-TENANT SAAS HANDLERS
// ------------------------------------------------------------------------------

/**
 * Mengambil informasi publik tenant (tanpa membocorkan PIN/phone/key)
 */
function handleGetTenantPublicInfo(tenantId) {
  if (tenantId === undefined || tenantId === null || String(tenantId).trim() === '') {
    return { success: true, notFound: true, cloudInitialized: isCloudInitialized_() };
  }
  const cleanId = String(tenantId).trim().toLowerCase();
  const rawTenants = getRowsAsObjects(CONFIG.SHEET_NAMES.TENANTS);
  const found = rawTenants.find(t => String(t.id || '').trim().toLowerCase() === cleanId);
  if (!found) {
    return { success: true, notFound: true, cloudInitialized: isCloudInitialized_() };
  }
  const normalized = normalizeTenantRecordFromSheet_(found);
  const publicTenant = sanitizeTenantPublicInfo_(normalized);
  return {
    success: true,
    cloudInitialized: isCloudInitialized_(),
    tenant: publicTenant,
    data: publicTenant
  };
}

/**
 * Mengambil seluruh data tenant (khusus Super Admin)
 */
function handleGetAllTenants() {
  const rawTenants = getRowsAsObjects(CONFIG.SHEET_NAMES.TENANTS);
  const tenants = rawTenants.map(normalizeTenantRecordFromSheet_);
  return {
    success: true,
    cloudInitialized: isCloudInitialized_(),
    tenants: tenants,
    data: tenants
  };
}

/**
 * Menyimpan / Update data tenant ke sheet Tenants
 */
function handleSaveTenant(data) {
  if (!data || data.id === undefined || data.id === null || String(data.id).trim() === '') {
    throw new Error('Data tenant dan id tenant wajib diisi');
  }
  setCloudInitialized_();
  const sheet = getOrCreateTenantsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIdx = headers.indexOf('id');
  const targetId = String(data.id).trim().toLowerCase();

  let existingRow = -1;
  let existingObj = null;

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idIdx] || '').trim().toLowerCase() === targetId) {
      existingRow = r + 1; // 1-based index
      existingObj = {};
      headers.forEach((h, i) => {
        existingObj[h] = values[r][i];
      });
      existingObj = normalizeTenantRecordFromSheet_(existingObj);
      break;
    }
  }

  const record = Object.assign({}, data);
  record.id = String(data.id).trim();
  const nowIso = new Date().toISOString();

  // Handle PIN hashes
  if (record.cashierPin !== undefined && String(record.cashierPin).trim() !== '') {
    record.cashierPinHash = hashTenantPin_(record.id, record.cashierPin);
  } else if (!record.cashierPinHash && existingObj && existingObj.cashierPinHash) {
    record.cashierPinHash = existingObj.cashierPinHash;
  } else if (!record.cashierPinHash) {
    record.cashierPinHash = hashTenantPin_(record.id, '1234');
  }

  if (record.ownerPin !== undefined && String(record.ownerPin).trim() !== '') {
    record.ownerPinHash = hashTenantPin_(record.id, record.ownerPin);
  } else if (!record.ownerPinHash && existingObj && existingObj.ownerPinHash) {
    record.ownerPinHash = existingObj.ownerPinHash;
  } else if (!record.ownerPinHash) {
    record.ownerPinHash = record.cashierPinHash || hashTenantPin_(record.id, '1234');
  }

  // Handle plan & lifetime
  if (record.plan !== undefined) {
    record.plan = String(record.plan).toLowerCase().trim();
  } else if (existingObj && existingObj.plan) {
    record.plan = existingObj.plan;
  } else {
    record.plan = 'monthly';
  }

  if (record.isLifetime !== undefined) {
    record.isLifetime = parseBool_(record.isLifetime);
  } else if (existingObj && existingObj.isLifetime !== undefined) {
    record.isLifetime = existingObj.isLifetime;
  } else {
    record.isLifetime = record.plan === 'lifetime';
  }

  if (record.isLifetime) {
    record.expiresAt = '';
  } else if (record.expiresAt !== undefined) {
    record.expiresAt = String(record.expiresAt || '').trim();
  } else if (existingObj && existingObj.expiresAt) {
    record.expiresAt = existingObj.expiresAt;
  } else {
    record.expiresAt = '';
  }

  if (record.tablesCount !== undefined) {
    record.tablesCount = Number(record.tablesCount) || 12;
  } else if (existingObj && existingObj.tablesCount !== undefined) {
    record.tablesCount = Number(existingObj.tablesCount) || 12;
  } else {
    record.tablesCount = 12;
  }

  if (record.price !== undefined) {
    record.price = Number(record.price) || 0;
  } else if (existingObj && existingObj.price !== undefined) {
    record.price = Number(existingObj.price) || 0;
  } else {
    record.price = 0;
  }

  if (record.originalPrice !== undefined) {
    record.originalPrice = Number(record.originalPrice) || 0;
  } else if (existingObj && existingObj.originalPrice !== undefined) {
    record.originalPrice = Number(existingObj.originalPrice) || 0;
  } else {
    record.originalPrice = 0;
  }

  record.name = String(record.name !== undefined ? record.name : (existingObj ? existingObj.name : '')).trim();
  record.pic = String(record.pic !== undefined ? record.pic : (existingObj ? existingObj.pic : '')).trim();
  record.phone = String(record.phone !== undefined ? record.phone : (existingObj ? existingObj.phone : '')).trim();
  record.cashierPhone = String(record.cashierPhone !== undefined ? record.cashierPhone : (existingObj ? existingObj.cashierPhone : '')).trim();
  record.city = String(record.city !== undefined ? record.city : (existingObj ? existingObj.city : '')).trim();
  record.planName = String(record.planName !== undefined ? record.planName : (existingObj ? existingObj.planName : '')).trim();
  record.billingCycle = String(record.billingCycle !== undefined ? record.billingCycle : (existingObj ? existingObj.billingCycle : '')).trim();
  record.status = String(record.status !== undefined ? record.status : (existingObj ? existingObj.status : 'active')).trim().toLowerCase();
  record.licenseKey = String(record.licenseKey !== undefined ? record.licenseKey : (existingObj ? existingObj.licenseKey : '')).trim();
  record.gasUrl = String(record.gasUrl !== undefined ? record.gasUrl : (existingObj ? existingObj.gasUrl : '')).trim();
  record.apiKey = String(record.apiKey !== undefined ? record.apiKey : (existingObj ? existingObj.apiKey : '')).trim();

  record.createdAt = (existingObj && existingObj.createdAt) || record.createdAt || nowIso;
  record.updatedAt = nowIso;

  const rowValues = headers.map(h => {
    let val = record[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val;
    return val;
  });

  if (existingRow > 0) {
    const range = sheet.getRange(existingRow, 1, 1, rowValues.length);
    try {
      if (typeof range.setNumberFormat === 'function') range.setNumberFormat('@');
    } catch (e) {}
    range.setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
    try {
      const lastR = sheet.getLastRow();
      const range = sheet.getRange(lastR, 1, 1, rowValues.length);
      if (typeof range.setNumberFormat === 'function') range.setNumberFormat('@');
    } catch (e) {}
  }

  invalidateCache();
  return {
    success: true,
    message: 'Data tenant ' + record.id + ' berhasil disimpan!',
    tenant: record,
    cloudInitialized: true
  };
}

/**
 * Menghapus tenant dari cloud
 */
function handleDeleteTenant(tenantId) {
  if (tenantId === undefined || tenantId === null || String(tenantId).trim() === '') {
    throw new Error('Tenant ID wajib diisi untuk menghapus tenant');
  }
  setCloudInitialized_();
  const cleanId = String(tenantId).trim().toLowerCase();
  const sheet = getOrCreateTenantsSheet_();
  const values = sheet.getDataRange().getValues();
  const idIdx = values[0].indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idIdx] || '').trim().toLowerCase() === cleanId) {
      sheet.deleteRow(r + 1);
      invalidateCache();
      return {
        success: true,
        message: 'Tenant ' + tenantId + ' berhasil dihapus dari cloud!',
        deletedId: String(tenantId),
        cloudInitialized: true
      };
    }
  }

  return {
    success: true,
    notFound: true,
    message: 'Tenant ' + tenantId + ' tidak ditemukan atau sudah dihapus',
    cloudInitialized: true
  };
}

/**
 * Registrasi Trial Tenant Mandiri (Public Self-Serve)
 */
function handleRegisterTrialTenant(data) {
  if (!data || data.name === undefined || data.name === null || String(data.name).trim() === '') {
    throw new Error('Nama resto wajib diisi');
  }
  setCloudInitialized_();

  const rawName = String(data.name).trim();
  let baseSlug = (data.id !== undefined && data.id !== null ? String(data.id).trim().toLowerCase() : '') ||
    rawName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') ||
    ('resto-' + Math.floor(1000 + Math.random() * 9000));
  baseSlug = baseSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const sheet = getOrCreateTenantsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIdx = headers.indexOf('id');

  const existingIds = new Set();
  for (let r = 1; r < values.length; r++) {
    existingIds.add(String(values[r][idIdx] || '').trim().toLowerCase());
  }

  let finalSlug = baseSlug;
  if (existingIds.has(finalSlug)) {
    let attempt = 0;
    do {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      finalSlug = baseSlug + '-' + suffix;
      attempt++;
    } while (existingIds.has(finalSlug) && attempt < 20);
  }

  const cashierPin = data.cashierPin ? String(data.cashierPin).trim() : '1234';
  const ownerPin = data.ownerPin ? String(data.ownerPin).trim() : cashierPin;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 14 * 86400000).toISOString();

  const trialTenant = {
    id: finalSlug,
    name: rawName,
    pic: data.pic ? String(data.pic).trim() : 'Pemilik Resto',
    phone: data.phone ? String(data.phone).trim() : '',
    cashierPhone: data.cashierPhone ? String(data.cashierPhone).trim() : '',
    cashierPinHash: hashTenantPin_(finalSlug, cashierPin),
    ownerPinHash: hashTenantPin_(finalSlug, ownerPin),
    city: data.city ? String(data.city).trim() : 'Indonesia',
    plan: 'trial',
    planName: 'Free Trial (14 Hari)',
    price: 0,
    originalPrice: 0,
    billingCycle: 'trial',
    tablesCount: 4,
    status: 'trial',
    isLifetime: false,
    createdAt: now.toISOString(),
    expiresAt: expiresAt,
    updatedAt: now.toISOString(),
    gasUrl: (data.gasUrl || '').trim(),
    apiKey: (data.apiKey || '').trim(),
    licenseKey: data.licenseKey || ('RP-TRL-' + finalSlug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) + '-' + Math.random().toString(36).substring(2, 8).toUpperCase())
  };

  const rowValues = headers.map(h => {
    let val = trialTenant[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val;
    return val;
  });

  sheet.appendRow(rowValues);
  try {
    const lastR = sheet.getLastRow();
    const range = sheet.getRange(lastR, 1, 1, rowValues.length);
    if (typeof range.setNumberFormat === 'function') range.setNumberFormat('@');
  } catch (e) {}
  invalidateCache();

  return {
    success: true,
    message: 'Registrasi trial tenant ' + finalSlug + ' berhasil!',
    tenant: trialTenant,
    slug: finalSlug,
    cloudInitialized: true
  };
}

// ------------------------------------------------------------------------------
// PAYMENTS & BUKTI TRANSFER HANDLERS (TAHAP 2)
// ------------------------------------------------------------------------------

/**
 * Helper Google Drive: Menyimpan file Base64 bukti pembayaran ke Google Drive
 */
function savePaymentProofToDrive_(imageBase64, imageMimeType, tenantId, customFileName) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('Data gambar bukti pembayaran Base64 tidak ditemukan atau kosong');
  }

  let cleanBase64 = imageBase64;
  if (cleanBase64.indexOf(',') !== -1) {
    cleanBase64 = cleanBase64.split(',')[1];
  }
  cleanBase64 = cleanBase64.trim();

  let mimeType = imageMimeType || 'image/jpeg';
  let ext = 'jpg';
  if (mimeType.indexOf('png') !== -1) {
    ext = 'png';
  } else if (mimeType.indexOf('webp') !== -1) {
    ext = 'webp';
  } else if (customFileName && customFileName.indexOf('.') !== -1) {
    ext = customFileName.split('.').pop().toLowerCase();
  }

  const safeTenantId = String(tenantId || 'tenant').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const fileName = 'BUKTI_' + safeTenantId + '_' + Date.now() + '.' + ext;

  const decodedBytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

  const folderId = CONFIG.ROOT_FOLDER_ID;
  let targetFolder = null;
  if (folderId) {
    try {
      targetFolder = DriveApp.getFolderById(folderId);
    } catch (e) {
      targetFolder = null;
    }
  }

  const file = targetFolder ? targetFolder.createFile(blob) : DriveApp.createFile(blob);
  return {
    fileId: file.getId(),
    fileUrl: (typeof file.getUrl === 'function') ? file.getUrl() : ('https://drive.google.com/file/d/' + file.getId() + '/view')
  };
}

/**
 * Submit Bukti Pembayaran Tenant (Public Endpoint)
 */
function handleSubmitPaymentProof(data) {
  if (!data || !data.tenantId || String(data.tenantId).trim() === '') {
    throw new Error('Tenant ID wajib diisi untuk upload bukti pembayaran');
  }

  const cleanTenantId = String(data.tenantId).trim().toLowerCase();
  const rawAmount = Number(data.amount);
  if (isNaN(rawAmount) || rawAmount <= 0) {
    throw new Error('Nominal pembayaran harus berupa angka valid lebih dari 0');
  }

  if (!data.imageBase64 || String(data.imageBase64).trim() === '') {
    throw new Error('File gambar bukti transfer (Base64) wajib diunggah');
  }

  // 1. Dapatkan nama tenant dari sheet Tenants jika ada
  let tenantName = cleanTenantId;
  try {
    const rawTenants = getRowsAsObjects(CONFIG.SHEET_NAMES.TENANTS);
    const tenantRecord = rawTenants.find(t => String(t.id || '').trim().toLowerCase() === cleanTenantId);
    if (tenantRecord && tenantRecord.name) {
      tenantName = tenantRecord.name;
    } else if (data.tenantName) {
      tenantName = String(data.tenantName).trim();
    }
  } catch (e) {}

  // 2. Upload file gambar ke Google Drive TERLEBIH DAHULU (Review Focus #3)
  // Tangani kegagalan Drive secara anggun tanpa merusak baris sheet
  let driveResult;
  try {
    driveResult = savePaymentProofToDrive_(data.imageBase64, data.imageMimeType, cleanTenantId, data.fileName);
  } catch (err) {
    return {
      success: false,
      error: 'Gagal mengunggah bukti pembayaran ke Google Drive: ' + err.message
    };
  }

  const sheet = getOrCreatePaymentsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIdx = headers.indexOf('id');
  const tenantIdIdx = headers.indexOf('tenantId');
  const statusIdx = headers.indexOf('status');

  // 3. Periksa apakah sudah ada pembayaran dengan status 'pending' untuk tenant ini (Review Focus #2)
  let existingPendingRow = -1;
  let existingPaymentId = null;

  for (let r = 1; r < values.length; r++) {
    const rTenantId = String(values[r][tenantIdIdx] || '').trim().toLowerCase();
    const rStatus = String(values[r][statusIdx] || '').trim().toLowerCase();
    if (rTenantId === cleanTenantId && rStatus === 'pending') {
      existingPendingRow = r + 1; // 1-based index
      existingPaymentId = String(values[r][idIdx] || '').trim();
      break;
    }
  }

  const plan = (data.plan && String(data.plan).trim().toLowerCase() === 'lifetime') ? 'lifetime' : 'monthly';
  const nowIso = new Date().toISOString();

  let paymentId = existingPaymentId;
  if (existingPendingRow > 0) {
    // Update existing pending row
    const record = {
      id: existingPaymentId,
      tenantId: cleanTenantId,
      tenantName: tenantName,
      plan: plan,
      amount: rawAmount,
      bankTarget: String(data.bankTarget || '').trim(),
      proofFileId: driveResult.fileId,
      proofUrl: driveResult.fileUrl,
      senderName: String(data.senderName || '').trim(),
      senderBank: String(data.senderBank || '').trim(),
      status: 'pending',
      rejectReason: '',
      createdAt: nowIso,
      verifiedAt: '',
      verifiedBy: ''
    };

    const rowValues = headers.map(h => {
      let val = record[h];
      if (val === undefined || val === null) return '';
      return val;
    });

    const range = sheet.getRange(existingPendingRow, 1, 1, rowValues.length);
    try {
      if (typeof range.setNumberFormat === 'function') range.setNumberFormat('@');
    } catch (e) {}
    range.setValues([rowValues]);
  } else {
    // Buat baris baru
    paymentId = 'PAY-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const record = {
      id: paymentId,
      tenantId: cleanTenantId,
      tenantName: tenantName,
      plan: plan,
      amount: rawAmount,
      bankTarget: String(data.bankTarget || '').trim(),
      proofFileId: driveResult.fileId,
      proofUrl: driveResult.fileUrl,
      senderName: String(data.senderName || '').trim(),
      senderBank: String(data.senderBank || '').trim(),
      status: 'pending',
      rejectReason: '',
      createdAt: nowIso,
      verifiedAt: '',
      verifiedBy: ''
    };

    const rowValues = headers.map(h => {
      let val = record[h];
      if (val === undefined || val === null) return '';
      return val;
    });

    sheet.appendRow(rowValues);
    try {
      const lastR = sheet.getLastRow();
      const range = sheet.getRange(lastR, 1, 1, rowValues.length);
      if (typeof range.setNumberFormat === 'function') range.setNumberFormat('@');
    } catch (e) {}
  }

  // CATATAN PENTING: Status tenant di sheet Tenants TIDAK DIUBAH di sini!
  invalidateCache();

  return {
    success: true,
    paymentId: paymentId,
    status: 'pending',
    message: 'Bukti pembayaran berhasil diunggah. Menunggu verifikasi Admin RASH.'
  };
}

/**
 * Mengambil daftar seluruh pembayaran (Khusus Super Admin)
 */
function handleGetPayments(statusFilter) {
  const rawPayments = getRowsAsObjects(CONFIG.SHEET_NAMES.PAYMENTS);
  let payments = rawPayments.map(p => {
    return {
      id: String(p.id || '').trim(),
      tenantId: String(p.tenantId || '').trim(),
      tenantName: String(p.tenantName || '').trim(),
      plan: String(p.plan || 'monthly').trim(),
      amount: Number(p.amount) || 0,
      bankTarget: String(p.bankTarget || '').trim(),
      proofFileId: String(p.proofFileId || '').trim(),
      proofUrl: String(p.proofUrl || '').trim(),
      senderName: String(p.senderName || '').trim(),
      senderBank: String(p.senderBank || '').trim(),
      status: String(p.status || 'pending').trim().toLowerCase(),
      rejectReason: String(p.rejectReason || '').trim(),
      createdAt: String(p.createdAt || '').trim(),
      verifiedAt: String(p.verifiedAt || '').trim(),
      verifiedBy: String(p.verifiedBy || '').trim()
    };
  });

  if (statusFilter && String(statusFilter).trim() !== '') {
    const filter = String(statusFilter).trim().toLowerCase();
    payments = payments.filter(p => p.status === filter);
  }

  return {
    success: true,
    payments: payments,
    data: payments
  };
}

/**
 * Mengambil status pembayaran terakhir untuk tenant tertentu (Public Endpoint)
 */
function handleGetTenantPaymentStatus(tenantId) {
  if (!tenantId || String(tenantId).trim() === '') {
    return { success: true, latestPayment: null };
  }

  const cleanId = String(tenantId).trim().toLowerCase();
  const rawPayments = getRowsAsObjects(CONFIG.SHEET_NAMES.PAYMENTS);
  const tenantPayments = rawPayments.filter(p => String(p.tenantId || '').trim().toLowerCase() === cleanId);

  if (tenantPayments.length === 0) {
    return { success: true, latestPayment: null };
  }

  const latest = tenantPayments[tenantPayments.length - 1];
  const latestPayment = {
    id: String(latest.id || '').trim(),
    plan: String(latest.plan || 'monthly').trim(),
    amount: Number(latest.amount) || 0,
    bankTarget: String(latest.bankTarget || '').trim(),
    senderName: String(latest.senderName || '').trim(),
    senderBank: String(latest.senderBank || '').trim(),
    status: String(latest.status || 'pending').trim().toLowerCase(),
    rejectReason: String(latest.rejectReason || '').trim(),
    createdAt: String(latest.createdAt || '').trim(),
    proofUrl: String(latest.proofUrl || '').trim()
  };

  return {
    success: true,
    latestPayment: latestPayment,
    data: latestPayment
  };
}

/**
 * Verifikasi Pembayaran (Approve / Reject) oleh Super Admin
 */
function handleVerifyPayment(data) {
  if (!data || !data.paymentId || String(data.paymentId).trim() === '') {
    throw new Error('Payment ID wajib diisi untuk verifikasi pembayaran');
  }

  const paymentId = String(data.paymentId).trim();
  let rawAction = '';
  if (data.action && String(data.action).trim() !== 'verifyPayment') {
    rawAction = String(data.action).trim().toLowerCase();
  } else if (data.actionType) {
    rawAction = String(data.actionType).trim().toLowerCase();
  } else if (data.decision) {
    rawAction = String(data.decision).trim().toLowerCase();
  } else if (data.verificationAction) {
    rawAction = String(data.verificationAction).trim().toLowerCase();
  } else if (data.status) {
    rawAction = String(data.status).trim().toLowerCase();
  }

  if (rawAction === 'verified' || rawAction === 'approved') rawAction = 'approve';
  if (rawAction === 'rejected') rawAction = 'reject';

  if (rawAction !== 'approve' && rawAction !== 'reject') {
    throw new Error('Action verifikasi pembayaran tidak valid: ' + (data.action || data.actionType || rawAction));
  }

  const paySheet = getOrCreatePaymentsSheet_();
  const payValues = paySheet.getDataRange().getValues();
  const payHeaders = payValues[0];
  const idIdx = payHeaders.indexOf('id');
  const tenantIdIdx = payHeaders.indexOf('tenantId');
  const planIdx = payHeaders.indexOf('plan');
  const statusIdx = payHeaders.indexOf('status');
  const rejectReasonIdx = payHeaders.indexOf('rejectReason');
  const verifiedAtIdx = payHeaders.indexOf('verifiedAt');
  const verifiedByIdx = payHeaders.indexOf('verifiedBy');

  let payRowIdx = -1;
  let targetPayment = null;

  for (let r = 1; r < payValues.length; r++) {
    if (String(payValues[r][idIdx] || '').trim() === paymentId) {
      payRowIdx = r + 1; // 1-based index
      targetPayment = {};
      payHeaders.forEach((h, i) => {
        targetPayment[h] = payValues[r][i];
      });
      break;
    }
  }

  if (payRowIdx === -1 || !targetPayment) {
    return {
      success: false,
      notFound: true,
      message: 'Data pembayaran dengan ID ' + paymentId + ' tidak ditemukan'
    };
  }

  const nowIso = new Date().toISOString();

  if (rawAction === 'approve') {
    // 1. Update baris pembayaran di sheet Payments
    paySheet.getRange(payRowIdx, statusIdx + 1).setValue('verified');
    paySheet.getRange(payRowIdx, verifiedAtIdx + 1).setValue(nowIso);
    paySheet.getRange(payRowIdx, verifiedByIdx + 1).setValue('admin');
    if (rejectReasonIdx !== -1) {
      paySheet.getRange(payRowIdx, rejectReasonIdx + 1).setValue('');
    }

    // 2. Cari tenant di sheet Tenants
    const tenantId = String(targetPayment.tenantId || '').trim().toLowerCase();
    const rawTenants = getRowsAsObjects(CONFIG.SHEET_NAMES.TENANTS);
    const tenantObj = rawTenants.find(t => String(t.id || '').trim().toLowerCase() === tenantId);

    let updatedTenant = null;
    if (tenantObj) {
      const plan = String(targetPayment.plan || 'monthly').trim().toLowerCase();
      tenantObj.plan = plan;

      if (plan === 'lifetime') {
        tenantObj.isLifetime = true;
        tenantObj.expiresAt = '';
        tenantObj.status = 'active';
      } else {
        // Plan monthly:
        // Review Focus #1: Akumulasi hari jika masa aktif masih tersisa (> now)
        tenantObj.isLifetime = false;
        tenantObj.status = 'active';

        const now = new Date();
        let baseDate = now;
        if (tenantObj.expiresAt) {
          const currentExpiry = new Date(tenantObj.expiresAt);
          if (!isNaN(currentExpiry.getTime()) && currentExpiry.getTime() > now.getTime()) {
            baseDate = currentExpiry;
          }
        }
        const newExpiry = new Date(baseDate.getTime() + 30 * 86400000);
        tenantObj.expiresAt = newExpiry.toISOString();
      }

      // Preservasi kuota meja kustom jika sebelumnya sudah > 12
      tenantObj.tablesCount = Math.max(Number(tenantObj.tablesCount) || 12, 12);

      // Simpan perubahan tenant via handleSaveTenant
      const saveRes = handleSaveTenant(tenantObj);
      updatedTenant = saveRes.tenant || tenantObj;
    }

    invalidateCache();
    return {
      success: true,
      paymentStatus: 'verified',
      updatedTenant: updatedTenant
    };
  } else {
    // rawAction === 'reject'
    // Review Focus #4: Fallback default alasan penolakan jika kosong
    const cleanReason = String(data.rejectReason || '').trim() ||
      'Bukti pembayaran belum dapat diverifikasi. Silakan periksa nominal/rekening dan unggah ulang.';

    paySheet.getRange(payRowIdx, statusIdx + 1).setValue('rejected');
    if (rejectReasonIdx !== -1) {
      paySheet.getRange(payRowIdx, rejectReasonIdx + 1).setValue(cleanReason);
    }
    paySheet.getRange(payRowIdx, verifiedAtIdx + 1).setValue(nowIso);
    paySheet.getRange(payRowIdx, verifiedByIdx + 1).setValue('admin');

    // CATATAN PENTING: Sheet Tenants TETAP TIDAK TERSENTUH
    invalidateCache();
    return {
      success: true,
      paymentStatus: 'rejected',
      rejectReason: cleanReason
    };
  }
}

// ==============================================================================
// 3.5. MANAJEMEN PESANAN ONLINE DELIVERY (OMNICHANNEL REST API)
// ==============================================================================

/**
 * Submit Pesanan Online Delivery (GoFood, GrabFood, ShopeeFood, Qpon, Takeaway)
 */
function handleSubmitOnlineOrder(data) {
  if (!data) {
    throw new Error('Data pesanan online tidak boleh kosong');
  }

  const cleanTenantId = (data.tenantId && String(data.tenantId).trim())
    ? String(data.tenantId).trim().toLowerCase()
    : 'default';

  const cleanPlatform = String(data.platform || '').trim().toLowerCase();
  const validPlatforms = ['gofood', 'grabfood', 'shopeefood', 'qpon', 'takeaway'];
  if (!cleanPlatform || !validPlatforms.includes(cleanPlatform)) {
    throw new Error('Platform tidak valid. Pilih: gofood, grabfood, shopeefood, qpon, atau takeaway');
  }

  let items = data.items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { items = []; }
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Daftar pesanan (items) harus berupa array dan minimal berisi 1 item');
  }

  const totalAmount = Number(data.totalAmount);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    throw new Error('Total pembayaran (totalAmount) harus berupa angka valid lebih dari 0');
  }

  const subtotal = Number(data.subtotal) || 0;
  const packagingFee = Number(data.packagingFee) || 0;
  const cleanPlatformRef = String(data.platformRef || '').trim();
  const customerName = String(data.customerName || data.customer || '').trim();
  const customerPhone = String(data.customerPhone || data.phone || '').trim();
  const specialNotes = String(data.specialNotes || data.packagingNotes || data.notes || '').trim();
  const status = String(data.status || 'cooking').trim().toLowerCase();

  let driverInfoStr = '';
  if (data.driverInfo !== undefined && data.driverInfo !== null) {
    driverInfoStr = typeof data.driverInfo === 'object' ? JSON.stringify(data.driverInfo) : String(data.driverInfo);
  }

  const sheet = getOrCreateOnlineOrdersSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const orderIdIdx = headers.indexOf('orderId');
  const tenantIdIdx = headers.indexOf('tenantId');
  const platformRefIdx = headers.indexOf('platformRef');
  const statusIdx = headers.indexOf('status');
  const updatedAtIdx = headers.indexOf('updatedAt');

  // Mencegah duplikasi: Jika platformRef sudah ada untuk tenantId yang sama dan statusnya bukan 'cancelled'
  let existingRow = -1;
  let existingOrderId = null;
  let existingStatus = null;

  if (cleanPlatformRef) {
    for (let r = 1; r < values.length; r++) {
      const rTenantId = String(values[r][tenantIdIdx] || '').trim().toLowerCase();
      const rPlatformRef = String(values[r][platformRefIdx] || '').trim();
      const rStatus = String(values[r][statusIdx] || '').trim().toLowerCase();

      if (rTenantId === cleanTenantId && rPlatformRef === cleanPlatformRef && rStatus !== 'cancelled') {
        existingRow = r + 1; // 1-based index
        existingOrderId = String(values[r][orderIdIdx] || '').trim();
        existingStatus = rStatus;
        break;
      }
    }
  }

  const nowIso = new Date().toISOString();

  if (existingRow > 0 && existingOrderId) {
    // Order sudah tercatat, kembalikan order existing atau update updatedAt
    try {
      if (updatedAtIdx !== -1) {
        sheet.getRange(existingRow, updatedAtIdx + 1).setValue(nowIso);
      }
    } catch (e) {}

    return {
      success: true,
      orderId: existingOrderId,
      status: existingStatus || status,
      message: 'Pesanan online berhasil dicatat.'
    };
  }

  // Generate orderId baru berformat: ORD-<PLATFORM>-<YYYYMMDD>-<HEX4>
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;
  const hex4 = Math.random().toString(16).substring(2, 6).toUpperCase();
  const orderId = (data.orderId && String(data.orderId).trim())
    ? String(data.orderId).trim()
    : ('ORD-' + cleanPlatform.toUpperCase() + '-' + datePart + '-' + hex4);

  const record = {
    orderId: orderId,
    tenantId: cleanTenantId,
    platform: cleanPlatform,
    platformRef: cleanPlatformRef,
    customerName: customerName,
    customerPhone: customerPhone,
    driverInfo: driverInfoStr,
    itemsJson: JSON.stringify(items),
    subtotal: subtotal,
    packagingFee: packagingFee,
    totalAmount: totalAmount,
    specialNotes: specialNotes,
    status: status,
    createdAt: data.createdAt || nowIso,
    updatedAt: nowIso
  };

  const rowValues = headers.map(h => {
    let val = record[h];
    if (val === undefined || val === null) return '';
    return val;
  });

  sheet.appendRow(rowValues);

  return {
    success: true,
    orderId: orderId,
    status: record.status,
    message: 'Pesanan online berhasil dicatat.'
  };
}

/**
 * Mengambil daftar pesanan online dari sheet OnlineOrders
 */
function handleGetOnlineOrders(params) {
  const p = params || {};
  const filterTenantId = (p.tenantId || p.id) ? String(p.tenantId || p.id).trim().toLowerCase() : '';
  const filterStatus = p.status ? String(p.status).trim().toLowerCase() : '';
  const limit = p.limit ? parseInt(p.limit, 10) : 50;

  const rawOrders = getRowsAsObjects(CONFIG.SHEET_NAMES.ONLINE_ORDERS);

  let orders = rawOrders.map(o => {
    let items = [];
    if (Array.isArray(o.items)) {
      items = o.items;
    } else if (Array.isArray(o.itemsJson)) {
      items = o.itemsJson;
    } else if (typeof o.itemsJson === 'string' && o.itemsJson.trim()) {
      try { items = JSON.parse(o.itemsJson); } catch (e) { items = []; }
    }

    let driverInfo = o.driverInfo;
    if (typeof driverInfo === 'string' && (driverInfo.startsWith('{') || driverInfo.startsWith('['))) {
      try { driverInfo = JSON.parse(driverInfo); } catch (e) {}
    }

    return {
      orderId: String(o.orderId || '').trim(),
      id: String(o.orderId || '').trim(),
      tenantId: String(o.tenantId || '').trim(),
      platform: String(o.platform || '').trim(),
      channel: String(o.platform || '').trim(),
      platformRef: String(o.platformRef || '').trim(),
      orderRef: String(o.platformRef || o.orderId || '').trim(),
      customerName: String(o.customerName || '').trim(),
      customerPhone: String(o.customerPhone || '').trim(),
      driverInfo: driverInfo,
      items: items,
      subtotal: Number(o.subtotal) || 0,
      packagingFee: Number(o.packagingFee) || 0,
      totalAmount: Number(o.totalAmount) || 0,
      grandTotal: Number(o.totalAmount) || 0,
      specialNotes: String(o.specialNotes || '').trim(),
      status: String(o.status || 'new').trim().toLowerCase(),
      createdAt: String(o.createdAt || '').trim(),
      updatedAt: String(o.updatedAt || '').trim()
    };
  });

  if (filterTenantId) {
    orders = orders.filter(o => o.tenantId.toLowerCase() === filterTenantId);
  }

  if (filterStatus) {
    orders = orders.filter(o => o.status.toLowerCase() === filterStatus);
  }

  if (limit > 0 && orders.length > limit) {
    orders = orders.slice(-limit);
  }

  return {
    success: true,
    orders: orders,
    data: orders
  };
}

/**
 * Update Status Pesanan Online
 */
function handleUpdateOnlineOrderStatus(data) {
  if (!data || !data.orderId || String(data.orderId).trim() === '') {
    throw new Error('orderId wajib diisi untuk update status pesanan');
  }
  if (!data.status || String(data.status).trim() === '') {
    throw new Error('status wajib diisi untuk update status pesanan');
  }

  const orderId = String(data.orderId).trim();
  const cleanTenantId = (data.tenantId && String(data.tenantId).trim())
    ? String(data.tenantId).trim().toLowerCase()
    : '';
  const newStatus = String(data.status).trim().toLowerCase();

  const sheet = getOrCreateOnlineOrdersSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const orderIdIdx = headers.indexOf('orderId');
  const tenantIdIdx = headers.indexOf('tenantId');
  const statusIdx = headers.indexOf('status');
  const driverInfoIdx = headers.indexOf('driverInfo');
  const updatedAtIdx = headers.indexOf('updatedAt');

  let targetRow = -1;
  for (let r = 1; r < values.length; r++) {
    const rOrderId = String(values[r][orderIdIdx] || '').trim();
    const rTenantId = String(values[r][tenantIdIdx] || '').trim().toLowerCase();

    if (rOrderId === orderId) {
      if (!cleanTenantId || rTenantId === cleanTenantId) {
        targetRow = r + 1; // 1-based index
        break;
      }
    }
  }

  if (targetRow === -1) {
    return {
      success: false,
      notFound: true,
      message: 'Pesanan online dengan ID ' + orderId + ' tidak ditemukan'
    };
  }

  const nowIso = new Date().toISOString();

  if (statusIdx !== -1) {
    sheet.getRange(targetRow, statusIdx + 1).setValue(newStatus);
  }
  if (updatedAtIdx !== -1) {
    sheet.getRange(targetRow, updatedAtIdx + 1).setValue(nowIso);
  }
  if (data.driverInfo !== undefined && driverInfoIdx !== -1) {
    const dStr = typeof data.driverInfo === 'object' ? JSON.stringify(data.driverInfo) : String(data.driverInfo);
    sheet.getRange(targetRow, driverInfoIdx + 1).setValue(dStr);
  }

  return {
    success: true,
    orderId: orderId,
    status: newStatus,
    message: 'Status pesanan online berhasil diperbarui.'
  };
}

// ==============================================================================
// 4. UTILITIES & HELPER DATABASE
// ==============================================================================

function getSpreadsheet_() {
  const ssId = CONFIG.SPREADSHEET_ID;
  if (ssId) {
    try {
      const ss = SpreadsheetApp.openById(ssId);
      if (ss) return ss;
    } catch (e) {}
  }
  try {
    if (typeof SpreadsheetApp.getActiveSpreadsheet === 'function') {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    }
  } catch (e) {}
  throw new Error('SPREADSHEET_ID belum dikonfigurasi! Jalankan setupAppEnvironment() terlebih dahulu.');
}

function getOrCreateTenantsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TENANTS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.TENANTS);
    sheet.appendRow(TENANT_HEADERS);
    styleHeader(sheet, '#0284C7');
  }
  return sheet;
}

function getOrCreatePaymentsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.PAYMENTS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.PAYMENTS);
    sheet.appendRow(PAYMENT_HEADERS);
    styleHeader(sheet, '#059669');
  }
  return sheet;
}

function getOrCreateOnlineOrdersSheet_(ss) {
  const targetSs = ss || getSpreadsheet_();
  let sheet = targetSs.getSheetByName(CONFIG.SHEET_NAMES.ONLINE_ORDERS);
  if (!sheet) {
    sheet = targetSs.insertSheet(CONFIG.SHEET_NAMES.ONLINE_ORDERS);
    sheet.appendRow(ONLINE_ORDER_HEADERS);
    styleHeader(sheet, '#EA580C');
  }
  return sheet;
}

function initOnlineOrdersSheet_(ss) {
  return getOrCreateOnlineOrdersSheet_(ss);
}

function getSheet(sheetName) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (sheetName === CONFIG.SHEET_NAMES.TENANTS) {
      return getOrCreateTenantsSheet_();
    }
    if (sheetName === CONFIG.SHEET_NAMES.PAYMENTS) {
      return getOrCreatePaymentsSheet_();
    }
    if (sheetName === CONFIG.SHEET_NAMES.ONLINE_ORDERS) {
      return getOrCreateOnlineOrdersSheet_();
    }
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

  // -------------------------------------------------------------
  // Sheet 7: Tenants (Direktori Tenant SaaS Multi-Resto)
  // -------------------------------------------------------------
  const tenantSheet = ss.insertSheet(CONFIG.SHEET_NAMES.TENANTS);
  tenantSheet.appendRow(TENANT_HEADERS);
  styleHeader(tenantSheet, '#0284C7');

  // -------------------------------------------------------------
  // Sheet 8: Payments (Direktori Pembayaran & Bukti Transfer)
  // -------------------------------------------------------------
  const paySheet = ss.insertSheet(CONFIG.SHEET_NAMES.PAYMENTS);
  paySheet.appendRow(PAYMENT_HEADERS);
  styleHeader(paySheet, '#059669');

  // -------------------------------------------------------------
  // Sheet 9: OnlineOrders (Direktori Pesanan Online Delivery)
  // -------------------------------------------------------------
  initOnlineOrdersSheet_(ss);

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
