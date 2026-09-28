// ============================================================
// FILE: backend/server.js   ← This is where everything starts
// RUN:  npm run dev
// ============================================================
require('dotenv').config();          // load .env FIRST

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

// ── Database connection (also tests the connection on startup)
const db = require('./config/database');

// ── Route files  (one per CRM module)
const authRoutes      = require('./routes/auth');
const customerRoutes  = require('./routes/customers');
const supplierRoutes  = require('./routes/suppliers');
const productRoutes   = require('./routes/products');
const salesRoutes     = require('./routes/sales');
const purchaseRoutes  = require('./routes/purchases');
const invoiceRoutes   = require('./routes/invoices');
const paymentRoutes   = require('./routes/payments');
const expenseRoutes   = require('./routes/expenses');
const dashboardRoutes = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET','POST','PUT','DELETE','PATCH'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 200 }));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/sales',     salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/invoices',  invoiceRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/expenses',  expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health check  →  http://localhost:5000/api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'LaptoBoost CRM API is running!', time: new Date() });
});

// ── 404
app.use((req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found` }));

// ── Global error handler (4 params = error handler in Express)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      LaptoBoost CRM - Backend Server     ║');
  console.log(`║  ✅  http://localhost:${PORT}               ║`);
  console.log(`║  🌍  Environment: ${process.env.NODE_ENV || 'development'}           ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
