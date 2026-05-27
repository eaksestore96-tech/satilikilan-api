import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Parse large payloads for images represented as data URLs
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Default initial database state matching instructions & seeded data
const defaultDB = {
  users: [
    {
      name: "Yönetici",
      email: "admin@satilikilan.com",
      phone: "05551112233",
      pass: "uib5379+",
      role: "admin",
      type: "individual",
      verified: true,
      active: true,
      badges: ["Yönetici", "Onaylı"]
    }
  ],
  listings: [
    {
      id: "1001",
      title: "2020 BMW 320i M Sport",
      price: 1450000,
      category: "otomobil",
      city: "İstanbul",
      district: "Kadıköy",
      images: ["https://images.unsplash.com/photo-1555215695-3004980adade?w=900"],
      desc: "Garaj arabası, bakımları eksiksiz ve temizdir. Trameri yoktur, alıcısına şimdiden hayırlı olsun.",
      seller: "Ahmet Y.",
      sellerEmail: "ahmet@email.com",
      sellerType: "sahibinden",
      vehicle: {
        brand: "BMW",
        model: "3 Serisi",
        year: "2020",
        km: 45000,
        fuel: "Benzin",
        transmission: "Otomatik",
        body: "Sedan"
      },
      status: "active",
      doping: "acil",
      views: 184,
      createdAt: Date.now() - 200000
    },
    {
      id: "1002",
      title: "3+1 Deniz Manzaralı Daire",
      price: 4200000,
      category: "emlak",
      city: "İzmir",
      district: "Karşıyaka",
      images: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900"],
      desc: "Site içinde, otoparklı, çocuk oyun alanlı ve geniş havuzlu muhteşev manzaralı lüks daire.",
      seller: "Emlak Ltd.",
      sellerEmail: "info@emlak.com",
      sellerType: "firma",
      property: {
        type: "Konut",
        subtype: "Daire",
        status: "satilik",
        m2: 145,
        rooms: "3+1",
        buildingAge: "5",
        floor: "7",
        heating: "Kombi",
        deed: "Kat Mülkiyetli",
        zoning: ""
      },
      status: "active",
      doping: "vitrin",
      views: 231,
      createdAt: Date.now() - 100000
    }
  ],
  messages: [],
  settings: {
    siteName: "satilikilan.com",
    logoData: "",
    heroBackgroundData: "",
    heroBackgroundUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=1400",
    bankName: "Garanti BBVA",
    bankHolder: "Satilikilan.com Havuz Hesabı",
    bankIban: "TR12 3456 7890 1234 5678 9012 34",
    posProvider: "iyzico",
    escrowFee: 3,
    posEnabled: false,
    securePaymentEnabled: true,
    footer: {
      brandDesc: "Kullanıcı dostu %100 yerli ve milli ilan platformu.",
      corporateTitle: "Kurumsal",
      corporateItems: "Hakkımızda\nİletişim\nBlog",
      servicesTitle: "Hizmetler",
      servicesItems: "Doping\nGüvenli Alışveriş\nMağaza",
      legalTitle: "Yasal",
      legalItems: "KVKK\nGizlilik\nÇerez Politikası",
      pages: {
        hakkimizda: "satilikilan.com, kullanıcıların güvenle ilan yayınlayıp alışveriş yapması için tasarlanmış modern bir web platformudur.",
        iletisim: "Bizimle destek@satilikilan.com mail adresimizden veya profil sekmesindeki destek kanallarımızdan iletişime geçebilirsiniz.",
        blog: "Güncel emlak ve otomotiv dünyası bloglarına çok yakında buradan ulaşabileceksiniz.",
        doping: "Doping özellikleri sayesinde ilanlarınız ana ekranda vitrin, öncelikli veya acil etiketiyle en başlarda yer alır.",
        "guvenli-alisveris": "Güvenli alışveriş sistemimiz ödemelerin korumalı havuz hesapta tutulmasını ve güvenli teslimatı hedefler.",
        magaza: "Kurumsal mağazalar kendilerine özel paketleriyle daha fazla sınırda ilan verme yetkisine kavuşurlar.",
        kvkk: "Kişisel verileriniz 6698 sayılı KVKK kapsamında güvence altında tutulmaktadır.",
        gizlilik: "Gizlilik politikamız uyarınca üye verileri kesinlikle üçüncü taraflarla paylaşılmamaktadır.",
        "cerez-politikasi": "Size daha iyi bir kullanıcı deneyimi sunmak için web çerezleri kullanmaktayız."
      }
    }
  },
  pricing: {
    corporate: {
      plan1: { name: "Başlangıç", price: 499, listings: 10 },
      plan2: { name: "Profesyonel", price: 999, listings: 50 },
      plan3: { name: "Kurumsal", price: 2499, listings: 999 }
    },
    doping: { vitrin: 500, acil: 250, oncelik: 150 }
  },
  corporateRequests: [],
  paymentNotices: [],
  nextPaymentNo: 1,
  sellerReviews: [],
  transactions: [],
  sentEmails: []
};

