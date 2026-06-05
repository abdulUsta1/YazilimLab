const db = require('../config/db');

/**
 * SKT'sine 7 gün kalan ürünler için "Kritik Risk" bildirimi oluşturur.
 * Her gün 08:00'de app.js tarafından çağrılır.
 */
function checkExpiryDates() {
  try {
    const expiring = db.prepare(
      `SELECT i.inventoryID, p.productID, p.productName, p.unit, i.quantity, i.expiryDate,
              CAST((julianday(i.expiryDate) - julianday('now')) AS INTEGER) AS daysLeft
       FROM Inventory i
       JOIN Products p ON p.productID = i.productID
       WHERE p.isPerishable = 1
         AND i.expiryDate IS NOT NULL
         AND julianday(i.expiryDate) - julianday('now') BETWEEN 0 AND 7
         AND p.isDeleted = 0`
    ).all();

    const roles = db.prepare("SELECT roleID FROM Roles WHERE roleName IN ('Admin','DepoSorumlusu','Yonetici')").all();

    for (const item of expiring) {
      // Aynı gün için tekrar bildirim oluşturma
      const existing = db.prepare(
        `SELECT notificationID FROM Notifications
         WHERE type='ExpiryWarning' AND referenceID=? AND date(createdAt)=date('now')`
      ).get(item.productID);
      if (existing) continue;

      for (const role of roles) {
        db.prepare(
          `INSERT INTO Notifications (roleID, type, title, message, referenceID)
           VALUES (?, 'ExpiryWarning', ?, ?, ?)`
        ).run(
          role.roleID,
          `Kritik Risk: ${item.productName}`,
          `${item.productName} ürününün son kullanma tarihine ${item.daysLeft} gün kaldı. Stok: ${item.quantity} ${item.unit}`,
          item.productID
        );
      }
    }

    console.log(`[ExpiryChecker] ${expiring.length} ürün kontrol edildi.`);
  } catch (err) {
    console.error('ExpiryChecker hatası:', err.message);
  }
}

module.exports = { checkExpiryDates };
