-- ============================================================
-- Restoran Tedarik ve Stok Yönetimi - Veritabanı Şeması
-- MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS restaurant_supply_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE restaurant_supply_db;

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE Roles (
    roleID      TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
    roleName    VARCHAR(50)         NOT NULL UNIQUE,  -- Admin, DepoSorumlusu, SatinAlmaSorumlusu, Yonetici
    PRIMARY KEY (roleID)
) ENGINE=InnoDB;

-- ============================================================
-- 2. USERS
-- ============================================================
CREATE TABLE Users (
    userID          INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    roleID          TINYINT UNSIGNED    NOT NULL,
    fullName        VARCHAR(100)        NOT NULL,
    email           VARCHAR(150)        NOT NULL UNIQUE,
    passwordHash    VARCHAR(255)        NOT NULL,           -- BCrypt / Argon2
    failedAttempts  TINYINT UNSIGNED    NOT NULL DEFAULT 0,
    lockedUntil     DATETIME            NULL,               -- 30 dk kilit süresi
    isActive        TINYINT(1)          NOT NULL DEFAULT 1,
    isDeleted       TINYINT(1)          NOT NULL DEFAULT 0,
    createdAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (userID),
    CONSTRAINT fk_users_role FOREIGN KEY (roleID) REFERENCES Roles(roleID)
) ENGINE=InnoDB;

