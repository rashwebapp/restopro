/**
 * Resto Pro by RASH WebApp Builder
 * Central Master Data & State Store
 * Spesialisasi: Kuliner Autentik Timur Tengah (Arab), Malaysia, & Thailand + Minuman Artisan
 */

const RESTO_CONFIG = {
  brandName: "Resto Pro by RASH WebApp Builder ✨",
  shortName: "Resto Pro",
  subTitle: "Arabian, Malaysian & Thai Culinary Heritage",
  tagline: "Authentic Eastern Fusion & Artisan Brews",
  currentTable: "05",
  tableLocation: "Indoor AC Lounge",
  taxRate: 0.10, // PB1 10%
  currencyPrefix: "Rp ",
  currencyLocale: "id-ID"
};

// 13 Item Menu Dummy Lengkap sesuai Spesifikasi
const MENU_ITEMS = [
  // 1. Middle Eastern (Arabian Delights)
  {
    id: "mandhi-lamb",
    name: "Nasi Mandhi Daging Kambing (Mandhi Lamb Rice)",
    price: 65000,
    category: "arabian",
    categoryLabel: "Arabian Delights 🕌",
    spicyLevel: 1,
    isPopular: true,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
    description: "Nasi basmati aromatik saffron bertabur kismis dan kacang almond dengan daging kambing empuk panggang oven khas Hadramaut.",
    calories: "780 kkal",
    portion: "1 Porsi (Nasi Basmati + Paha/Betis Kambing 250g)",
    defaultModifiers: {
      spiciness: 1,
      ricePortion: "Regular",
      notes: ""
    }
  },
  {
    id: "shawarma-ayam",
    name: "Shawarma Ayam Panggang (Grilled Chicken Shawarma)",
    price: 35000,
    category: "arabian",
    categoryLabel: "Arabian Delights 🕌",
    spicyLevel: 2,
    isPopular: true,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=800&q=80",
    description: "Daging ayam marinasi rempah oriental dipanggang vertikal rotisserie, dibalut roti pita garing dengan garlic toum sauce & acar timun Lebanon.",
    calories: "450 kkal",
    portion: "1 Roll Jumbo + French Fries",
    defaultModifiers: {
      spiciness: 2,
      extraSauce: false,
      notes: ""
    }
  },
  {
    id: "sambosa-keju",
    name: "Sambosa Daging Keju (Beef & Cheese Samosa 3pcs)",
    price: 25000,
    category: "arabian",
    categoryLabel: "Arabian Delights 🕌",
    spicyLevel: 1,
    isPopular: false,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    description: "Pastry segitiga super renyah berisi cacahan daging sapi Australia berbumbu jintan dan lelehan keju mozzarella gurih.",
    calories: "320 kkal",
    portion: "Isi 3 Pcs + Saus Cocol Harissa Sambal",
    defaultModifiers: {
      spiciness: 1,
      notes: ""
    }
  },

  // 2. Malaysian Favorites
  {
    id: "nasi-lemak-sotong",
    name: "Nasi Lemak Sambal Sotong Special",
    price: 45000,
    category: "malaysian",
    categoryLabel: "Malaysian Favorites 🇲🇾",
    spicyLevel: 3,
    isPopular: true,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
    description: "Nasi wangi santan pandan daun pisang disajikan dengan sambal cumi sotong pedas manis gurih, ikan bilis garing, kacang tanah, dan telur rebus.",
    calories: "620 kkal",
    portion: "1 Porsi Lengkap",
    defaultModifiers: {
      spiciness: 3,
      ricePortion: "Regular",
      notes: ""
    }
  },
  {
    id: "roti-canai-kari",
    name: "Roti Canai Kari Daging (Flaky Flatbread with Beef Curry)",
    price: 30000,
    category: "malaysian",
    categoryLabel: "Malaysian Favorites 🇲🇾",
    spicyLevel: 2,
    isPopular: false,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
    description: "Roti canai renyah berlapis khas mamak Penang yang dipanggang mentega garing, ditemani semangkuk kuah kari daging sapi pekat gurih.",
    calories: "490 kkal",
    portion: "2 Keping Canai + Semangkuk Kuah Daging",
    defaultModifiers: {
      spiciness: 2,
      extraRoti: false,
      notes: ""
    }
  },
  {
    id: "laksa-penang",
    name: "Laksa Penang Kuah Kental",
    price: 42000,
    category: "malaysian",
    categoryLabel: "Malaysian Favorites 🇲🇾",
    spicyLevel: 3,
    isPopular: false,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
    description: "Mie beras kenyal dalam kuah kaldu ikan tenggiri asam pedas pekat, disempurnakan bunga kecombrang wangi, daun kesum, potongan nanas, dan telur.",
    calories: "510 kkal",
    portion: "1 Mangkuk Porsi Besar",
    defaultModifiers: {
      spiciness: 3,
      notes: ""
    }
  },

  // 3. Thai Specialties
  {
    id: "tom-yum-goong",
    name: "Tom Yum Goong Seafood Kuah Merah (Hot & Sour Seafood Soup)",
    price: 55000,
    category: "thai",
    categoryLabel: "Thai Specialties 🇹🇭",
    spicyLevel: 4,
    isPopular: true,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?auto=format&fit=crop&w=800&q=80",
    description: "Sup asam pedas Bangkok autentik sarat rempah serai, lengkuas & daun jeruk, dengan isian udang windu jumbo, cumi, kerang, dan jamur merang segar.",
    calories: "380 kkal",
    portion: "1 Porsi Mangkuk Saji Panas",
    defaultModifiers: {
      spiciness: 4,
      addRice: false,
      notes: ""
    }
  },
  {
    id: "pad-thai-jumbo",
    name: "Pad Thai Udang Jumbo (Stir-fried Noodles with Jumbo Prawns)",
    price: 48000,
    category: "thai",
    categoryLabel: "Thai Specialties 🇹🇭",
    spicyLevel: 2,
    isPopular: false,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=800&q=80",
    description: "Kwetiau beras tumis asam jawa otentik Thailand dengan telur orak-arik, kucai segar, tauge krispi, udang laut jumbo, dan taburan kacang tanah sangrai.",
    calories: "560 kkal",
    portion: "1 Porsi Lengkap + Jeruk Nipis",
    defaultModifiers: {
      spiciness: 2,
      notes: ""
    }
  },
  {
    id: "mango-sticky-rice",
    name: "Mango Sticky Rice Santan Kental",
    price: 32000,
    category: "thai",
    categoryLabel: "Thai Specialties 🇹🇭",
    spicyLevel: 0,
    isPopular: true,
    isSoldOut: true, // WAJIB SOLD OUT SESUAI PERMINTAAN
    image: "https://images.unsplash.com/photo-1621996346565-e3d5d62810eb?auto=format&fit=crop&w=800&q=80",
    description: "Ketan pulen pandan harum disajikan dengan potongan mangga harum manis masak pohon dan siraman kuah santan kental gurih bertabur wijen sangrai.",
    calories: "390 kkal",
    portion: "1 Porsi Dessert (Sold Out Batch Hari Ini)",
    defaultModifiers: {
      notes: ""
    }
  },

  // 4. Signature Beverages
  {
    id: "teh-tarik",
    name: "Authentic Teh Tarik Buih Melimpah",
    price: 18000,
    category: "drinks",
    categoryLabel: "Artisan Drinks 🍹",
    spicyLevel: 0,
    isPopular: true,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
    description: "Teh hitam Ceylon premium ditarik tangan secara terampil dengan susu kental manis dan evaporated milk sampai membentuk buih karamel melimpah.",
    calories: "180 kkal",
    portion: "Gelas Besar 400ml",
    isDrink: true,
    defaultModifiers: {
      temperature: "Es Normal",
      sweetness: "Normal Manis",
      notes: ""
    }
  },
  {
    id: "thai-green-tea",
    name: "Thai Green Tea Susu Asli",
    price: 22000,
    category: "drinks",
    categoryLabel: "Artisan Drinks 🍹",
    spicyLevel: 0,
    isPopular: false,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80",
    description: "Seduhan daun teh hijau asli pegunungan Thailand berpadu susu kental manis segar dan aroma floral melati yang menyejukkan.",
    calories: "210 kkal",
    portion: "Gelas Besar 400ml",
    isDrink: true,
    defaultModifiers: {
      temperature: "Es Normal",
      extraJelly: false,
      notes: ""
    }
  },
  {
    id: "qahwa-arabika",
    name: "Qahwa Arabika Rempah Kapulaga (Arabic Spiced Coffee)",
    price: 25000,
    category: "drinks",
    categoryLabel: "Artisan Drinks 🍹",
    spicyLevel: 0,
    isPopular: false,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
    description: "Kopi arabika light-roast tradisional khas jazirah Arab diseduh lambat bersama biji kapulaga hijau harum, cengkeh wangi, dan serbuk saffron murni.",
    calories: "45 kkal",
    portion: "Dallah Teko Kecil + Cangkir Finjan & 2 Butir Kurma",
    isDrink: true,
    defaultModifiers: {
      temperature: "Panas Tradisional",
      sweetness: "Gula Pisah",
      notes: ""
    }
  },
  {
    id: "jus-kurma-madu",
    name: "Jus Kurma Susu Madu Segar",
    price: 24000,
    category: "drinks",
    categoryLabel: "Artisan Drinks 🍹",
    spicyLevel: 0,
    isPopular: true,
    isSoldOut: false,
    image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=800&q=80",
    description: "Minuman kesehatan berenergi tinggi dari lumatan kurma basah Sukari organik dipadu susu sapi segar dingin dan madu murni lebah liar Sumbawa.",
    calories: "260 kkal",
    portion: "Gelas Slim 350ml",
    isDrink: true,
    defaultModifiers: {
      temperature: "Dingin Segar",
      notes: ""
    }
  }
];

