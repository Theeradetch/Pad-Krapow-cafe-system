// utils/errors.js - error ที่ระบุ HTTP status ได้ ใช้ส่งต่อไปยัง error handler กลาง
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const unauthorized = (msg = 'กรุณาเข้าสู่ระบบ') => new AppError(401, msg);
const forbidden = (msg = 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้') => new AppError(403, msg);
const notFound = (msg = 'ไม่พบข้อมูล') => new AppError(404, msg);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound };
