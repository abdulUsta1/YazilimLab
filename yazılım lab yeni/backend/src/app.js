require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt  = require('bcryptjs');

const path    = require('path');
const initDb  = require('./config/initDb');
const db      = require('./config/db');
const routes  = require('./routes/index');
const { checkExpiryDates } = require('./services/expiryChecker');

const app = express();

// ── Güvenlik ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // geliştirme modunda kapalı
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.set('trust proxy', 1);

// ── Rate limiter ──────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200,
  message: { message: 'Çok fazla istek gönderildi.' } }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Çok fazla giriş denemesi.' } }));

// ── Rotalar ───────────────────────────────────────────────────
app.use('/api', routes);

// ── Frontend static dosyaları ─────────────────────────────────
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Başlatma ──────────────────────────────────────────────────
async function start() {
  // 1. Şemayı ve seed verilerini oluştur
  initDb();

  // 2. Tüm pending şifreleri hash'le (ilk çalıştırmada)
  const pendingUsers = db.prepare("SELECT userID, email, passwordHash FROM Users WHERE passwordHash LIKE '__PENDING%'").all();
  const passwords = {
    'admin@restoran.com':    process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123',
    'depo@restoran.com':     'Depo@123',
    'satin@restoran.com':    'Satin@123',
    'yonetici@restoran.com': 'Yonetici@123',
  };
  for (const u of pendingUsers) {
    const plain = passwords[u.email] || 'Pass@123';
    const hash  = await bcrypt.hash(plain, 10);
    db.prepare('UPDATE Users SET passwordHash=? WHERE userID=?').run(hash, u.userID);
    console.log(`[DB] Şifre hashlendi: ${u.email}`);
  }

  // 3. SKT kontrolü — her gün 08:00
  function scheduleDailyExpiryCheck() {
    const now  = new Date();
    const next = new Date(now);
    next.setHours(8, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    setTimeout(() => {
      checkExpiryDates();
      setInterval(checkExpiryDates, 24 * 60 * 60 * 1000);
    }, next - now);
  }
  scheduleDailyExpiryCheck();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n✅ API çalışıyor → http://localhost:${PORT}`);
    console.log(`📦 Veritabanı    → ${require('path').resolve(__dirname, '../data/restaurant.sqlite')}\n`);
  });
}

start();
module.exports = app;
