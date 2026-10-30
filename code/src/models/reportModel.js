// reportModel.js - query สรุปยอดขาย (FR-06 รายวัน / FR-07 รายเดือน)
// ช่วงเวลาใช้แบบ [from, toExclusive) เพื่อให้รวมทุกเวลาในวันสุดท้ายได้ครบ
const db = require('../config/db');

class ReportModel {
  static async getSummary(branchId, from, toExclusive) {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS totalSales, COUNT(*) AS orderCount
         FROM orders
        WHERE branch_id = ? AND created_at >= ? AND created_at < ?`,
      [branchId, from, toExclusive]
    );
    const totalSales = Number(rows[0].totalSales);
    const orderCount = Number(rows[0].orderCount);
    return {
      totalSales,
      orderCount,
      averagePerOrder: orderCount === 0 ? 0 : Math.round((totalSales / orderCount) * 100) / 100,
    };
  }

  // ยอดขายแยกตามเมนู เรียงจากขายได้มากไปน้อย (limit = null คือทั้งหมด)
  static async getSalesByMenu(branchId, from, toExclusive, limit = null) {
    const [rows] = await db.query(
      `SELECT m.menu_id AS menuId, m.name, c.name AS categoryName,
              SUM(oi.quantity) AS quantitySold,
              ROUND(SUM(oi.quantity * oi.unit_price), 2) AS sales
         FROM order_item oi
         JOIN orders o    ON o.order_id = oi.order_id
         JOIN menu_item m ON m.menu_id = oi.menu_id
         JOIN category c  ON c.category_id = m.category_id
        WHERE o.branch_id = ? AND o.created_at >= ? AND o.created_at < ?
        GROUP BY m.menu_id, m.name, c.name
        ORDER BY quantitySold DESC, sales DESC, m.name
        ${limit ? 'LIMIT ?' : ''}`,
      limit ? [branchId, from, toExclusive, limit] : [branchId, from, toExclusive]
    );
    return rows.map((r) => ({ ...r, quantitySold: Number(r.quantitySold), sales: Number(r.sales) }));
  }

  // ยอดขายรายวันภายในช่วง (ใช้วาดกราฟรายเดือน)
  static async getDailySales(branchId, from, toExclusive) {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
              SUM(total_amount) AS sales, COUNT(*) AS orderCount
         FROM orders
        WHERE branch_id = ? AND created_at >= ? AND created_at < ?
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY date`,
      [branchId, from, toExclusive]
    );
    return rows.map((r) => ({ date: r.date, sales: Number(r.sales), orderCount: Number(r.orderCount) }));
  }
}

module.exports = ReportModel;
