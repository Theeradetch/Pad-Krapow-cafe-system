// utils/validate.js - ฟังก์ชันตรวจข้อมูลนำเข้า (server ต้องตรวจซ้ำเสมอ แม้หน้าจอจะตรวจแล้ว)
const { badRequest } = require('./errors');

// แปลงเป็นจำนวนเต็มบวก ถ้าไม่ใช่ให้โยน 400
function toPositiveInt(value, fieldName) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n <= 0) {
    throw badRequest(`${fieldName} ต้องเป็นจำนวนเต็มบวก`);
  }
  return n;
}

function toOptionalPositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined;
  return toPositiveInt(value, fieldName);
}

function toNonNegativeInt(value, fieldName) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n < 0) {
    throw badRequest(`${fieldName} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
  }
  return n;
}

// ราคา: ตัวเลข >= 0 ทศนิยมไม่เกิน 2 ตำแหน่ง และไม่เกิน 99,999.99
function toPrice(value, fieldName = 'price') {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 99999.99) {
    throw badRequest(`${fieldName} ต้องเป็นตัวเลขตั้งแต่ 0 ถึง 99,999.99`);
  }
  if (Math.round(n * 100) / 100 !== n) {
    throw badRequest(`${fieldName} มีทศนิยมได้ไม่เกิน 2 ตำแหน่ง`);
  }
  return n;
}

function toNonEmptyString(value, fieldName, maxLength) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`กรุณาระบุ ${fieldName}`);
  }
  const s = value.trim();
  if (s.length > maxLength) {
    throw badRequest(`${fieldName} ยาวได้ไม่เกิน ${maxLength} ตัวอักษร`);
  }
  return s;
}

// ตรวจวันที่รูปแบบ YYYY-MM-DD และต้องเป็นวันที่มีอยู่จริงในปฏิทิน (เช่น 2026-02-30 ไม่ผ่าน)
function toDateString(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${fieldName} ต้องอยู่ในรูปแบบ YYYY-MM-DD`);
  }
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw badRequest(`${fieldName} ไม่ใช่วันที่ที่มีอยู่จริง`);
  }
  return value;
}

function toMonthString(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw badRequest(`${fieldName} ต้องอยู่ในรูปแบบ YYYY-MM`);
  }
  return value;
}

// วันที่ปัจจุบันตามเวลาไทย ในรูปแบบ YYYY-MM-DD
function todayInBangkok() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

// บวกวันให้สตริง YYYY-MM-DD
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

module.exports = {
  toPositiveInt,
  toOptionalPositiveInt,
  toNonNegativeInt,
  toPrice,
  toNonEmptyString,
  toDateString,
  toMonthString,
  todayInBangkok,
  addDays,
};
