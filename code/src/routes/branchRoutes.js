// branchRoutes.js - /api/branches
const express = require('express');
const branchController = require('../controllers/branchController');

const router = express.Router();

router.get('/', branchController.listBranches);

module.exports = router;
