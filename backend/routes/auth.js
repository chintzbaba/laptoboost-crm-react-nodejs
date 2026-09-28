// ============================================================
// FILE: backend/routes/auth.js
// ENDPOINTS:
//   POST /api/auth/login          → returns JWT token
//   GET  /api/auth/me             → returns current user info
//   POST /api/auth/change-password
// ============================================================
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ── LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── WHO AM I
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── CHANGE PASSWORD
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  try {
    const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const valid  = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
