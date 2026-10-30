// api.test.js - ทดสอบ API กับฐานข้อมูลจริง (MySQL/MariaDB) ตาม Acceptance Criteria ใน wk04
// ข้อมูลตั้งต้น (scripts/setup-db.js):
//   สาขา 1: menuId 1-10  (1 Latte 45฿ สต็อก 40, 3 Mocha 50฿ สต็อก 20, 4 Espresso 35฿ สต็อก 8,
//                         6 โกโก้เย็น สต็อก 0, 7 เค้กช็อกโกแลต 65฿ สต็อก 6 ขั้นต่ำ 5)
//   สาขา 2: menuId 11-20
//   พนักงาน: 1 owner (สาขา 1), 2 barista1 (สาขา 1), 3 barista2 (สาขา 2)
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, login, auth, stockOf, count, resetDatabase, _resetLoginFailures } = require('./helpers');

let owner;
let barista1;
let barista2;

test.before(async () => {
  owner = await login('owner', 'Owner@1234');
  barista1 = await login('barista1', 'Barista@1234');
  barista2 = await login('barista2', 'Barista@1234');
});

test.after(async () => {
  await db.end();
});

// ---------------------------------------------------------------- Auth
test.describe('การเข้าสู่ระบบและสิทธิ์ (NFR-03, ความปลอดภัย)', () => {
  test('TC-01 login ถูกต้องได้ token และข้อมูลผู้ใช้ ไม่ส่ง password hash กลับมา', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'barista1', password: 'Barista@1234' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'barista');
    assert.equal(res.body.user.branchId, 1);
    assert.equal(JSON.stringify(res.body).includes('$2'), false);
  });

  test('TC-02 รหัสผ่านผิด/ไม่มีผู้ใช้ ได้ 401 ข้อความเดียวกัน (ไม่บอกว่าผิดที่ช่องไหน)', async () => {
    const a = await request(app).post('/api/auth/login').send({ username: 'barista1', password: 'nope' });
    const b = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'nope' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error);
  });

  test('TC-03 รหัสผ่านในฐานข้อมูลเก็บเป็น bcrypt hash', async () => {
    const [rows] = await db.query('SELECT password_hash FROM employee');
    for (const r of rows) assert.match(r.password_hash, /^\$2[aby]\$10\$/);
  });

  test('TC-04 ใส่รหัสผิดเกิน 5 ครั้ง ถูกพักชั่วคราว (429) แม้รหัสครั้งต่อไปจะถูก', async () => {
    _resetLoginFailures();
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ username: 'barista2', password: 'wrong' });
    }
    const res = await request(app).post('/api/auth/login').send({ username: 'barista2', password: 'Barista@1234' });
    assert.equal(res.status, 429);
    _resetLoginFailures();
  });

  test('TC-05 เรียก API โดยไม่มี token หรือ token ปลอม ได้ 401', async () => {
    assert.equal((await request(app).get('/api/menu')).status, 401);
    const res = await request(app).get('/api/menu').set('Authorization', 'Bearer abc.def.ghi');
    assert.equal(res.status, 401);
  });

  test('TC-06 บาริสต้าดูข้อมูลสาขาอื่นไม่ได้ (กัน IDOR) ทั้งเมนู ออเดอร์ และรายงาน', async () => {
    assert.equal((await request(app).get('/api/menu?branchId=2').set(auth(barista1))).status, 403);
    assert.equal((await request(app).get('/api/reports/sales?branchId=2').set(auth(barista1))).status, 403);
    assert.equal((await request(app).get('/api/menu/11').set(auth(barista1))).status, 403);
    const res = await request(app).post('/api/orders').set(auth(barista1))
      .send({ branchId: 2, paymentMethod: 'cash', items: [{ menuId: 11, quantity: 1 }] });
    assert.equal(res.status, 403);
  });

  test('TC-07 เจ้าของร้านดูได้ทุกสาขา แต่สาขาที่ไม่มีอยู่ได้ 404', async () => {
    const res = await request(app).get('/api/menu?branchId=2').set(auth(owner));
    assert.equal(res.status, 200);
    assert.ok(res.body.items.every((m) => m.branchId === 2));
    assert.equal((await request(app).get('/api/menu?branchId=99').set(auth(owner))).status, 404);
  });

  test('TC-08 บาริสต้าเห็นเฉพาะสาขาตัวเองในรายชื่อสาขา', async () => {
    const res = await request(app).get('/api/branches').set(auth(barista2));
    assert.deepEqual(res.body.branches.map((b) => b.branchId), [2]);
    const all = await request(app).get('/api/branches').set(auth(owner));
    assert.equal(all.body.branches.length, 2);
  });
});

