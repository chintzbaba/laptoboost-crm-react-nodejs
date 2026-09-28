// FILE: backend/routes/purchases.js
const express = require('express');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT p.*,s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.purchase_date DESC');
    res.json({ data: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [purch] = await db.execute('SELECT p.*,s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE p.id=?',[req.params.id]);
    if (!purch.length) return res.status(404).json({ error: 'Not found' });
    const [items] = await db.execute('SELECT * FROM purchase_items WHERE purchase_id=?',[req.params.id]);
    res.json({ ...purch[0], items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { supplier_id, purchase_date, tax_amount=0, notes, items=[] } = req.body;
    const year = new Date().getFullYear();
    const [cnt] = await conn.execute('SELECT COUNT(*) as n FROM purchases WHERE YEAR(purchase_date)=?',[year]);
    const purchase_number = `PUR-${year}-${String(cnt[0].n+1).padStart(4,'0')}`;
    const subtotal = items.reduce((s,i)=>s+(i.quantity*i.unit_cost),0);
    const total    = subtotal + tax_amount;
    const [r] = await conn.execute(
      'INSERT INTO purchases (purchase_number,supplier_id,purchase_date,subtotal,tax_amount,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?)',
      [purchase_number, supplier_id||null, purchase_date, subtotal, tax_amount, total, notes||null, req.user.id]
    );
    for (const item of items) {
      await conn.execute('INSERT INTO purchase_items (purchase_id,product_id,product_name,quantity,unit_cost,line_total) VALUES (?,?,?,?,?,?)',
        [r.insertId, item.product_id||null, item.product_name, item.quantity, item.unit_cost, item.quantity*item.unit_cost]);
      if (item.product_id)
        await conn.execute('UPDATE products SET stock_quantity=stock_quantity+?,cost_price=? WHERE id=?',[item.quantity,item.unit_cost,item.product_id]);
    }
    await conn.commit();
    res.status(201).json({ message:'Purchase created', purchase_number, id:r.insertId });
  } catch (e) { await conn.rollback(); res.status(500).json({ error: e.message }); }
  finally { conn.release(); }
});

module.exports = router;
