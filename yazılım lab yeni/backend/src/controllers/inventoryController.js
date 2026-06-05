const db = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');

/** GET /api/inventory */
function getAll(req, res) {
  try {
    const rows = db.prepare(
      `SELECT i.inventoryID, p.productID, p.productName, p.unit, p.isPerishable,
              c.categoryName, i.quantity, i.reorderLevel, i.expiryDate, i.warehouseZone,
              CASE WHEN ? = 'DepoSorumlusu' THEN NULL ELSE p.unitPrice END AS unitPrice,
              CAST((julianday(i.expiryDate) - julianday('now')) AS INTEGER) AS daysToExpiry
       FROM Inventory i
       JOIN Products   p ON p.productID  = i.productID
       JOIN Categories c ON c.categoryID = p.categoryID
       WHERE p.isDeleted = 0
       ORDER BY i.expiryDate ASC`
    ).all(req.user.roleName);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** GET /api/inventory/expiry-warnings */
function getExpiryWarnings(req, res) {
  try {
    const rows = db.prepare(
      `SELECT i.inventoryID, p.productName, p.unit, i.quantity, i.expiryDate,
              CAST((julianday(i.expiryDate) - julianday('now')) AS INTEGER) AS daysToExpiry
       FROM Inventory i
       JOIN Products p ON p.productID = i.productID
       WHERE p.isPerishable = 1
         AND i.expiryDate IS NOT NULL
         AND julianday(i.expiryDate) - julianday('now') BETWEEN 0 AND 7
         AND p.isDeleted = 0
       ORDER BY daysToExpiry ASC`
    ).all();
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** POST /api/inventory/movement */
function addMovement(req, res) {
  const { productID, amount, movementType, referenceID, note, expiryDate } = req.body;

  if (!productID || !amount || !movementType)
    return res.status(400).json({ message: 'productID, amount ve movementType zorunludur.' });
  if (!['IN','OUT','WASTE','RETURN'].includes(movementType))
    return res.status(400).json({ message: 'Geçersiz movementType.' });
  if (amount <= 0)
    return res.status(400).json({ message: 'Miktar pozitif olmalıdır.' });

  try {
    const product = db.prepare('SELECT isPerishable FROM Products WHERE productID=? AND isDeleted=0').get(productID);
    if (!product) return res.status(404).json({ message: 'Ürün bulunamadı.' });

    if (movementType === 'IN' && product.isPerishable && !expiryDate)
      return res.status(400).json({ message: 'Bozulabilir ürünler için Son Kullanma Tarihi zorunludur.' });

    const inv   = db.prepare('SELECT inventoryID, quantity FROM Inventory WHERE productID=?').get(productID);
    const delta = ['IN','RETURN'].includes(movementType) ? +amount : -amount;

    // Transaction ile atomik güncelleme
    try {
      db.exec('BEGIN');
      if (inv) {
        const newQty = parseFloat(inv.quantity) + delta;
        if (newQty < 0) { db.exec('ROLLBACK'); return res.status(400).json({ message: 'Stok miktarı negatife düşemez. (BR-1)' }); }
        if (expiryDate) {
          db.prepare('UPDATE Inventory SET quantity=?, expiryDate=? WHERE productID=?').run(newQty, expiryDate, productID);
        } else {
          db.prepare('UPDATE Inventory SET quantity=? WHERE productID=?').run(newQty, productID);
        }
      } else {
        if (delta < 0) { db.exec('ROLLBACK'); return res.status(400).json({ message: 'Stok kaydı yok, çıkış yapılamaz.' }); }
        db.prepare('INSERT INTO Inventory (productID, quantity, expiryDate) VALUES (?,?,?)').run(productID, delta, expiryDate || null);
      }
      db.prepare(
        `INSERT INTO StockMovements (productID, userID, amount, movementType, referenceID, note)
         VALUES (?,?,?,?,?,?)`
      ).run(productID, req.user.userID, amount, movementType, referenceID || null, note || null);
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      throw err;
    }
    writeAuditLog(req, `Stok hareketi: ${movementType} - ${amount}`, 'Inventory', productID);
    return res.status(201).json({ message: 'Stok hareketi kaydedildi.' });
  } catch (err) {
    if (err.message === 'NEGATIVE_STOCK')
      return res.status(400).json({ message: 'Stok miktarı negatife düşemez. (BR-1)' });
    if (err.message === 'NO_STOCK')
      return res.status(400).json({ message: 'Stok kaydı yok, çıkış yapılamaz.' });
  }
}

module.exports = { getAll, getExpiryWarnings, addMovement };
