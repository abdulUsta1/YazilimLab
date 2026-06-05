/**
 * Rol tabanlı erişim kontrolü (RBAC).
 * Kullanım: authorize('Admin', 'Yonetici')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.roleName)) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  };
}

module.exports = { authorize };
