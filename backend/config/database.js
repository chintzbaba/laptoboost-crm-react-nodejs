// ============================================================
// FILE: backend/config/database.js
// PURPOSE: MySQL connection pool
// ============================================================
const mysql2 = require('mysql2');
require('dotenv').config();

const pool = mysql2.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            process.env.DB_PORT     || 3306,
  user:            process.env.DB_USER     || 'chintan',
  password:        process.env.DB_PASSWORD || 'Approval#234',
  database:        process.env.DB_NAME     || 'laptopboost_crm',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
});

const promisePool = pool.promise();

// Test connection when server starts
async function testConnection() {
  try {
    const conn = await promisePool.getConnection();
    console.log('✅ MySQL connected successfully!');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   DB  : ${process.env.DB_NAME || 'laptopboost_crm'}`);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection FAILED:', err.message);
    console.error('   → Check your .env DB_USER, DB_PASSWORD, DB_NAME');
    process.exit(1); // stop the server — no point running without a DB
  }
}

testConnection();
module.exports = promisePool;
