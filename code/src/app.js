// app.js - ประกอบ Express app (แยกจาก server.js เพื่อให้ชุดทดสอบเรียกใช้ได้โดยไม่ต้องเปิด port)
require('dotenv').config();
const path = require('path');
const express = require('express');
const { authenticate } = require('./middleware/auth');
const { AppError } = require('./utils/errors');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// header ความปลอดภัยพื้นฐาน
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  });
  next();
});

// หน้าเว็บ (Presentation Layer)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API — ทุกเส้นทางยกเว้น /api/auth/login ต้อง login ก่อน
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/branches', authenticate, require('./routes/branchRoutes'));
app.use('/api/menu', authenticate, require('./routes/menuRoutes'));
app.use('/api/orders', authenticate, require('./routes/orderRoutes'));
app.use('/api/reports', authenticate, require('./routes/reportRoutes'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'ไม่พบ endpoint นี้' });
});

// Error handler กลาง: แปลง error เป็น JSON ที่หน้าจอนำไปแสดงได้
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป' });
  }
  // MySQL 3819 / MariaDB 4025 = ละเมิด CHECK constraint
  if (err.errno === 3819 || err.errno === 4025) {
    return res.status(400).json({ error: 'ข้อมูลไม่ผ่านเงื่อนไขของฐานข้อมูล' });
  }
  console.error(err);
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
});

module.exports = app;
