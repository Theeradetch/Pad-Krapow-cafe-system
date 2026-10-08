// menuModel.js - จัดการข้อมูลตาราง menu_item
const db = require('../config/db');

class MenuModel {
  // ดึงรายการเมนูทั้งหมดตาม branch_id
  static async getByBranch(branchId) {
    const [rows] = await db.query(
      'SELECT menu_id, branch_id, category_id, name, price, stock_quantity FROM menu_item WHERE branch_id = ?',
      [branchId]
    );
    return rows;
  }

  // ดึงข้อมูลเมนูตาม menu_id
  static async getById(menuId) {
    const [rows] = await db.query(
      'SELECT menu_id, branch_id, category_id, name, price, stock_quantity FROM menu_item WHERE menu_id = ?',
      [menuId]
    );
    return rows[0];
  }

  // ตัดสต็อกสินค้า
  static async updateStock(menuId, quantity) {
    const [result] = await db.query(
      'UPDATE menu_item SET stock_quantity = stock_quantity - ? WHERE menu_id = ?',
      [quantity, menuId]
    );
    return result;
  }
}

module.exports = MenuModel;