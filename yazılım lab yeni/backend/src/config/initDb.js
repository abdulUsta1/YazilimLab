/**
 * SQLite şema başlatıcı — node:sqlite (Node 22 built-in)
 */
const db = require('./db');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Roles (
      roleID   INTEGER PRIMARY KEY AUTOINCREMENT,
      roleName TEXT    NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS Users (
      userID        INTEGER PRIMARY KEY AUTOINCREMENT,
      roleID        INTEGER NOT NULL,
      fullName      TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      passwordHash  TEXT    NOT NULL,
      failedAttempts INTEGER NOT NULL DEFAULT 0,
      lockedUntil   TEXT    DEFAULT NULL,
      isActive      INTEGER NOT NULL DEFAULT 1,
      isDeleted     INTEGER NOT NULL DEFAULT 0,
      createdAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (roleID) REFERENCES Roles(roleID)
    );

    CREATE TABLE IF NOT EXISTS AuditLogs (
      logID      INTEGER PRIMARY KEY AUTOINCREMENT,
      userID     INTEGER DEFAULT NULL,
      action     TEXT    NOT NULL,
      tableName  TEXT    DEFAULT NULL,
      recordID   INTEGER DEFAULT NULL,
      ipAddress  TEXT    NOT NULL,
      userAgent  TEXT    DEFAULT NULL,
      createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userID) REFERENCES Users(userID) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Categories (
      categoryID   INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryName TEXT    NOT NULL UNIQUE,
      description  TEXT    DEFAULT NULL,
      isDeleted    INTEGER NOT NULL DEFAULT 0,
      createdAt    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Products (
      productID    INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryID   INTEGER NOT NULL,
      productName  TEXT    NOT NULL,
      unit         TEXT    NOT NULL,
      unitPrice    REAL    NOT NULL DEFAULT 0,
      isPerishable INTEGER NOT NULL DEFAULT 0,
      isDeleted    INTEGER NOT NULL DEFAULT 0,
      createdAt    TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryID) REFERENCES Categories(categoryID)
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
      supplierID  INTEGER PRIMARY KEY AUTOINCREMENT,
      companyName TEXT    NOT NULL,
      taxNumber   TEXT    NOT NULL UNIQUE,
      contactName TEXT    DEFAULT NULL,
      phone       TEXT    DEFAULT NULL,
      email       TEXT    DEFAULT NULL,
      address     TEXT    DEFAULT NULL,
      perfScore   REAL    NOT NULL DEFAULT 100,
      isActive    INTEGER NOT NULL DEFAULT 1,
      isDeleted   INTEGER NOT NULL DEFAULT 0,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Inventory (
      inventoryID   INTEGER PRIMARY KEY AUTOINCREMENT,
      productID     INTEGER NOT NULL UNIQUE,
      quantity      REAL    NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      reorderLevel  REAL    NOT NULL DEFAULT 0,
      expiryDate    TEXT    DEFAULT NULL,
      warehouseZone TEXT    DEFAULT NULL,
      lastUpdated   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (productID) REFERENCES Products(productID)
    );

    CREATE TABLE IF NOT EXISTS StockMovements (
      movementID   INTEGER PRIMARY KEY AUTOINCREMENT,
      productID    INTEGER NOT NULL,
      userID       INTEGER NOT NULL,
      amount       REAL    NOT NULL CHECK(amount > 0),
      movementType TEXT    NOT NULL CHECK(movementType IN ('IN','OUT','WASTE','RETURN')),
      referenceID  INTEGER DEFAULT NULL,
      note         TEXT    DEFAULT NULL,
      createdAt    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (productID) REFERENCES Products(productID),
      FOREIGN KEY (userID)    REFERENCES Users(userID)
    );

    CREATE TABLE IF NOT EXISTS PurchaseRequests (
      requestID    INTEGER PRIMARY KEY AUTOINCREMENT,
      productID    INTEGER NOT NULL,
      requesterID  INTEGER NOT NULL,
      approverID   INTEGER DEFAULT NULL,
      requestedQty REAL    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'Pending'
                           CHECK(status IN ('Pending','Approved','Rejected')),
      note         TEXT    DEFAULT NULL,
      approvalNote TEXT    DEFAULT NULL,
      requestedAt  TEXT    NOT NULL DEFAULT (datetime('now')),
      resolvedAt   TEXT    DEFAULT NULL,
      isDeleted    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (productID)   REFERENCES Products(productID),
      FOREIGN KEY (requesterID) REFERENCES Users(userID),
      FOREIGN KEY (approverID)  REFERENCES Users(userID)
    );

    CREATE TABLE IF NOT EXISTS Orders (
      orderID               INTEGER PRIMARY KEY AUTOINCREMENT,
      supplierID            INTEGER NOT NULL,
      createdByID           INTEGER NOT NULL,
      approvedByID          INTEGER DEFAULT NULL,
      requestID             INTEGER DEFAULT NULL,
      totalAmount           REAL    NOT NULL DEFAULT 0,
      status                TEXT    NOT NULL DEFAULT 'Pending'
                                    CHECK(status IN ('Pending','Partial','Received','Cancelled')),
      requiresAdminApproval INTEGER NOT NULL DEFAULT 0,
      orderDate             TEXT    NOT NULL DEFAULT (datetime('now')),
      expectedDate          TEXT    DEFAULT NULL,
      receivedDate          TEXT    DEFAULT NULL,
      isDeleted             INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (supplierID)   REFERENCES Suppliers(supplierID),
      FOREIGN KEY (createdByID)  REFERENCES Users(userID),
      FOREIGN KEY (approvedByID) REFERENCES Users(userID),
      FOREIGN KEY (requestID)    REFERENCES PurchaseRequests(requestID)
    );

    CREATE TABLE IF NOT EXISTS OrderDetails (
      orderDetailID INTEGER PRIMARY KEY AUTOINCREMENT,
      orderID       INTEGER NOT NULL,
      productID     INTEGER NOT NULL,
      orderedQty    REAL    NOT NULL CHECK(orderedQty > 0),
      receivedQty   REAL    NOT NULL DEFAULT 0 CHECK(receivedQty >= 0),
      unitPrice     REAL    NOT NULL,
      expiryDate    TEXT    DEFAULT NULL,
      FOREIGN KEY (orderID)   REFERENCES Orders(orderID),
      FOREIGN KEY (productID) REFERENCES Products(productID)
    );

    CREATE TABLE IF NOT EXISTS Payments (
      paymentID     INTEGER PRIMARY KEY AUTOINCREMENT,
      orderID       INTEGER NOT NULL,
      paidByID      INTEGER NOT NULL,
      amount        REAL    NOT NULL,
      paymentMethod TEXT    NOT NULL DEFAULT 'BankTransfer'
                            CHECK(paymentMethod IN ('Cash','BankTransfer','CreditCard','Cheque')),
      paymentDate   TEXT    NOT NULL DEFAULT (datetime('now')),
      invoiceNumber TEXT    DEFAULT NULL,
      note          TEXT    DEFAULT NULL,
      isDeleted     INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (orderID)  REFERENCES Orders(orderID),
      FOREIGN KEY (paidByID) REFERENCES Users(userID)
    );

    CREATE TABLE IF NOT EXISTS Notifications (
      notificationID INTEGER PRIMARY KEY AUTOINCREMENT,
      userID         INTEGER DEFAULT NULL,
      roleID         INTEGER DEFAULT NULL,
      type           TEXT    NOT NULL,
      title          TEXT    NOT NULL,
      message        TEXT    NOT NULL,
      referenceID    INTEGER DEFAULT NULL,
      isRead         INTEGER NOT NULL DEFAULT 0,
      createdAt      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userID) REFERENCES Users(userID) ON DELETE CASCADE,
      FOREIGN KEY (roleID) REFERENCES Roles(roleID)
    );

    CREATE TABLE IF NOT EXISTS SupplierPerformanceLogs (
      perfLogID         INTEGER PRIMARY KEY AUTOINCREMENT,
      supplierID        INTEGER NOT NULL,
      orderID           INTEGER NOT NULL,
      onTimeScore       REAL    NOT NULL DEFAULT 0,
      completenessScore REAL    NOT NULL DEFAULT 0,
      priceScore        REAL    NOT NULL DEFAULT 0,
      totalScore        REAL    NOT NULL DEFAULT 0,
      calculatedAt      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supplierID) REFERENCES Suppliers(supplierID),
      FOREIGN KEY (orderID)    REFERENCES Orders(orderID)
    );

    CREATE INDEX IF NOT EXISTS idx_users_email         ON Users(email);
    CREATE INDEX IF NOT EXISTS idx_auditlogs_createdat ON AuditLogs(createdAt);
    CREATE INDEX IF NOT EXISTS idx_inventory_expiry    ON Inventory(expiryDate);
    CREATE INDEX IF NOT EXISTS idx_stockmov_product    ON StockMovements(productID);
    CREATE INDEX IF NOT EXISTS idx_pr_status           ON PurchaseRequests(status);
    CREATE INDEX IF NOT EXISTS idx_orders_status       ON Orders(status);
    CREATE INDEX IF NOT EXISTS idx_notif_user_read     ON Notifications(userID, isRead);
  `);

  // Seed: sadece ilk çalıştırmada
  const roleCount = db.prepare('SELECT COUNT(*) as c FROM Roles').get().c;
  if (roleCount === 0) {
    ['Admin','DepoSorumlusu','SatinAlmaSorumlusu','Yonetici'].forEach(r =>
      db.prepare('INSERT INTO Roles (roleName) VALUES (?)').run(r)
    );

    // Admin şifresi app.js'de async olarak hashlenir
    db.prepare(
      `INSERT OR IGNORE INTO Users (roleID, fullName, email, passwordHash)
       VALUES (1, 'Sistem Yöneticisi', 'admin@restoran.com', '__PENDING__')`
    ).run();

    // Demo kullanıcılar (diğer roller) — şifreler app.js'de hashlenir
    db.prepare(`INSERT OR IGNORE INTO Users (roleID, fullName, email, passwordHash) VALUES (2,'Mehmet Kaya','depo@restoran.com','__PENDING2__')`).run();
    db.prepare(`INSERT OR IGNORE INTO Users (roleID, fullName, email, passwordHash) VALUES (3,'Ayşe Demir','satin@restoran.com','__PENDING3__')`).run();
    db.prepare(`INSERT OR IGNORE INTO Users (roleID, fullName, email, passwordHash) VALUES (4,'Fatma Öztürk','yonetici@restoran.com','__PENDING4__')`).run();

    ['Et ve Tavuk','Sebze ve Meyve','Süt Ürünleri','Kuru Gıda','İçecek','Temizlik'].forEach(c =>
      db.prepare('INSERT OR IGNORE INTO Categories (categoryName) VALUES (?)').run(c)
    );

    db.prepare(`INSERT OR IGNORE INTO Suppliers (companyName,taxNumber,contactName,phone,email)
      VALUES ('Güven Gıda A.Ş.','1234567890','Ahmet Yılmaz','0212 555 0001','info@guvengida.com')`).run();
    db.prepare(`INSERT OR IGNORE INTO Suppliers (companyName,taxNumber,contactName,phone,email)
      VALUES ('Taze Market Ltd.','9876543210','Fatma Kaya','0216 555 0002','satis@tazemarket.com')`).run();

    console.log('[DB] Şema ve seed verileri oluşturuldu.');
  } else {
    console.log('[DB] Mevcut veritabanı yüklendi.');
  }
}

module.exports = initDb;
