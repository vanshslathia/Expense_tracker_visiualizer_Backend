const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

// All routes are protected
router.get("/", authMiddleware, notificationController.getNotifications);
router.get("/unread-count", authMiddleware, notificationController.getUnreadCount);
router.patch("/:id/read", authMiddleware, notificationController.markAsRead);
router.patch("/read-all", authMiddleware, notificationController.markAllAsRead);
router.delete("/:id", authMiddleware, notificationController.deleteNotification);

module.exports = router;
