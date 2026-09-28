// ============================================================
// FILE: backend/middleware/auth.js
// PURPOSE: Verify JWT tokens on protected routes
// ============================================================
const jwt = require('jsonwebtoken');

// Attach this to any route you want to protect
const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Token missing' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    const msg = e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: msg });
  }
};

// Use after verifyToken when the route needs admin access
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
};

module.exports = { verifyToken, requireAdmin };
