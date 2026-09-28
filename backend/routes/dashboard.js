// FILE: backend/routes/dashboard.js
// Returns KPIs for the dashboard home page
const express = require('express');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    // This month's revenue
    const [[rev]]  = await db.execute("SELECT COALESCE(SUM(total_amount),0) AS total FROM sales WHERE MONTH(sale_date)=MONTH(NOW()) AND YEAR(sale_date)=YEAR(NOW())");
    // This month's expenses
    const [[exp]]  = await db.execute("SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE MONTH(expense_date)=MONTH(NOW()) AND YEAR(expense_date)=YEAR(NOW())");
    // Outstanding invoices
    const [[outs]] = await db.execute("SELECT COALESCE(SUM(total_amount - paid_amount),0) AS total FROM invoices WHERE status NOT IN ('paid','cancelled')");
    // Low stock products
    const [lowStock] = await db.execute("SELECT id, name, sku, stock_quantity, min_stock FROM products WHERE stock_quantity <= min_stock AND is_active=TRUE ORDER BY stock_quantity ASC");
    // Total customers
    const [[custs]] = await db.execute("SELECT COUNT(*) AS total FROM customers");
    // Recent sales (last 5)
    const [recentSales] = await db.execute("SELECT s.id, s.sale_number, s.sale_date, s.total_amount, s.payment_status, c.name AS customer_name FROM sales s LEFT JOIN customers c ON s.customer_id=c.id ORDER BY s.created_at DESC LIMIT 5");
    // Monthly revenue for chart (last 6 months)
    const [monthly] = await db.execute(`
      SELECT DATE_FORMAT(sale_date,'%b %Y') AS month,
             SUM(total_amount) AS revenue
      FROM sales
      WHERE sale_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(sale_date,'%b %Y')
      ORDER BY MIN(sale_date)
    `);

    res.json({
      kpis: {
        monthlyRevenue:    parseFloat(rev.total),
        monthlyExpenses:   parseFloat(exp.total),
        monthlyProfit:     parseFloat(rev.total) - parseFloat(exp.total),
        outstandingAmount: parseFloat(outs.total),
        totalCustomers:    custs.total,
        lowStockCount:     lowStock.length
      },
      lowStockProducts: lowStock,
      recentSales,
      monthlyChart: monthly
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