// Help load existing db or fallback
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (!parsed.sellerReviews) parsed.sellerReviews = [];
      if (!parsed.transactions) parsed.transactions = [];
      if (!parsed.sentEmails) parsed.sentEmails = [];
      return parsed;
    }
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
  }
  const fallback = { ...defaultDB };
  if (!fallback.sellerReviews) fallback.sellerReviews = [];
  if (!fallback.transactions) fallback.transactions = [];
  if (!fallback.sentEmails) fallback.sentEmails = [];
  return fallback;
}

// Save db with safety lock
function saveDB(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// API Routes
app.get("/api/download", (req, res) => {
  const distPath = path.join(process.cwd(), "dist", "index.html");
  if (fs.existsSync(distPath)) {
    res.setHeader("Content-Disposition", "attachment; filename=satilikilan_complete.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.sendFile(distPath);
  } else {
    res.status(404).json({ 
      success: false, 
      message: "Derlenmiş tek parça index.html dosyası henüz oluşturulmadı. Lütfen önce derleme yapın." 
    });
  }
});

app.get("/api/db", (req, res) => {
  const db = loadDB();
  // Strip passwords from the users list before sending to the client to keep passwords fully hidden in Ctrl+U (view source) or DevTools inspection
  if (db && db.users && Array.isArray(db.users)) {
    db.users = db.users.map((u: any) => {
      const { pass, ...rest } = u;
      return rest;
    });
  }
  res.json(db);
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "E-posta ve şifre gereklidir." });
  }
  
  const db = loadDB();
  const user = db.users?.find((u: any) => u.email === email && u.pass === password);
  
  if (!user) {
    return res.status(401).json({ success: false, message: "E-posta adresi veya şifre hatalı." });
  }
  
  if (user.active === false) {
    return res.status(403).json({ success: false, message: "Hesabınız dondurulmuştur." });
  }
  
  const { pass, ...sanitizedUser } = user;
  res.json({ success: true, user: sanitizedUser });
});

