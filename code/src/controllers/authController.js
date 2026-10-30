// authController.js - เข้าสู่ระบบด้วย username/password (รหัสผ่านเก็บเป็น bcrypt hash ตาม NFR-03)
const bcrypt = require('bcryptjs');
const EmployeeModel = require('../models/employeeModel');
const { signToken } = require('../middleware/auth');
const { AppError, unauthorized } = require('../utils/errors');
const { toNonEmptyString } = require('../utils/validate');

// hash จำลอง ใช้เปรียบเทียบเมื่อไม่พบ username เพื่อให้เวลาตอบกลับใกล้เคียงกัน (กันการเดาชื่อผู้ใช้)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// จำกัดการเดารหัสผ่าน: ผิดเกิน 5 ครั้งใน 15 นาที (ต่อ IP + username) จะถูกพักชั่วคราว
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

function failKey(req, username) {
  return `${req.ip}|${username.toLowerCase()}`;
}

function isLocked(key) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
}

async function login(req, res) {
  const username = toNonEmptyString(req.body?.username, 'ชื่อผู้ใช้', 50);
  const password = toNonEmptyString(req.body?.password, 'รหัสผ่าน', 100);
  const key = failKey(req, username);

  if (isLocked(key)) {
    throw new AppError(429, 'ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่');
  }

  const employee = await EmployeeModel.findByUsername(username);
  const ok = await bcrypt.compare(password, employee ? employee.passwordHash : DUMMY_HASH);
  if (!employee || !ok) {
    recordFailure(key);
    throw unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  failures.delete(key);

  res.json({
    token: signToken(employee),
    user: {
      employeeId: employee.employeeId,
      name: employee.name,
      role: employee.role,
      branchId: employee.branchId,
      branchName: employee.branchName,
    },
  });
}

function me(req, res) {
  res.json({ user: req.user });
}

// ใช้ในชุดทดสอบเท่านั้น
function _resetLoginFailures() {
  failures.clear();
}

module.exports = { login, me, _resetLoginFailures };