// ---------------------------------------------------------------- Orders
test.describe('สร้างออเดอร์ (US-01 ถึง US-05, Sequence Diagram wk09)', () => {
  test('TC-10 สร้างออเดอร์สำเร็จ: 201, ยอดรวมถูก, ตัดสต็อก, บันทึก order_item และ stock_movement', async () => {
    const latteBefore = await stockOf(1);
    const mochaBefore = await stockOf(3);
    const res = await request(app).post('/api/orders').set(auth(barista1)).send({
      paymentMethod: 'cash',
      items: [{ menuId: 1, quantity: 2 }, { menuId: 3, quantity: 1 }],
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.totalAmount, 140);
    assert.equal(await stockOf(1), latteBefore - 2);
    assert.equal(await stockOf(3), mochaBefore - 1);

    const order = await request(app).get(`/api/orders/${res.body.orderId}`).set(auth(barista1));
    assert.equal(order.status, 200);
    assert.equal(order.body.paymentMethod, 'cash');
    assert.equal(order.body.employeeName, 'แจม');
    assert.equal(order.body.items.length, 2);

    const [moves] = await db.query(
      "SELECT menu_id, quantity_change FROM stock_movement WHERE order_id = ? AND reason = 'sale' ORDER BY menu_id",
      [res.body.orderId]
    );
    assert.deepEqual(moves.map((m) => [m.menu_id, m.quantity_change]), [[1, -2], [3, -1]]);
  });

  test('TC-11 รองรับวิธีชำระเงินทั้ง 3 แบบ และปฏิเสธแบบอื่น (US-04)', async () => {
    for (const pm of ['cash', 'transfer', 'promptpay']) {
      const res = await request(app).post('/api/orders').set(auth(barista1))
        .send({ paymentMethod: pm, items: [{ menuId: 10, quantity: 1 }] });
      assert.equal(res.status, 201, pm);
    }
    for (const pm of ['credit', '', null, undefined]) {
      const res = await request(app).post('/api/orders').set(auth(barista1))
        .send({ paymentMethod: pm, items: [{ menuId: 10, quantity: 1 }] });
      assert.equal(res.status, 400, String(pm));
    }
  });

  test('TC-12 เมนูซ้ำในออเดอร์ถูกรวมเป็นรายการเดียว', async () => {
    const res = await request(app).post('/api/orders').set(auth(barista1)).send({
      paymentMethod: 'cash',
      items: [{ menuId: 2, quantity: 1 }, { menuId: 2, quantity: 2 }],
    });
    assert.equal(res.status, 201);
    const order = await request(app).get(`/api/orders/${res.body.orderId}`).set(auth(barista1));
    assert.equal(order.body.items.length, 1);
    assert.equal(order.body.items[0].quantity, 3);
    assert.equal(order.body.totalAmount, 135);
  });

  test('TC-13 ไม่เชื่อราคาที่ส่งมาจากหน้าจอ ใช้ราคาจากฐานข้อมูลเสมอ', async () => {
    const res = await request(app).post('/api/orders').set(auth(barista1)).send({
      paymentMethod: 'cash',
      items: [{ menuId: 1, quantity: 1, unitPrice: 1 }],
      totalAmount: 1,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.totalAmount, 45);
  });

  test('TC-14 ไม่เชื่อ employeeId จาก body ใช้คนที่ login อยู่', async () => {
    const res = await request(app).post('/api/orders').set(auth(barista1))
      .send({ employeeId: 1, paymentMethod: 'cash', items: [{ menuId: 10, quantity: 1 }] });
    const [[row]] = await db.query('SELECT employee_id FROM orders WHERE order_id = ?', [res.body.orderId]);
    assert.equal(row.employee_id, 2);
  });

  test('TC-15 สต็อกไม่พอ: 400, ไม่มีออเดอร์ถูกบันทึก และสต็อกทุกเมนูไม่เปลี่ยน (rollback)', async () => {
    const ordersBefore = await count('orders');
    const latteBefore = await stockOf(1);
    const res = await request(app).post('/api/orders').set(auth(barista1)).send({
      paymentMethod: 'cash',
      items: [{ menuId: 1, quantity: 1 }, { menuId: 6, quantity: 1 }], // โกโก้เย็นหมด
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /สต็อกไม่เพียงพอ/);
    assert.equal(res.body.details.shortages[0].menuId, 6);
    assert.equal(await count('orders'), ordersBefore);
    assert.equal(await stockOf(1), latteBefore);
  });

  test('TC-16 ข้อมูลนำเข้าไม่ถูกต้องได้ 400 ทุกกรณี', async () => {
    const bad = [
      {},
      { paymentMethod: 'cash' },
      { paymentMethod: 'cash', items: [] },
      { paymentMethod: 'cash', items: 'x' },
      { paymentMethod: 'cash', items: [null] },
      { paymentMethod: 'cash', items: [{ menuId: 1, quantity: 0 }] },
      { paymentMethod: 'cash', items: [{ menuId: 1, quantity: -2 }] },
      { paymentMethod: 'cash', items: [{ menuId: 1, quantity: 1.5 }] },
      { paymentMethod: 'cash', items: [{ menuId: 'abc', quantity: 1 }] },
      { paymentMethod: 'cash', items: [{ menuId: 1, quantity: 101 }] },
      { paymentMethod: 'cash', items: [{ menuId: 1, quantity: 60 }, { menuId: 1, quantity: 60 }] },
      { paymentMethod: 'cash', items: Array.from({ length: 51 }, () => ({ menuId: 1, quantity: 1 })) },
    ];
    for (const body of bad) {
      const res = await request(app).post('/api/orders').set(auth(barista1)).send(body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
      assert.ok(res.body.error);
    }
  });

  test('TC-17 JSON เสียได้ 400 ไม่ใช่ 500', async () => {
    const res = await request(app).post('/api/orders').set(auth(barista1))
      .set('Content-Type', 'application/json').send('{"items": [');
    assert.equal(res.status, 400);
  });

  test('TC-18 สั่งเมนูของสาขาอื่น หรือเมนูที่ไม่มี ได้ 400', async () => {
    for (const menuId of [11, 9999]) {
      const res = await request(app).post('/api/orders').set(auth(barista1))
        .send({ paymentMethod: 'cash', items: [{ menuId, quantity: 1 }] });
      assert.equal(res.status, 400, String(menuId));
    }
  });

  test('TC-19 สต็อกลดต่ำกว่าขั้นต่ำหลังขาย ระบบแจ้ง lowStockMenuIds (US-06 / FR-05)', async () => {
    // เค้กช็อกโกแลต (id 7) สต็อก 6 ขั้นต่ำ 5 -> ขาย 2 เหลือ 4
    const res = await request(app).post('/api/orders').set(auth(barista1))
      .send({ paymentMethod: 'cash', items: [{ menuId: 7, quantity: 2 }, { menuId: 10, quantity: 1 }] });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.lowStockMenuIds, [7]);
    const low = await request(app).get('/api/menu/low-stock').set(auth(barista1));
    assert.ok(low.body.items.some((m) => m.menuId === 7));
    assert.ok(low.body.items.every((m) => m.stockQuantity < m.lowStockThreshold));
  });

  test('TC-20 ขายพร้อมกันหลายเครื่อง สต็อกไม่ติดลบ (race condition)', async () => {
    // ตั้ง Espresso (id 4) ให้เหลือ 3 แล้วยิง 8 ออเดอร์พร้อมกัน ออเดอร์ละ 1
    await db.query('UPDATE menu_item SET stock_quantity = 3 WHERE menu_id = 4');
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      request(app).post('/api/orders').set(auth(barista1))
        .send({ paymentMethod: 'cash', items: [{ menuId: 4, quantity: 1 }] })));
    const ok = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 400).length;
    assert.equal(ok, 3);
    assert.equal(rejected, 5);
    assert.equal(await stockOf(4), 0);
  });

  test('TC-21 ดูใบเสร็จของสาขาอื่นไม่ได้ / ไม่พบออเดอร์ได้ 404', async () => {
    const res = await request(app).post('/api/orders').set(auth(barista2))
      .send({ paymentMethod: 'cash', items: [{ menuId: 11, quantity: 1 }] });
    assert.equal(res.status, 201);
    assert.equal((await request(app).get(`/api/orders/${res.body.orderId}`).set(auth(barista1))).status, 403);
    assert.equal((await request(app).get(`/api/orders/${res.body.orderId}`).set(auth(owner))).status, 200);
    assert.equal((await request(app).get('/api/orders/999999').set(auth(owner))).status, 404);
    assert.equal((await request(app).get('/api/orders/abc').set(auth(owner))).status, 400);
  });
});

