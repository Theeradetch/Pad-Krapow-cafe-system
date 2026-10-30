// test/helpers.js - เตรียมฐานข้อมูลทดสอบแยกจากของจริง แล้วคืน app + ฟังก์ชันช่วย login
// ชุดทดสอบนี้ต้องมี MySQL/MariaDB ทำงานอยู่ และใช้บัญชีตาม .env (ฐานข้อมูลชื่อ *_test จะถูกลบ/สร้างใหม่)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { execFileSync } = require('child_process');

process.env.NODE_ENV = 'test';
process.env.DB_NAME = `${process.env.DB_NAME || 'pad_krapow_cafe'}_test`;

function resetDatabase() {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'setup-db.js')], {
    env: process.env,
    stdio: 'pipe',
  });
}

resetDatabase();

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { _resetLoginFailures } = require('../src/controllers/authController');

async function login(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login ${username} failed: ${res.status}`);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function stockOf(menuId) {
  const [[row]] = await db.query('SELECT stock_quantity FROM menu_item WHERE menu_id = ?', [menuId]);
  return row.stock_quantity;
}

async function count(table) {
  const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(row.n);
}

module.exports = { app, db, request, login, auth, stockOf, count, resetDatabase, _resetLoginFailures };
