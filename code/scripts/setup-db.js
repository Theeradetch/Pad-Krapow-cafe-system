// scripts/setup-db.js - สร้างฐานข้อมูลใหม่จาก db/schema.sql และใส่ข้อมูลตั้งต้น
//   npm run db:setup        -> โครงสร้าง + ข้อมูลตั้งต้น (สาขา หมวดหมู่ เมนู พนักงาน)
//   npm run db:setup:demo   -> เพิ่มออเดอร์ย้อนหลัง 45 วัน สำหรับทดลองหน้ารายงาน
// คำเตือน: สคริปต์นี้ "ลบ" ฐานข้อมูลชื่อตาม DB_NAME แล้วสร้างใหม่
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'pad_krapow_cafe';

const BRANCHES = [
  ['สาขาหน้ามหาวิทยาลัย', '169 ถ.ลงหาดบางแสน ต.แสนสุข อ.เมือง จ.ชลบุรี'],
  ['สาขาตัวเมือง', '99 ถ.สุขุมวิท ต.บางปลาสร้อย อ.เมือง จ.ชลบุรี'],
];
const CATEGORIES = ['เครื่องดื่ม', 'ขนมหวาน', 'เบเกอรี่', 'อื่นๆ'];

// [ชื่อ, หมวด(1-based), ราคา, สต็อกสาขา1, สต็อกสาขา2, ขั้นต่ำ]
const MENUS = [
  ['Latte', 1, 45, 40, 35, 10],
  ['Cappuccino', 1, 45, 30, 28, 10],
  ['Mocha', 1, 50, 20, 18, 10],
  ['Espresso', 1, 35, 8, 22, 10],
  ['ชาเขียวเย็น', 1, 45, 25, 30, 10],
  ['โกโก้เย็น', 1, 40, 0, 15, 10],
  ['เค้กช็อกโกแลต', 2, 65, 6, 10, 5],
  ['บราวนี่', 2, 45, 15, 12, 5],
  ['ครัวซองต์', 3, 55, 12, 9, 5],
  ['น้ำเปล่า', 4, 10, 50, 40, 10],
];

// รหัสผ่านตั้งต้นสำหรับทดลองระบบเท่านั้น ควรเปลี่ยนก่อนใช้งานจริง
const EMPLOYEES = [
  [1, 'นีโม่ (เจ้าของร้าน)', 'owner', 'owner', 'Owner@1234'],
  [1, 'แจม', 'barista', 'barista1', 'Barista@1234'],
  [2, 'นิค', 'barista', 'barista2', 'Barista@1234'],
];

function loadSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  // ตัดคำสั่ง CREATE DATABASE / USE ออก เพราะสคริปต์กำหนดชื่อฐานข้อมูลจาก .env เอง
  return sql
    .split('\n')
    .filter((line) => !/^\s*(CREATE DATABASE|USE)\b/i.test(line) && !/^\s*CHARACTER SET/i.test(line))
    .join('\n');
}

// ตัวสุ่มแบบกำหนด seed ได้ ให้ข้อมูลตัวอย่างออกมาเหมือนเดิมทุกครั้ง
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function bangkokDate(daysAgo) {
  const now = new Date(Date.now() + 7 * 3600 * 1000 - daysAgo * 86400000);
  return now.toISOString().slice(0, 10);
}

