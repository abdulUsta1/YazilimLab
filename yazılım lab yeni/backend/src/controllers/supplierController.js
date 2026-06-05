const db = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');

function getAll(req, res) {
  try {
    const rows = db.prepare(
      `SELECT supplierID, companyName, taxNumber, contactName, phone, email, perfScore, isActive
       FROM Suppliers WHERE isDeleted=0 ORDER BY companyName ASC`
    ).all();
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

function create(req, res) {
  const { companyName, taxNumber, contactName, phone, email } = req.body;
  if (!companyName || !taxNumber)
    return res.status(400).json({ message: 'companyName ve taxNumber zorunludur.' });
  try {
    const result = db.prepare(
      `INSERT INTO Suppliers (companyName, taxNumber, contactName, phone, email)
       VALUES (?,?,?,?,?)`
    ).run(companyName, taxNumber, contactName || null, phone || null, email || null);
    writeAuditLog(req, `Tedarikçi eklendi: ${companyName}`, 'Suppliers', result.lastInsertRowid);
    return res.status(201).json({ message: 'Tedarikçi eklendi.', supplierID: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ message: 'Bu vergi numarası zaten kayıtlı.' });
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

function remove(req, res) {
  const { id } = req.params;
  try {
    db.prepare('UPDATE Suppliers SET isDeleted=1, isActive=0 WHERE supplierID=?').run(id);
    writeAuditLog(req, `Tedarikçi silindi: ${id}`, 'Suppliers', parseInt(id));
    return res.json({ message: 'Tedarikçi silindi.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

module.exports = { getAll, create, remove };
