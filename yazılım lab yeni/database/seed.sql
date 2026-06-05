-- ============================================================
-- Seed Data - Temel Roller ve Admin Kullanıcısı
-- ============================================================

USE restaurant_supply_db;

-- Roller
INSERT INTO Roles (roleName) VALUES
    ('Admin'),
    ('DepoSorumlusu'),
    ('SatinAlmaSorumlusu'),
    ('Yonetici');

-- Admin kullanıcısı (şifre: Admin@123 - BCrypt hash örneği)
INSERT INTO Users (roleID, fullName, email, passwordHash) VALUES
    (1, 'Sistem Yöneticisi', 'admin@restoran.com',
     '$2b$12$examplehashplaceholderAdminUser000000000000000000000000');

-- Örnek kategoriler
INSERT INTO Categories (categoryName) VALUES
    ('Et ve Tavuk'),
    ('Sebze ve Meyve'),
    ('Süt Ürünleri'),
    ('Kuru Gıda'),
    ('İçecek'),
    ('Temizlik Malzemesi');

-- Örnek tedarikçi
INSERT INTO Suppliers (companyName, taxNumber, contactName, phone, email) VALUES
    ('Güven Gıda A.Ş.', '1234567890', 'Ahmet Yılmaz', '0212 555 0001', 'info@guvengida.com'),
    ('Taze Market Ltd.', '9876543210', 'Fatma Kaya',  '0216 555 0002', 'satis@tazemarket.com');
