// orderModel.js - จัดการข้อมูลตาราง orders และ order_item
const db = require('../config/db');

class OrderModel {
  // บันทึกออเดอร์ใหม่พร้อมรายการสินค้า
  static async createOrder(branchId, employeeId, paymentMethod, items) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. เพิ่มข้อมูลลงตาราง orders
      const [orderResult] = await connection.query(
        'INSERT INTO orders (branch_id, employee_id, payment_method) VALUES (?, ?, ?)',
        [branchId, employeeId, paymentMethod]
      );
      const orderId = orderResult.insertId;

      // 2. เพิ่มรายการสินค้าลง order_item และตัดสต็อก
      for (const item of items) {
        await connection.query(
          'INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [orderId, item.menuId, item.quantity, item.unitPrice]
        );

        await connection.query(
          'UPDATE menu_item SET stock_quantity = stock_quantity - ? WHERE menu_id = ?',
          [item.quantity, item.menuId]
        );
      }

      await connection.commit();
      return orderId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = OrderModel;