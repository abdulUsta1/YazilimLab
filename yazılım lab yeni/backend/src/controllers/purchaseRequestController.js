const db = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');

/** GET /api/purchase-requests */
function getAll(req, res) {
  try {
    const rows = db.prepare(
      `SELECT pr.requestID, p.productName, p.unit, pr.requestedQty, pr.status,
              pr.note, pr.approvalNote, pr.requestedAt, pr.resolvedAt,
              u1.fullName AS requesterName, u2.fullName AS approverName
       FROM PurchaseRequests pr
       JOIN Products p  ON p.productID   = pr.productID
       JOIN Users    u1 ON u1.userID      = pr.requesterID
       LEFT JOIN Users u2 ON u2.userID   = pr.approverID
       WHERE pr.isDeleted = 0
       ORDER BY pr.requestedAt DESC`
    ).all();
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** POST /api/purchase-requests */
function create(req, res) {
  const { productID, requestedQty, note } = req.body;
  if (!productID || !requestedQty)
    return res.status(400).json({ message: 'productID ve requestedQty zorunludur.' });

  try {
    const result = db.prepare(
      `INSERT INTO PurchaseRequests (productID, requesterID, requestedQty, note)
       VALUES (?,?,?,?)`
    ).run(productID, req.user.userID, requestedQty, note || null);

    writeAuditLog(req, 'Satın alma talebi oluşturuldu', 'PurchaseRequests', result.lastInsertRowid);
    return res.status(201).json({ message: 'Talep oluşturuldu.', requestID: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

/** PATCH /api/purchase-requests/:id/approve */
function resolve(req, res) {
  const { id } = req.params;
  const { status, approvalNote } = req.body;

  if (!['Approved','Rejected'].includes(status))
    return res.status(400).json({ message: 'Geçersiz status.' });

  try {
    const pr = db.prepare('SELECT requestID, status FROM PurchaseRequests WHERE requestID=? AND isDeleted=0').get(id);
    if (!pr) return res.status(404).json({ message: 'Talep bulunamadı.' });
    if (pr.status !== 'Pending') return res.status(409).json({ message: 'Bu talep zaten işleme alınmış.' });

    db.prepare(
      `UPDATE PurchaseRequests
       SET status=?, approverID=?, approvalNote=?, resolvedAt=datetime('now')
       WHERE requestID=?`
    ).run(status, req.user.userID, approvalNote || null, id);

    writeAuditLog(req, `Talep ${status}: ${id}`, 'PurchaseRequests', parseInt(id));
    return res.json({ message: `Talep ${status === 'Approved' ? 'onaylandı' : 'reddedildi'}.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

module.exports = { getAll, create, resolve };
