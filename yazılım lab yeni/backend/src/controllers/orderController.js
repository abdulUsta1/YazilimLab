const db = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');
const { calculateAndSaveScore } = require('../services/supplierScoring');

const ADMIN_THRESHOLD = 5000;

/** GET /api/orders */
function getAll(req, res) {
  try {
    const rows = db.prepare(
      `SELECT o.orderID, s.companyName AS supplierName, o.totalAmount, o.status,
              o.requiresAdminApproval, o.orderDate, o.expectedDate, o.receivedDate,
              u1.fullName AS createdBy, u2.fullName AS approvedBy
       FROM Orders o
       JOIN Suppliers s ON s.supplierID = o.supplierID
       JOIN Users u1    ON u1.userID    = o.createdByID
       LEFT JOIN Users u2 ON u2.userID  = o.approvedByID
       WHERE o.isDeleted = 0
       ORDER BY o.orderDate DESC`
    ).all();
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** GET /api/orders/:id/details */
function getDetails(req, res) {
  const { id } = req.params;
  try {
    const order = db.prepare(
      `SELECT o.orderID, o.supplierID, s.companyName AS supplierName,
              o.totalAmount, o.status, o.requiresAdminApproval,
              o.orderDate, o.expectedDate, o.receivedDate,
              u1.fullName AS createdBy, u2.fullName AS approvedBy
       FROM Orders o
       JOIN Suppliers s ON s.supplierID = o.supplierID
       JOIN Users u1    ON u1.userID    = o.createdByID
       LEFT JOIN Users u2 ON u2.userID  = o.approvedByID
       WHERE o.orderID = ? AND o.isDeleted = 0`
    ).get(id);
    if (!order) return res.status(404).json({ message: 'Sipariş bulunamadı.' });

    const details = db.prepare(
      `SELECT od.orderDetailID, od.productID, p.productName, p.unit,
              od.orderedQty, od.receivedQty, od.unitPrice, od.expiryDate,
              p.isPerishable
       FROM OrderDetails od
       JOIN Products p ON p.productID = od.productID
       WHERE od.orderID = ?`
    ).all(id);

    return res.json({ ...order, details });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** POST /api/orders */
function create(req, res) {
  const { supplierID, requestID, expectedDate, items } = req.body;
  if (!supplierID || !items?.length)
    return res.status(400).json({ message: 'supplierID ve items zorunludur.' });

  // C-4: Talep onaylanmış mı?
  if (requestID) {
    const pr = db.prepare('SELECT status FROM PurchaseRequests WHERE requestID=? AND isDeleted=0').get(requestID);
    if (!pr || pr.status !== 'Approved')
      return res.status(403).json({ message: 'Yönetici onayı olmayan talep siparişe dönüştürülemez. (C-4)' });
  }

  const totalAmount   = items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0);
  const requiresAdmin = totalAmount > ADMIN_THRESHOLD ? 1 : 0;

  try {
    db.exec('BEGIN');
    const orderResult = db.prepare(
      `INSERT INTO Orders (supplierID, createdByID, requestID, totalAmount, requiresAdminApproval, expectedDate)
       VALUES (?,?,?,?,?,?)`
    ).run(supplierID, req.user.userID, requestID || null, totalAmount, requiresAdmin, expectedDate || null);

    const orderID = orderResult.lastInsertRowid;
    for (const item of items) {
      db.prepare(
        'INSERT INTO OrderDetails (orderID, productID, orderedQty, unitPrice) VALUES (?,?,?,?)'
      ).run(orderID, item.productID, item.orderedQty, item.unitPrice);
    }
    db.exec('COMMIT');

    writeAuditLog(req, `Sipariş oluşturuldu: ${orderID} (${totalAmount} TL)`, 'Orders', orderID);
    const msg = requiresAdmin
      ? `Sipariş oluşturuldu. ${totalAmount} TL üzeri — Admin onayı gerekiyor. (BR-12)`
      : 'Sipariş oluşturuldu.';
    return res.status(201).json({ message: msg, orderID, requiresAdminApproval: !!requiresAdmin });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** PATCH /api/orders/:id/admin-approve */
function adminApprove(req, res) {
  const { id } = req.params;
  try {
    const order = db.prepare(
      'SELECT orderID, requiresAdminApproval, approvedByID FROM Orders WHERE orderID=? AND isDeleted=0'
    ).get(id);
    if (!order) return res.status(404).json({ message: 'Sipariş bulunamadı.' });
    if (!order.requiresAdminApproval) return res.status(400).json({ message: 'Bu sipariş Admin onayı gerektirmiyor.' });
    if (order.approvedByID) return res.status(409).json({ message: 'Sipariş zaten onaylanmış.' });

    db.prepare('UPDATE Orders SET approvedByID=? WHERE orderID=?').run(req.user.userID, id);
    writeAuditLog(req, `Admin sipariş onayladı: ${id}`, 'Orders', parseInt(id));
    return res.json({ message: 'Sipariş Admin tarafından onaylandı.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** POST /api/orders/:id/receive */
function receiveDelivery(req, res) {
  const { id } = req.params;
  const { deliveries, receivedDate } = req.body;
  if (!deliveries?.length)
    return res.status(400).json({ message: 'deliveries zorunludur.' });

  const order = db.prepare(
    'SELECT orderID, supplierID, requiresAdminApproval, approvedByID, status FROM Orders WHERE orderID=? AND isDeleted=0'
  ).get(id);
  if (!order) return res.status(404).json({ message: 'Sipariş bulunamadı.' });
  if (order.status === 'Cancelled') return res.status(400).json({ message: 'İptal edilmiş sipariş teslim alınamaz.' });
  if (order.requiresAdminApproval && !order.approvedByID)
    return res.status(403).json({ message: 'Admin onayı bekleniyor, teslimat yapılamaz. (BR-12)' });

  try {
    db.exec('BEGIN');
    let allReceived = true;

    for (const d of deliveries) {
      const detail = db.prepare(
        'SELECT orderDetailID, productID, orderedQty, receivedQty FROM OrderDetails WHERE orderDetailID=? AND orderID=?'
      ).get(d.orderDetailID, id);
      if (!detail) continue;

      const newReceived = parseFloat(detail.receivedQty) + parseFloat(d.receivedQty);
      db.prepare('UPDATE OrderDetails SET receivedQty=?, expiryDate=? WHERE orderDetailID=?')
        .run(newReceived, d.expiryDate || null, d.orderDetailID);

      const inv = db.prepare('SELECT inventoryID FROM Inventory WHERE productID=?').get(detail.productID);
      if (inv) {
        db.prepare('UPDATE Inventory SET quantity=quantity+?, expiryDate=COALESCE(?,expiryDate) WHERE productID=?')
          .run(d.receivedQty, d.expiryDate || null, detail.productID);
      } else {
        db.prepare('INSERT INTO Inventory (productID, quantity, expiryDate) VALUES (?,?,?)')
          .run(detail.productID, d.receivedQty, d.expiryDate || null);
      }

      db.prepare(
        `INSERT INTO StockMovements (productID, userID, amount, movementType, referenceID, note)
         VALUES (?,?,?,'IN',?,'Sipariş teslimatı')`
      ).run(detail.productID, req.user.userID, d.receivedQty, id);

      if (newReceived < parseFloat(detail.orderedQty)) allReceived = false;
    }

    const newStatus = allReceived ? 'Received' : 'Partial';
    db.prepare('UPDATE Orders SET status=?, receivedDate=? WHERE orderID=?')
      .run(newStatus, receivedDate || new Date().toISOString(), id);

    db.exec('COMMIT');
    calculateAndSaveScore(parseInt(id), order.supplierID);
    writeAuditLog(req, `Teslimat alındı: Sipariş ${id} - ${newStatus}`, 'Orders', parseInt(id));
    return res.json({ message: `Teslimat kaydedildi. Sipariş durumu: ${newStatus}` });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

module.exports = { getAll, getDetails, create, adminApprove, receiveDelivery };
