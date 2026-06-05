const jwt = require('jsonwebtoken');

/**
 * JWT doğrulama middleware.
 * Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Yetkilendirme token\'ı eksik.' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Geçersiz veya süresi dolmuş token.' });
  }
}

module.exports = { authenticate };
