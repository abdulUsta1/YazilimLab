const db = require('../config/db');

/**
 * Teslimat sonrası tedarikçi performans puanını hesaplar ve kaydeder.
 */
function calculateAndSaveScore(orderID, supplierID) {
  try {
    const order = db.prepare('SELECT expectedDate, receivedDate FROM Orders WHERE orderID=?').get(orderID);
    if (!order) return;

    // 1. Zamanında teslimat
    let onTimeScore = 100;
    if (order.expectedDate && order.receivedDate) {
      const diffDays = Math.floor(
        (new Date(order.receivedDate) - new Date(order.expectedDate)) / 86400000
      );
      if      (diffDays <= 0) onTimeScore = 100;
      else if (diffDays <= 2) onTimeScore = 80;
      else if (diffDays <= 5) onTimeScore = 60;
      else                    onTimeScore = 30;
    }

    // 2. Eksiksizlik
    const details = db.prepare('SELECT orderedQty, receivedQty FROM OrderDetails WHERE orderID=?').all(orderID);
    const totalOrdered  = details.reduce((s, d) => s + d.orderedQty,  0);
    const totalReceived = details.reduce((s, d) => s + d.receivedQty, 0);
    const completenessScore = totalOrdered > 0
      ? Math.min(100, (totalReceived / totalOrdered) * 100) : 100;

    // 3. Fiyat uygunluğu
    let priceDiff = 0;
    for (const d of details) {
      const prod = db.prepare(
        `SELECT unitPrice FROM Products WHERE productID =
         (SELECT productID FROM OrderDetails WHERE orderID=? AND orderedQty=? LIMIT 1)`
      ).get(orderID, d.orderedQty);
      if (prod && d.unitPrice > prod.unitPrice * 1.1) priceDiff++;
    }
    const priceScore = details.length > 0
      ? Math.max(0, 100 - (priceDiff / details.length) * 100) : 100;

    const totalScore = (onTimeScore + completenessScore + priceScore) / 3;

    db.prepare(
      `INSERT INTO SupplierPerformanceLogs
         (supplierID, orderID, onTimeScore, completenessScore, priceScore, totalScore)
       VALUES (?,?,?,?,?,?)`
    ).run(supplierID, orderID, onTimeScore, completenessScore.toFixed(2), priceScore.toFixed(2), totalScore.toFixed(2));

    // Son 10 teslimatın ortalamasıyla genel puanı güncelle
    const avg = db.prepare(
      `SELECT AVG(totalScore) AS avgScore FROM (
         SELECT totalScore FROM SupplierPerformanceLogs
         WHERE supplierID=? ORDER BY calculatedAt DESC LIMIT 10
       )`
    ).get(supplierID);

    db.prepare('UPDATE Suppliers SET perfScore=? WHERE supplierID=?')
      .run(parseFloat(avg.avgScore || totalScore).toFixed(2), supplierID);
  } catch (err) {
    console.error('Tedarikçi puanlama hatası:', err.message);
  }
}

module.exports = { calculateAndSaveScore };
