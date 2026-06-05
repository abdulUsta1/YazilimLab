const db = require('../config/db');

function getAll(req, res) {
  try {
    const rows = db.prepare('SELECT categoryID, categoryName FROM Categories WHERE isDeleted=0 ORDER BY categoryName').all();
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
}

module.exports = { getAll };
