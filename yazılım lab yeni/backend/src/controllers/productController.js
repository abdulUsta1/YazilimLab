const db = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');

function getAll(req, res) {
  try {
    const rows = db.prepare(
      `SELECT p.productID, p.productName, p.unit, p.isPerishable, p.isDeleted,
              CASE WHEN ? = 'DepoSorumlusu' THEN NULL ELSE p.unitPrice END AS unitPrice,
              c.categoryName,
              COALESCE(i.quantity, 0) AS quantity,
              COALESCE(i.reorderLevel, 0) AS reorderLevel,
              i.expiryDate
       FROM Products p
       JOIN Categories c ON c.categoryID = p.categoryID
       LEFT JOIN Inventory i ON i.productID = p.productID
       WHERE p.isDeleted = 0
       ORDER BY p.productName ASC`
    ).all(req.user.roleName);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

function create(req, res) {
  const { productName, categoryID, unit, unitPrice, isPerishable, quantity, reorderLevel, expiryDate } = req.body;
  if (!productName || !categoryID || !unit)
    return res.status(400).json({ message: 'productName, categoryID ve unit zorunludur.' });
  if (isPerishable && !expiryDate)
    return res.status(400).json({ message: 'Bozulabilir ürünler için Son Kullanma Tarihi zorunludur.' });

  try {
    db.exec('BEGIN');
    const result = db.prepare(
      `INSERT INTO Products (categoryID, productName, unit, unitPrice, isPerishable)
       VALUES (?,?,?,?,?)`
    ).run(categoryID, productName, unit, unitPrice || 0, isPerishable ? 1 : 0);
    const productID = result.lastInsertRowid;
    db.prepare(
      `INSERT INTO Inventory (productID, quantity, reorderLevel, expiryDate)
       VALUES (?,?,?,?)`
    ).run(productID, quantity || 0, reorderLevel || 0, expiryDate || null);
    db.exec('COMMIT');
    writeAuditLog(req, `Ürün oluşturuldu: ${productName}`, 'Products', productID);
    return res.status(201).json({ message: 'Ürün eklendi.', productID });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

function remove(req, res) {
  const { id } = req.params;
  try {
    db.prepare('UPDATE Products SET isDeleted=1 WHERE productID=?').run(id);
    writeAuditLog(req, `Ürün silindi: ${id}`, 'Products', parseInt(id));
    return res.json({ message: 'Ürün silindi.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

module.exports = { getAll, create, remove };
