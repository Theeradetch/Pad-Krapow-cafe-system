// server.js - จุดเริ่มต้นของโปรแกรม: เปิด HTTP server
const app = require('./app');
const db = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await db.query('SELECT 1');
  } catch (err) {
    console.error('เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบค่าในไฟล์ .env และว่ารัน npm run db:setup แล้ว');
    console.error(err.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Pad-Krapow cafe POS กำลังทำงานที่ http://localhost:${PORT}`);
  });
}

start();
