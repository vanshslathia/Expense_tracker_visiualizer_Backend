const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const healthController = require("../controllers/healthController");

// All routes are protected
router.get("/score", authMiddleware, healthController.getFinancialHealthScore);
router.get("/history", authMiddleware, healthController.getHistoricalHealthScores);

module.exports = router;