-- ============================================================
-- 3. AUDIT LOGS
-- ============================================================
CREATE TABLE AuditLogs (
    logID       BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
    userID      INT UNSIGNED        NULL,                   -- NULL: sistem eylemi
    action      VARCHAR(255)        NOT NULL,
    tableName   VARCHAR(100)        NULL,
    recordID    INT UNSIGNED        NULL,
    ipAddress   VARCHAR(45)         NOT NULL,               -- IPv4 / IPv6
    userAgent   VARCHAR(500)        NULL,
    createdAt   DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (logID),
    CONSTRAINT fk_auditlogs_user FOREIGN KEY (userID) REFERENCES Users(userID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 4. CATEGORIES
-- ============================================================
CREATE TABLE Categories (
    categoryID      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    categoryName    VARCHAR(100)    NOT NULL UNIQUE,
    description     TEXT            NULL,
    isDeleted       TINYINT(1)      NOT NULL DEFAULT 0,
    createdAt       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (categoryID)
) ENGINE=InnoDB;

-- ============================================================
-- 5. PRODUCTS
-- ============================================================
CREATE TABLE Products (
    productID       INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    categoryID      INT UNSIGNED        NOT NULL,
    productName     VARCHAR(150)        NOT NULL,
    unit            VARCHAR(30)         NOT NULL,           -- kg, litre, adet, kutu...
    unitPrice       DECIMAL(10,2)       NOT NULL DEFAULT 0.00,
    isPerishable    TINYINT(1)          NOT NULL DEFAULT 0, -- Bozulabilir mi? SKT zorunlu
    isDeleted       TINYINT(1)          NOT NULL DEFAULT 0,
    createdAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (productID),
    CONSTRAINT fk_products_category FOREIGN KEY (categoryID) REFERENCES Categories(categoryID)
) ENGINE=InnoDB;

-- ============================================================
-- 6. SUPPLIERS
-- ============================================================
CREATE TABLE Suppliers (
    supplierID      INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    companyName     VARCHAR(150)        NOT NULL,
    taxNumber       VARCHAR(20)         NOT NULL UNIQUE,
    contactName     VARCHAR(100)        NULL,
    phone           VARCHAR(20)         NULL,
    email           VARCHAR(150)        NULL,
    address         TEXT                NULL,
    perfScore       DECIMAL(5,2)        NOT NULL DEFAULT 100.00, -- 0-100 arası otomatik puan
    isActive        TINYINT(1)          NOT NULL DEFAULT 1,
    isDeleted       TINYINT(1)          NOT NULL DEFAULT 0,
    createdAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (supplierID)
) ENGINE=InnoDB;

-- ============================================================
-- 7. INVENTORY
-- ============================================================
CREATE TABLE Inventory (
    inventoryID     INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    productID       INT UNSIGNED        NOT NULL UNIQUE,    -- Her ürün için tek kayıt
    quantity        DECIMAL(12,3)       NOT NULL DEFAULT 0, -- Negatif olamaz (CHECK)
    reorderLevel    DECIMAL(12,3)       NOT NULL DEFAULT 0, -- Yeniden sipariş eşiği
    expiryDate      DATE                NULL,               -- isPerishable=1 ise zorunlu (uygulama katmanında)
    warehouseZone   VARCHAR(50)         NULL,
    lastUpdated     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (inventoryID),
    CONSTRAINT fk_inventory_product FOREIGN KEY (productID) REFERENCES Products(productID),
    CONSTRAINT chk_inventory_qty    CHECK (quantity >= 0)
) ENGINE=InnoDB;

-- ============================================================
-- 8. STOCK MOVEMENTS
-- ============================================================
CREATE TABLE StockMovements (
    movementID      BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
    productID       INT UNSIGNED        NOT NULL,
    userID          INT UNSIGNED        NOT NULL,
    amount          DECIMAL(12,3)       NOT NULL,           -- Pozitif değer; yön movementType ile belirlenir
    movementType    ENUM('IN','OUT','WASTE','RETURN') NOT NULL,
    referenceID     INT UNSIGNED        NULL,               -- İlgili sipariş/talep ID
    note            VARCHAR(500)        NULL,
    createdAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (movementID),
    CONSTRAINT fk_stockmov_product FOREIGN KEY (productID) REFERENCES Products(productID),
    CONSTRAINT fk_stockmov_user    FOREIGN KEY (userID)    REFERENCES Users(userID),
    CONSTRAINT chk_stockmov_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ============================================================
-- 9. PURCHASE REQUESTS (Satın Alma Talepleri)
-- ============================================================
CREATE TABLE PurchaseRequests (
    requestID       INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    productID       INT UNSIGNED        NOT NULL,
    requesterID     INT UNSIGNED        NOT NULL,           -- Depo Sorumlusu
    approverID      INT UNSIGNED        NULL,               -- Yönetici
    requestedQty    DECIMAL(12,3)       NOT NULL,
    status          ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    note            TEXT                NULL,
    approvalNote    TEXT                NULL,
    requestedAt     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolvedAt      DATETIME            NULL,
    isDeleted       TINYINT(1)          NOT NULL DEFAULT 0,
    PRIMARY KEY (requestID),
    CONSTRAINT fk_pr_product   FOREIGN KEY (productID)   REFERENCES Products(productID),
    CONSTRAINT fk_pr_requester FOREIGN KEY (requesterID) REFERENCES Users(userID),
    CONSTRAINT fk_pr_approver  FOREIGN KEY (approverID)  REFERENCES Users(userID)
) ENGINE=InnoDB;

-- ============================================================
-- 10. ORDERS (Siparişler)
-- ============================================================
CREATE TABLE Orders (
    orderID         INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    supplierID      INT UNSIGNED        NOT NULL,
    createdByID     INT UNSIGNED        NOT NULL,           -- Satın Alma Sorumlusu
    approvedByID    INT UNSIGNED        NULL,               -- Admin (5000 TL üzeri)
    requestID       INT UNSIGNED        NULL,               -- Kaynak talep
    totalAmount     DECIMAL(12,2)       NOT NULL DEFAULT 0.00,
    status          ENUM('Pending','Partial','Received','Cancelled') NOT NULL DEFAULT 'Pending',
    requiresAdminApproval TINYINT(1)    NOT NULL DEFAULT 0, -- BR-12: 5000 TL üzeri
    orderDate       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expectedDate    DATE                NULL,
    receivedDate    DATETIME            NULL,
    isDeleted       TINYINT(1)          NOT NULL DEFAULT 0,
    PRIMARY KEY (orderID),
    CONSTRAINT fk_orders_supplier   FOREIGN KEY (supplierID)   REFERENCES Suppliers(supplierID),
    CONSTRAINT fk_orders_createdby  FOREIGN KEY (createdByID)  REFERENCES Users(userID),
    CONSTRAINT fk_orders_approvedby FOREIGN KEY (approvedByID) REFERENCES Users(userID),
    CONSTRAINT fk_orders_request    FOREIGN KEY (requestID)    REFERENCES PurchaseRequests(requestID)
) ENGINE=InnoDB;

-- ============================================================
-- 11. ORDER DETAILS (Sipariş Kalemleri)
-- ============================================================
CREATE TABLE OrderDetails (
    orderDetailID   INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    orderID         INT UNSIGNED        NOT NULL,
    productID       INT UNSIGNED        NOT NULL,
    orderedQty      DECIMAL(12,3)       NOT NULL,
    receivedQty     DECIMAL(12,3)       NOT NULL DEFAULT 0, -- Kısmi teslimat desteği
    unitPrice       DECIMAL(10,2)       NOT NULL,
    expiryDate      DATE                NULL,               -- Teslim alınan partinin SKT
    PRIMARY KEY (orderDetailID),
    CONSTRAINT fk_od_order   FOREIGN KEY (orderID)   REFERENCES Orders(orderID),
    CONSTRAINT fk_od_product FOREIGN KEY (productID) REFERENCES Products(productID),
    CONSTRAINT chk_od_rcvqty CHECK (receivedQty >= 0),
    CONSTRAINT chk_od_ordqty CHECK (orderedQty > 0)
) ENGINE=InnoDB;

-- ============================================================
-- 12. PAYMENTS (Ödemeler)
-- ============================================================
CREATE TABLE Payments (
    paymentID       INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    orderID         INT UNSIGNED        NOT NULL,
    paidByID        INT UNSIGNED        NOT NULL,
    amount          DECIMAL(12,2)       NOT NULL,
    paymentMethod   ENUM('Cash','BankTransfer','CreditCard','Cheque') NOT NULL DEFAULT 'BankTransfer',
    paymentDate     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invoiceNumber   VARCHAR(100)        NULL,
    note            TEXT                NULL,
    isDeleted       TINYINT(1)          NOT NULL DEFAULT 0,
    PRIMARY KEY (paymentID),
    CONSTRAINT fk_payments_order  FOREIGN KEY (orderID)  REFERENCES Orders(orderID),
    CONSTRAINT fk_payments_paidby FOREIGN KEY (paidByID) REFERENCES Users(userID)
) ENGINE=InnoDB;

-- ============================================================
-- 13. NOTIFICATIONS (Sistem Bildirimleri)
-- ============================================================
CREATE TABLE Notifications (
    notificationID  INT UNSIGNED        NOT NULL AUTO_INCREMENT,
    userID          INT UNSIGNED        NULL,               -- NULL = tüm ilgili roller
    roleID          TINYINT UNSIGNED    NULL,               -- Rol bazlı bildirim
    type            ENUM('ExpiryWarning','LowStock','OrderStatus','ApprovalRequired','AdminApproval','General') NOT NULL,
    title           VARCHAR(200)        NOT NULL,
    message         TEXT                NOT NULL,
    referenceID     INT UNSIGNED        NULL,               -- İlgili kayıt ID
    isRead          TINYINT(1)          NOT NULL DEFAULT 0,
    createdAt       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notificationID),
    CONSTRAINT fk_notif_user FOREIGN KEY (userID) REFERENCES Users(userID) ON DELETE CASCADE,
    CONSTRAINT fk_notif_role FOREIGN KEY (roleID) REFERENCES Roles(roleID)
) ENGINE=InnoDB;

-- ============================================================
-- SUPPLIER PERFORMANCE LOG (Tedarikçi Puanlama Geçmişi)
-- ============================================================
CREATE TABLE SupplierPerformanceLogs (
    perfLogID           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    supplierID          INT UNSIGNED    NOT NULL,
    orderID             INT UNSIGNED    NOT NULL,
    onTimeScore         DECIMAL(5,2)    NOT NULL DEFAULT 0,  -- Zamanında teslimat (0-100)
    completenessScore   DECIMAL(5,2)    NOT NULL DEFAULT 0,  -- Eksik ürün oranı (0-100)
    priceScore          DECIMAL(5,2)    NOT NULL DEFAULT 0,  -- Fiyat uygunluğu (0-100)
    totalScore          DECIMAL(5,2)    NOT NULL DEFAULT 0,  -- Ağırlıklı ortalama
    calculatedAt        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (perfLogID),
    CONSTRAINT fk_perflog_supplier FOREIGN KEY (supplierID) REFERENCES Suppliers(supplierID),
    CONSTRAINT fk_perflog_order    FOREIGN KEY (orderID)    REFERENCES Orders(orderID)
) ENGINE=InnoDB;

-- ============================================================
-- İNDEKSLER (Performans)
-- ============================================================
CREATE INDEX idx_users_email          ON Users(email);
CREATE INDEX idx_users_role           ON Users(roleID);
CREATE INDEX idx_auditlogs_user       ON AuditLogs(userID);
CREATE INDEX idx_auditlogs_createdat  ON AuditLogs(createdAt);
CREATE INDEX idx_inventory_expiry     ON Inventory(expiryDate);
CREATE INDEX idx_stockmov_product     ON StockMovements(productID);
CREATE INDEX idx_stockmov_createdat   ON StockMovements(createdAt);
CREATE INDEX idx_pr_status            ON PurchaseRequests(status);
CREATE INDEX idx_orders_status        ON Orders(status);
CREATE INDEX idx_orders_supplier      ON Orders(supplierID);
CREATE INDEX idx_notif_user_read      ON Notifications(userID, isRead);
