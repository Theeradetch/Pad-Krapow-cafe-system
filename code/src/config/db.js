// config/db.js - สร้าง Connection Pool ไปยัง MySQL (ใช้ร่วมกันทุก Model)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pad_krapow_cafe',
  waitForConnections: true,
  connectionLimit: 10,
  // ร้านอยู่ประเทศไทย: ให้เวลาใน DATETIME เป็นเวลาไทยเสมอ
  timezone: '+07:00',
  // ให้ DECIMAL กลับมาเป็น number ไม่ใช่ string (ป้องกันบั๊ก "45.00" + "50.00")
  decimalNumbers: true,
  dateStrings: true,
});

// ให้ CURRENT_TIMESTAMP ของ MySQL ใช้เวลาไทยด้วย
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+07:00'");
});

module.exports = pool;