// Data 12 Meja Restoran (Tables 01-12)
const RESTO_TABLES = [
  { id: "T01", name: "Meja 01", seats: 2, section: "Indoor AC", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] },
  { id: "T02", name: "Meja 02", seats: 4, section: "Indoor AC", status: "occupied", runningTotal: 142000, elapsedMinutes: 28, customer: "Bpk. Farhan", orderCount: 3, items: [
    { name: "Nasi Mandhi Daging Kambing", qty: 1, price: 65000, notes: "Pedas Lvl 1" },
    { name: "Authentic Teh Tarik", qty: 2, price: 18000, notes: "Es Normal" },
    { name: "Sambosa Daging Keju", qty: 1, price: 25000, notes: "Lvl 1" }
  ]},
  { id: "T03", name: "Meja 03", seats: 4, section: "Indoor AC", status: "bill_requested", runningTotal: 187000, elapsedMinutes: 46, customer: "Ibu Rahmawati", orderCount: 4, items: [
    { name: "Tom Yum Goong Seafood", qty: 1, price: 55000, notes: "Pedas Lvl 4" },
    { name: "Pad Thai Udang Jumbo", qty: 1, price: 48000, notes: "Pedas Lvl 2" },
    { name: "Thai Green Tea Susu Asli", qty: 2, price: 22000, notes: "Sedikit Es" },
    { name: "Roti Canai Kari Daging", qty: 1, price: 30000, notes: "Lvl 2" }
  ]},
  { id: "T04", name: "Meja 04", seats: 6, section: "Indoor AC", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] },
  { id: "T05", name: "Meja 05", seats: 4, section: "Indoor AC (QR Active)", status: "occupied", runningTotal: 83000, elapsedMinutes: 12, customer: "Kevin Sanjaya (QR App)", orderCount: 2, items: [
    { name: "Nasi Lemak Sambal Sotong", qty: 1, price: 45000, notes: "Pedas Lvl 3, Nasi Regular" },
    { name: "Authentic Teh Tarik", qty: 1, price: 18000, notes: "Es Normal" },
    { name: "Sambosa Daging Keju", qty: 1, price: 25000, notes: "Lvl 0" }
  ]},
  { id: "T06", name: "Meja 06", seats: 2, section: "Indoor AC", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] },
  { id: "T07", name: "Meja 07", seats: 8, section: "Outdoor Garden", status: "occupied", runningTotal: 310000, elapsedMinutes: 55, customer: "Keluarga dr. Zulkarnain", orderCount: 6, items: [
    { name: "Nasi Mandhi Daging Kambing", qty: 3, price: 65000, notes: "Extra Basmati (+10k)" },
    { name: "Shawarma Ayam Panggang", qty: 2, price: 35000, notes: "Pedas Lvl 2" },
    { name: "Jus Kurma Susu Madu", qty: 3, price: 24000, notes: "Dingin Segar" }
  ]},
  { id: "T08", name: "Meja 08", seats: 4, section: "Outdoor Garden", status: "bill_requested", runningTotal: 99000, elapsedMinutes: 34, customer: "Bpk. Hendra Wijaya", orderCount: 3, items: [
    { name: "Laksa Penang Kuah Kental", qty: 1, price: 42000, notes: "Pedas Lvl 3" },
    { name: "Roti Canai Kari Daging", qty: 1, price: 30000, notes: "Pedas Lvl 2" },
    { name: "Qahwa Arabika Kapulaga", qty: 1, price: 25000, notes: "Panas Tradisional" }
  ]},
  { id: "T09", name: "Meja 09", seats: 4, section: "Outdoor Garden", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] },
  { id: "T10", name: "Meja 10", seats: 2, section: "Outdoor Garden", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] },
  { id: "T11", name: "Meja 11", seats: 4, section: "VIP Private Room", status: "occupied", runningTotal: 175000, elapsedMinutes: 22, customer: "VIP: Ibu Diana & Partner", orderCount: 3, items: [
    { name: "Nasi Mandhi Daging Kambing", qty: 1, price: 65000, notes: "Lvl 1" },
    { name: "Tom Yum Goong Seafood", qty: 1, price: 55000, notes: "Lvl 3" },
    { name: "Qahwa Arabika Kapulaga", qty: 2, price: 25000, notes: "Panas" }
  ]},
  { id: "T12", name: "Meja 12", seats: 6, section: "VIP Private Room", status: "available", runningTotal: 0, elapsedMinutes: 0, customer: "-", orderCount: 0, items: [] }
];