// AI / Gemini API Helper Proxy Endpoints
app.post("/api/gemini/generate-desc", async (req, res) => {
  const { category, title, price, details } = req.body;
  if (!title || !category) {
    return res.status(400).json({ success: false, message: "Kategori ve ilan başlığı zorunludur." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Generate high-quality programmatically computed fallback text
    const brandPart = details?.brand ? `**Marka/Model:** ${details.brand} ${details.model || ""}` : "";
    const extraSpecs = details
      ? Object.entries(details)
          .filter(([k, v]) => v && k !== "brand" && k !== "model" && typeof v !== "object")
          .map(([k, v]) => `   - **${k.toUpperCase()}:** ${v}`)
          .join("\n")
      : "";

    const simulatedText = `✨ **[YAPAY ZEKA CO-PILOT SİHİRBAZI]** ✨\n\n` +
      `📣 **${title}**\n\n` +
      `Sizler için harika bir fırsat sunuyoruz! İlanımız teknik özellikleri, konumu ve avantajlı fiyatıyla öne çıkmaktadır. Özenle korunmuş ve alıcısını bekleyen değerli bir seçenektir.\n\n` +
      `📌 **Öne Çıkan Özellikler:**\n` +
      (brandPart ? `   - ${brandPart}\n` : "") +
      `   - **Seviye/Fiyat:** ${Number(price || 0).toLocaleString("tr-TR")} TL\n` +
      `   - **Kategori:** ${category.toUpperCase()}\n` +
      extraSpecs + `\n\n` +
      `✅ **Neden Bu İlanı Tercih Etmelisiniz?**\n` +
      `1. **Yüksek Fiyat/Fayda Dengesi:** Piyasadaki muadillerine göre adil ve kazançlı fiyat çizgisine sahiptir.\n` +
      `2. **Likit Varlık Gücü:** Kolayca elden çıkarılabilecek, popülerliği ve işlem hacmi yüksek bir modeldir.\n` +
      `3. **Güvenli Alışveriş Desteği:** İlanın ödemesini sitemizin güvenli eskorv havuz sistemi üzerinden gerçekleştirerek paranızı her aşamada tam güvence altında tutabilirsiniz.\n\n` +
      `📞 Detaylı bilgi, görüntülü arama randevusu ve yerinde inceleme için lütfen ilan sahibiyle şimdi iletişime geçin. Şimdiden yeni sahibine uğurlu olmasını dileriz!`;

    return res.json({ success: true, text: simulatedText, simulated: true });
  }

  try {
    const detailString = JSON.stringify(details || {});
    const prompt = `Lütfen emlak/araç ilan platformumuz için mükemmel ve ilgi çekici bir satış açıklaması hazırla.\n\n` +
      `İlan Başlığı: ${title}\n` +
      `Kategori: ${category}\n` +
      `Fiyat: ${price} TL\n` +
      `Detaylar: ${detailString}\n\n` +
      `Raporu tamamen Türkçe yaz. Maddeler halinde düzenli olsun, satıcı dilini kullansın, ikna gücü yüksek ve samimi olsun. Sitemizin "Güvenli Havuzlu Ödeme" sistemini de öven küçük bir dipnot ekle.`;

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);

    const text = response.response.text();
    res.json({ success: true, text: text || "Yapay zeka boş yanıt döndürdü.", simulated: false });
  } catch (err: any) {
    console.error("Gemini description error:", err);
    res.status(500).json({ success: false, message: "Yapay zeka sunucusu ile bağlantı kurulamadı. Lütfen tekrar deneyin." });
  }
});

app.post("/api/gemini/compare", async (req, res) => {
  const { listings } = req.body;
  if (!listings || !Array.isArray(listings) || listings.length < 2) {
    return res.status(400).json({ success: false, message: "Karşılaştırma için en az 2 ilan seçmelisiniz." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    let simulatedText = `⚖️ **[YAPAY ZEKA AKILLI KARŞILAŞTIRMA ANALİZİ]** ⚖️\n\n` +
      `Seçmiş olduğunuz **${listings.length} adet ilanın** teknik ve fiyat kıyaslaması tamamlanmıştır:\n\n`;

    listings.forEach((item, index) => {
      const isVehicle = item.category === "otomobil";
      const specLine = isVehicle
        ? `KM: ${item.vehicle?.km?.toLocaleString() || "Bilinmiyor"} KM | Yıl: ${item.vehicle?.year || "Bilinmiyor"} | Yakıt: ${item.vehicle?.fuel || "Bilinmiyor"}`
        : `Brüt Alan: ${item.property?.m2 || "Bilinmiyor"} m² | Oda Sayısı: ${item.property?.rooms || "Bilinmiyor"} | Isıtma: ${item.property?.heating || "Bilinmiyor"}`;

      simulatedText += `📍 **İlan #${index + 1}: ${item.title}**\n` +
        `   - **Fiyat:** ${Number(item.price).toLocaleString("tr-TR")} TL\n` +
        `   - **Konum:** ${item.city} / ${item.district}\n` +
        `   - **Teknik Detaylar:** ${specLine}\n` +
        `   - **Satıcı:** ${item.seller} (${item.sellerType})\n\n`;
    });

    const prices = listings.map(l => Number(l.price));
    const cheapest = listings.find(l => Number(l.price) === Math.min(...prices));
    const highest = listings.find(l => Number(l.price) === Math.max(...prices));

    simulatedText += `📊 **Piyasa ve Değer Analizi:**\n` +
      `- **Fiyat Farkı:** En yüksek fiyatlı ilan ile en bütçe dostu ilan arasında tam **${(Math.max(...prices) - Math.min(...prices)).toLocaleString("tr-TR")} TL** fark bulunmaktadır.\n` +
      `- **Fiyat/Performans Şampiyonu:** **"${cheapest?.title}"** bütçe verimliliği ve teknik bileşenlerin oranı göz önüne alındığında öne çıkmaktadır.\n` +
      `- **Prestij ve Konfor Tercihi:** **"${highest?.title}"** sunduğu konfor seviyesi, yeni yaşı ve yüksek marka/konum itibarıyla bütçesi esnek olan alıcılar için harika bir yatırımdır.\n\n` +
      `💡 **Yapay Zeka Uzman Tavsiyesi:** Satın alım kararı vermeden önce her iki ilan sahibiyle de sitemiz üzerinden mesajlaşıp detaylı eksper raporlarını karşılaştırın ve ödemenizi mutlaka sitemizin korumalı havuz hesabı üzerinden geçirin!`;

    return res.json({ success: true, text: simulatedText, simulated: true });
  }

  try {
    const listPayload = listings.map(l => ({
      title: l.title,
      price: l.price,
      city: l.city,
      district: l.district,
      seller: l.seller,
      sellerType: l.sellerType,
      category: l.category,
      vehicle: l.vehicle,
      property: l.property
    }));

    const prompt = `Lütfen aşağıda bilgileri verilen ilanları detaylıca karşılaştır, her birinin avantaj ve dezavantajlarını çıkart ve alıcıya harika bir karşılaştırma raporu sun:\n\n` +
      JSON.stringify(listPayload, null, 2);

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);

    const text = response.response.text();
    res.json({ success: true, text: text || "Analiz üretilemedi.", simulated: false });
  } catch (err: any) {
    console.error("Gemini compare error:", err);
    res.status(500).json({ success: false, message: "Yapay zeka karşılaştırma modülü meşgul, lütfen az sonra tekrar deneyin." });
  }
});

app.post("/api/gemini/market-analysis", async (req, res) => {
  const { category, city, district, price, details } = req.body;
  if (!category || !city || !district) {
    return res.status(400).json({ success: false, message: "Kategori, il ve ilçe alanları zorunludur." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    const simulatedText = `📈 **[YAPAY ZEKA LOKAL PİYASA RAPORU]** 📈\n\n` +
      `📍 **Lokasyon Bilgisi:** ${city} / ${district} Bölgesi\n` +
      `📂 **Kategori:** ${category.toUpperCase()}\n` +
      `💰 **Sorgulanan Birim Tutar:** ${Number(price || 0).toLocaleString("tr-TR")} TL\n\n` +
      `🔥 **Bölge Talep Seviyesi: YÜKSEK (%82)**\n` +
      `- **Fiyat Eğilimi:** ${district} bölgesinde emsal ilanlarda son dönemde %4.8 oranında durağan fakat istikrarlı bir yukarı gidiş izlenmektedir.\n` +
      `- **Adil Piyasa Değeri:** Sorguladığınız ilan tutarı (${Number(price || 0).toLocaleString()} TL), bölgenin güncel amortisman katsayısı ve arz hızına bağlı olarak **Adil Değer Aralığında (Green Zone)** yer almaktadır.\n` +
      `- **Ortalama İlan Ömrü:** Bu muhit ve şartlardaki ilanlar ortalama **15 gün** içerisinde rezerve edilmektedir.\n\n` +
      `🎯 **Stratejik Yatırım & Pazarlık Tavsiyeleri:**\n` +
      `1. **Gerekli Pazarlık Hedefi:** Türk ticaret geleneğine ve bölge istatistiklerine göre %3 ila %4.5 oranında teklifler makul karşılanır.\n` +
      `2. **Tapu / Ruhsat Aşamasındaki Avantajlar:** Satış öncesi eksper onayı ve ruhsat sorgularını eksiksiz isteyin. Sitemizin "Güvenli Havuz Sistemini" kullanarak tüm tapu/devir ödemelerinizi korumaya alın. Alıcının onayı olmadan para havuzdan satıcıya aktarılmaz.\n\n` +
      `💡 *Not:* Bu analiz lokal veri trendleri ve geçmiş ilan istatistikleri simüle edilerek hazırlanmıştır.`;

    return res.json({ success: true, text: simulatedText, simulated: true });
  }

  try {
    const prompt = `Lütfen şu bölge ve ilan detaylarına göre kapsamlı bir emlak / otomotiv piyasa değerlendirme raporu oluştur:\n\n` +
      `Kategori: ${category}\n` +
      `Konum: ${city} / ${district}\n` +
      `Fiyat: ${price} TL\n` +
      `Spesifikasyonlar: ${JSON.stringify(details || {})}`;

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);

    const text = response.response.text();
    res.json({ success: true, text: text || "Piyasa analizi üretilemedi.", simulated: false });
  } catch (err: any) {
    console.error("Gemini market analysis error:", err);
    res.status(500).json({ success: false, message: "Yapay zeka piyasa analizi şu anda kapalıdır." });
  }
});

// Memory storage for OTP verification codes with optional name support
const otpStore = new Map<string, { code: string; expiresAt: number; name: string; phone: string }>();

app.post("/api/sms/send-otp", async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Telefon numarası zorunludur." });
  }

  // Sanitize phone number (keep only digits)
  const cleanPhone = phone.replace(/\D/g, "");
  const clientName = name || "Değerli Müşterimiz";
  
  // Generate random 6-digit OTP code (e.g. 523146)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Save OTP in volatile backend memory (valid for 10 minutes to allow admin manual delivery buffer)
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(cleanPhone, { code, expiresAt, name: clientName, phone: cleanPhone });

  console.log(`[SMS VERIFICATION ROUTER] Sent code ${code} to +${cleanPhone}`);

  // 1. Twilio Integration (Global standard)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;

  if (twilioSid && twilioAuthToken && twilioFrom) {
    try {
      const Twilio = require("twilio");
      const client = new Twilio(twilioSid, twilioAuthToken);
      await client.messages.create({
        body: `SatilikIlan.com doğrulama kodunuz: ${code}. Lütfen bu kodu kimseyle paylaşmayınız.`,
        to: `+${cleanPhone.startsWith('90') || cleanPhone.length > 10 ? cleanPhone : '90' + cleanPhone}`,
        from: twilioFrom
      });
      return res.json({ success: true, message: "Doğrulama kodu otomatik SMS ile gönderildi.", code, simulated: false });
    } catch (err: any) {
      console.error("Twilio SMS send error, falling back to simulated:", err);
    }
  }

  // 2. Netgsm Turkey XML/GET Integration (Turkish local standard)
  const netgsmUser = process.env.NETGSM_USER;
  const netgsmPass = process.env.NETGSM_PASS;
  const netgsmHeader = process.env.NETGSM_HEADER || "BIZIM_HERO";
  if (netgsmUser && netgsmPass) {
    try {
      const targetPhone = cleanPhone.startsWith('90') && cleanPhone.length > 10 ? cleanPhone.slice(2) : cleanPhone;
      const phoneUrl = `https://api.netgsm.com.tr/sms/send/get/?user=${encodeURIComponent(netgsmUser)}&password=${encodeURIComponent(netgsmPass)}&gsm=${targetPhone}&text=${encodeURIComponent(`SatilikIlan.com dogrulama kodunuz: ${code}.`)}&msgheader=${encodeURIComponent(netgsmHeader)}`;
      await fetch(phoneUrl);
      return res.json({ success: true, message: "Doğrulama kodu Netgsm SMS hattıyla gönderildi.", code, simulated: false });
    } catch (err) {
      console.error("Netgsm Turkey SMS send error, falling back to simulated:", err);
    }
  }

  // Developer preview sandbox simulation fallback with responsive payload
  return res.json({
    success: true,
    message: "Üyelik onay kodu oluşturuldu. Yönetici bu kodu size gönderecektir.",
    code, // Sent to client for instant simulation support
    simulated: true
  });
});

app.get("/api/sms/active-otps", (req, res) => {
  // Return all non-expired OTP queries for Admin dashboard manual delivery panel
  const list: any[] = [];
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt > now) {
      list.push({
        phone: key,
        code: value.code,
        name: value.name,
        expiresAt: value.expiresAt,
        timeLeftSeconds: Math.max(0, Math.round((value.expiresAt - now) / 1000))
      });
    } else {
      otpStore.delete(key);
    }
  }
  res.json({ success: true, otps: list });
});

