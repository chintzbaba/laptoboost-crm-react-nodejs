// FILE: backend/routes/invoices.js
const express = require('express');
const db = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT i.*, c.name AS customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id ORDER BY i.invoice_date DESC'
    );
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT i.*, c.name AS customer_name, c.phone, c.email AS customer_email FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id WHERE i.id=?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { sale_id, customer_id, invoice_date, due_date, total_amount = 0, notes } = req.body;
    const year = new Date().getFullYear();
    const [cnt] = await db.execute('SELECT COUNT(*) as n FROM invoices WHERE YEAR(invoice_date)=?', [year]);
    const invoice_number = `INV-${year}-${String(cnt[0].n + 1).padStart(4,'0')}`;
    const [r] = await db.execute(
      'INSERT INTO invoices (invoice_number,sale_id,customer_id,invoice_date,due_date,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?)',
      [invoice_number, sale_id||null, customer_id||null, invoice_date, due_date||null, total_amount, notes||null, req.user.id]
    );
    const [newRow] = await db.execute('SELECT * FROM invoices WHERE id=?', [r.insertId]);
    res.status(201).json(newRow[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    await db.execute('UPDATE invoices SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM invoices WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