// Utilitas Format Rupiah
function formatRupiah(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
  return "Rp " + Number(amount).toLocaleString("id-ID");
}

// Theme Engine Terpusat
const ThemeManager = {
  THEME_KEY: "resto_pro_theme_mode",

  init() {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const activeTheme = savedTheme || (prefersDark ? "dark" : "light");
    this.applyTheme(activeTheme);
  },

  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body && document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body && document.body.classList.remove("dark");
    }
    localStorage.setItem(this.THEME_KEY, theme);
    this.updateToggleIcons(theme);

    // Broadcast ke iframe jika berada di dalam portal index.html
    window.postMessage({ type: "THEME_CHANGED", theme: theme }, "*");
  },

  toggle() {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    this.applyTheme(nextTheme);
    return nextTheme;
  },

  updateToggleIcons(theme) {
    document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
      const icon = btn.querySelector(".theme-icon");
      const label = btn.querySelector(".theme-label");
      if (theme === "dark") {
        if (icon) icon.textContent = "light_mode";
        if (label) label.textContent = "Light Mode";
        btn.setAttribute("title", "Beralih ke Warm Light Mode");
      } else {
        if (icon) icon.textContent = "dark_mode";
        if (label) label.textContent = "Dark Mode";
        btn.setAttribute("title", "Beralih ke Modern Dark Mode");
      }
    });
  }
};

// Ekspor ke window global untuk pemakaian di seluruh halaman
if (typeof window !== "undefined") {
  window.RESTO_CONFIG = RESTO_CONFIG;
  window.MENU_ITEMS = MENU_ITEMS;
  window.RESTO_TABLES = RESTO_TABLES;
  window.formatRupiah = formatRupiah;
  window.ThemeManager = ThemeManager;
}
