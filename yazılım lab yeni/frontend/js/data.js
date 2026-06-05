/**
 * Mock veri katmanı — Backend API hazır olduğunda
 * her fonksiyon fetch() çağrısıyla değiştirilecek.
 */

const DB = {
  currentRole: 'Admin',
  currentUser: 'Ahmet Yılmaz',

  products: [
    { id: 1, name: 'Zeytinyağı', category: 'Yağ',        qty: 2,  unit: 'litre', minLevel: 5,  price: 85.00,  isPerishable: false, expiry: null },
    { id: 2, name: 'Tavuk Göğsü',category: 'Et',         qty: 15, unit: 'kg',    minLevel: 10, price: 120.00, isPerishable: true,  expiry: '2026-05-10' },
    { id: 3, name: 'Un',         category: 'Un & Tahıl', qty: 3,  unit: 'kg',    minLevel: 20, price: 18.50,  isPerishable: false, expiry: null },
    { id: 4, name: 'Süt',        category: 'Süt Ürünleri',qty:25, unit: 'litre', minLevel: 15, price: 22.00,  isPerishable: true,  expiry: '2026-05-08' },
    { id: 5, name: 'Soğan',      category: 'Sebze',      qty: 20, unit: 'kg',    minLevel: 10, price: 12.00,  isPerishable: false, expiry: null },
  ],

  suppliers: [
    { id: 1, name: 'Gıda Tedarik Ltd.',  tax: '1234567890', contact: 'Ahmet Yılmaz', phone: '0212 555 0001', email: 'info@gidatedarik.com', score: 92, isActive: true },
    { id: 2, name: 'Taze Market A.Ş.',   tax: '9876543210', contact: 'Fatma Kaya',   phone: '0216 555 0002', email: 'satis@tazemarket.com',  score: 78, isActive: true },
  ],

  requests: [
    { id: 1, productId: 1, productName: 'Domates',    qty: 20, unit: 'kg',    requester: 'Mehmet Kaya',  note: 'Stok kritik seviyede, acil sipariş gerekli',              status: 'Approved',  approver: 'Ahmet Yılmaz' },
    { id: 2, productId: 1, productName: 'Zeytinyağı', qty: 10, unit: 'litre', requester: 'Mehmet Kaya',  note: 'Mevsimsel talep artışı nedeniyle stok yetersiz',          status: 'Approved',  approver: 'Fatma Öztürk' },
    { id: 3, productId: 3, productName: 'Test Stock', qty: 25, unit: 'kg',    requester: 'Test User',    note: 'Test request for API testing',                           status: 'Approved',  approver: 'Test Manager' },
    { id: 4, productId: 3, productName: 'Test Stock', qty: 25, unit: 'kg',    requester: 'Test User',    note: 'Test request for API testing',                           status: 'Approved',  approver: 'Test Manager' },
    { id: 5, productId: 4, productName: 'Süt',        qty: 0.03, unit: 'litre', requester: 'Ayşe Demir', note: 'aa',                                                    status: 'Pending',   approver: null },
  ],

  orders: [
    { id: 1, productName: 'Zeytinyağı', qty: 10, unit: 'litre', supplier: 'Gıda Tedarik Ltd.', createdBy: 'Ayşe Demir',       status: 'Pending',  receivedBy: null },
    { id: 2, productName: 'Test Stock', qty: 20, unit: 'kg',    supplier: 'Test Supplier',      createdBy: 'Test Purchasing',  status: 'Received', receivedBy: 'Test Warehouse' },
    { id: 3, productName: 'Test Stock', qty: 20, unit: 'kg',    supplier: 'Test Supplier',      createdBy: 'Test Purchasing',  status: 'Received', receivedBy: 'Test Warehouse' },
  ],

  nextId: { product: 6, request: 6, order: 4, supplier: 3 },
};
