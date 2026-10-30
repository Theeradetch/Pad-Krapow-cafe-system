// reportController.js - รายงานยอดขายรายวัน/ช่วงวันที่ (FR-06) และรายเดือน (FR-07)
const ReportModel = require('../models/reportModel');
const { resolveBranchId } = require('../middleware/auth');
const { badRequest } = require('../utils/errors');
const { toDateString, toMonthString, todayInBangkok, addDays } = require('../utils/validate');

const MAX_RANGE_DAYS = 366;

function daysBetween(from, to) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
}

// GET /api/reports/sales?branchId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// ถ้าไม่ส่งวันที่ ใช้วันนี้ (เวลาไทย)
async function getSalesReport(req, res) {
  const branchId = await resolveBranchId(req, req.query.branchId);
  const today = todayInBangkok();
  const from = req.query.from ? toDateString(req.query.from, 'from') : today;
  const to = req.query.to ? toDateString(req.query.to, 'to') : from;
  if (to < from) throw badRequest('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) {
    throw badRequest(`ช่วงวันที่ต้องไม่เกิน ${MAX_RANGE_DAYS} วัน`);
  }

  const toExclusive = addDays(to, 1);
  const [summary, items] = await Promise.all([
    ReportModel.getSummary(branchId, from, toExclusive),
    ReportModel.getSalesByMenu(branchId, from, toExclusive),
  ]);
  res.json({ branchId, from, to, ...summary, items });
}

// GET /api/reports/monthly?branchId=&month=YYYY-MM
async function getMonthlyReport(req, res) {
  const branchId = await resolveBranchId(req, req.query.branchId);
  const month = req.query.month ? toMonthString(req.query.month, 'month') : todayInBangkok().slice(0, 7);

  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const toExclusive = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const [summary, daily, topMenus] = await Promise.all([
    ReportModel.getSummary(branchId, from, toExclusive),
    ReportModel.getDailySales(branchId, from, toExclusive),
    ReportModel.getSalesByMenu(branchId, from, toExclusive, 5),
  ]);
  res.json({ branchId, month, ...summary, daily, topMenus });
}

module.exports = { getSalesReport, getMonthlyReport };