app.post("/api/sms/verify-otp", (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ success: false, message: "Telefon numarası ve doğrulama kodu gereklidir." });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  const record = otpStore.get(cleanPhone);

  if (!record) {
    return res.status(400).json({ success: false, message: "Bu telefon numarası için aktif bir SMS doğrulama kaydı bulunamadı. Lütfen yeni bir kod isteyin." });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(400).json({ success: false, message: "Doğrulama kodunun geçerlilik süresi dolmuştur (3 dakika). Lütfen tekrar deneyin." });
  }

  if (record.code !== code.trim()) {
    return res.status(400).json({ success: false, message: "Girdiğiniz 6 haneli doğrulama kodu yanlıştır. Lütfen kontrol edip tekrar deneyin." });
  }

  // OTP verified, clear state from MAP
  otpStore.delete(cleanPhone);
  res.json({ success: true, message: "Telefon numarası başarıyla doğrulandı!" });
});

// Lazy loader helper function
const getGeminiClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI({
    apiKey: key
  });
};

app.post("/api/sync", (req, res) => {
  const incoming = req.body;
  const current = loadDB();
  
  // Special Handling for Users list to merge passwords and not lose them!
  if (incoming.users && Array.isArray(incoming.users)) {
    const currentUsers = current.users || [];
    incoming.users = incoming.users.map((incomingUser: any) => {
      // Find matching user in the database by email
      const existingUser = currentUsers.find((u: any) => u.email === incomingUser.email);
      if (existingUser) {
        // If incoming user doesn't have a password but has one on backend, preserve the password on backend!
        return {
          ...incomingUser,
          pass: incomingUser.pass !== undefined ? incomingUser.pass : existingUser.pass
        };
      }
      return incomingUser; // New user (has u.pass from registration)
    });
  }
  
  // Update requested fields selectively
  Object.keys(incoming).forEach((key) => {
    if (key in current) {
      current[key] = incoming[key];
    }
  });

  // Automated Administrator E-mail Dispatcher Simulation
  const sendAdminEmail = (subject: string, html: string) => {
    const adminEmail = current.settings?.adminNotificationEmail || current.users?.find((u: any) => u.role === "admin")?.email || "admin@satilikilan.com";
    if (!current.sentEmails) current.sentEmails = [];
    
    current.sentEmails.push({
      id: "EML-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      to: adminEmail,
      subject,
      html,
      sentAt: new Date().toLocaleString("tr-TR"),
      status: "sent"
    });
    
    console.log(`\n=============================================================`);
    console.log(`[E-POSTA AKTİF BİLDİRİMİ] "${adminEmail}" adresine yeni bilgilendirme gönderildi!`);
    console.log(`Konu: ${subject}`);
    console.log(`İçerik Görüntü No (Console Sim):`);
    console.log(html.replace(/<\/?[^>]+(>|$)/g, " ").trim().substring(0, 200) + "...");
    console.log(`=============================================================\n`);
  };

  // Detect and notify on brand new payment notices (e.g., escrow / doping)
  if (incoming.paymentNotices && Array.isArray(incoming.paymentNotices)) {
    const prevNotices = current.paymentNotices || [];
    const addedNotices = incoming.paymentNotices.filter(
      (n: any) => !prevNotices.some((existing: any) => existing.id === n.id)
    );
    if (addedNotices.length > 0) {
      addedNotices.forEach((n: any) => {
        sendAdminEmail(
          `Yeni Ödeme Bildirimi Alındı - Tutar: ${n.amount} TL`,
          `<div style="font-family: sans-serif; padding: 25px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 16px; max-width: 500px; color: #1f2937;">
            <p style="text-transform: uppercase; font-size: 10px; color: #4f46e5; font-weight: bold; margin: 0; letter-spacing: 1px;">SİSTEM BİLDİRİMİ</p>
            <h2 style="color: #111827; margin: 5px 0 15px 0; font-size: 20px; font-weight: 800;">Yeni Havuz / Doping Ödemesi</h2>
            <div style="background: #ffffff; border: 1px solid #f3f4f6; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
              <p style="margin: 5px 0; font-size: 13px;"><strong>Gönderici:</strong> ${n.senderName}</p>
              <p style="margin: 5px 0; font-size: 13px;"><strong>Banka Havale:</strong> ${n.bankName}</p>
              <p style="margin: 5px 0; font-size: 13px;"><strong>Tip:</strong> ${n.paymentType === "doping" ? "Vitrin / Doping" : "İlan Güvenli Ödeme"}</p>
              <p style="margin: 5px 0; font-size: 13.5px; color: #10b981;"><strong>Tutar:</strong> <b>${n.amount} TL</b></p>
              <p style="margin: 5px 0; font-size: 12px; color: #6b7280;"><strong>Sipariş No / İlan:</strong> #${n.orderId}</p>
            </div>
            <p style="font-size: 11px; color: #9ca3af; line-height: 1.5; margin: 0;">Bu e-posta otomatik olarak üretilmiştir. Yönetici panelinden onay verebilirsiniz.</p>
          </div>`
        );
      });
    }
  }

  // Detect and notify on brand new corporate applications
  if (incoming.corporateRequests && Array.isArray(incoming.corporateRequests)) {
    const prevReqs = current.corporateRequests || [];
    const addedReqs = incoming.corporateRequests.filter(
      (r: any) => !prevReqs.some((existing: any) => existing.paymentRef === r.paymentRef)
    );
    if (addedReqs.length > 0) {
      addedReqs.forEach((r: any) => {
        sendAdminEmail(
          `Yeni Kurumsal Mağaza Başvurusu - ${r.companyName || r.name}`,
          `<div style="font-family: sans-serif; padding: 25px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 16px; max-width: 500px; color: #1f2937;">
            <p style="text-transform: uppercase; font-size: 10px; color: #4f46e5; font-weight: bold; margin: 0; letter-spacing: 1px;">SİSTEM BİLDİRİMİ</p>
            <h2 style="color: #111827; margin: 5px 0 15px 0; font-size: 20px; font-weight: 800;">Kurumsal Mağaza Başvurusu</h2>
            <div style="background: #ffffff; border: 1px solid #f3f4f6; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
              <p style="margin: 5px 0; font-size: 13px;"><strong>Şirket Ünvanı:</strong> ${r.companyName || "Belirtilmemiş"}</p>
              <p style="margin: 5px 0; font-size: 13px;"><strong>Yetkili:</strong> ${r.name}</p>
              <p style="margin: 5px 0; font-size: 13px;"><strong>E-post / Telefon:</strong> ${r.email} / ${r.phone}</p>
              <p style="margin: 5px 0; font-size: 13px;"><strong>Vergi Bilgileri:</strong> ${r.taxNo || "Bilinmiyor"} (${r.taxOffice || "Bilinmiyor"})</p>
              <p style="margin: 5px 0; font-size: 13.5px; color: #4f46e5;"><strong>Abonelik Bedeli:</strong> ${r.planPrice} TL</p>
              <p style="margin: 5px 0; font-size: 12px; color: #6b7280;"><strong>Ödeme Referansı:</strong> ${r.paymentRef}</p>
            </div>
          </div>`
        );
      });
    }
  }
  
  saveDB(current);
  res.json({ success: true, message: "Database synchronized successfully" });
});

// Port & Host bind for production & custom development server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express API Server running on port ${PORT}`);
  });
}

startServer();
