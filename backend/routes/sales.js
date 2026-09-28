// FILE: backend/routes/sales.js
const express = require('express');
const db = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    let q = 'SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON s.customer_id=c.id';
    let p = [];
    if (search) { q += ' WHERE s.sale_number LIKE ? OR c.name LIKE ?'; p.push(`%${search}%`,`%${search}%`); }
    q += ' ORDER BY s.sale_date DESC LIMIT 50';
    const [rows] = await db.execute(q, p);
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [sales] = await db.execute('SELECT s.*,c.name AS customer_name FROM sales s LEFT JOIN customers c ON s.customer_id=c.id WHERE s.id=?',[req.params.id]);
    if (!sales.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await db.execute('SELECT * FROM sale_items WHERE sale_id=?',[req.params.id]);
    res.json({ ...sales[0], items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, sale_date, discount=0, tax_amount=0, notes, items=[] } = req.body;
    const year = new Date().getFullYear();
    const [cnt] = await conn.execute('SELECT COUNT(*) as n FROM sales WHERE YEAR(sale_date)=?',[year]);
    const sale_number = `SAL-${year}-${String(cnt[0].n+1).padStart(4,'0')}`;
    const subtotal = items.reduce((s,i)=>s+(i.quantity*i.unit_price-(i.discount||0)),0);
    const total    = subtotal - discount + tax_amount;
    const [r] = await conn.execute(
      'INSERT INTO sales (sale_number,customer_id,sale_date,subtotal,discount,tax_amount,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [sale_number, customer_id||null, sale_date, subtotal, discount, tax_amount, total, notes||null, req.user.id]
    );
    for (const item of items) {
      const lt = item.quantity*item.unit_price-(item.discount||0);
      await conn.execute('INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,discount,line_total) VALUES (?,?,?,?,?,?,?)',
        [r.insertId, item.product_id||null, item.product_name, item.quantity, item.unit_price, item.discount||0, lt]);
      if (item.product_id)
        await conn.execute('UPDATE products SET stock_quantity=stock_quantity-? WHERE id=?',[item.quantity,item.product_id]);
    }
    await conn.commit();
    res.status(201).json({ message:'Sale created', sale_number, id:r.insertId });
  } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
  finally { conn.release(); }
});

module.exports = router;
