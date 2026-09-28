// FILE: backend/routes/customers.js
const express = require('express');
const db = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(verifyToken);

const normalizeCustomerType = type => {
  if (type == null || type === '') return 'individual';
  if (type === 'retail') return 'individual';
  if (type === 'individual' || type === 'business') return type;
  return null;
};

const customerPayload = body => {
  const fields = ['name', 'email', 'phone', 'address', 'city', 'gstin', 'customer_type', 'notes'];
  const vals = fields.map(f => f === 'customer_type' ? normalizeCustomerType(body[f]) : (body[f] ?? null));
  return { fields, vals, customerType: vals[fields.indexOf('customer_type')] };
};

// GET all  (supports ?search=  ?page=  ?limit=)
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    let q = 'SELECT * FROM customers', params = [];
    if (search) { q += ' WHERE name LIKE ?'; params.push('%' + search + '%'); }
    const [cnt] = await db.execute(q.replace('SELECT *','SELECT COUNT(*) as n'), params);
    // LIMIT/OFFSET are inlined as literal integers, not placeholders: some
    // MySQL Server versions reject them as bound params in a prepared
    // statement (mysql2 .execute()). Safe here since limit/offset are
    // already coerced to integers above (Math.min/Math.max + parseInt).
    q += ` ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.execute(q, params);
    res.json({ data: rows, pagination: { page, limit, total: cnt[0].n, pages: Math.ceil(cnt[0].n/limit) } });
  } catch (e) { console.error('Customers list error:', e); res.status(500).json({ error: e.message }); }
});

// GET one
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { console.error('Customer get error:', e); res.status(500).json({ error: e.message }); }
});

// CREATE
router.post('/', async (req, res) => {
  try {
    const { fields, vals, customerType } = customerPayload(req.body);
    if (!customerType) return res.status(400).json({ error: 'Customer type must be Retail or Business' });
    const [r]    = await db.execute(
      'INSERT INTO customers (' + fields.join(',') + ') VALUES (' + fields.map(()=>'?').join(',') + ')',
      vals
    );
    const [newRow] = await db.execute('SELECT * FROM customers WHERE id = ?', [r.insertId]);
    res.status(201).json(newRow[0]);
  } catch (e) { console.error('Customer create error:', e); res.status(500).json({ error: e.message }); }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    const { fields, vals, customerType } = customerPayload(req.body);
    if (!customerType) return res.status(400).json({ error: 'Customer type must be Retail or Business' });
    vals.push(req.params.id);
    await db.execute('UPDATE customers SET ' + fields.map(f => f+'=?').join(',') + ' WHERE id=?', vals);
    const [upd] = await db.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!upd.length) return res.status(404).json({ error: 'Not found' });
    res.json(upd[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [r] = await db.execute('DELETE FROM customers WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
