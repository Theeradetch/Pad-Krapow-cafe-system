// unit.test.js - ทดสอบ domain class และฟังก์ชันตรวจข้อมูล (ไม่ต้องใช้ฐานข้อมูล)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Order, OrderItem } = require('../src/models/Order');
const v = require('../src/utils/validate');

test('OrderItem.getSubtotal คิดเงินถูกต้องและไม่มีปัญหาทศนิยม', () => {
  assert.equal(new OrderItem(1, 2, 45).getSubtotal(), 90);
  assert.equal(new OrderItem(1, 3, 0.1).getSubtotal(), 0.3); // 0.1*3 ใน JS ปกติ = 0.30000000000000004
  assert.equal(new OrderItem(1, 3, 19.99).getSubtotal(), 59.97);
});

test('Order.addItem รวมเมนูซ้ำ และ calculateTotal รวมยอดถูกต้อง', () => {
  const o = new Order();
  o.addItem(1, 2, 45);
  o.addItem(3, 1, 50);
  o.addItem(1, 1, 45);
  assert.equal(o.items.length, 2);
  assert.equal(o.items[0].quantity, 3);
  assert.equal(o.calculateTotal(), 185);
});

test('Order.removeItem ลบตาม index และไม่พังเมื่อ index ไม่ถูกต้อง', () => {
  const o = new Order();
  o.addItem(1, 1, 45);
  o.addItem(2, 1, 50);
  assert.equal(o.removeItem(5), false);
  assert.equal(o.removeItem(0), true);
  assert.deepEqual(o.items.map((i) => i.menuId), [2]);
  assert.equal(o.calculateTotal(), 50);
});

test('toPositiveInt รับเฉพาะจำนวนเต็มบวก', () => {
  assert.equal(v.toPositiveInt(3, 'x'), 3);
  assert.equal(v.toPositiveInt('7', 'x'), 7);
  for (const bad of [0, -1, 1.5, '1.5', 'abc', '', null, undefined, true, [1], {}]) {
    assert.throws(() => v.toPositiveInt(bad, 'x'), { status: 400 }, `ค่า ${JSON.stringify(bad)} ควรไม่ผ่าน`);
  }
});

test('toDateString ตรวจว่าวันที่มีอยู่จริงในปฏิทิน', () => {
  assert.equal(v.toDateString('2026-02-28', 'd'), '2026-02-28');
  assert.equal(v.toDateString('2028-02-29', 'd'), '2028-02-29'); // ปีอธิกสุรทิน
  for (const bad of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '30/10/2026', 'abc']) {
    assert.throws(() => v.toDateString(bad, 'd'), { status: 400 }, bad);
  }
});

test('toPrice ไม่รับค่าติดลบหรือทศนิยมเกิน 2 ตำแหน่ง', () => {
  assert.equal(v.toPrice(45), 45);
  assert.equal(v.toPrice('45.50'), 45.5);
  for (const bad of [-1, 1.234, 'abc', null, 100000]) {
    assert.throws(() => v.toPrice(bad), { status: 400 }, String(bad));
  }
});

test('addDays ข้ามเดือน/ปีได้ถูกต้อง', () => {
  assert.equal(v.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(v.addDays('2026-12-31', 1), '2027-01-01');
});

test('schema ใน code/db กับ docs/wk07-schema.sql ต้องตรงกัน', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'wk07-schema.sql'), 'utf8');
  assert.equal(a, b);
});
