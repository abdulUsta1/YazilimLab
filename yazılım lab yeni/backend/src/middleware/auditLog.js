const db = require('../config/db');

/**
 * Kritik işlemleri AuditLogs tablosuna yazar.
 */
function writeAuditLog(req, action, tableName = null, recordID = null) {
  const userID    = req.user?.userID || null;
  const ip        = req.ip || req.connection?.remoteAddress || '0.0.0.0';
  const userAgent = req.headers['user-agent'] || null;
  try {
    db.prepare(
      `INSERT INTO AuditLogs (userID, action, tableName, recordID, ipAddress, userAgent)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userID, action, tableName, recordID, ip, userAgent);
  } catch (err) {
    console.error('AuditLog yazma hatası:', err.message);
  }
}

module.exports = { writeAuditLog };
