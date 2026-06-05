const db      = require('../config/db');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { writeAuditLog } = require('../middleware/auditLog');

const MAX_ATTEMPTS    = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_MINUTES)     || 30;

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'E-posta ve şifre zorunludur.' });

  try {
    const user = db.prepare(
      `SELECT u.userID, u.fullName, u.email, u.passwordHash,
              u.failedAttempts, u.lockedUntil, u.isActive, u.isDeleted,
              r.roleName
       FROM Users u JOIN Roles r ON r.roleID = u.roleID
       WHERE u.email = ?`
    ).get(email);

    if (!user || user.isDeleted)
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });

    if (!user.isActive)
      return res.status(403).json({ message: 'Hesabınız devre dışı bırakılmıştır.' });

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({ message: `Hesabınız kilitli. ${remaining} dakika sonra tekrar deneyin.` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      const newAttempts = user.failedAttempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
        db.prepare('UPDATE Users SET failedAttempts=?, lockedUntil=? WHERE userID=?')
          .run(newAttempts, lockUntil, user.userID);
        writeAuditLog(req, `Hesap kilitlendi: ${email}`, 'Users', user.userID);
        return res.status(423).json({ message: `Çok fazla hatalı giriş. Hesabınız ${LOCKOUT_MINUTES} dakika kilitlendi.` });
      }
      db.prepare('UPDATE Users SET failedAttempts=? WHERE userID=?').run(newAttempts, user.userID);
      return res.status(401).json({ message: `E-posta veya şifre hatalı. (${MAX_ATTEMPTS - newAttempts} hak kaldı)` });
    }

    // Başarılı giriş
    db.prepare('UPDATE Users SET failedAttempts=0, lockedUntil=NULL WHERE userID=?').run(user.userID);

    const token = jwt.sign(
      { userID: user.userID, email: user.email, roleName: user.roleName, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    writeAuditLog(req, 'Kullanıcı giriş yaptı', 'Users', user.userID);
    return res.json({
      token,
      user: { userID: user.userID, fullName: user.fullName, email: user.email, roleName: user.roleName },
    });
  } catch (err) {
    console.error('Login hatası:', err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** POST /api/auth/logout */
function logout(req, res) {
  writeAuditLog(req, 'Kullanıcı çıkış yaptı', 'Users', req.user?.userID);
  return res.json({ message: 'Çıkış başarılı.' });
}

module.exports = { login, logout };
