// menuController.js - ดึงข้อมูลเมนู จัดการเมนู และปรับสต็อก
const MenuModel = require('../models/menuModel');
const { resolveBranchId, assertCanAccessBranch } = require('../middleware/auth');
const { badRequest, notFound } = require('../utils/errors');
const {
  toPositiveInt,
  toNonNegativeInt,
  toPrice,
  toNonEmptyString,
} = require('../utils/validate');

const STOCK_REASONS = ['restock', 'adjust'];
const MAX_STOCK = 100000;

// GET /api/menu?branchId=&includeInactive=1
async function listMenu(req, res) {
  const branchId = await resolveBranchId(req, req.query.branchId);
  const includeInactive = req.query.includeInactive === '1' && req.user.role === 'owner';
  const items = await MenuModel.getByBranch(branchId, { includeInactive });
  res.json({ branchId, items });
}

// GET /api/menu/low-stock?branchId=
async function listLowStock(req, res) {
  const branchId = await resolveBranchId(req, req.query.branchId);
  const items = await MenuModel.getLowStock(branchId);
  res.json({ branchId, items });
}

// GET /api/menu/categories
async function listCategories(req, res) {
  res.json({ categories: await MenuModel.getCategories() });
}

async function loadMenuForUser(req) {
  const menuId = toPositiveInt(req.params.menuId, 'menuId');
  const menu = await MenuModel.getById(menuId);
  if (!menu) throw notFound('ไม่พบเมนู');
  assertCanAccessBranch(req, menu.branchId);
  return menu;
}

// GET /api/menu/:menuId
async function getMenuItem(req, res) {
  res.json(await loadMenuForUser(req));
}

// POST /api/menu  (owner)
async function createMenuItem(req, res) {
  const body = req.body || {};
  const branchId = await resolveBranchId(req, body.branchId);
  const categoryId = toPositiveInt(body.categoryId, 'categoryId');
  if (!(await MenuModel.categoryExists(categoryId))) throw badRequest('ไม่พบหมวดหมู่ที่ระบุ');
  const data = {
    branchId,
    categoryId,
    name: toNonEmptyString(body.name, 'ชื่อเมนู', 100),
    price: toPrice(body.price, 'ราคา'),
    stockQuantity: body.stockQuantity === undefined ? 0 : toNonNegativeInt(body.stockQuantity, 'สต็อก'),
    lowStockThreshold:
      body.lowStockThreshold === undefined ? 10 : toNonNegativeInt(body.lowStockThreshold, 'จำนวนขั้นต่ำ'),
  };
  if (data.stockQuantity > MAX_STOCK) throw badRequest(`สต็อกต้องไม่เกิน ${MAX_STOCK}`);
  const menuId = await MenuModel.create(data);
  res.status(201).json(await MenuModel.getById(menuId));
}

// PATCH /api/menu/:menuId  (owner) แก้เฉพาะ field ที่ส่งมา
async function updateMenuItem(req, res) {
  const menu = await loadMenuForUser(req);
  const body = req.body || {};
  if ('stockQuantity' in body) {
    throw badRequest('แก้สต็อกผ่าน PATCH /api/menu/:menuId/stock เพื่อให้มีประวัติการปรับ');
  }
  const fields = {};
  if (body.name !== undefined) fields.name = toNonEmptyString(body.name, 'ชื่อเมนู', 100);
  if (body.price !== undefined) fields.price = toPrice(body.price, 'ราคา');
  if (body.lowStockThreshold !== undefined) {
    fields.lowStockThreshold = toNonNegativeInt(body.lowStockThreshold, 'จำนวนขั้นต่ำ');
  }
  if (body.categoryId !== undefined) {
    fields.categoryId = toPositiveInt(body.categoryId, 'categoryId');
    if (!(await MenuModel.categoryExists(fields.categoryId))) throw badRequest('ไม่พบหมวดหมู่ที่ระบุ');
  }
  if (Object.keys(fields).length === 0) throw badRequest('ไม่มีข้อมูลที่ต้องแก้ไข');
  await MenuModel.update(menu.menuId, fields);
  res.json(await MenuModel.getById(menu.menuId));
}

// PATCH /api/menu/:menuId/stock  { change, reason }  เติมของ (+) หรือปรับลด (-)
async function adjustStock(req, res) {
  const menu = await loadMenuForUser(req);
  const body = req.body || {};
  const change = body.change;
  if (!Number.isInteger(change) || change === 0 || Math.abs(change) > MAX_STOCK) {
    throw badRequest(`change ต้องเป็นจำนวนเต็มที่ไม่ใช่ 0 และไม่เกิน ±${MAX_STOCK}`);
  }
  const reason = body.reason === undefined ? (change > 0 ? 'restock' : 'adjust') : body.reason;
  if (!STOCK_REASONS.includes(reason)) {
    throw badRequest(`reason ต้องเป็น ${STOCK_REASONS.join(' หรือ ')}`);
  }
  if (menu.stockQuantity + change > MAX_STOCK) throw badRequest(`สต็อกรวมต้องไม่เกิน ${MAX_STOCK}`);
  const result = await MenuModel.adjustStock(menu.menuId, change, reason);
  if (result.notFound) throw notFound('ไม่พบเมนู');
  if (!result.ok) {
    throw badRequest(`ปรับลดไม่ได้ สต็อกปัจจุบันเหลือ ${result.stockQuantity}`);
  }
  res.json(await MenuModel.getById(menu.menuId));
}

// DELETE /api/menu/:menuId  (owner) ซ่อนเมนู ไม่ลบประวัติการขาย
async function deleteMenuItem(req, res) {
  const menu = await loadMenuForUser(req);
  await MenuModel.softDelete(menu.menuId);
  res.status(204).end();
}

module.exports = {
  listMenu,
  listLowStock,
  listCategories,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  adjustStock,
  deleteMenuItem,
};
