const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const recurringController = require("../controllers/recurringController");

// All routes are protected
router.post("/create", authMiddleware, recurringController.createRecurringRule);
router.get("/", authMiddleware, recurringController.getRecurringRules);
router.get("/:id", authMiddleware, recurringController.getRecurringRuleById);
router.put("/:id", authMiddleware, recurringController.updateRecurringRule);
router.delete("/:id", authMiddleware, recurringController.deleteRecurringRule);
router.patch("/:id/toggle", authMiddleware, recurringController.toggleActiveStatus);
router.post("/process", authMiddleware, recurringController.processRecurringRules);

module.exports = router;
