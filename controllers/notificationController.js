const notificationService = require("../services/notificationService");

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user;
    const { unreadOnly, type, limit } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      unreadOnly: unreadOnly === "true",
      type: type || null,
      limit: parseInt(limit) || 50,
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(userId, id);

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error",
      error: error.message,
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user;

    const count = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: `${count} notifications marked as read`,
      count,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user;
    const { id } = req.params;

    await notificationService.deleteNotification(userId, id);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server Error",
      error: error.message,
    });
  }
};

// Get unread count (lightweight endpoint)
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user;

    const result = await notificationService.getUserNotifications(userId, {
      unreadOnly: true,
      limit: 1,
    });

    res.status(200).json({
      success: true,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
