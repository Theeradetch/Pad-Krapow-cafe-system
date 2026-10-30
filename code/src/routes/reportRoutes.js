// reportRoutes.js - /api/reports  รายงานยอดขายรายวัน/รายเดือน
const express = require('express');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.get('/sales', reportController.getSalesReport);
router.get('/monthly', reportController.getMonthlyReport);

module.exports = router;
