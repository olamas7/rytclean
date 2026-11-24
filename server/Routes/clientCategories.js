const express = require('express');
const { runQuery } = require('../db');
const router = express.Router();

// Mounted behind adminSetup's JWT middleware. Reading options is available to staff.
router.get('/client-categories', async (req, res) => {
  const [err, rows] = await runQuery('SELECT id, name, status FROM client_categories ORDER BY name');
  if (err) return res.status(500).json({ code: 2, message: 'Unable to load client categories.' });
  return res.json({ code: 1, data: rows });
});

const requireAdmin = (req, res, next) => {
  if (!['Admin', 'Super Admin'].includes(req.user?.role)) {
    return res.status(403).json({ code: 2, message: 'Only administrators can change configuration.' });
  }
  return next();
};

const saveCategory = async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const status = req.body.status || 'active';
  const id = Number(req.params.id);
  if (!name || name.length > 100 || !['active', 'inactive'].includes(status)) {
    return res.json({ code: 2, message: 'Enter a category name of up to 100 characters and a valid status.' });
  }
  if (req.params.id && (!Number.isSafeInteger(id) || id <= 0)) {
    return res.json({ code: 2, message: 'Invalid category selected.' });
  }
  if (req.params.id) {
    const [err, rows] = await runQuery('SELECT id FROM client_categories WHERE id = ?', [id]);
    if (err) return res.status(500).json({ code: 2, message: 'Unable to load category.' });
    if (!rows.length) return res.status(404).json({ code: 2, message: 'Category not found.' });
  }
  const [err, result] = req.params.id
    ? await runQuery('UPDATE client_categories SET name = ?, status = ? WHERE id = ?', [name, status, id])
    : await runQuery('INSERT INTO client_categories (name, status) VALUES (?, ?)', [name, status]);
  if (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.json({ code: 2, message: 'A category with this name already exists.' });
    return res.status(500).json({ code: 2, message: 'Unable to save category.' });
  }
  return res.json({ code: 1, data: { id: req.params.id ? id : result.insertId, name, status }, message: 'Client category saved.' });
};

router.post('/client-categories', requireAdmin, saveCategory);
router.patch('/client-categories/:id', requireAdmin, saveCategory);
module.exports = router;
