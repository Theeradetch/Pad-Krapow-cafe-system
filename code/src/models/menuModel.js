// menuModel.js - จัดการข้อมูลตาราง menu_item และ category
const db = require('../config/db');

const MENU_COLUMNS = `
  m.menu_id AS menuId, m.branch_id AS branchId, m.category_id AS categoryId,
  c.name AS categoryName, m.name, m.price, m.stock_quantity AS stockQuantity,
  m.low_stock_threshold AS lowStockThreshold, m.is_active AS isActive,
  (m.stock_quantity < m.low_stock_threshold) AS isLowStock`;

function normalize(row) {
  if (!row) return row;
  return { ...row, isActive: Boolean(row.isActive), isLowStock: Boolean(row.isLowStock) };
}

class MenuModel {
  // ดึงรายการเมนูทั้งหมดตาม branch_id (ค่าเริ่มต้นเฉพาะเมนูที่ยังขายอยู่)
  static async getByBranch(branchId, { includeInactive = false } = {}) {
    const [rows] = await db.query(
      `SELECT ${MENU_COLUMNS}
         FROM menu_item m JOIN category c ON c.category_id = m.category_id
        WHERE m.branch_id = ? ${includeInactive ? '' : 'AND m.is_active = 1'}
        ORDER BY c.category_id, m.name`,
      [branchId]
    );
    return rows.map(normalize);
  }

  // ดึงข้อมูลเมนูตาม menu_id
  static async getById(menuId) {
    const [rows] = await db.query(
      `SELECT ${MENU_COLUMNS}
         FROM menu_item m JOIN category c ON c.category_id = m.category_id
        WHERE m.menu_id = ?`,
      [menuId]
    );
    return normalize(rows[0]);
  }

  // เมนูที่สต็อกต่ำกว่าจำนวนขั้นต่ำ (FR-05 / US-06)
  static async getLowStock(branchId) {
    const [rows] = await db.query(
      `SELECT ${MENU_COLUMNS}
         FROM menu_item m JOIN category c ON c.category_id = m.category_id
        WHERE m.branch_id = ? AND m.is_active = 1
          AND m.stock_quantity < m.low_stock_threshold
        ORDER BY m.stock_quantity, m.name`,
      [branchId]
    );
    return rows.map(normalize);
  }

  // ตัดสต็อกสินค้า (ตัดได้เฉพาะเมื่อสต็อกพอ กันสต็อกติดลบ) คืนค่า true ถ้าตัดสำเร็จ
  // หมายเหตุ: การขายจริงตัดสต็อกใน OrderModel.createOrder ภายใน transaction เดียวกับออเดอร์
  static async updateStock(menuId, quantity, conn = db) {
    const [result] = await conn.query(
      'UPDATE menu_item SET stock_quantity = stock_quantity - ? WHERE menu_id = ? AND stock_quantity >= ?',
      [quantity, menuId, quantity]
    );
    return result.affectedRows === 1;
  }

  // ปรับสต็อก (เติมของ/แก้ไขยอด) พร้อมบันทึก stock_movement ใน transaction เดียวกัน
  // คืนค่า { ok, stockQuantity } ; ok = false เมื่อปรับแล้วจะติดลบ
  static async adjustStock(menuId, change, reason) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        'SELECT stock_quantity FROM menu_item WHERE menu_id = ? FOR UPDATE',
        [menuId]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return { ok: false, notFound: true };
      }
      const newQty = rows[0].stock_quantity + change;
      if (newQty < 0) {
        await conn.rollback();
        return { ok: false, stockQuantity: rows[0].stock_quantity };
      }
      await conn.query('UPDATE menu_item SET stock_quantity = ? WHERE menu_id = ?', [newQty, menuId]);
      await conn.query(
        'INSERT INTO stock_movement (menu_id, quantity_change, reason) VALUES (?, ?, ?)',
        [menuId, change, reason]
      );
      await conn.commit();
      return { ok: true, stockQuantity: newQty };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async create({ branchId, categoryId, name, price, stockQuantity, lowStockThreshold }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [branchId, categoryId, name, price, stockQuantity, lowStockThreshold]
      );
      if (stockQuantity > 0) {
        await conn.query(
          "INSERT INTO stock_movement (menu_id, quantity_change, reason) VALUES (?, ?, 'restock')",
          [result.insertId, stockQuantity]
        );
      }
      await conn.commit();
      return result.insertId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // แก้ไขเฉพาะ field ที่ส่งมา (ไม่แก้สต็อกตรงนี้ ให้ใช้ adjustStock เพื่อให้มีประวัติ)
  static async update(menuId, fields) {
    const map = {
      name: 'name',
      price: 'price',
      categoryId: 'category_id',
      lowStockThreshold: 'low_stock_threshold',
    };
    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(map)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = ?`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) return false;
    values.push(menuId);
    const [result] = await db.query(`UPDATE menu_item SET ${sets.join(', ')} WHERE menu_id = ?`, values);
    return result.affectedRows === 1;
  }

  // ลบแบบ soft delete: ซ่อนจากหน้าขาย แต่ประวัติการขายในรายงานยังอยู่ครบ
  static async softDelete(menuId) {
    const [result] = await db.query('UPDATE menu_item SET is_active = 0 WHERE menu_id = ?', [menuId]);
    return result.affectedRows === 1;
  }

  static async getCategories() {
    const [rows] = await db.query(
      'SELECT category_id AS categoryId, name FROM category ORDER BY category_id'
    );
    return rows;
  }

  static async categoryExists(categoryId) {
    const [rows] = await db.query('SELECT 1 FROM category WHERE category_id = ?', [categoryId]);
    return rows.length === 1;
  }
}

module.exports = MenuModel;
