// employeeModel.js - ข้อมูลพนักงาน (ใช้ตอน login) และสาขา
const db = require('../config/db');

class EmployeeModel {
  static async findByUsername(username) {
    const [rows] = await db.query(
      `SELECT e.employee_id AS employeeId, e.branch_id AS branchId, b.name AS branchName,
              e.name, e.role, e.password_hash AS passwordHash
         FROM employee e JOIN branch b ON b.branch_id = e.branch_id
        WHERE e.username = ?`,
      [username]
    );
    return rows[0] || null;
  }

  static async getBranches() {
    const [rows] = await db.query(
      'SELECT branch_id AS branchId, name, address FROM branch ORDER BY branch_id'
    );
    return rows;
  }

  static async branchExists(branchId) {
    const [rows] = await db.query('SELECT 1 FROM branch WHERE branch_id = ?', [branchId]);
    return rows.length === 1;
  }
}

module.exports = EmployeeModel;
