// menuRoutes.js - /api/menu  เรียกดูเมนูและสต็อก / จัดการเมนู (owner)
const express = require('express');
const menuController = require('../controllers/menuController');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const ownerOnly = requireRole('owner');

router.get('/', menuController.listMenu);
router.get('/low-stock', menuController.listLowStock);
router.get('/categories', menuController.listCategories);
router.get('/:menuId', menuController.getMenuItem);
router.post('/', ownerOnly, menuController.createMenuItem);
router.patch('/:menuId', ownerOnly, menuController.updateMenuItem);
router.patch('/:menuId/stock', menuController.adjustStock);
router.delete('/:menuId', ownerOnly, menuController.deleteMenuItem);

module.exports = router;
