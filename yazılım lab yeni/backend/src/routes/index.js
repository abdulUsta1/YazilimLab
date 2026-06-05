const express  = require('express');
const router   = express.Router();

const { authenticate } = require('../middleware/auth');
const { authorize }    = require('../middleware/rbac');

const authCtrl     = require('../controllers/authController');
const invCtrl      = require('../controllers/inventoryController');
const prCtrl       = require('../controllers/purchaseRequestController');
const orderCtrl    = require('../controllers/orderController');
const productCtrl  = require('../controllers/productController');
const supplierCtrl = require('../controllers/supplierController');
const catCtrl      = require('../controllers/categoryController');

// ── Auth ──────────────────────────────────────────────────────
router.post('/auth/login',  authCtrl.login);
router.post('/auth/logout', authenticate, authCtrl.logout);

// ── Categories ────────────────────────────────────────────────
router.get('/categories', authenticate, catCtrl.getAll);

// ── Products ──────────────────────────────────────────────────
router.get('/products',      authenticate, productCtrl.getAll);
router.post('/products',     authenticate, authorize('Admin','DepoSorumlusu'), productCtrl.create);
router.delete('/products/:id', authenticate, authorize('Admin','DepoSorumlusu'), productCtrl.remove);

// ── Inventory ─────────────────────────────────────────────────
router.get('/inventory',                 authenticate, invCtrl.getAll);
router.get('/inventory/expiry-warnings', authenticate, authorize('Admin','DepoSorumlusu','Yonetici'), invCtrl.getExpiryWarnings);
router.post('/inventory/movement',       authenticate, authorize('Admin','DepoSorumlusu'), invCtrl.addMovement);

// ── Purchase Requests ─────────────────────────────────────────
router.get('/purchase-requests',                    authenticate, prCtrl.getAll);
router.post('/purchase-requests',                   authenticate, authorize('Admin','DepoSorumlusu'), prCtrl.create);
router.patch('/purchase-requests/:id/approve',      authenticate, authorize('Admin','Yonetici'), prCtrl.resolve);

// ── Orders ────────────────────────────────────────────────────
router.get('/orders',                     authenticate, orderCtrl.getAll);
router.get('/orders/:id/details',         authenticate, orderCtrl.getDetails);
router.post('/orders',                    authenticate, authorize('Admin','SatinAlmaSorumlusu'), orderCtrl.create);
router.patch('/orders/:id/admin-approve', authenticate, authorize('Admin'), orderCtrl.adminApprove);
router.post('/orders/:id/receive',        authenticate, authorize('Admin','DepoSorumlusu'), orderCtrl.receiveDelivery);

// ── Suppliers ─────────────────────────────────────────────────
router.get('/suppliers',       authenticate, supplierCtrl.getAll);
router.post('/suppliers',      authenticate, authorize('Admin','SatinAlmaSorumlusu'), supplierCtrl.create);
router.delete('/suppliers/:id',authenticate, authorize('Admin'), supplierCtrl.remove);

module.exports = router;