async function insertDemoOrders(conn) {
  const rand = seededRandom(42);
  const [menus] = await conn.query('SELECT menu_id, branch_id, price, is_active FROM menu_item');
  const [emps] = await conn.query('SELECT employee_id, branch_id FROM employee');
  const sold = new Map();
  let count = 0;

  for (let day = 45; day >= 1; day -= 1) {
    const date = bangkokDate(day);
    for (const branchId of [1, 2]) {
      const branchMenus = menus.filter((m) => m.branch_id === branchId);
      const staff = emps.filter((e) => e.branch_id === branchId);
      const ordersToday = 6 + Math.floor(rand() * 10);
      for (let n = 0; n < ordersToday; n += 1) {
        const hour = 7 + Math.floor(rand() * 11);
        const minute = Math.floor(rand() * 60);
        const createdAt = `${date} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        const lines = new Map();
        const lineCount = 1 + Math.floor(rand() * 3);
        for (let l = 0; l < lineCount; l += 1) {
          // ให้เมนูต้น ๆ (กาแฟ) ขายดีกว่า
          const idx = Math.min(branchMenus.length - 1, Math.floor(rand() * rand() * branchMenus.length));
          const m = branchMenus[idx];
          lines.set(m.menu_id, (lines.get(m.menu_id) || 0) + 1 + Math.floor(rand() * 2));
        }
        let total = 0;
        for (const [menuId, qty] of lines) {
          total += menus.find((m) => m.menu_id === menuId).price * qty;
        }
        const payment = ['cash', 'transfer', 'promptpay'][Math.floor(rand() * 3)];
        const employee = staff[Math.floor(rand() * staff.length)];
        const [res] = await conn.query(
          'INSERT INTO orders (branch_id, employee_id, payment_method, total_amount, created_at) VALUES (?, ?, ?, ?, ?)',
          [branchId, employee.employee_id, payment, total, createdAt]
        );
        for (const [menuId, qty] of lines) {
          const price = menus.find((m) => m.menu_id === menuId).price;
          await conn.query(
            'INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
            [res.insertId, menuId, qty, price]
          );
          await conn.query(
            "INSERT INTO stock_movement (menu_id, order_id, quantity_change, reason, moved_at) VALUES (?, ?, ?, 'sale', ?)",
            [menuId, res.insertId, -qty, createdAt]
          );
          sold.set(menuId, (sold.get(menuId) || 0) + qty);
        }
        count += 1;
      }
    }
  }

  // ปรับประวัติการเติมสต็อกตั้งต้นให้ (เติม - ขาย) = สต็อกปัจจุบัน
  const firstDay = `${bangkokDate(46)} 06:00:00`;
  await conn.query("DELETE FROM stock_movement WHERE reason = 'restock'");
  for (const m of menus) {
    const [[row]] = await conn.query('SELECT stock_quantity FROM menu_item WHERE menu_id = ?', [m.menu_id]);
    const restock = row.stock_quantity + (sold.get(m.menu_id) || 0);
    if (restock > 0) {
      await conn.query(
        "INSERT INTO stock_movement (menu_id, quantity_change, reason, moved_at) VALUES (?, ?, 'restock', ?)",
        [m.menu_id, restock, firstDay]
      );
    }
  }
  return count;
}

async function main() {
  const demo = process.argv.includes('--demo');
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME ใช้ได้เฉพาะ a-z, 0-9 และ _');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    timezone: '+07:00',
  });

  try {
    console.log(`สร้างฐานข้อมูล ${DB_NAME} ใหม่ ...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    await conn.query(
      `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${DB_NAME}\``);
    await conn.query("SET time_zone = '+07:00'");
    await conn.query(loadSchema());

    await conn.query('INSERT INTO branch (name, address) VALUES ?', [BRANCHES]);
    await conn.query('INSERT INTO category (name) VALUES ?', [CATEGORIES.map((c) => [c])]);

    for (const [branchId, name, role, username, password] of EMPLOYEES) {
      const hash = await bcrypt.hash(password, 10);
      await conn.query(
        'INSERT INTO employee (branch_id, name, role, username, password_hash) VALUES (?, ?, ?, ?, ?)',
        [branchId, name, role, username, hash]
      );
    }

    for (const branchId of [1, 2]) {
      for (const [name, categoryId, price, stock1, stock2, threshold] of MENUS) {
        const stock = branchId === 1 ? stock1 : stock2;
        const [res] = await conn.query(
          `INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity, low_stock_threshold)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [branchId, categoryId, name, price, stock, threshold]
        );
        if (stock > 0) {
          await conn.query(
            "INSERT INTO stock_movement (menu_id, quantity_change, reason) VALUES (?, ?, 'restock')",
            [res.insertId, stock]
          );
        }
      }
    }

    if (demo) {
      const n = await insertDemoOrders(conn);
      console.log(`เพิ่มออเดอร์ตัวอย่างย้อนหลัง ${n} รายการ`);
    }

    console.log('เสร็จแล้ว บัญชีสำหรับทดลอง:');
    for (const [, name, role, username, password] of EMPLOYEES) {
      console.log(`  ${username.padEnd(9)} / ${password.padEnd(13)} (${role}: ${name})`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('ตั้งค่าฐานข้อมูลไม่สำเร็จ:', err.message);
  process.exit(1);
});
