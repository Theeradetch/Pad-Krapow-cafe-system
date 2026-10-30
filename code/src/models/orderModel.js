// orderModel.js - จัดการข้อมูลตาราง orders, order_item และ stock_movement
const db = require('../config/db');
const { Order } = require('./Order');
const { badRequest } = require('../utils/errors');

class OrderModel {
  // บันทึกออเดอร์ใหม่พร้อมรายการสินค้า และตัดสต็อก ภายใน transaction เดียว (ตาม Sequence Diagram wk09)
  // items: [{ menuId, quantity }] ที่ controller ตรวจรูปแบบและรวมเมนูซ้ำมาแล้ว
  // ราคาใช้จากฐานข้อมูลเท่านั้น ไม่เชื่อราคาที่ส่งมาจากหน้าจอ
  static async createOrder(branchId, employeeId, paymentMethod, items) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. ล็อกแถวเมนูที่จะขาย (FOR UPDATE) แล้วอ่านราคาและสต็อก
      //    ORDER BY menu_id เพื่อให้ทุก transaction ล็อกตามลำดับเดียวกัน ลดโอกาส deadlock
      const menuIds = items.map((it) => it.menuId);
      const [menus] = await connection.query(
        `SELECT menu_id, name, price, stock_quantity, low_stock_threshold, is_active
           FROM menu_item
          WHERE menu_id IN (?) AND branch_id = ?
          ORDER BY menu_id
          FOR UPDATE`,
        [menuIds, branchId]
      );
      const menuById = new Map(menus.map((m) => [m.menu_id, m]));

      // 2. ตรวจว่าเมนูมีอยู่ในสาขานี้ ยังขายอยู่ และสต็อกพอทุกรายการ
      const missing = menuIds.filter((id) => !menuById.has(id) || !menuById.get(id).is_active);
      if (missing.length > 0) {
        throw badRequest('ไม่พบเมนูในสาขานี้ หรือเมนูถูกปิดการขายแล้ว', { menuIds: missing });
      }
      const shortages = items
        .filter((it) => menuById.get(it.menuId).stock_quantity < it.quantity)
        .map((it) => {
          const m = menuById.get(it.menuId);
          return { menuId: it.menuId, name: m.name, requested: it.quantity, available: m.stock_quantity };
        });
      if (shortages.length > 0) {
        const names = shortages.map((s) => `${s.name} (เหลือ ${s.available})`).join(', ');
        throw badRequest(`สต็อกไม่เพียงพอ: ${names}`, { shortages });
      }

      // 3. คำนวณยอดรวมด้วย domain class Order
      const order = new Order();
      for (const it of items) {
        const m = menuById.get(it.menuId);
        order.addItem(it.menuId, it.quantity, m.price, m.name);
      }
      const totalAmount = order.calculateTotal();

      // 4. เพิ่มข้อมูลลงตาราง orders
      const [orderResult] = await connection.query(
        'INSERT INTO orders (branch_id, employee_id, payment_method, total_amount) VALUES (?, ?, ?, ?)',
        [branchId, employeeId, paymentMethod, totalAmount]
      );
      const orderId = orderResult.insertId;

      // 5. เพิ่มรายการสินค้าลง order_item ตัดสต็อก และบันทึกประวัติใน stock_movement
      const lowStockMenuIds = [];
      for (const item of order.items) {
        await connection.query(
          'INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [orderId, item.menuId, item.quantity, item.unitPrice]
        );
        await connection.query(
          'UPDATE menu_item SET stock_quantity = stock_quantity - ? WHERE menu_id = ?',
          [item.quantity, item.menuId]
        );
        await connection.query(
          "INSERT INTO stock_movement (menu_id, order_id, quantity_change, reason) VALUES (?, ?, ?, 'sale')",
          [item.menuId, orderId, -item.quantity]
        );
        const m = menuById.get(item.menuId);
        if (m.stock_quantity - item.quantity < m.low_stock_threshold) {
          lowStockMenuIds.push(item.menuId);
        }
      }

      await connection.commit();
      return { orderId, totalAmount, lowStockMenuIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ข้อมูลสำหรับใบเสร็จ
  static async getById(orderId) {
    const [orders] = await db.query(
      `SELECT o.order_id AS orderId, o.branch_id AS branchId, b.name AS branchName,
              o.employee_id AS employeeId, e.name AS employeeName,
              o.payment_method AS paymentMethod, o.total_amount AS totalAmount,
              o.created_at AS createdAt
         FROM orders o
         JOIN branch b ON b.branch_id = o.branch_id
         JOIN employee e ON e.employee_id = o.employee_id
        WHERE o.order_id = ?`,
      [orderId]
    );
    if (orders.length === 0) return null;
    const [items] = await db.query(
      `SELECT oi.menu_id AS menuId, m.name, oi.quantity, oi.unit_price AS unitPrice,
              ROUND(oi.quantity * oi.unit_price, 2) AS subtotal
         FROM order_item oi JOIN menu_item m ON m.menu_id = oi.menu_id
        WHERE oi.order_id = ?
        ORDER BY oi.order_item_id`,
      [orderId]
    );
    return { ...orders[0], items };
  }

  // รายการออเดอร์ของสาขาในวันที่ระบุ (ล่าสุดก่อน)
  static async listByBranchAndDate(branchId, fromDate, toDateExclusive) {
    const [rows] = await db.query(
      `SELECT o.order_id AS orderId, o.payment_method AS paymentMethod,
              o.total_amount AS totalAmount, o.created_at AS createdAt,
              e.name AS employeeName,
              (SELECT SUM(quantity) FROM order_item WHERE order_id = o.order_id) AS itemCount
         FROM orders o JOIN employee e ON e.employee_id = o.employee_id
        WHERE o.branch_id = ? AND o.created_at >= ? AND o.created_at < ?
        ORDER BY o.created_at DESC, o.order_id DESC
        LIMIT 200`,
      [branchId, fromDate, toDateExclusive]
    );
    return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) }));
  }
}

module.exports = OrderModel;
