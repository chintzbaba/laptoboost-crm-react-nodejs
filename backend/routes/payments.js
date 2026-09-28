// FILE: backend/routes/payments.js
const express = require('express');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM payments ORDER BY payment_date DESC');
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { type, reference_type, reference_id, party_name, amount, payment_date, payment_method, transaction_ref, notes } = req.body;
    const year = new Date().getFullYear();
    const [cnt] = await conn.execute('SELECT COUNT(*) as n FROM payments WHERE YEAR(payment_date)=?',[year]);
    const payment_number = `PAY-${year}-${String(cnt[0].n + 1).padStart(4,'0')}`;
    const [r] = await conn.execute(
      'INSERT INTO payments (payment_number,type,reference_type,reference_id,party_name,amount,payment_date,payment_method,transaction_ref,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [payment_number, type, reference_type||'other', reference_id||null, party_name||null, amount, payment_date, payment_method||'cash', transaction_ref||null, notes||null, req.user.id]
    );
    // If paying an invoice, update its paid_amount
    if (reference_type === 'invoice' && reference_id) {
      await conn.execute('UPDATE invoices SET paid_amount = paid_amount + ? WHERE id=?', [amount, reference_id]);
      // Mark invoice as paid if fully covered
      await conn.execute(
        "UPDATE invoices SET status='paid' WHERE id=? AND paid_amount >= total_amount",
        [reference_id]
      );
    }
    await conn.commit();
    const [newRow] = await db.execute('SELECT * FROM payments WHERE id=?', [r.insertId]);
    res.status(201).json(newRow[0]);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

module.exports = router;
