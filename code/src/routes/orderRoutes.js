// orderRoutes.js - /api/orders  สร้างและดูออเดอร์
const express = require('express');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.post('/', orderController.createOrder);
router.get('/', orderController.listOrders);
router.get('/:orderId', orderController.getOrder);

module.exports = router;
