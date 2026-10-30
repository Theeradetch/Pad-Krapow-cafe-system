// branchController.js - รายชื่อสาขา (barista เห็นเฉพาะสาขาตัวเอง)
const EmployeeModel = require('../models/employeeModel');

async function listBranches(req, res) {
  const branches = await EmployeeModel.getBranches();
  const visible =
    req.user.role === 'owner' ? branches : branches.filter((b) => b.branchId === req.user.branchId);
  res.json({ branches: visible });
}

module.exports = { listBranches };
