require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// 🔐 Güvenlik Middleware'leri
app.use(helmet());
app.use(cors({
  origin: ['https://satilikilan.com', 'https://www.satilikilan.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 🚦 Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Çok fazla istek. Lütfen bekleyin.' }
});
app.use('/api/', limiter);

// 🗄️ MongoDB Bağlantısı
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/satilikilan')
  .then(() => console.log('✅ MongoDB bağlantısı başarılı'))
  .catch(err => console.error('❌ MongoDB hatası:', err));

// 📁 Routes (Basit Health Check)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'satilikilan.com API çalışıyor!'
  });
});

// Örnek İlan Endpoint'i
app.get('/api/listings', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        title: 'Örnek İlan - Backend Bağlandı!',
        price: 50000,
        category: 'Alışveriş',
        city: 'İstanbul'
      }
    ]
  });
});

// 🚨 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// 🐛 Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Hata:', err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

// 🚀 Sunucuyu Başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: Port ${PORT}`);
});