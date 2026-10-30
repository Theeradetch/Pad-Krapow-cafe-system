// orderController.js - ตรวจข้อมูลออเดอร์ แล้วส่งให้ OrderModel บันทึก (ตาม Sequence Diagram wk09)
const OrderModel = require('../models/orderModel');
const { Order } = require('../models/Order');
const { resolveBranchId, assertCanAccessBranch } = require('../middleware/auth');
const { badRequest, notFound } = require('../utils/errors');
const { toPositiveInt, toDateString, todayInBangkok, addDays } = require('../utils/validate');

const PAYMENT_METHODS = ['cash', 'transfer', 'promptpay'];
const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 100;

// POST /api/orders  { branchId?, paymentMethod, items: [{ menuId, quantity }] }
// employeeId มาจาก token ของคนที่ login อยู่ ไม่รับจาก body (กันการบันทึกในชื่อคนอื่น)
async function createOrder(req, res) {
  const body = req.body || {};
  const branchId = await resolveBranchId(req, body.branchId);

  if (!PAYMENT_METHODS.includes(body.paymentMethod)) {
    throw badRequest('กรุณาเลือกวิธีชำระเงิน (cash, transfer หรือ promptpay)');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw badRequest('ออเดอร์ต้องมีอย่างน้อย 1 รายการ');
  }
  if (body.items.length > MAX_LINES) {
    throw badRequest(`ออเดอร์มีได้ไม่เกิน ${MAX_LINES} รายการ`);
  }

  // รวมจำนวนของรายการที่เป็นเมนูเดียวกัน
  const order = new Order();
  body.items.forEach((item, i) => {
    if (!item || typeof item !== 'object') throw badRequest(`รายการที่ ${i + 1} ไม่ถูกต้อง`);
    const menuId = toPositiveInt(item.menuId, `items[${i}].menuId`);
    const quantity = toPositiveInt(item.quantity, `items[${i}].quantity`);
    order.addItem(menuId, quantity);
  });
  const tooMany = order.items.find((it) => it.quantity > MAX_QTY_PER_LINE);
  if (tooMany) {
    throw badRequest(`จำนวนต่อเมนูต้องไม่เกิน ${MAX_QTY_PER_LINE} (menuId ${tooMany.menuId})`);
  }

  const result = await OrderModel.createOrder(
    branchId,
    req.user.employeeId,
    body.paymentMethod,
    order.items.map(({ menuId, quantity }) => ({ menuId, quantity }))
  );
  res.status(201).json(result);
}

// GET /api/orders/:orderId  ข้อมูลใบเสร็จ
async function getOrder(req, res) {
  const orderId = toPositiveInt(req.params.orderId, 'orderId');
  const order = await OrderModel.getById(orderId);
  if (!order) throw notFound('ไม่พบออเดอร์');
  assertCanAccessBranch(req, order.branchId);
  res.json(order);
}

// GET /api/orders?branchId=&date=YYYY-MM-DD  รายการออเดอร์ของวัน (ค่าเริ่มต้น = วันนี้)
async function listOrders(req, res) {
  const branchId = await resolveBranchId(req, req.query.branchId);
  const date = req.query.date ? toDateString(req.query.date, 'date') : todayInBangkok();
  const orders = await OrderModel.listByBranchAndDate(branchId, date, addDays(date, 1));
  res.json({ branchId, date, orders });
}

module.exports = { createOrder, getOrder, listOrders, PAYMENT_METHODS };
