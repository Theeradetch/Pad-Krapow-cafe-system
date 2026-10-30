// middleware/auth.js - ตรวจ token และสิทธิ์ตามบทบาท/สาขา
// บทบาท: 'barista' ใช้ได้เฉพาะสาขาของตัวเอง, 'owner' (เจ้าของร้าน) ดูได้ทุกสาขาและจัดการเมนูได้
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const EmployeeModel = require('../models/employeeModel');
const { unauthorized, forbidden, notFound } = require('../utils/errors');
const { toOptionalPositiveInt } = require('../utils/validate');

let secret = process.env.JWT_SECRET;
if (!secret || secret === 'change_me_to_a_long_random_string') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ต้องตั้งค่า JWT_SECRET ในไฟล์ .env ก่อนใช้งานจริง');
  }
  // โหมดพัฒนา: สุ่ม secret ใหม่ทุกครั้งที่เปิด server (ต้อง login ใหม่หลังรีสตาร์ต)
  secret = crypto.randomBytes(32).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[auth] ไม่ได้ตั้ง JWT_SECRET ใน .env จึงสุ่มค่าชั่วคราวให้ (ใช้ได้เฉพาะตอนพัฒนา)');
  }
}

function signToken(employee) {
  return jwt.sign(
    {
      sub: employee.employeeId,
      branchId: employee.branchId,
      role: employee.role,
      name: employee.name,
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

// ต้องมี header  Authorization: Bearer <token>
function authenticate(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, secret);
    req.user = {
      employeeId: payload.sub,
      branchId: payload.branchId,
      role: payload.role,
      name: payload.name,
    };
    return next();
  } catch {
    return next(unauthorized('เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden('บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้'));
    }
    return next();
  };
}

// หา branchId ที่ผู้ใช้มีสิทธิ์ใช้งาน (ป้องกัน IDOR ข้ามสาขา)
// - barista: ถ้าส่งสาขาอื่นมา -> 403, ถ้าไม่ส่ง -> ใช้สาขาของตัวเอง
// - owner  : ใช้สาขาที่ส่งมา (ต้องมีอยู่จริง) หรือสาขาของตัวเองถ้าไม่ส่ง
async function resolveBranchId(req, requested) {
  const branchId = toOptionalPositiveInt(requested, 'branchId');
  if (branchId === undefined) return req.user.branchId;
  if (req.user.role !== 'owner') {
    if (branchId !== req.user.branchId) throw forbidden('ไม่มีสิทธิ์เข้าถึงข้อมูลของสาขาอื่น');
    return branchId;
  }
  if (!(await EmployeeModel.branchExists(branchId))) throw notFound('ไม่พบสาขาที่ระบุ');
  return branchId;
}

// ใช้กับข้อมูลที่ระบุสาขามาแล้ว (เช่น เมนู/ออเดอร์ที่ดึงจากฐานข้อมูล)
function assertCanAccessBranch(req, branchId) {
  if (req.user.role !== 'owner' && branchId !== req.user.branchId) {
    throw forbidden('ไม่มีสิทธิ์เข้าถึงข้อมูลของสาขาอื่น');
  }
}

module.exports = { signToken, authenticate, requireRole, resolveBranchId, assertCanAccessBranch };
