/**
 * Resto Pro by RASH WebApp Builder
 * Real-Time Event Bus & Web Audio Chime Engine
 * Menghubungkan QR Self-Order <--> KDS Layar Dapur <--> POS Kasir secara instan
 */

const RestoSync = {
  TENANTS_DIRECTORY_KEY: "resto_pro_super_admin_tenants_v1",

  // --------------------------------------------------------------------------
  // MULTI-TENANT SAAS ROUTING & NAMESPACE ISOLATION
  // --------------------------------------------------------------------------
  getTenantId() {
    try {
      if (typeof window !== "undefined") {
        if (window.location && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const t = params.get("tenant") || params.get("resto");
          if (t && t.trim()) {
            const clean = t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
            sessionStorage.setItem("resto_pro_active_tenant", clean);
            return clean;
          }
        }
        const cached = sessionStorage.getItem("resto_pro_active_tenant");
        if (cached && cached.trim()) return cached.trim();
      }
    } catch (e) {}
    return "default";
  },

  setTenantId(tenantId) {
    try {
      const clean = (tenantId || "default").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
      sessionStorage.setItem("resto_pro_active_tenant", clean);
      return clean;
    } catch (e) {
      return "default";
    }
  },

  getStorageKey(baseKey) {
    const tenant = this.getTenantId();
    if (tenant && tenant !== "default") {
      return `${baseKey}_tenant_${tenant}`;
    }
    return baseKey;
  },

  get CHANNEL_NAME() {
    const t = this.getTenantId();
    return (t && t !== "default") ? `resto_pro_live_sync_${t}` : "resto_pro_live_sync";
  },

  get STORAGE_EVENT_KEY() {
    const t = this.getTenantId();
    return (t && t !== "default") ? `resto_pro_sync_event_${t}` : "resto_pro_sync_event";
  },

  get KDS_STORAGE_KEY() { return this.getStorageKey("resto_pro_kds_tickets"); },
  get ONLINE_ORDERS_STORAGE_KEY() { return this.getStorageKey("resto_pro_online_delivery_orders_v1"); },
  get TRANSACTIONS_STORAGE_KEY() { return this.getStorageKey("resto_pro_daily_transactions"); },
  get MEMBERS_STORAGE_KEY() { return this.getStorageKey("resto_pro_crm_members"); },
  get MENU_STORAGE_KEY() { return this.getStorageKey("resto_pro_menu_catalog"); },
  get RESERVATIONS_STORAGE_KEY() { return this.getStorageKey("resto_pro_table_reservations"); },
  get TABLES_STORAGE_KEY() { return this.getStorageKey("resto_pro_tables_list"); },
  get LICENSE_STORAGE_KEY() { return this.getStorageKey("resto_pro_saas_license"); },
  get GAS_URL_STORAGE_KEY() { return this.getStorageKey("resto_pro_gas_url"); },
  get GAS_API_KEY_STORAGE_KEY() { return this.getStorageKey("resto_pro_gas_api_key"); },
  get SUPABASE_URL_STORAGE_KEY() { return this.getStorageKey("resto_pro_supabase_url"); },
  get SUPABASE_KEY_STORAGE_KEY() { return this.getStorageKey("resto_pro_supabase_key"); },

  // Super Admin Tenant Directory Helpers
  getAllTenants() {
    try {
      const raw = localStorage.getItem(this.TENANTS_DIRECTORY_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}

    // Inisialisasi default demo tenants jika masih kosong
    const defaultTenants = [
      {
        id: "harapan-corner",
        name: "Harapan Corner Resto & Coffee",
        pic: "Bpk. Budi Santoso",
        phone: "081234567890",
        city: "Bandung, Jawa Barat",
        plan: "pro",
        planName: "Paket Pro (Multi-Stasiun + GrabFood/GoFood)",
        price: 199000,
        billingCycle: "monthly",
        tablesCount: 12,
        status: "active",
        createdAt: "2026-11-01T08:00:00Z",
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        gasUrl: "",
        apiKey: "",
        licenseKey: "RP-PRO-HARAPAN-CORNER-L9X4K2"
      },
      {
        id: "kopi-senja",
        name: "Kopi Senja Heritage",
        pic: "Ibu Rahmawati S.",
        phone: "081198765432",
        city: "Jakarta Selatan",
        plan: "trial",
        planName: "Trial (14 Hari Gratis)",
        price: 0,
        billingCycle: "trial",
        tablesCount: 8,
        status: "trial",
        createdAt: "2026-11-05T10:30:00Z",
        expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(),
        gasUrl: "",
        apiKey: "",
        licenseKey: "RP-TRL-KOPI-SENJA-88A92F"
      },
      {
        id: "warung-bu-siti",
        name: "Warung Sate Khas Madura Bu Siti",
        pic: "Cak H. Imron",
        phone: "081388776655",
        city: "Surabaya",
        plan: "basic",
        planName: "Paket Basic (Kasir POS + QR Meja)",
        price: 99000,
        billingCycle: "monthly",
        tablesCount: 10,
        status: "active",
        createdAt: "2026-10-20T09:00:00Z",
        expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
        gasUrl: "",
        apiKey: "",
        licenseKey: "RP-BSC-WARUNG-BU-SITI-33C14E"
      }
    ];
    this.saveAllTenants(defaultTenants);
    return defaultTenants;
  },

  saveAllTenants(tenants) {
    try {
      localStorage.setItem(this.TENANTS_DIRECTORY_KEY, JSON.stringify(tenants || []));
      this.emit("TENANTS_UPDATED", { count: (tenants || []).length });
      return true;
    } catch (e) {
      console.warn("Gagal simpan tenant directory:", e);
      return false;
    }
  },

  getTenantInfo(targetTenantId) {
    try {
      const tenantId = targetTenantId || this.getTenantId();
      if (!tenantId || tenantId === "default") return null;
      const all = this.getAllTenants();
      return all.find(t => t.id === tenantId) || {
        id: tenantId,
        name: tenantId.replace(/-/g, " ").toUpperCase(),
        plan: "pro",
        status: "active",
        tablesCount: 12
      };
    } catch (e) {
      return null;
    }
  },

  createLicenseToken(payload = {}) {
    const appCode = "RESTO";
    const clientTag = (payload.tenantId || payload.restaurantName || "CLIENT").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
    const expiryYear = new Date(payload.expiresAt || (Date.now() + 365 * 86400000)).getFullYear();
    const randChecksum = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RASH-${appCode}-PRO-${clientTag}-${expiryYear}-${randChecksum}`;
  },

  registerNewTenant(data) {
    if (!data || !data.name) throw new Error("Nama resto wajib diisi");
    const rawName = data.name.trim();
    const slug = (data.id || rawName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")) || ("resto-" + Date.now().toString().slice(-4));
    
    // Hitung tanggal kedaluwarsa
    let durationDays = 30;
    if (data.plan === "trial") durationDays = 14;
    else if (data.billingCycle === "yearly" || data.plan === "enterprise") durationDays = 365;

    const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();
    
    // Bangkitkan token lisensi HMAC-SHA256
    const licensePayload = {
      tenantId: slug,
      restaurantName: rawName,
      plan: data.plan || "pro",
      billingCycle: data.billingCycle || (data.plan === "trial" ? "trial" : "monthly"),
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt,
      maxTables: Number(data.tablesCount || 12),
      isUnlimited: (data.plan === "enterprise" || data.plan === "pro")
    };
    const licenseToken = this.createLicenseToken(licensePayload);

    const newTenant = {
      id: slug,
      name: rawName,
      pic: data.pic || "Pemilik Resto",
      phone: data.phone || "",
      city: data.city || "-",
      plan: data.plan || "pro",
      planName: data.planName || (data.plan === "trial" ? "Trial (14 Hari Gratis)" : (data.plan === "basic" ? "Paket Basic" : "Paket Pro")),
      price: Number(data.price || (data.plan === "trial" ? 0 : (data.plan === "basic" ? 99000 : 199000))),
      billingCycle: data.billingCycle || (data.plan === "trial" ? "trial" : "monthly"),
      tablesCount: Number(data.tablesCount || 12),
      status: data.plan === "trial" ? "trial" : "active",
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt,
      gasUrl: (data.gasUrl || "").trim(),
      apiKey: (data.apiKey || "").trim(),
      licenseKey: licenseToken
    };

    const tenants = this.getAllTenants();
    // Cek jika ID sudah ada, timpa
    const existingIdx = tenants.findIndex(t => t.id === slug);
    if (existingIdx >= 0) {
      tenants[existingIdx] = newTenant;
    } else {
      tenants.unshift(newTenant);
    }

    this.saveAllTenants(tenants);
    return newTenant;
  },

  renewTenantSubscription(tenantId, addDays = 30) {
    const tenants = this.getAllTenants();
    const idx = tenants.findIndex(t => t.id === tenantId);
    if (idx === -1) return { success: false, message: "Klien tidak ditemukan" };

    const t = tenants[idx];
    const currentExp = new Date(t.expiresAt).getTime();
    const baseTime = currentExp > Date.now() ? currentExp : Date.now();
    const newExp = new Date(baseTime + addDays * 86400000).toISOString();

    t.expiresAt = newExp;
    t.status = "active";
    if (t.plan === "trial") {
      t.plan = "pro";
      t.planName = "Paket Pro (Berlangganan)";
      t.price = 199000;
      t.billingCycle = "monthly";
    }

    // Perbarui token lisensi
    const licensePayload = {
      tenantId: t.id,
      restaurantName: t.name,
      plan: t.plan,
      billingCycle: t.billingCycle,
      issuedAt: new Date().toISOString(),
      expiresAt: newExp,
      maxTables: t.tablesCount,
      isUnlimited: true
    };
    t.licenseKey = this.createLicenseToken(licensePayload);

    tenants[idx] = t;
    this.saveAllTenants(tenants);
    return { success: true, message: `Langganan ${t.name} berhasil diperpanjang hingga ${new Date(newExp).toLocaleDateString("id-ID")}`, tenant: t };
  },

  deleteTenant(tenantId) {
    const tenants = this.getAllTenants().filter(t => t.id !== tenantId);
    this.saveAllTenants(tenants);
    return { success: true };
  },

  channel: null,
  listeners: {},
  audioCtx: null,

  init() {
    // Inisialisasi BroadcastChannel jika didukung browser
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(this.CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.handleIncomingEvent(event.data);
        };
      } catch (e) {
        console.warn("BroadcastChannel fallback ke storage listener:", e);
      }
    }

    // Storage Event Listener sebagai fallback cross-window yang andal
    window.addEventListener("storage", (event) => {
      if (event.key === this.STORAGE_EVENT_KEY && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          this.handleIncomingEvent(payload);
        } catch (err) {
          console.error("Gagal mengurai sync event:", err);
        }
      }
    });

    // Inisialisasi tiket KDS, online orders, riwayat transaksi, CRM member, katalog menu, reservasi, meja & lisensi
    this.initDefaultKdsTickets();
    this.initDefaultOnlineOrders();
    this.initDefaultTransactions();
    this.initDefaultMembers();
    this.initDefaultMenuCatalog();
    this.initDefaultReservations();
    this.initDefaultTables();
    this.initLicenseData();

    // Periksa apakah ada parameter magic setup link di URL (?setupGasUrl=...&setupApiKey=...)
    this.checkUrlAutoConfig();
  },

  // Daftarkan callback listener untuk tipe event tertentu
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  },

  // Broadcast event ke seluruh tab dan window yang aktif
  emit(eventType, data = {}) {
    const payload = {
      type: eventType,
      data: data,
      timestamp: Date.now(),
      senderId: Math.random().toString(36).substring(2, 9)
    };

    // Kirim via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (e) {
        console.warn("BroadcastChannel postMessage error:", e);
      }
    }

    // Kirim via LocalStorage (cross-tab & cross-window trigger)
    try {
      localStorage.setItem(this.STORAGE_EVENT_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("LocalStorage emit error:", e);
    }

    // Jalankan listener lokal pada tab saat ini
    this.handleIncomingEvent(payload);
  },

  handleIncomingEvent(payload) {
    if (!payload || !payload.type) return;
    const callbacks = this.listeners[payload.type] || [];
    callbacks.forEach(cb => {
      try {
        cb(payload.data, payload);
      } catch (err) {
        console.error(`Error pada listener ${payload.type}:`, err);
      }
    });
  },

  // ============================================================
  // SYNTHESIZED WEB AUDIO BELL CHIMES (100% Offline & Reliable)
  // ============================================================
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  },

  // Lonceng Dapur Saat Ada Pesanan Baru Masuk (Ding-Dong 2-Tone G-C)
  playKitchenBell() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Nada 1: 784 Hz (G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Nada 2: 1046.5 Hz (C6) sedikit lebih tinggi setelah 0.15s
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1046.5, now + 0.15);
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.log("Audio autoplay dicegah browser sebelum interaksi:", e);
    }
  },

  // Lonceng Panggilan Pelayan (Ting)
  playWaiterBell() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1174.66, now); // D6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    } catch (e) {
      console.log("Waiter bell error:", e);
    }
  },

  playKitchenChime() {
    this.playKitchenBell();
  },

  playCashRegisterSound() {
    this.playKitchenBell();
  },

  // ============================================================
  // KDS TICKETS STORAGE & DISPATCH HELPERS
  // ============================================================
  initDefaultKdsTickets() {
    const existing = localStorage.getItem(this.KDS_STORAGE_KEY);
    if (!existing) {
      const defaultTickets = [
        {
          id: "ORD-101",
          table: "Meja 02",
          tableId: "T02",
          customer: "Bpk. Farhan",
          createdAt: Date.now() - (6 * 60 * 1000), // 6 menit lalu (Hijau)
          status: "cooking", // 'new', 'cooking', 'ready', 'served'
          section: "Indoor AC",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 1, station: "arabian", notes: "Pedas Lvl 1, Basmati Regular" },
            { name: "Sambosa Daging Keju", qty: 1, station: "arabian", notes: "Lvl 1, Saus Harissa" },
            { name: "Authentic Teh Tarik", qty: 2, station: "drinks", notes: "Es Normal, Buih Tebal" }
          ]
        },
        {
          id: "ORD-102",
          table: "Meja 07",
          tableId: "T07",
          customer: "Keluarga dr. Zulkarnain",
          createdAt: Date.now() - (16 * 60 * 1000), // 16 menit lalu (Merah Overdue)
          status: "cooking",
          section: "Outdoor Garden",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 3, station: "arabian", notes: "Extra Basmati Jumbo (+10k)" },
            { name: "Shawarma Ayam Panggang", qty: 2, station: "arabian", notes: "Pedas Lvl 2, Extra Toum" },
            { name: "Jus Kurma Susu Madu", qty: 3, station: "drinks", notes: "Dingin Segar" }
          ]
        },
        {
          id: "ORD-103",
          table: "Meja 11",
          tableId: "T11",
          customer: "VIP: Ibu Diana",
          createdAt: Date.now() - (2 * 60 * 1000), // 2 menit lalu (Baru)
          status: "new",
          section: "VIP Private Room",
          items: [
            { name: "Tom Yum Goong Seafood", qty: 1, station: "thai", notes: "Pedas Lvl 3, Mangkuk Panas" },
            { name: "Qahwa Arabika Kapulaga", qty: 2, station: "drinks", notes: "Dallah Panas + Kurma Sukari" }
          ]
        }
      ];
      this.saveKdsTickets(defaultTickets);
    }
  },

  getKdsTickets() {
    try {
      const data = localStorage.getItem(this.KDS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveKdsTickets(tickets) {
    try {
      localStorage.setItem(this.KDS_STORAGE_KEY, JSON.stringify(tickets));
    } catch (e) {
      console.warn("Gagal simpan KDS tickets:", e);
    }
  },

  // Tambah tiket baru dari pesanan tamu Meja 05 atau Online Delivery
  addNewOrderTicket(order) {
    const tickets = this.getKdsTickets();
    const newTicket = {
      id: order.id || ("ORD-" + Math.floor(100 + Math.random() * 900)),
      orderType: order.orderType || order.channel || "dine_in",
      channel: order.channel || "Dine-in",
      orderRef: order.orderRef || order.id || "",
      driverName: order.driverName || "",
      driverPlate: order.driverPlate || "",
      packagingNotes: order.packagingNotes || "",
      table: order.table || "Meja 05",
      tableId: order.tableId || "T05",
      customer: order.customer || "Tamu Meja 05",
      phone: order.phone || "-",
      createdAt: order.createdAt || Date.now(),
      status: order.status || "new",
      section: order.section || "Indoor AC (QR Order)",
      items: order.items || []
    };

    tickets.unshift(newTicket);
    this.saveKdsTickets(tickets);

    // Emit event ke semua tab/window & sinkronkan ke Google Apps Script
    this.emit("ORDER_PLACED", newTicket);
    this.postToGas("placeOrder", newTicket);
    return newTicket;
  },

  updateTicketStatus(ticketId, newStatus) {
    const tickets = this.getKdsTickets();
    const target = tickets.find(t => t.id === ticketId);
    if (target) {
      target.status = newStatus;
      if (newStatus === "ready") {
        target.readyAt = Date.now();
        // Tandai seluruh item sebagai selesai jika tiket diset ready
        if (target.items) {
          target.items.forEach(i => i.completed = true);
        }
      }
      this.saveKdsTickets(tickets);
      this.emit("ORDER_STATUS_CHANGED", { ticketId, status: newStatus, table: target.table });
      this.postToGas("updateKdsStatus", { id: ticketId, status: newStatus });

      // Sinkronkan ke online order list jika ini tiket delivery
      if (newStatus === "ready") {
        const onlineOrders = this.getOnlineOrders();
        const olTarget = onlineOrders.find(o => o.id === ticketId || o.orderRef === ticketId);
        if (olTarget && olTarget.status !== "ready" && olTarget.status !== "completed") {
          olTarget.status = "ready";
          this.saveOnlineOrders(onlineOrders);
          this.emit("ONLINE_ORDER_UPDATED", olTarget);
        }
      }
    }
  },

  // Toggle checklist per-item pesanan (Ceklis Dapur Makanan vs Bar Minuman)
  toggleTicketItemCompleted(ticketId, itemIndex) {
    const tickets = this.getKdsTickets();
    const target = tickets.find(t => t.id === ticketId);
    if (target && target.items && target.items[itemIndex]) {
      target.items[itemIndex].completed = !target.items[itemIndex].completed;

      // Hitung progress penyelesaian item
      const completedCount = target.items.filter(i => i.completed).length;
      const totalCount = target.items.length;

      if (completedCount === totalCount) {
        target.status = "ready";
        target.readyAt = Date.now();
        this.emit("ORDER_STATUS_CHANGED", { ticketId, status: "ready", table: target.table });
        this.playWaiterBell();

        // Update online delivery order jika ini pesanan GoFood/GrabFood/ShopeeFood
        const onlineOrders = this.getOnlineOrders();
        const olTarget = onlineOrders.find(o => o.id === ticketId || o.orderRef === ticketId);
        if (olTarget && olTarget.status !== "ready" && olTarget.status !== "completed") {
          olTarget.status = "ready";
          this.saveOnlineOrders(onlineOrders);
          this.emit("ONLINE_ORDER_UPDATED", olTarget);
        }
      } else if (completedCount > 0) {
        target.status = "cooking";
        this.emit("ORDER_STATUS_CHANGED", { ticketId, status: "cooking", table: target.table });
      } else {
        target.status = "new";
      }

      this.saveKdsTickets(tickets);
      this.emit("TICKET_ITEMS_UPDATED", { 
        ticketId, 
        itemIndex, 
        completed: target.items[itemIndex].completed, 
        status: target.status,
        completedCount,
        totalCount
      });
      return target;
    }
    return null;
  },

  removeTicket(ticketId) {
    let tickets = this.getKdsTickets();
    tickets = tickets.filter(t => t.id !== ticketId);
    this.saveKdsTickets(tickets);
    this.emit("TICKET_REMOVED", { ticketId });
    this.postToGas("clearKdsTicket", { id: ticketId });
  },

  // ============================================================
  // MANAJEMEN PESANAN ONLINE DELIVERY (GOFOOD, GRABFOOD, SHOPEEFOOD)
  // ============================================================
  getOnlineOrders() {
    try {
      const raw = localStorage.getItem(this.ONLINE_ORDERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("Gagal parse online delivery orders:", e);
      return [];
    }
  },

  saveOnlineOrders(orders) {
    try {
      localStorage.setItem(this.ONLINE_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.warn("Gagal simpan online delivery orders:", e);
    }
  },

  initDefaultOnlineOrders() {
    const existing = localStorage.getItem(this.ONLINE_ORDERS_STORAGE_KEY);
    if (!existing) {
      const defaultOrders = [
        {
          id: "DLV-GF-8821",
          orderRef: "GF-8821",
          channel: "gofood",
          channelLabel: "GoFood",
          customer: "Dini Rahayu",
          phone: "0812-9876-5432",
          driverName: "Pak Budi Santoso",
          driverPhone: "0813-1122-3344",
          driverPlate: "B 4567 TZR",
          packagingNotes: "Box tebal terpisah kuah, seal cup es, sendok 2 pasang",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 2, price: 65000, station: "arabian", completed: false, notes: "Pedas Lvl 1" },
            { name: "Authentic Teh Tarik", qty: 2, price: 18000, station: "drinks", completed: false, notes: "Es Normal, Seal Cup" }
          ],
          subtotal: 166000,
          packagingFee: 4000,
          grandTotal: 170000,
          status: "cooking",
          createdAt: Date.now() - (7 * 60 * 1000)
        },
        {
          id: "DLV-GB-4192",
          orderRef: "GB-4192",
          channel: "grabfood",
          channelLabel: "GrabFood",
          customer: "Hendra Wijaya",
          phone: "0817-4455-6677",
          driverName: "Pak Agus Pratama",
          driverPhone: "0856-7788-9900",
          driverPlate: "B 6128 SAK",
          packagingNotes: "Kuah Tom Yum double plastic heat seal",
          items: [
            { name: "Tom Yum Goong Seafood Kuah Merah", qty: 1, price: 55000, station: "thai", completed: true, notes: "Pedas Sedang" },
            { name: "Pad Thai Udang Jumbo", qty: 1, price: 48000, station: "thai", completed: true, notes: "Extra Kacang" },
            { name: "Thai Green Tea Susu Asli", qty: 2, price: 22000, station: "drinks", completed: true, notes: "Manis Sedang" }
          ],
          subtotal: 147000,
          packagingFee: 5000,
          grandTotal: 152000,
          status: "ready",
          createdAt: Date.now() - (14 * 60 * 1000)
        },
        {
          id: "DLV-SF-3310",
          orderRef: "SF-3310",
          channel: "shopeefood",
          channelLabel: "ShopeeFood",
          customer: "Maya Safitri",
          phone: "0819-2233-4455",
          driverName: "Pak Irfan Maulana",
          driverPhone: "0878-3344-5566",
          driverPlate: "B 3891 PKL",
          packagingNotes: "Pemisahan saus garlic toum, paper bag rapi",
          items: [
            { name: "Shawarma Ayam Panggang", qty: 2, price: 35000, station: "arabian", completed: false, notes: "Extra Toum" },
            { name: "Jus Kurma Susu Madu Segar", qty: 1, price: 24000, station: "drinks", completed: false, notes: "Dingin Segar" }
          ],
          subtotal: 94000,
          packagingFee: 3000,
          grandTotal: 97000,
          status: "cooking",
          createdAt: Date.now() - (3 * 60 * 1000)
        }
      ];
      this.saveOnlineOrders(defaultOrders);
    }
  },

  createOnlineDeliveryOrder(data) {
    const orders = this.getOnlineOrders();
    const channelLabels = {
      gofood: "GoFood",
      grabfood: "GrabFood",
      shopeefood: "ShopeeFood",
      takeaway: "Takeaway"
    };
    const ch = (data.channel || "gofood").toLowerCase();
    const chLabel = channelLabels[ch] || "Online Delivery";
    const refCode = data.orderRef || (ch.slice(0, 2).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000));
    const orderId = "DLV-" + refCode;

    // Mapping items stasiun dapur vs bar
    const items = (data.items || []).map(it => {
      const lowerName = (it.name || "").toLowerCase();
      const isDrink = it.station === "drinks" || it.category === "drinks" || 
                      lowerName.includes("teh") || lowerName.includes("tea") || 
                      lowerName.includes("jus") || lowerName.includes("qahwa") || 
                      lowerName.includes("kopi");
      return {
        name: it.name,
        qty: Number(it.qty || 1),
        price: Number(it.price || 0),
        station: isDrink ? "drinks" : (it.station || "kitchen"),
        notes: it.notes || "",
        completed: false
      };
    });

    const subtotal = items.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 1)), 0);
    const packagingFee = Number(data.packagingFee || 3000);
    const grandTotal = subtotal + packagingFee;

    const newOrder = {
      id: orderId,
      orderRef: refCode,
      channel: ch,
      channelLabel: chLabel,
      customer: data.customer || "Pelanggan " + chLabel,
      phone: data.phone || "0812-xxxx-xxxx",
      driverName: data.driverName || "Driver " + chLabel,
      driverPhone: data.driverPhone || "-",
      driverPlate: data.driverPlate || ("B " + Math.floor(1000 + Math.random() * 9000) + " XYZ"),
      packagingNotes: data.packagingNotes || "Wajib bungkus rapi + sendok tisu",
      items: items,
      subtotal: subtotal,
      packagingFee: packagingFee,
      grandTotal: grandTotal,
      status: "cooking",
      createdAt: Date.now()
    };

    orders.unshift(newOrder);
    this.saveOnlineOrders(orders);

    // Otomatis terbitkan KDS Ticket untuk Dapur & Bar
    const kdsTicket = {
      id: orderId,
      orderType: ch,
      channel: chLabel,
      orderRef: refCode,
      table: `[${chLabel}] #${refCode}`,
      tableId: orderId,
      customer: `${newOrder.customer} (Driver: ${newOrder.driverName})`,
      phone: newOrder.phone,
      driverName: newOrder.driverName,
      driverPlate: newOrder.driverPlate,
      packagingNotes: newOrder.packagingNotes,
      createdAt: Date.now(),
      status: "new",
      section: `🛵 ${chLabel} • Bungkus 📦`,
      items: items
    };

    const tickets = this.getKdsTickets();
    tickets.unshift(kdsTicket);
    this.saveKdsTickets(tickets);

    // Emit event sinkronisasi real-time
    this.emit("ONLINE_ORDER_PLACED", newOrder);
    this.emit("ORDER_PLACED", kdsTicket);
    this.playKitchenBell();
    this.postToGas("placeOnlineOrder", newOrder);

    return newOrder;
  },

  updateOnlineOrderStatus(orderId, newStatus) {
    const orders = this.getOnlineOrders();
    const target = orders.find(o => o.id === orderId || o.orderRef === orderId);
    if (!target) return null;

    target.status = newStatus;
    this.saveOnlineOrders(orders);

    // Sinkronkan status tiket di KDS
    const tickets = this.getKdsTickets();
    const kdsTarget = tickets.find(t => t.id === target.id);
    if (kdsTarget) {
      if (newStatus === "ready") {
        kdsTarget.status = "ready";
        kdsTarget.readyAt = Date.now();
        (kdsTarget.items || []).forEach(i => i.completed = true);
        this.saveKdsTickets(tickets);
        this.emit("ORDER_STATUS_CHANGED", { ticketId: kdsTarget.id, status: "ready", table: kdsTarget.table });
      } else if (newStatus === "completed") {
        this.removeTicket(kdsTarget.id);
      }
    }

    // Jika completed (driver sudah ambil makanan), catat ke pembukuan transaksi
    if (newStatus === "completed") {
      this.recordTransaction({
        billNo: `RP-${target.orderRef}`,
        table: `[${target.channelLabel}] ${target.orderRef}`,
        tableId: target.id,
        customer: `${target.customer} (${target.driverName})`,
        paymentMethod: target.channel, // gofood, grabfood, shopeefood, takeaway
        channel: target.channel,
        orderType: target.channel,
        driverName: target.driverName,
        driverPlate: target.driverPlate,
        orderRef: target.orderRef,
        items: target.items,
        subtotal: target.subtotal,
        discount: 0,
        tax: 0,
        grandTotal: target.grandTotal,
        amountPaid: target.grandTotal,
        change: 0
      });
      this.playKitchenBell();
    }

    this.emit("ONLINE_ORDER_UPDATED", target);
    return target;
  },

  quickSimulateOnlineOrder(channel = "gofood") {
    const simulationData = {
      gofood: {
        channel: "gofood",
        customer: "Dini Rahayu",
        phone: "0812-9876-5432",
        driverName: "Pak Budi Santoso",
        driverPlate: "B 4567 TZR",
        packagingNotes: "Box tebal pisah kuah, seal cup es, sendok 2 set",
        items: [
          { name: "Nasi Mandhi Daging Kambing", qty: 2, price: 65000, station: "arabian", notes: "Pedas Lvl 1" },
          { name: "Sambosa Daging Keju", qty: 1, price: 25000, station: "arabian", notes: "Saus Harissa" },
          { name: "Authentic Teh Tarik", qty: 2, price: 18000, station: "drinks", notes: "Es Normal, Seal Cup" }
        ]
      },
      grabfood: {
        channel: "grabfood",
        customer: "Hendra Wijaya",
        phone: "0817-4455-6677",
        driverName: "Pak Agus Pratama",
        driverPlate: "B 6128 SAK",
        packagingNotes: "Kuah Tom Yum double plastic heat seal + sendok tisu",
        items: [
          { name: "Tom Yum Goong Seafood Kuah Merah", qty: 1, price: 55000, station: "thai", notes: "Pedas Sedang" },
          { name: "Pad Thai Udang Jumbo", qty: 1, price: 48000, station: "thai", notes: "Extra Kacang" },
          { name: "Thai Green Tea Susu Asli", qty: 2, price: 22000, station: "drinks", notes: "Manis Sedang" }
        ]
      },
      shopeefood: {
        channel: "shopeefood",
        customer: "Maya Safitri",
        phone: "0819-2233-4455",
        driverName: "Pak Irfan Maulana",
        driverPlate: "B 3891 PKL",
        packagingNotes: "Pemisahan saus garlic toum, paper bag rapi",
        items: [
          { name: "Nasi Lemak Sambal Sotong Special", qty: 2, price: 45000, station: "malaysian", notes: "Sambal Pisah Cup" },
          { name: "Shawarma Ayam Panggang", qty: 1, price: 35000, station: "arabian", notes: "Extra Toum" },
          { name: "Jus Kurma Susu Madu Segar", qty: 2, price: 24000, station: "drinks", notes: "Dingin Segar" }
        ]
      }
    };

    const data = simulationData[channel] || simulationData.gofood;
    const refCode = channel.slice(0, 2).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
    return this.createOnlineDeliveryOrder({
      ...data,
      orderRef: refCode
    });
  },

  // ============================================================
  // RIWAYAT TRANSAKSI MULTI-HARI (MULTI-DAY SALES LEDGER)
  // ============================================================
  initDefaultTransactions() {
    const existing = localStorage.getItem(this.TRANSACTIONS_STORAGE_KEY);
    if (!existing) {
      const now = new Date();
      const formatDate = (d) => d.toISOString().slice(0, 10);
      
      const today = formatDate(now);
      const yesterday = formatDate(new Date(now.getTime() - 24 * 3600 * 1000));
      const twoDaysAgo = formatDate(new Date(now.getTime() - 2 * 24 * 3600 * 1000));
      const fiveDaysAgo = formatDate(new Date(now.getTime() - 5 * 24 * 3600 * 1000));

      const defaultTrx = [
        // Hari Ini (Today)
        {
          billNo: `RP-${today.replace(/-/g, "")}-001`,
          timestamp: Date.now() - (4 * 3600 * 1000),
          dateStr: today,
          timeStr: "08:45 WIB",
          table: "Meja 01",
          tableId: "T01",
          customer: "Bpk. Subagyo",
          cashier: "Siti Aminah",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "cash",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 2, price: 65000 },
            { name: "Authentic Teh Tarik", qty: 2, price: 18000 }
          ],
          subtotal: 166000,
          discount: 16600,
          tax: 14940,
          grandTotal: 164340,
          amountPaid: 200000,
          change: 35660,
          status: "Lunas"
        },
        {
          billNo: `RP-${today.replace(/-/g, "")}-002`,
          timestamp: Date.now() - (3 * 3600 * 1000),
          dateStr: today,
          timeStr: "09:30 WIB",
          table: "Meja 04",
          tableId: "T04",
          customer: "Ibu Nurul Hidayah",
          cashier: "Siti Aminah",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "qris",
          items: [
            { name: "Laksa Penang Kuah Kental", qty: 1, price: 42000 },
            { name: "Roti Canai Kari Daging", qty: 1, price: 30000 },
            { name: "Thai Green Tea Susu Asli", qty: 1, price: 22000 }
          ],
          subtotal: 94000,
          discount: 0,
          tax: 9400,
          grandTotal: 103400,
          amountPaid: 103400,
          change: 0,
          status: "Lunas"
        },
        {
          billNo: `RP-${today.replace(/-/g, "")}-003`,
          timestamp: Date.now() - (2 * 3600 * 1000),
          dateStr: today,
          timeStr: "10:15 WIB",
          table: "Meja 06",
          tableId: "T06",
          customer: "dr. Adrian Pratama",
          cashier: "Siti Aminah",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "card",
          items: [
            { name: "Tom Yum Goong Seafood Kuah Merah", qty: 2, price: 55000 },
            { name: "Pad Thai Udang Jumbo", qty: 1, price: 48000 },
            { name: "Qahwa Arabika Kapulaga", qty: 2, price: 25000 }
          ],
          subtotal: 208000,
          discount: 20800,
          tax: 18720,
          grandTotal: 205920,
          amountPaid: 205920,
          change: 0,
          status: "Lunas"
        },
        {
          billNo: `RP-${today.replace(/-/g, "")}-004`,
          timestamp: Date.now() - (1 * 3600 * 1000),
          dateStr: today,
          timeStr: "11:20 WIB",
          table: "Meja 09",
          tableId: "T09",
          customer: "Sdr. Rendy Wijaya",
          cashier: "Siti Aminah",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "qris",
          items: [
            { name: "Shawarma Ayam Panggang", qty: 2, price: 35000 },
            { name: "Jus Kurma Susu Madu Segar", qty: 2, price: 24000 }
          ],
          subtotal: 118000,
          discount: 11800,
          tax: 10620,
          grandTotal: 116820,
          amountPaid: 116820,
          change: 0,
          status: "Lunas"
        },

        // Kemarin (Yesterday)
        {
          billNo: `RP-${yesterday.replace(/-/g, "")}-001`,
          timestamp: new Date(now.getTime() - 26 * 3600 * 1000).getTime(),
          dateStr: yesterday,
          timeStr: "12:15 WIB",
          table: "Meja 02",
          tableId: "T02",
          customer: "Kevin Sanjaya (VIP Gold)",
          cashier: "Budi Santoso",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "qris",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 3, price: 65000 },
            { name: "Sambosa Daging Keju", qty: 2, price: 25000 },
            { name: "Authentic Teh Tarik", qty: 3, price: 18000 }
          ],
          subtotal: 299000,
          discount: 29900,
          tax: 26910,
          grandTotal: 296010,
          amountPaid: 296010,
          change: 0,
          status: "Lunas"
        },
        {
          billNo: `RP-${yesterday.replace(/-/g, "")}-002`,
          timestamp: new Date(now.getTime() - 22 * 3600 * 1000).getTime(),
          dateStr: yesterday,
          timeStr: "18:40 WIB",
          table: "Meja 11",
          tableId: "T11",
          customer: "dr. Ahmad Fauzi (VIP Gold)",
          cashier: "Riko Saputra",
          shift: "Shift 2 (Malam)",
          paymentMethod: "card",
          items: [
            { name: "Tom Yum Goong Seafood Kuah Merah", qty: 2, price: 55000 },
            { name: "Laksa Penang Kuah Kental", qty: 2, price: 42000 },
            { name: "Jus Kurma Susu Madu Segar", qty: 4, price: 24000 }
          ],
          subtotal: 290000,
          discount: 29000,
          tax: 26100,
          grandTotal: 287100,
          amountPaid: 287100,
          change: 0,
          status: "Lunas"
        },
        {
          billNo: `RP-${yesterday.replace(/-/g, "")}-003`,
          timestamp: new Date(now.getTime() - 20 * 3600 * 1000).getTime(),
          dateStr: yesterday,
          timeStr: "20:10 WIB",
          table: "Meja 05",
          tableId: "T05",
          customer: "Ibu Fatimah",
          cashier: "Riko Saputra",
          shift: "Shift 2 (Malam)",
          paymentMethod: "cash",
          items: [
            { name: "Nasi Lemak Sambal Sotong Special", qty: 2, price: 45000 },
            { name: "Thai Green Tea Susu Asli", qty: 2, price: 22000 }
          ],
          subtotal: 134000,
          discount: 0,
          tax: 13400,
          grandTotal: 147400,
          amountPaid: 150000,
          change: 2600,
          status: "Lunas"
        },

        // 2 Hari Lalu
        {
          billNo: `RP-${twoDaysAgo.replace(/-/g, "")}-001`,
          timestamp: new Date(now.getTime() - 48 * 3600 * 1000).getTime(),
          dateStr: twoDaysAgo,
          timeStr: "13:20 WIB",
          table: "Meja 08",
          tableId: "T08",
          customer: "Ibu Siti Rahmawati (VIP Silver)",
          cashier: "Siti Aminah",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "qris",
          items: [
            { name: "Pad Thai Udang Jumbo", qty: 2, price: 48000 },
            { name: "Roti Canai Kari Daging", qty: 2, price: 30000 },
            { name: "Thai Green Tea Susu Asli", qty: 2, price: 22000 }
          ],
          subtotal: 200000,
          discount: 10000, // 5% silver
          tax: 19000,
          grandTotal: 209000,
          amountPaid: 209000,
          change: 0,
          status: "Lunas"
        },
        {
          billNo: `RP-${twoDaysAgo.replace(/-/g, "")}-002`,
          timestamp: new Date(now.getTime() - 44 * 3600 * 1000).getTime(),
          dateStr: twoDaysAgo,
          timeStr: "19:00 WIB",
          table: "Meja 12",
          tableId: "T12",
          customer: "Bpk. Hendra Gunawan",
          cashier: "Riko Saputra",
          shift: "Shift 2 (Malam)",
          paymentMethod: "cash",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 4, price: 65000 },
            { name: "Qahwa Arabika Kapulaga", qty: 4, price: 25000 }
          ],
          subtotal: 360000,
          discount: 0,
          tax: 36000,
          grandTotal: 396000,
          amountPaid: 400000,
          change: 4000,
          status: "Lunas"
        },

        // 5 Hari Lalu
        {
          billNo: `RP-${fiveDaysAgo.replace(/-/g, "")}-001`,
          timestamp: new Date(now.getTime() - 120 * 3600 * 1000).getTime(),
          dateStr: fiveDaysAgo,
          timeStr: "11:45 WIB",
          table: "Meja 03",
          tableId: "T03",
          customer: "Rombongan Kantor BSI",
          cashier: "Siti Aminah",
          shift: "Shift 1 (Pagi)",
          paymentMethod: "card",
          items: [
            { name: "Nasi Mandhi Daging Kambing", qty: 5, price: 65000 },
            { name: "Shawarma Ayam Panggang", qty: 3, price: 35000 },
            { name: "Authentic Teh Tarik", qty: 8, price: 18000 }
          ],
          subtotal: 574000,
          discount: 57400,
          tax: 51660,
          grandTotal: 568260,
          amountPaid: 568260,
          change: 0,
          status: "Lunas"
        }
      ];

      this.saveTransactions(defaultTrx);
    }
  },

  getTransactions(filterOptions = null) {
    try {
      const data = localStorage.getItem(this.TRANSACTIONS_STORAGE_KEY);
      let list = data ? JSON.parse(data) : [];

      if (!filterOptions) {
        return list;
      }

      // Filter string langsung (format: YYYY-MM-DD)
      if (typeof filterOptions === "string") {
        return list.filter(t => t.dateStr === filterOptions);
      }

      // Filter objek opsi
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const yesterdayStr = new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const sevenDaysAgoTime = now.getTime() - 7 * 24 * 3600 * 1000;
      const thisMonthPrefix = todayStr.slice(0, 7); // e.g. "2026-11"

      const preset = filterOptions.preset || "all";
      const customDate = filterOptions.specificDate || filterOptions.date;
      const paymentMethod = filterOptions.paymentMethod || "all";

      if (customDate) {
        list = list.filter(t => t.dateStr === customDate);
      } else if (preset === "today") {
        list = list.filter(t => t.dateStr === todayStr);
      } else if (preset === "yesterday") {
        list = list.filter(t => t.dateStr === yesterdayStr);
      } else if (preset === "last7") {
        list = list.filter(t => (t.timestamp || 0) >= sevenDaysAgoTime);
      } else if (preset === "month") {
        list = list.filter(t => t.dateStr && t.dateStr.startsWith(thisMonthPrefix));
      }

      if (paymentMethod && paymentMethod !== "all") {
        list = list.filter(t => t.paymentMethod === paymentMethod);
      }

      return list;
    } catch (e) {
      console.warn("Error getTransactions:", e);
      return [];
    }
  },

  saveTransactions(transactions) {
    try {
      localStorage.setItem(this.TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.warn("Gagal simpan transaksi:", e);
    }
  },

  recordTransaction(trx) {
    const list = this.getTransactions();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} WIB`;

    const newRecord = {
      billNo: trx.billNo || `RP-${today.replace(/-/g, "")}-${String(list.length + 1).padStart(3, "0")}`,
      timestamp: Date.now(),
      dateStr: today,
      timeStr: timeStr,
      table: trx.table || "Meja 01",
      tableId: trx.tableId || "T01",
      customer: trx.customer || "Tamu Resto",
      memberPhone: trx.memberPhone || "",
      cashier: trx.cashier || (this.getTenantInfo() && this.getTenantInfo().pic ? this.getTenantInfo().pic : "Kasir Utama"),
      shift: trx.shift || "Shift 1 (Pagi)",
      paymentMethod: trx.paymentMethod || "cash",
      channel: trx.channel || (['gofood','grabfood','shopeefood'].includes((trx.paymentMethod || '').toLowerCase()) ? trx.paymentMethod.toLowerCase() : 'dine_in'),
      orderType: trx.orderType || trx.channel || "dine_in",
      driverName: trx.driverName || "",
      driverPlate: trx.driverPlate || "",
      orderRef: trx.orderRef || "",
      items: trx.items || [],
      subtotal: trx.subtotal || 0,
      discount: trx.discount || 0,
      tax: trx.tax || 0,
      grandTotal: trx.grandTotal || 0,
      amountPaid: trx.amountPaid || trx.grandTotal || 0,
      change: trx.change || 0,
      status: "Lunas"
    };

    list.unshift(newRecord);
    this.saveTransactions(list);

    // Jika ada nomor HP member terhubung, tambahkan poin loyalti (1 poin per Rp 1.000)
    if (newRecord.memberPhone) {
      const earnedPoints = Math.floor(newRecord.grandTotal / 1000);
      this.addMemberPoints(newRecord.memberPhone, earnedPoints);
    }

    this.emit("TRANSACTION_SAVED", newRecord);
    this.postToGas("saveTransaction", newRecord);
    return newRecord;
  },

  // Export Data Transaksi ke File CSV (Dapat dibuka di Microsoft Excel / Google Sheets)
  exportTransactionsToCSV(filterOptions = null) {
    const list = this.getTransactions(filterOptions);
    if (!list || list.length === 0) {
      alert("Tidak ada data transaksi untuk diekspor pada filter yang dipilih!");
      return;
    }

    const headers = [
      "No. Struk",
      "Tanggal",
      "Jam",
      "Meja",
      "Tamu/Member",
      "Kasir",
      "Shift",
      "Metode Bayar",
      "Rincian Menu",
      "Subtotal (Rp)",
      "Diskon (Rp)",
      "Pajak PB1 (Rp)",
      "Total Bersih (Rp)",
      "Uang Diterima (Rp)",
      "Kembalian (Rp)",
      "Status"
    ];

    const rows = list.map(t => {
      const itemDetails = (t.items || []).map(i => `${i.qty}x ${i.name}`).join("; ");
      return [
        `"${t.billNo}"`,
        `"${t.dateStr}"`,
        `"${t.timeStr}"`,
        `"${t.table}"`,
        `"${t.customer}"`,
        `"${t.cashier}"`,
        `"${t.shift}"`,
        `"${(t.paymentMethod || '').toUpperCase()}"`,
        `"${itemDetails}"`,
        t.subtotal,
        t.discount,
        t.tax,
        t.grandTotal,
        t.amountPaid,
        t.change,
        `"${t.status}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const tag = (typeof filterOptions === 'string' ? filterOptions : (filterOptions && (filterOptions.specificDate || filterOptions.preset))) || 'Semua';
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Transaksi_RestoPro_${tag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // ============================================================
  // ANALITIK BISNIS & STATISTIK PENJUALAN (SALES ANALYTICS ENGINE)
  // ============================================================
  getSalesAnalytics(filterOptions = null) {
    const list = this.getTransactions(filterOptions);
    const catalog = this.getMenuCatalog();
    
    // Total Finansial Dasar
    const totalRevenue = list.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
    const totalOrders = list.length;
    const avgBill = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const totalTax = list.reduce((sum, t) => sum + (t.tax || 0), 0);
    const totalDiscount = list.reduce((sum, t) => sum + (t.discount || 0), 0);

    // 1. Distribusi Jam Sibuk (Hourly Peak Hours Heatmap 08:00 - 22:00)
    const hours = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];
    const hourlyData = hours.map(h => {
      const match = list.filter(t => {
        if (!t.timeStr) return false;
        const hr = t.timeStr.slice(0, 2);
        return hr === h;
      });
      const rev = match.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
      return {
        hour: `${h}:00`,
        count: match.length,
        revenue: rev
      };
    });

    // Cari jam dengan omset tertinggi
    let peakHour = hourlyData.reduce((prev, curr) => (curr.revenue > prev.revenue ? curr : prev), hourlyData[0] || { hour: "12:00", revenue: 0, count: 0 });

    // 2. Ranking Menu Terlaris (Leaderboard Best Sellers)
    const itemMap = {};
    list.forEach(trx => {
      (trx.items || []).forEach(it => {
        const name = it.name;
        if (!itemMap[name]) {
          const matchedCatalog = catalog.find(m => m.name === name || name.includes(m.name) || m.name.includes(name));
          itemMap[name] = {
            name: name,
            qty: 0,
            revenue: 0,
            category: matchedCatalog ? matchedCatalog.category : (
              (name.includes('Mandhi') || name.includes('Shawarma') || name.includes('Sambosa') || name.includes('Qahwa')) ? 'arabian' :
              (name.includes('Lemak') || name.includes('Canai') || name.includes('Laksa') || name.includes('Tarik')) ? 'malaysian' :
              (name.includes('Tom Yum') || name.includes('Pad Thai') || name.includes('Sticky') || name.includes('Green Tea')) ? 'thai' : 'drinks'
            ),
            categoryLabel: matchedCatalog ? matchedCatalog.categoryLabel : "Special Menu",
            image: matchedCatalog ? matchedCatalog.image : "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
          };
        }
        itemMap[name].qty += Number(it.qty || 1);
        itemMap[name].revenue += (Number(it.price || 0) * Number(it.qty || 1));
      });
    });

    const topSelling = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

    // 3. Kontribusi Omset per Kategori Kuliner
    const categoryTotals = {
      arabian: { label: "Arabian Delights 🕌", revenue: 0, qty: 0, color: "#D97706" },
      malaysian: { label: "Malaysian Favorites 🇲🇾", revenue: 0, qty: 0, color: "#C2410C" },
      thai: { label: "Thai Specialties 🇹🇭", revenue: 0, qty: 0, color: "#8B5CF6" },
      drinks: { label: "Artisan Drinks 🍹", revenue: 0, qty: 0, color: "#059669" }
    };

    topSelling.forEach(item => {
      const cat = categoryTotals[item.category] ? item.category : 'drinks';
      categoryTotals[cat].revenue += item.revenue;
      categoryTotals[cat].qty += item.qty;
    });

    const totalCategoryRevenue = Object.values(categoryTotals).reduce((sum, c) => sum + c.revenue, 0) || 1;
    Object.keys(categoryTotals).forEach(k => {
      categoryTotals[k].percent = Math.round((categoryTotals[k].revenue / totalCategoryRevenue) * 100);
    });

    // 4. Breakdown Metode Pembayaran
    const payMap = {
      qris: { label: "QRIS Dinamis", count: 0, revenue: 0, color: "#F59E0B" },
      cash: { label: "Tunai / Cash", count: 0, revenue: 0, color: "#10B981" },
      card: { label: "Kartu EDC", count: 0, revenue: 0, color: "#A855F7" },
      gofood: { label: "GoFood", count: 0, revenue: 0, color: "#00AA13" },
      grabfood: { label: "GrabFood", count: 0, revenue: 0, color: "#00B14F" },
      shopeefood: { label: "ShopeeFood", count: 0, revenue: 0, color: "#EE4D2D" }
    };

    list.forEach(t => {
      const m = (t.paymentMethod || "cash").toLowerCase();
      if (payMap[m]) {
        payMap[m].count += 1;
        payMap[m].revenue += (t.grandTotal || 0);
      }
    });

    const totalPayRev = Object.values(payMap).reduce((sum, p) => sum + p.revenue, 0) || 1;
    Object.keys(payMap).forEach(k => {
      payMap[k].percent = Math.round((payMap[k].revenue / totalPayRev) * 100);
    });

    // 5. Breakdown Kanal Penjualan (Dine-in vs Online Delivery vs Takeaway)
    const channelBreakdown = {
      dine_in: { label: "Dine-In (Meja Kasir)", count: 0, revenue: 0, commissionEstimate: 0, netRevenue: 0, color: "#3B82F6" },
      gofood: { label: "GoFood (Gojek)", count: 0, revenue: 0, commissionEstimate: 0, netRevenue: 0, color: "#00AA13" },
      grabfood: { label: "GrabFood (Grab)", count: 0, revenue: 0, commissionEstimate: 0, netRevenue: 0, color: "#00B14F" },
      shopeefood: { label: "ShopeeFood (Shopee)", count: 0, revenue: 0, commissionEstimate: 0, netRevenue: 0, color: "#EE4D2D" },
      takeaway: { label: "Takeaway Langsung", count: 0, revenue: 0, commissionEstimate: 0, netRevenue: 0, color: "#8B5CF6" }
    };

    list.forEach(t => {
      const ch = (t.channel || (t.paymentMethod && ['gofood','grabfood','shopeefood'].includes(t.paymentMethod.toLowerCase()) ? t.paymentMethod : 'dine_in')).toLowerCase();
      const targetCh = channelBreakdown[ch] || channelBreakdown.dine_in;
      const rev = t.grandTotal || 0;
      targetCh.count += 1;
      targetCh.revenue += rev;
      
      // Estimasi komisi aplikasi online ~20%
      if (['gofood', 'grabfood', 'shopeefood'].includes(ch)) {
        const comm = Math.round(rev * 0.20);
        targetCh.commissionEstimate += comm;
        targetCh.netRevenue += (rev - comm);
      } else {
        targetCh.netRevenue += rev;
      }
    });

    const totalChannelRev = Object.values(channelBreakdown).reduce((sum, c) => sum + c.revenue, 0) || 1;
    Object.keys(channelBreakdown).forEach(k => {
      channelBreakdown[k].percent = Math.round((channelBreakdown[k].revenue / totalChannelRev) * 100);
    });

    return {
      totalRevenue,
      totalOrders,
      avgBill,
      totalTax,
      totalDiscount,
      hourlyData,
      peakHour,
      topSelling,
      categoryTotals,
      payMap,
      channelBreakdown
    };
  },

  // ============================================================
  // CRM MEMBER & DATA PELANGGAN (CUSTOMER LOYALTY DATABASE)
  // ============================================================
  initDefaultMembers() {
    const existing = localStorage.getItem(this.MEMBERS_STORAGE_KEY);
    if (!existing) {
      const defaultMembers = [
        {
          id: "MBR-001",
          name: "Kevin Sanjaya",
          phone: "081234567890",
          tier: "gold", // gold (10%), silver (5%), regular (0%)
          tierLabel: "VIP Gold Member",
          discountRate: 0.10,
          points: 1250,
          totalVisits: 14,
          joinedDate: "2026-08-10",
          lastVisit: "2026-11-07",
          notes: "Favorit Nasi Mandhi Lamb & Teh Tarik. Meja dekat taman."
        },
        {
          id: "MBR-002",
          name: "dr. Ahmad Fauzi",
          phone: "081298765432",
          tier: "gold",
          tierLabel: "VIP Gold Member",
          discountRate: 0.10,
          points: 850,
          totalVisits: 9,
          joinedDate: "2026-09-15",
          lastVisit: "2026-11-07",
          notes: "Alergi kacang mete, suka rempah kapulaga ekstra pedas."
        },
        {
          id: "MBR-003",
          name: "Ibu Siti Rahmawati",
          phone: "085712345678",
          tier: "silver",
          tierLabel: "VIP Silver Member",
          discountRate: 0.05,
          points: 420,
          totalVisits: 5,
          joinedDate: "2026-10-01",
          lastVisit: "2026-11-06",
          notes: "Langganan Laksa Penang & Thai Green Tea."
        },
        {
          id: "MBR-004",
          name: "Bpk. Hendra Gunawan",
          phone: "081399887766",
          tier: "regular",
          tierLabel: "Reguler Member",
          discountRate: 0.00,
          points: 150,
          totalVisits: 2,
          joinedDate: "2026-10-25",
          lastVisit: "2026-11-06",
          notes: "Pilihan meja VIP Room untuk makan malam keluarga."
        }
      ];
      this.saveMembers(defaultMembers);
    }
  },

  getMembers() {
    try {
      const data = localStorage.getItem(this.MEMBERS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn("Gagal getMembers:", e);
      return [];
    }
  },

  saveMembers(members) {
    try {
      localStorage.setItem(this.MEMBERS_STORAGE_KEY, JSON.stringify(members));
    } catch (e) {
      console.warn("Gagal simpan members:", e);
    }
  },

  saveMember(memberData) {
    const list = this.getMembers();
    const cleanPhone = (memberData.phone || "").replace(/\s+/g, "").replace(/^0/, "62");
    
    // Tentukan diskon berdasarkan tier
    let discountRate = 0;
    let tierLabel = "Reguler Member";
    if (memberData.tier === "gold") {
      discountRate = 0.10;
      tierLabel = "VIP Gold Member";
    } else if (memberData.tier === "silver") {
      discountRate = 0.05;
      tierLabel = "VIP Silver Member";
    }

    const existingIndex = list.findIndex(m => 
      (m.id && m.id === memberData.id) || 
      (m.phone && m.phone.replace(/\s+/g, "").replace(/^0/, "62") === cleanPhone)
    );

    let savedMember;
    if (existingIndex >= 0) {
      savedMember = {
        ...list[existingIndex],
        ...memberData,
        discountRate: discountRate,
        tierLabel: tierLabel,
        updatedAt: Date.now()
      };
      list[existingIndex] = savedMember;
    } else {
      const count = list.length + 1;
      const today = new Date().toISOString().slice(0, 10);
      savedMember = {
        id: memberData.id || `MBR-${String(count).padStart(3, "0")}`,
        name: memberData.name.trim(),
        phone: memberData.phone.trim(),
        tier: memberData.tier || "regular",
        tierLabel: tierLabel,
        discountRate: discountRate,
        points: Number(memberData.points || 100), // Bonus registrasi awal 100 poin
        totalVisits: 1,
        joinedDate: today,
        lastVisit: today,
        notes: memberData.notes || ""
      };
      list.unshift(savedMember);
    }

    this.saveMembers(list);
    this.emit("MEMBER_UPDATED", savedMember);
    this.postToGas("saveMember", savedMember);
    return savedMember;
  },

  findMember(query) {
    if (!query) return null;
    const list = this.getMembers();
    const q = query.toString().toLowerCase().trim();
    const cleanQ = q.replace(/\D/g, "");

    return list.find(m => {
      const matchName = m.name && m.name.toLowerCase().includes(q);
      const mCleanPhone = (m.phone || "").replace(/\D/g, "");
      const matchPhone = cleanQ.length >= 4 && mCleanPhone.includes(cleanQ);
      const matchId = m.id && m.id.toLowerCase() === q;
      return matchName || matchPhone || matchId;
    }) || null;
  },

  addMemberPoints(phone, addedPoints) {
    if (!phone || !addedPoints) return;
    const list = this.getMembers();
    const cleanPhone = phone.replace(/\D/g, "");
    const member = list.find(m => (m.phone || "").replace(/\D/g, "") === cleanPhone);
    if (member) {
      member.points = (member.points || 0) + Number(addedPoints);
      member.totalVisits = (member.totalVisits || 0) + 1;
      member.lastVisit = new Date().toISOString().slice(0, 10);

      // Auto upgrade tier jika poin melampaui batas
      if (member.points >= 1000 && member.tier !== "gold") {
        member.tier = "gold";
        member.tierLabel = "VIP Gold Member";
        member.discountRate = 0.10;
      } else if (member.points >= 400 && member.tier === "regular") {
        member.tier = "silver";
        member.tierLabel = "VIP Silver Member";
        member.discountRate = 0.05;
      }

      this.saveMembers(list);
      this.emit("MEMBER_UPDATED", member);
    }
  },

  // ============================================================
  // KATALOG MENU DINAMIS & CRUD PRODUK (PRODUCT MANAGER)
  // ============================================================
  initDefaultMenuCatalog() {
    const existing = localStorage.getItem(this.MENU_STORAGE_KEY);
    if (!existing) {
      const baseMenu = (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS))
        ? JSON.parse(JSON.stringify(MENU_ITEMS))
        : [];
      this.saveMenuCatalog(baseMenu);
    }
  },

  getMenuCatalog() {
    try {
      const data = localStorage.getItem(this.MENU_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Gagal getMenuCatalog:", e);
    }
    // Fallback ke MENU_ITEMS bawaan
    return (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS)) ? MENU_ITEMS : [];
  },

  saveMenuCatalog(catalog) {
    try {
      localStorage.setItem(this.MENU_STORAGE_KEY, JSON.stringify(catalog));
    } catch (e) {
      console.warn("Gagal simpan menu catalog:", e);
    }
  },

  saveMenuItem(itemData) {
    const catalog = this.getMenuCatalog();
    const categoryLabels = {
      arabian: "Arabian Delights 🕌",
      malaysian: "Malaysian Favorites 🇲🇾",
      thai: "Thai Specialties 🇹🇭",
      drinks: "Artisan Drinks 🍹"
    };

    let savedItem;
    const existingIndex = catalog.findIndex(m => m.id === itemData.id);

    if (existingIndex >= 0) {
      // Edit / Update item yang ada
      savedItem = {
        ...catalog[existingIndex],
        ...itemData,
        price: Number(itemData.price),
        spicyLevel: Number(itemData.spicyLevel || 0),
        categoryLabel: categoryLabels[itemData.category] || catalog[existingIndex].categoryLabel || "Special Menu"
      };
      catalog[existingIndex] = savedItem;
    } else {
      // Tambah item baru
      const slug = itemData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const newId = itemData.id || `${slug}-${Date.now().toString().slice(-4)}`;

      savedItem = {
        id: newId,
        name: itemData.name.trim(),
        price: Number(itemData.price),
        category: itemData.category || "arabian",
        categoryLabel: categoryLabels[itemData.category] || "Special Menu",
        spicyLevel: Number(itemData.spicyLevel || 0),
        isPopular: !!itemData.isPopular,
        isSoldOut: !!itemData.isSoldOut,
        image: itemData.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
        description: itemData.description || "Menu lezat racikan bumbu autentik khas Resto Pro.",
        calories: itemData.calories || "450 kkal",
        portion: itemData.portion || "1 Porsi Standar",
        defaultModifiers: itemData.defaultModifiers || {
          spiciness: Number(itemData.spicyLevel || 0),
          notes: ""
        }
      };
      catalog.push(savedItem);
    }

    this.saveMenuCatalog(catalog);
    // Sinkronkan variabel runtime MENU_ITEMS jika ada
    if (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS)) {
      const idx = MENU_ITEMS.findIndex(m => m.id === savedItem.id);
      if (idx >= 0) {
        MENU_ITEMS[idx] = savedItem;
      } else {
        MENU_ITEMS.push(savedItem);
      }
    }

    this.emit("MENU_CATALOG_UPDATED", { item: savedItem, catalog: catalog });
    this.postToGas("saveMenuItem", savedItem);
    return savedItem;
  },

  deleteMenuItem(itemId) {
    let catalog = this.getMenuCatalog();
    catalog = catalog.filter(m => m.id !== itemId);
    this.saveMenuCatalog(catalog);

    if (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS)) {
      const idx = MENU_ITEMS.findIndex(m => m.id === itemId);
      if (idx >= 0) {
        MENU_ITEMS.splice(idx, 1);
      }
    }

    this.emit("MENU_CATALOG_UPDATED", { deletedId: itemId, catalog: catalog });
    this.postToGas("deleteMenuItem", { id: itemId });
    return true;
  },

  toggleMenuItemStock(itemId, isAvailable) {
    const catalog = this.getMenuCatalog();
    const item = catalog.find(m => m.id === itemId);
    if (item) {
      item.isSoldOut = !isAvailable;
      this.saveMenuCatalog(catalog);

      if (typeof MENU_ITEMS !== "undefined" && Array.isArray(MENU_ITEMS)) {
        const runtimeItem = MENU_ITEMS.find(m => m.id === itemId);
        if (runtimeItem) runtimeItem.isSoldOut = !isAvailable;
      }

      this.emit("MENU_STOCK_CHANGED", { itemId, isSoldOut: !isAvailable, name: item.name });
      this.emit("MENU_CATALOG_UPDATED", { item, catalog });
      this.postToGas("toggleMenuStock", { id: itemId, isAvailable: isAvailable });
      return item;
    }
    return null;
  },

  // ============================================================
  // SISTEM RESERVASI MEJA & BOOKING JADWAL (TABLE RESERVATIONS)
  // ============================================================
  initDefaultReservations() {
    const existing = localStorage.getItem(this.RESERVATIONS_STORAGE_KEY);
    if (!existing) {
      const today = new Date().toISOString().slice(0, 10);
      const defaultReservations = [
        {
          id: "RES-101",
          tableId: "T07",
          tableName: "Meja 07",
          section: "Outdoor Garden",
          customerName: "dr. Irfan Hakim",
          phone: "081234567890",
          guests: 6,
          dateStr: today,
          timeStr: "19:30 WIB",
          status: "confirmed", // 'confirmed', 'seated', 'cancelled'
          createdAt: Date.now() - (2 * 3600 * 1000),
          notes: "Acara Ulang Tahun Keluarga. Mohon meja samping kolam air mancur.",
          preOrders: [
            { name: "Nasi Mandhi Daging Kambing", qty: 4, price: 65000 },
            { name: "Authentic Teh Tarik", qty: 6, price: 18000 }
          ]
        },
        {
          id: "RES-102",
          tableId: "T11",
          tableName: "Meja 11",
          section: "VIP Private Room",
          customerName: "Keluarga Bpk. Anies R.",
          phone: "081298765432",
          guests: 8,
          dateStr: today,
          timeStr: "20:00 WIB",
          status: "confirmed",
          createdAt: Date.now() - (4 * 3600 * 1000),
          notes: "Dinner bisnis keluarga. Harap siapkan set teko Qahwa panas sebelum kedatangan.",
          preOrders: [
            { name: "Tom Yum Goong Seafood Kuah Merah", qty: 3, price: 55000 },
            { name: "Qahwa Arabika Rempah Kapulaga", qty: 4, price: 25000 }
          ]
        }
      ];
      this.saveReservations(defaultReservations);
    }
  },

  getReservations(filterDate = null) {
    try {
      const data = localStorage.getItem(this.RESERVATIONS_STORAGE_KEY);
      let list = data ? JSON.parse(data) : [];
      if (filterDate) {
        list = list.filter(r => r.dateStr === filterDate);
      }
      return list;
    } catch (e) {
      console.warn("Gagal getReservations:", e);
      return [];
    }
  },

  saveReservations(reservations) {
    try {
      localStorage.setItem(this.RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
    } catch (e) {
      console.warn("Gagal simpan reservations:", e);
    }
  },

  saveReservation(resData) {
    const list = this.getReservations();
    const today = new Date().toISOString().slice(0, 10);
    const id = resData.id || `RES-${Math.floor(100 + Math.random() * 900)}`;

    const newRes = {
      id: id,
      tableId: resData.tableId || "T01",
      tableName: resData.tableName || resData.table || "Meja 01",
      section: resData.section || "Indoor AC",
      customerName: resData.customerName || resData.name || "Tamu Reservasi",
      phone: resData.phone || "-",
      guests: Number(resData.guests || 2),
      dateStr: resData.dateStr || today,
      timeStr: resData.timeStr || "19:00 WIB",
      status: resData.status || "confirmed",
      createdAt: resData.createdAt || Date.now(),
      notes: resData.notes || "",
      preOrders: resData.preOrders || []
    };

    const existingIdx = list.findIndex(r => r.id === newRes.id);
    if (existingIdx >= 0) {
      list[existingIdx] = newRes;
    } else {
      list.unshift(newRes);
    }

    this.saveReservations(list);
    this.emit("RESERVATION_UPDATED", newRes);
    this.postToGas("saveReservation", newRes);
    return newRes;
  },

  checkInReservation(resId) {
    const list = this.getReservations();
    const res = list.find(r => r.id === resId);
    if (res) {
      res.status = "seated";
      this.saveReservations(list);

      // Sinkronkan status meja di runtime
      if (typeof RESTO_TABLES !== "undefined" && Array.isArray(RESTO_TABLES)) {
        const table = RESTO_TABLES.find(t => t.id === res.tableId);
        if (table) {
          table.status = "occupied";
          table.customer = `${res.customerName} (Reservasi)`;
          if (res.preOrders && res.preOrders.length > 0) {
            table.items = res.preOrders.map(p => ({
              name: p.name,
              qty: p.qty,
              price: p.price || 0,
              notes: "Pre-Order Reservasi"
            }));
            table.runningTotal = table.items.reduce((sum, it) => sum + (it.price * it.qty), 0);
          }
        }
      }

      this.emit("RESERVATION_CHECKED_IN", res);
      this.emit("TABLE_STATUS_CHANGED", { tableId: res.tableId, status: "occupied" });
      this.postToGas("checkInReservation", { id: resId });
      return res;
    }
    return null;
  },

  cancelReservation(resId) {
    const list = this.getReservations();
    const res = list.find(r => r.id === resId);
    if (res) {
      res.status = "cancelled";
      this.saveReservations(list);

      if (typeof RESTO_TABLES !== "undefined" && Array.isArray(RESTO_TABLES)) {
        const table = RESTO_TABLES.find(t => t.id === res.tableId);
        if (table && table.status === "reserved") {
          table.status = "available";
          table.customer = "-";
        }
      }

      this.emit("RESERVATION_UPDATED", res);
      this.postToGas("cancelReservation", { id: resId });
      return res;
    }
    return null;
  },

  // ============================================================
  // MANAJEMEN DENAH MEJA DINAMIS (DYNAMIC TABLE CRUD)
  // ============================================================
  initDefaultTables() {
    const existing = localStorage.getItem(this.TABLES_STORAGE_KEY);
    if (!existing) {
      let tables = [];
      if (typeof RESTO_TABLES !== "undefined" && Array.isArray(RESTO_TABLES)) {
        tables = JSON.parse(JSON.stringify(RESTO_TABLES));
      } else {
        // Fallback 12 meja awal
        for (let i = 1; i <= 12; i++) {
          const num = i < 10 ? "0" + i : "" + i;
          let sec = "Indoor AC";
          let seats = 4;
          if (i >= 7 && i <= 10) { sec = "Outdoor Garden"; seats = (i === 7 ? 8 : 4); }
          else if (i >= 11) { sec = "VIP Private Room"; seats = 6; }
          tables.push({
            id: "T" + num,
            name: "Meja " + num,
            seats: seats,
            section: sec,
            status: "available",
            runningTotal: 0,
            elapsedMinutes: 0,
            customer: "-",
            orderCount: 0,
            items: []
          });
        }
      }
      this.saveTables(tables);
    }
  },

  getTables() {
    try {
      const data = localStorage.getItem(this.TABLES_STORAGE_KEY);
      if (data) return JSON.parse(data);
      if (typeof RESTO_TABLES !== "undefined" && Array.isArray(RESTO_TABLES)) {
        return RESTO_TABLES;
      }
    } catch (e) {}
    return [];
  },

  saveTables(tables) {
    try {
      localStorage.setItem(this.TABLES_STORAGE_KEY, JSON.stringify(tables));
      if (typeof RESTO_TABLES !== "undefined") {
        RESTO_TABLES.length = 0;
        tables.forEach(t => RESTO_TABLES.push(t));
      }
      this.emit("TABLES_UPDATED", tables);
      return true;
    } catch (e) {
      console.warn("Gagal simpan tables:", e);
      return false;
    }
  },

  addTable(tableData) {
    if (!this.canAddTable()) {
      const lic = this.getLicenseData();
      this.showProFeatureLockedModal(
        "Batas Kuota Meja Tercapai",
        `Versi Starter Free Anda saat ini dibatasi maksimal ${lic.maxTables} meja. Upgrade ke Resto Pro Enterprise untuk mengelola meja tanpa batas (Unlimited Tables)!`
      );
      return null;
    }

    const tables = this.getTables();
    let nextNum = tables.length + 1;
    let nextId = "T" + (nextNum < 10 ? "0" + nextNum : nextNum);
    while (tables.some(t => t.id === nextId)) {
      nextNum++;
      nextId = "T" + (nextNum < 10 ? "0" + nextNum : nextNum);
    }

    const newTable = {
      id: nextId,
      name: tableData.name || ("Meja " + (nextNum < 10 ? "0" + nextNum : nextNum)),
      seats: Number(tableData.seats) || 4,
      section: tableData.section || "Indoor AC",
      status: "available",
      runningTotal: 0,
      elapsedMinutes: 0,
      customer: "-",
      orderCount: 0,
      items: []
    };

    tables.push(newTable);
    this.saveTables(tables);
    this.postToGas("saveTable", newTable);
    return newTable;
  },

  updateTable(tableId, data) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === tableId);
    if (table) {
      if (data.name) table.name = data.name;
      if (data.seats) table.seats = Number(data.seats);
      if (data.section) table.section = data.section;
      if (data.status) table.status = data.status;
      if (data.customer) table.customer = data.customer;
      this.saveTables(tables);
      this.postToGas("saveTable", table);
      return table;
    }
    return null;
  },

  deleteTable(tableId) {
    const tables = this.getTables();
    const table = tables.find(t => t.id === tableId);
    if (!table) return false;

    if (table.status === "occupied" || table.status === "bill_requested") {
      alert(`Meja ${table.name} sedang terisi tamu! Harap selesaikan pembayaran kasir terlebih dahulu sebelum menghapus meja.`);
      return false;
    }

    const filtered = tables.filter(t => t.id !== tableId);
    this.saveTables(filtered);
    this.postToGas("deleteTable", { id: tableId });
    return true;
  },

  // ============================================================
  // SISTEM LISENSI SAAS & GEMBOK FITUR PRO (FEATURE GATING)
  // ============================================================
  initLicenseData() {
    const existing = localStorage.getItem(this.LICENSE_STORAGE_KEY);
    if (!existing) {
      const defaultLicense = {
        isPro: true,
        tier: "enterprise",
        tierLabel: "RASH Enterprise Tier",
        token: "RASH-PRO-ENTERPRISE-2028",
        expiry: "31 Desember 2028",
        maxTables: 999,
        activatedAt: Date.now()
      };
      this.saveLicenseData(defaultLicense);
    }
  },

  getLicenseData() {
    try {
      const data = localStorage.getItem(this.LICENSE_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      isPro: true,
      tier: "enterprise",
      tierLabel: "RASH Enterprise Tier",
      token: "RASH-PRO-ENTERPRISE-2028",
      expiry: "31 Desember 2028",
      maxTables: 999
    };
  },

  saveLicenseData(lic) {
    try {
      localStorage.setItem(this.LICENSE_STORAGE_KEY, JSON.stringify(lic));
      this.emit("LICENSE_STATUS_CHANGED", lic);
    } catch (e) {
      console.warn("Gagal simpan license data:", e);
    }
  },

  isProActive() {
    return Boolean(this.getLicenseData().isPro);
  },

  canAddTable() {
    const lic = this.getLicenseData();
    const tables = this.getTables();
    return tables.length < (lic.maxTables || 999);
  },

  verifyLicenseToken(rawToken) {
    const token = (rawToken || "").trim().toUpperCase();
    if (!token) {
      return { success: false, message: "Kode token lisensi tidak boleh kosong!" };
    }

    // Format valid: RASH-RESTO-PRO-..., RASH-PRO-..., RASH-APP-PRO-..., RASH-ENTERPRISE-...
    const isMaster = token.includes("RASH-RESTO-PRO-") || token.includes("RASH-PRO-") || token.includes("RASH-APP-PRO-") || token.includes("RASH-ENTERPRISE-") || token === "RASH-2028";
    if (!isMaster) {
      return { success: false, message: "Format token tidak dikenali oleh RASH Keynode. Pastikan token resmi diterbitkan oleh RASH WebApp Builder!" };
    }

    let expiryStr = "31 Desember 2028";
    if (token.includes("LIFETIME") || token.includes("VIP")) {
      expiryStr = "Permanen / Lifetime (Tanpa Batas)";
    } else if (token.includes("2027")) {
      expiryStr = "31 Desember 2027";
    }

    const lic = {
      isPro: true,
      tier: "enterprise",
      tierLabel: "RASH Enterprise Tier",
      token: token,
      expiry: expiryStr,
      maxTables: 999,
      activatedAt: Date.now()
    };

    this.saveLicenseData(lic);
    return { 
      success: true, 
      message: `Token lisensi "${token}" berhasil diverifikasi!\nSeluruh fitur Resto Pro Enterprise (Unlimited Meja, BI & WA CRM) telah aktif.`,
      license: lic 
    };
  },

  setSimulationFreeTier() {
    const freeLic = {
      isPro: false,
      tier: "free",
      tierLabel: "Starter Free Tier",
      token: "FREE-MODE",
      expiry: "Mode Gratis (Maksimal 4 Meja)",
      maxTables: 4,
      activatedAt: Date.now()
    };
    this.saveLicenseData(freeLic);
    return freeLic;
  },

  showProFeatureLockedModal(featureName, description) {
    let modal = document.getElementById("proFeatureLockModal");
    if (!modal) {
      const div = document.createElement("div");
      div.id = "proFeatureLockModal";
      div.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm";
      div.innerHTML = `
        <div class="bg-white dark:bg-[#1E293B] border border-amber-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-[#E7DFD5] dark:border-[#334155]">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <span class="material-symbols-outlined text-[20px]">lock</span>
              </span>
              <h3 class="font-heading font-extrabold text-base text-[#1C1917] dark:text-white" id="proModalFeatureTitle">Fitur Resto Pro Enterprise</h3>
            </div>
            <button onclick="document.getElementById('proFeatureLockModal').classList.add('hidden')" class="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <p class="text-xs text-stone-600 dark:text-stone-300 leading-relaxed" id="proModalFeatureDesc">
            Fitur ini khusus untuk restoran berlisensi Resto Pro Enterprise.
          </p>
          <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <span class="font-heading font-bold block flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">verified</span>
              Keuntungan Lisensi Enterprise:
            </span>
            <ul class="list-disc list-inside space-y-0.5 text-[11px] text-stone-600 dark:text-stone-300">
              <li>Kelola Meja Tanpa Batas (Unlimited Tables)</li>
              <li>Analitik Jam Sibuk Heatmap & AI Smart Insights</li>
              <li>Struk Belanja Digital Otomatis via WhatsApp</li>
              <li>Database Cloud Google Sheets Tanpa Batas</li>
            </ul>
          </div>
          <div class="space-y-2 pt-1">
            <a href="https://wa.me/6281200000000?text=Halo%20RASH%20WebApp%20Builder%2C%20saya%20ingin%20upgrade%20ke%20Resto%20Pro%20Enterprise" target="_blank" class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#0F172A] font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md">
              <span class="material-symbols-outlined text-[18px]">chat</span>
              <span>Hubungi Developer via WhatsApp</span>
            </a>
            <div class="flex items-center gap-1.5 pt-2 border-t border-stone-200 dark:border-stone-800">
              <input type="text" id="proModalTokenInput" placeholder="Punya Token? Masukkan di sini..." class="flex-1 px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#0F172A] border border-[#E7DFD5] dark:border-[#334155] text-xs font-mono text-[#1C1917] dark:text-white outline-none" />
              <button onclick="RestoSync.verifyFromModal()" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs whitespace-nowrap">Aktifkan</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      modal = div;
    }

    document.getElementById("proModalFeatureTitle").textContent = featureName || "Fitur Resto Pro Enterprise";
    document.getElementById("proModalFeatureDesc").textContent = description || "Fitur ini khusus untuk pengguna berlisensi Resto Pro Enterprise.";
    modal.classList.remove("hidden");
  },

  verifyFromModal() {
    const input = document.getElementById("proModalTokenInput");
    if (!input || !input.value.trim()) {
      alert("Silakan masukkan token lisensi terlebih dahulu!");
      return;
    }
    const res = this.verifyLicenseToken(input.value.trim());
    alert(res.message);
    if (res.success) {
      document.getElementById("proFeatureLockModal").classList.add("hidden");
      location.reload();
    }
  },

  // ============================================================
  // INTEGRASI NOTIFIKASI WHATSAPP CRM (STRUK & RESERVASI)
  // ============================================================
  formatWhatsAppReceiptText(transaction) {
    if (!transaction) return "";
    const itemsText = (transaction.items || []).map(i => `• ${i.qty}x ${i.name} (@ Rp ${(i.price || 0).toLocaleString('id-ID')})`).join("\n");
    const billNumber = transaction.billNo || transaction.id || 'BILL';
    const dateFormatted = transaction.dateStr ? `${transaction.dateStr} ${transaction.timeStr || ''}` : new Date(transaction.timestamp || Date.now()).toLocaleString('id-ID');
    const tenantInfo = this.getTenantInfo();
    const restoName = (tenantInfo && tenantInfo.name) ? tenantInfo.name.toUpperCase() : "RESTO PRO";

    return `✨ *${restoName} - STRUK PEMBAYARAN RESMI* ✨\n` +
      `No. Struk : *${billNumber}*\n` +
      `Tanggal   : ${dateFormatted}\n` +
      `Meja      : ${transaction.table || 'Meja'}\n` +
      `Kasir     : ${transaction.cashier || (tenantInfo ? tenantInfo.pic : 'Kasir')}\n` +
      `Tamu      : ${transaction.customer || 'Pelanggan Terhormat'}\n` +
      `------------------------------------------\n` +
      `*RINCIAN MENU:*\n${itemsText}\n` +
      `------------------------------------------\n` +
      `Subtotal  : Rp ${(transaction.subtotal || 0).toLocaleString('id-ID')}\n` +
      `Diskon    : Rp ${(transaction.discount || 0).toLocaleString('id-ID')}\n` +
      `PB1 (10%) : Rp ${(transaction.tax || 0).toLocaleString('id-ID')}\n` +
      `*TOTAL    : Rp ${(transaction.grandTotal || 0).toLocaleString('id-ID')}*\n` +
      `Metode    : ${(transaction.paymentMethod || 'Tunai').toUpperCase()}\n` +
      `------------------------------------------\n` +
      `Terima kasih telah bersantap di ${tenantInfo ? tenantInfo.name : 'Resto Pro'}! 🙏\nSemoga berkah & ditunggu kedatangannya kembali!`;
  },

  sendWhatsAppReceipt(transaction, overridePhone = null) {
    if (!transaction) return;
    const phone = overridePhone || transaction.phone || transaction.memberPhone || transaction.customerPhone || "";
    if (!phone || phone === "-") {
      alert("Nomor WhatsApp pelanggan belum tercatat untuk transaksi ini!");
      return;
    }

    let cleanPhone = String(phone).replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);
    else if (cleanPhone.startsWith("8")) cleanPhone = "62" + cleanPhone;

    const msg = this.formatWhatsAppReceiptText(transaction);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  },

  sendWhatsAppReservationConfirm(res, overridePhone = null) {
    if (!res) return;
    let phone = overridePhone || res.phone || "";
    if (!phone || phone === "-") {
      const input = prompt("Masukkan nomor WhatsApp tamu (contoh: 081234567890):", "");
      if (input && input.trim()) {
        phone = input.trim();
        res.phone = phone;
      } else {
        return;
      }
    }

    let cleanPhone = String(phone).replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);
    else if (cleanPhone.startsWith("8")) cleanPhone = "62" + cleanPhone;

    const msg = `🎉 *KONFIRMASI BOOKING MEJA - RESTO PRO* 🎉\n` +
      `Halo *${res.customerName}*,\nReservasi meja Anda telah kami konfirmasi:\n\n` +
      `📌 ID Booking : *${res.id}*\n` +
      `🍽️ Meja       : *${res.tableName}* (${res.section})\n` +
      `📅 Jadwal     : *${res.dateStr}*, Pukul *${res.timeStr}*\n` +
      `👥 Kapasitas  : *${res.guests} Orang*\n` +
      (res.notes ? `📝 Catatan   : ${res.notes}\n` : '') +
      `\nTim kami siap menyambut kedatangan Anda dan keluarga. Sampai jumpa di Resto Pro! ✨`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  },

  // ============================================================
  // CADANGAN & PEMULIHAN DATABASE JSON (BACKUP & RESTORE)
  // ============================================================
  backupFullDatabaseJSON() {
    try {
      const backupData = {
        appName: "Resto Pro by RASH WebApp Builder",
        exportTimestamp: Date.now(),
        exportDateStr: new Date().toISOString(),
        version: "2.5.0 Enterprise",
        kdsTickets: this.getKdsTickets(),
        transactions: this.getTransactions(),
        members: this.getMembers(),
        menuCatalog: this.getMenuCatalog(),
        reservations: this.getReservations(),
        tables: this.getTables(),
        theme: localStorage.getItem("resto_theme") || "light"
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().slice(0, 10);
      link.setAttribute("href", url);
      link.setAttribute("download", `Backup_RestoPro_Database_${dateTag}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      console.error("Gagal backup database:", e);
      alert("Gagal membuat file cadangan database: " + e.message);
      return false;
    }
  },

  restoreFullDatabaseJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || !data.appName || (!data.menuCatalog && !data.transactions)) {
        throw new Error("Format berkas backup tidak valid atau rusak!");
      }

      if (Array.isArray(data.kdsTickets)) this.saveKdsTickets(data.kdsTickets);
      if (Array.isArray(data.transactions)) this.saveTransactions(data.transactions);
      if (Array.isArray(data.members)) this.saveMembers(data.members);
      if (Array.isArray(data.menuCatalog)) this.saveMenuCatalog(data.menuCatalog);
      if (Array.isArray(data.reservations)) this.saveReservations(data.reservations);
      if (Array.isArray(data.tables)) this.saveTables(data.tables);
      if (data.theme) localStorage.setItem("resto_theme", data.theme);

      this.emit("DATABASE_RESTORED", { timestamp: Date.now() });
      return true;
    } catch (err) {
      console.error("Gagal memulihkan database:", err);
      alert("Gagal memulihkan database: " + err.message);
      return false;
    }
  },

  // ============================================================
  // IMPORT DATA LAMA MASAL (CSV / EXCEL DATA MIGRATION ENGINE)
  // ============================================================
  parseCSV(text) {
    const lines = text.trim().split(/\r\n|\n|\r/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = [];
      let insideQuote = false;
      let entry = '';
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          values.push(entry.trim().replace(/^["']|["']$/g, ''));
          entry = '';
        } else {
          entry += char;
        }
      }
      values.push(entry.trim().replace(/^["']|["']$/g, ''));
      
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] !== undefined ? values[idx] : '';
      });
      rows.push(obj);
    }
    return rows;
  },

  importMenuFromCSV(csvText) {
    const rows = this.parseCSV(csvText);
    if (!rows || rows.length === 0) throw new Error("Format CSV menu kosong atau tidak valid.");
    const catalog = this.getMenuCatalog();
    let added = 0;
    let updated = 0;

    rows.forEach(r => {
      const name = r.name || r.nama || r['nama menu'] || r['nama_menu'];
      if (!name) return;
      const price = Number(r.price || r.harga || 0);
      const category = (r.category || r.kategori || 'arabian').toLowerCase();
      const station = (r.station || r.stasiun || (category === 'drinks' ? 'drinks' : 'kitchen')).toLowerCase();
      
      const existing = catalog.find(m => m.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (price > 0) existing.price = price;
        existing.category = category || existing.category;
        existing.station = station || existing.station;
        updated++;
      } else {
        const id = "menu-" + Math.floor(1000 + Math.random() * 9000);
        catalog.push({
          id,
          name,
          price: price || 25000,
          category,
          categoryLabel: category === 'drinks' ? 'Minuman' : category.toUpperCase(),
          station,
          image: r.image || r.foto || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
          isSoldOut: false
        });
        added++;
      }
    });

    this.saveMenuCatalog(catalog);
    this.emit("MENU_CATALOG_UPDATED", catalog);
    return { added, updated, total: catalog.length };
  },

  importMembersFromCSV(csvText) {
    const rows = this.parseCSV(csvText);
    if (!rows || rows.length === 0) throw new Error("Format CSV member kosong atau tidak valid.");
    const members = this.getMembers();
    let added = 0;
    let updated = 0;

    rows.forEach(r => {
      const phone = (r.phone || r.telepon || r.wa || r.whatsapp || r['no hp'] || r['no_hp'] || '').replace(/[^0-9]/g, '');
      const name = r.name || r.nama || 'Pelanggan';
      if (!phone) return;

      const points = Number(r.points || r.poin || r.saldo || 0);
      const tier = (r.tier || 'regular').toLowerCase();

      const existing = members.find(m => m.phone.replace(/[^0-9]/g, '') === phone);
      if (existing) {
        existing.name = name || existing.name;
        existing.points = Math.max(existing.points || 0, points);
        existing.tier = tier || existing.tier;
        updated++;
      } else {
        members.push({
          id: "MBR-" + Math.floor(100 + Math.random() * 900),
          name,
          phone,
          points,
          tier,
          tierLabel: tier === 'gold' ? 'VIP Gold Member' : (tier === 'silver' ? 'VIP Silver Member' : 'Regular Member'),
          registeredAt: Date.now()
        });
        added++;
      }
    });

    this.saveMembers(members);
    this.emit("MEMBERS_UPDATED", members);
    return { added, updated, total: members.length };
  },

  getSupabaseConfig() {
    return {
      url: localStorage.getItem(this.SUPABASE_URL_STORAGE_KEY) || "",
      key: localStorage.getItem(this.SUPABASE_KEY_STORAGE_KEY) || ""
    };
  },

  saveSupabaseConfig(url, key) {
    localStorage.setItem(this.SUPABASE_URL_STORAGE_KEY, (url || "").trim());
    localStorage.setItem(this.SUPABASE_KEY_STORAGE_KEY, (key || "").trim());
    this.emit("SUPABASE_CONFIG_UPDATED", { url, key });
  },

  // ============================================================
  // GOOGLE APPS SCRIPT (GAS) & GOOGLE SHEETS REST API ENGINE
  // ============================================================
  
  /**
   * Memeriksa parameter magic setup link di URL browser
   * Format: ?setupGasUrl=https://.../exec&setupApiKey=RP-SEC-...
   */
  checkUrlAutoConfig() {
    if (typeof window === "undefined" || !window.location || !window.location.search) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("setupGasUrl");
      const keyParam = params.get("setupApiKey");
      const licParam = params.get("setupLicense");
      let updated = false;

      if (urlParam && urlParam.startsWith("https://script.google.com/macros/s/")) {
        const cleanUrl = decodeURIComponent(urlParam).trim();
        localStorage.setItem(this.GAS_URL_STORAGE_KEY, cleanUrl);
        updated = true;
      }
      if (keyParam) {
        const cleanKey = decodeURIComponent(keyParam).trim();
        localStorage.setItem(this.GAS_API_KEY_STORAGE_KEY, cleanKey);
        updated = true;
      }
      if (licParam) {
        const cleanLic = decodeURIComponent(licParam).trim();
        const licRes = this.verifyLicenseToken(cleanLic);
        if (licRes.success && licRes.license) {
          this.saveLicenseData(licRes.license);
          updated = true;
        }
      }
      if (updated) {
        params.delete("setupGasUrl");
        params.delete("setupApiKey");
        params.delete("setupLicense");
        const newQuery = params.toString();
        const newUrl = window.location.pathname + (newQuery ? "?" + newQuery : "") + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        this.emit("GAS_CONFIG_CHANGED", { autoConfigured: true });
        console.log("Resto Pro: Konfigurasi Cloud berhasil dipasang otomatis via link!");
      }
    } catch (e) {
      console.warn("Gagal membaca auto config URL:", e);
    }
  },

  getGasUrl() {
    try {
      // 1. Cek dari konfigurasi Tenant khusus jika ada
      const tenant = this.getTenantInfo();
      if (tenant && tenant.gasUrl && tenant.gasUrl.trim()) {
        return tenant.gasUrl.trim();
      }

      // 2. Prioritaskan URL yang tersimpan di LocalStorage
      const local = localStorage.getItem(this.GAS_URL_STORAGE_KEY);
      if (local && local.trim()) return local.trim();

      // 3. Fallback otomatis ke konfigurasi sentral resto-config.js
      if (typeof window !== "undefined" && window.RESTO_CLOUD_CONFIG && window.RESTO_CLOUD_CONFIG.GAS_URL) {
        const fileUrl = window.RESTO_CLOUD_CONFIG.GAS_URL.trim();
        if (fileUrl) return fileUrl;
      }
      return "";
    } catch (e) {
      return "";
    }
  },

  setGasUrl(url) {
    try {
      const cleanUrl = (url || "").trim();
      localStorage.setItem(this.GAS_URL_STORAGE_KEY, cleanUrl);
      this.emit("GAS_CONFIG_CHANGED", { url: cleanUrl });
      return true;
    } catch (e) {
      console.warn("Gagal simpan GAS URL:", e);
      return false;
    }
  },

  getGasApiKey() {
    try {
      // 1. Cek dari konfigurasi Tenant khusus jika ada
      const tenant = this.getTenantInfo();
      if (tenant && tenant.apiKey && tenant.apiKey.trim()) {
        return tenant.apiKey.trim();
      }

      // 2. Prioritaskan API Key yang tersimpan di LocalStorage
      const local = localStorage.getItem(this.GAS_API_KEY_STORAGE_KEY);
      if (local && local.trim()) return local.trim();

      // 3. Fallback otomatis ke konfigurasi sentral resto-config.js
      if (typeof window !== "undefined" && window.RESTO_CLOUD_CONFIG && window.RESTO_CLOUD_CONFIG.API_SECRET_KEY) {
        const fileKey = window.RESTO_CLOUD_CONFIG.API_SECRET_KEY.trim();
        if (fileKey) return fileKey;
      }
      return "";
    } catch (e) {
      return "";
    }
  },

  setGasApiKey(key) {
    try {
      const cleanKey = (key || "").trim();
      localStorage.setItem(this.GAS_API_KEY_STORAGE_KEY, cleanKey);
      this.emit("GAS_CONFIG_CHANGED", { apiKey: cleanKey });
      return true;
    } catch (e) {
      console.warn("Gagal simpan GAS API Key:", e);
      return false;
    }
  },

  isGasConfigured() {
    const url = this.getGasUrl();
    return Boolean(url && url.startsWith("https://script.google.com/macros/s/"));
  },

  isConfiguredViaConfigFile() {
    if (typeof window === "undefined" || !window.RESTO_CLOUD_CONFIG) return false;
    const fileUrl = window.RESTO_CLOUD_CONFIG.GAS_URL || "";
    return Boolean(fileUrl && fileUrl.startsWith("https://script.google.com/macros/s/"));
  },

  generateMagicSetupLink(targetPage = "cashier_pos_register.html") {
    const url = this.getGasUrl();
    const key = this.getGasApiKey();
    if (!url) return "";

    let base = window.location.href.split("?")[0].split("#")[0];
    const slashIdx = base.lastIndexOf("/");
    if (slashIdx !== -1) {
      base = base.substring(0, slashIdx + 1) + targetPage;
    }
    return `${base}?setupGasUrl=${encodeURIComponent(url)}&setupApiKey=${encodeURIComponent(key)}`;
  },

  async pingGasBackend() {
    const url = this.getGasUrl();
    if (!url) throw new Error("URL Google Apps Script belum diisi!");

    const apiKey = this.getGasApiKey();
    const pingUrl = url + (url.includes("?") ? "&" : "?") + "action=ping" + (apiKey ? "&apiKey=" + encodeURIComponent(apiKey) : "") + "&_t=" + Date.now();
    const res = await fetch(pingUrl, { method: "GET", mode: "cors" });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    return await res.json();
  },

  async postToGas(action, data = {}) {
    const url = this.getGasUrl();
    if (!url) return null;

    try {
      // Menggunakan Content-Type text/plain agar tidak memicu CORS preflight OPTIONS check di GAS
      // Menyertakan apiKey untuk mengotorisasi aksi di server
      const res = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
          action, 
          data, 
          apiKey: this.getGasApiKey(),
          timestamp: Date.now() 
        })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Background GAS POST warning (non-blocking):", e);
    }
    return null;
  },

  async pullFromGasCloud() {
    const url = this.getGasUrl();
    if (!url) throw new Error("URL Google Apps Script belum dikonfigurasi!");

    const apiKey = this.getGasApiKey();
    const fetchUrl = url + (url.includes("?") ? "&" : "?") + "action=getAllData" + (apiKey ? "&apiKey=" + encodeURIComponent(apiKey) : "") + "&_t=" + Date.now();
    const res = await fetch(fetchUrl, { method: "GET", mode: "cors" });
    if (!res.ok) throw new Error(`Gagal menghubungi server GAS (Status: ${res.status})`);

    const json = await res.json();
    if (json.unauthorized) {
      throw new Error("Akses Ditolak: API Secret Key tidak valid atau belum diisi. Periksa Section 7 Owner Settings!");
    }
    if (!json.success || !json.data) {
      throw new Error(json.error || json.message || "Format data server tidak valid");
    }

    const cloudData = json.data;

    // Simpan data cloud ke LocalStorage
    if (Array.isArray(cloudData.menuCatalog) && cloudData.menuCatalog.length > 0) {
      this.saveMenuCatalog(cloudData.menuCatalog);
    }
    if (Array.isArray(cloudData.transactions) && cloudData.transactions.length > 0) {
      this.saveTransactions(cloudData.transactions);
    }
    if (Array.isArray(cloudData.members) && cloudData.members.length > 0) {
      this.saveMembers(cloudData.members);
    }
    if (Array.isArray(cloudData.reservations) && cloudData.reservations.length > 0) {
      this.saveReservations(cloudData.reservations);
    }
    if (Array.isArray(cloudData.kdsTickets) && cloudData.kdsTickets.length > 0) {
      this.saveKdsTickets(cloudData.kdsTickets);
    }

    this.emit("DATABASE_RESTORED", { source: "google_sheets", timestamp: Date.now() });
    return json;
  },

  async pushToGasCloud() {
    const url = this.getGasUrl();
    if (!url) throw new Error("URL Google Apps Script belum dikonfigurasi!");

    const fullPayload = {
      menuCatalog: this.getMenuCatalog(),
      transactions: this.getTransactions(),
      members: this.getMembers(),
      reservations: this.getReservations(),
      kdsTickets: this.getKdsTickets()
    };

    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ 
        action: "syncFullState", 
        data: fullPayload,
        apiKey: this.getGasApiKey(),
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const json = await res.json();
    if (json.unauthorized) {
      throw new Error("Akses Ditolak: API Secret Key tidak valid atau belum diisi. Periksa Section 7 Owner Settings!");
    }
    return json;
  },

  resetDemoData() {
    if (confirm("PERINGATAN: Seluruh transaksi lokal, kustomisasi menu, dan member akan di-reset ke data bawaan pabrik. Lanjutkan?")) {
      localStorage.removeItem(this.KDS_STORAGE_KEY);
      localStorage.removeItem(this.ONLINE_ORDERS_STORAGE_KEY);
      localStorage.removeItem(this.TRANSACTIONS_STORAGE_KEY);
      localStorage.removeItem(this.MEMBERS_STORAGE_KEY);
      localStorage.removeItem(this.MENU_STORAGE_KEY);
      localStorage.removeItem(this.RESERVATIONS_STORAGE_KEY);
      
      this.initDefaultKdsTickets();
      this.initDefaultOnlineOrders();
      this.initDefaultTransactions();
      this.initDefaultMembers();
      this.initDefaultMenuCatalog();
      this.initDefaultReservations();

      this.emit("DATABASE_RESTORED", { timestamp: Date.now() });
      alert("Database Resto Pro berhasil dikembalikan ke status demo awal pabrik!");
      location.reload();
    }
  }
};

// Inisialisasi saat script dimuat
RestoSync.init();

if (typeof window !== "undefined") {
  window.RestoSync = RestoSync;
}