// ---------------------------------------------------------------- Menu
test.describe('จัดการเมนูและสต็อก (FR-05, FR-08)', () => {
  test('TC-30 บาริสต้าเพิ่ม/แก้/ลบเมนูไม่ได้ (403)', async () => {
    const body = { name: 'X', categoryId: 1, price: 10 };
    assert.equal((await request(app).post('/api/menu').set(auth(barista1)).send(body)).status, 403);
    assert.equal((await request(app).patch('/api/menu/1').set(auth(barista1)).send({ price: 1 })).status, 403);
    assert.equal((await request(app).delete('/api/menu/1').set(auth(barista1))).status, 403);
  });

  test('TC-31 เจ้าของร้านเพิ่มเมนูได้ และสต็อกเริ่มต้นถูกบันทึกใน stock_movement', async () => {
    const res = await request(app).post('/api/menu').set(auth(owner))
      .send({ branchId: 1, categoryId: 1, name: 'ชาไทยเย็น', price: 40, stockQuantity: 15 });
    assert.equal(res.status, 201);
    assert.equal(res.body.stockQuantity, 15);
    assert.equal(res.body.lowStockThreshold, 10);
    const [[mv]] = await db.query("SELECT quantity_change FROM stock_movement WHERE menu_id = ? AND reason = 'restock'", [res.body.menuId]);
    assert.equal(mv.quantity_change, 15);
  });

  test('TC-32 ข้อมูลเมนูไม่ถูกต้องได้ 400', async () => {
    const bad = [
      { categoryId: 1, price: 10 },
      { name: '  ', categoryId: 1, price: 10 },
      { name: 'A', categoryId: 99, price: 10 },
      { name: 'A', categoryId: 1, price: -5 },
      { name: 'A', categoryId: 1, price: 'abc' },
      { name: 'A', categoryId: 1, price: 10, stockQuantity: -1 },
      { name: 'x'.repeat(101), categoryId: 1, price: 10 },
    ];
    for (const body of bad) {
      const res = await request(app).post('/api/menu').set(auth(owner)).send(body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    }
  });

  test('TC-33 แก้ไขเมนูบาง field ได้ และห้ามแก้สต็อกตรง ๆ', async () => {
    const res = await request(app).patch('/api/menu/2').set(auth(owner)).send({ price: 50, lowStockThreshold: 12 });
    assert.equal(res.status, 200);
    assert.equal(res.body.price, 50);
    assert.equal(res.body.lowStockThreshold, 12);
    assert.equal(res.body.name, 'Cappuccino');
    const stock = await request(app).patch('/api/menu/2').set(auth(owner)).send({ stockQuantity: 999 });
    assert.equal(stock.status, 400);
    const empty = await request(app).patch('/api/menu/2').set(auth(owner)).send({});
    assert.equal(empty.status, 400);
  });

  test('TC-34 เติมสต็อกได้ทุกบทบาท ปรับลดจนติดลบไม่ได้ และมีประวัติ', async () => {
    const before = await stockOf(5);
    const up = await request(app).patch('/api/menu/5/stock').set(auth(barista1)).send({ change: 10 });
    assert.equal(up.status, 200);
    assert.equal(up.body.stockQuantity, before + 10);
    const down = await request(app).patch('/api/menu/5/stock').set(auth(barista1))
      .send({ change: -(before + 11), reason: 'adjust' });
    assert.equal(down.status, 400);
    assert.equal(await stockOf(5), before + 10);
    for (const body of [{ change: 0 }, { change: 1.5 }, { change: '5' }, { change: 5, reason: 'sale' }]) {
      const res = await request(app).patch('/api/menu/5/stock').set(auth(barista1)).send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    const [[mv]] = await db.query(
      "SELECT COUNT(*) AS n FROM stock_movement WHERE menu_id = 5 AND reason = 'restock' AND quantity_change = 10"
    );
    assert.equal(Number(mv.n), 1);
  });

  test('TC-35 ลบเมนูแบบ soft delete: หายจากหน้าขาย สั่งไม่ได้ แต่รายงานยังมียอดขายเดิม', async () => {
    const sold = await request(app).post('/api/orders').set(auth(barista1))
      .send({ paymentMethod: 'cash', items: [{ menuId: 9, quantity: 1 }] });
    assert.equal(sold.status, 201);
    assert.equal((await request(app).delete('/api/menu/9').set(auth(owner))).status, 204);

    const menu = await request(app).get('/api/menu').set(auth(barista1));
    assert.equal(menu.body.items.some((m) => m.menuId === 9), false);
    const order = await request(app).post('/api/orders').set(auth(barista1))
      .send({ paymentMethod: 'cash', items: [{ menuId: 9, quantity: 1 }] });
    assert.equal(order.status, 400);
    const report = await request(app).get('/api/reports/sales').set(auth(owner));
    assert.ok(report.body.items.some((i) => i.menuId === 9));
  });
});

// ---------------------------------------------------------------- Reports
test.describe('รายงานยอดขาย (FR-06, FR-07, US-07, US-08)', () => {
  test.before(async () => {
    resetDatabase();
    // สร้างข้อมูลที่รู้ค่าแน่นอน: ออเดอร์ย้อนหลังในวันที่กำหนด
    const rows = [
      // [branch, employee, date, items[[menuId, qty, price]]]
      [1, 2, '2026-09-01 08:00:00', [[1, 2, 45], [3, 1, 50]]], // 140
      [1, 2, '2026-09-01 23:59:59', [[1, 1, 45]]], // 45 (ปลายวัน ต้องนับในวันที่ 1)
      [1, 2, '2026-09-02 00:00:00', [[2, 3, 45]]], // 135 (ต้นวัน ต้องนับในวันที่ 2)
      [1, 2, '2026-09-30 12:00:00', [[4, 4, 35], [5, 1, 45], [7, 1, 65], [8, 1, 45], [9, 1, 55], [10, 1, 10]]], // 360
      [1, 2, '2026-10-01 09:00:00', [[1, 10, 45]]], // เดือนอื่น
      [2, 3, '2026-09-01 10:00:00', [[11, 5, 45]]], // สาขาอื่น
    ];
    for (const [branchId, employeeId, at, items] of rows) {
      const total = items.reduce((s, [, q, p]) => s + q * p, 0);
      const [res] = await db.query(
        "INSERT INTO orders (branch_id, employee_id, payment_method, total_amount, created_at) VALUES (?, ?, 'cash', ?, ?)",
        [branchId, employeeId, total, at]
      );
      for (const [menuId, q, p] of items) {
        await db.query('INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [res.insertId, menuId, q, p]);
      }
    }
    _resetLoginFailures();
    owner = await login('owner', 'Owner@1234');
    barista1 = await login('barista1', 'Barista@1234');
  });

  test('TC-40 รายงานรายวัน: ยอดรวม จำนวนออเดอร์ ค่าเฉลี่ย และยอดแยกเมนูถูกต้อง', async () => {
    const res = await request(app).get('/api/reports/sales?from=2026-09-01&to=2026-09-01').set(auth(barista1));
    assert.equal(res.status, 200);
    assert.equal(res.body.totalSales, 185);
    assert.equal(res.body.orderCount, 2);
    assert.equal(res.body.averagePerOrder, 92.5);
    assert.deepEqual(res.body.items.map((i) => [i.name, i.quantitySold, i.sales]), [
      ['Latte', 3, 135],
      ['Mocha', 1, 50],
    ]);
  });

  test('TC-41 ขอบวัน: 23:59:59 นับวันนั้น, 00:00:00 นับวันถัดไป และกรองตามสาขา', async () => {
    const d2 = await request(app).get('/api/reports/sales?from=2026-09-02&to=2026-09-02').set(auth(owner));
    assert.equal(d2.body.totalSales, 135);
    const b2 = await request(app).get('/api/reports/sales?branchId=2&from=2026-09-01&to=2026-09-01').set(auth(owner));
    assert.equal(b2.body.totalSales, 225);
  });

  test('TC-42 รายงานรายเดือน: ยอดทั้งเดือน รายวัน และเมนูขายดี 5 อันดับ', async () => {
    const res = await request(app).get('/api/reports/monthly?month=2026-09').set(auth(owner));
    assert.equal(res.status, 200);
    assert.equal(res.body.totalSales, 680); // 140 + 45 + 135 + 360
    assert.equal(res.body.orderCount, 4);
    assert.deepEqual(res.body.daily.map((d) => [d.date, d.sales]), [
      ['2026-09-01', 185], ['2026-09-02', 135], ['2026-09-30', 360],
    ]);
    assert.equal(res.body.topMenus.length, 5);
    assert.deepEqual(res.body.topMenus.slice(0, 3).map((t) => t.name), ['Espresso', 'Cappuccino', 'Latte']);
  });

  test('TC-43 ช่วงที่ไม่มียอดขาย ได้ 0 ไม่ error', async () => {
    const res = await request(app).get('/api/reports/sales?from=2020-01-01&to=2020-01-31').set(auth(owner));
    assert.equal(res.status, 200);
    assert.equal(res.body.totalSales, 0);
    assert.equal(res.body.averagePerOrder, 0);
    assert.deepEqual(res.body.items, []);
  });

  test('TC-44 วันที่/เดือนไม่ถูกต้องได้ 400', async () => {
    const urls = [
      '/api/reports/sales?from=2026-02-30',
      '/api/reports/sales?from=2026-09-10&to=2026-09-01',
      '/api/reports/sales?from=01/09/2026',
      '/api/reports/sales?from=2024-01-01&to=2026-01-01',
      "/api/reports/sales?from=2026-09-01'%20OR%201=1--",
      '/api/reports/monthly?month=2026-13',
      '/api/reports/monthly?month=2026-9',
    ];
    for (const url of urls) {
      assert.equal((await request(app).get(url).set(auth(owner))).status, 400, url);
    }
  });

  test('TC-45 รายการออเดอร์ของวัน เรียงล่าสุดก่อน', async () => {
    const res = await request(app).get('/api/orders?date=2026-09-01').set(auth(barista1));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.orders.map((o) => o.totalAmount), [45, 140]);
  });
});

test('TC-50 endpoint ที่ไม่มีได้ 404 JSON และมี security header', async () => {
  const res = await request(app).get('/api/nope').set(auth(owner));
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
  const page = await request(app).get('/login.html');
  assert.equal(page.status, 200);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  assert.ok(page.headers['content-security-policy']);
  assert.equal(page.headers['x-powered-by'], undefined);
});
