const Notification = require("../models/Notification");
const Transaction = require("../models/Transaction");
const CategoryBudgetGoal = require("../models/CategoryBudgetGoal");
const Budget = require("../models/Budget");
const Debt = require("../models/Debt");
const User = require("../models/User");
const emailService = require("./emailService");

/**
 * Create a notification and optionally send email
 */
const createNotification = async (userId, notificationData, sendEmail = false) => {
  try {
    // Always store notification in database
    const notification = new Notification({
      userId,
      ...notificationData,
    });

    await notification.save();
    console.log(`✅ Notification created for user ${userId}: ${notification.title}`);

    // Send email if requested (separate from notification storage)
    if (sendEmail) {
      try {
        const user = await User.findById(userId).select("email name");
        if (user && user.email) {
          // Only send email for budget alerts
          if (notificationData.type === "budget_alert") {
            const emailData = {
              currentSpending: notificationData.currentSpending || 0,
              budgetLimit: notificationData.budgetLimit || 0,
              percentage: notificationData.percentage || 0,
              category: notificationData.category || "Budget",
              threshold: notificationData.threshold || "80",
              alertType: notificationData.priority === "critical" ? "critical" : "warning",
            };

            // Send email asynchronously (non-blocking)
            emailService.sendBudgetAlertEmail(user.email, user.name || "User", emailData)
              .then((result) => {
                if (result.sent) {
                  console.log(`✅ Budget alert email sent to ${user.email}`);
                } else {
                  console.warn(`⚠️ Failed to send email to ${user.email}:`, result.reason);
                }
              })
              .catch((err) => {
                console.error(`❌ Error sending email to ${user.email}:`, err.message);
              });
          }
        } else {
          console.warn(`⚠️ User ${userId} not found or has no email. Notification stored but email not sent.`);
        }
      } catch (emailError) {
        // Don't fail notification creation if email fails
        console.error("❌ Error sending notification email (non-blocking):", emailError.message);
      }
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Check budget thresholds and create alerts
 */
const checkBudgetAlerts = async (userId) => {
  try {
    const alerts = [];

    // Get current month transactions
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const transactions = await Transaction.find({
      userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // Check category budget goals
    const categoryGoals = await CategoryBudgetGoal.find({ user: userId });
    for (const goal of categoryGoals) {
      const categorySpent = transactions
        .filter((t) => t.category === goal.category && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const percentage = goal.goal > 0 ? (categorySpent / goal.goal) * 100 : 0;

      // Alert at 80% threshold
      if (percentage >= 80 && percentage < 100) {
        alerts.push({
          userId,
          title: "Budget Warning",
          message: `You've spent ${Math.round(percentage)}% of your ${goal.category} budget (₹${categorySpent.toLocaleString()} / ₹${goal.goal.toLocaleString()})`,
          type: "budget_alert",
          priority: "high",
          relatedEntityType: "goal",
          relatedEntityId: goal._id,
          actionUrl: "/budget",
          currentSpending: categorySpent,
          budgetLimit: goal.goal,
          percentage,
          category: goal.category,
          threshold: "80",
        });
      }

      // Alert at 100% threshold
      if (percentage >= 100) {
        alerts.push({
          userId,
          title: "Budget Exceeded",
          message: `You've exceeded your ${goal.category} budget! Spent ₹${categorySpent.toLocaleString()} out of ₹${goal.goal.toLocaleString()}`,
          type: "budget_alert",
          priority: "critical",
          relatedEntityType: "goal",
          relatedEntityId: goal._id,
          actionUrl: "/budget",
          currentSpending: categorySpent,
          budgetLimit: goal.goal,
          percentage,
          category: goal.category,
          threshold: "100",
        });
      }
    }

    // Check general budgets
    const budgets = await Budget.find({ user: userId });
    for (const budget of budgets) {
      const spent = budget.spent || 0;
      const percentage = budget.goal > 0 ? (spent / budget.goal) * 100 : 0;

      if (percentage >= 80 && percentage < 100) {
        alerts.push({
          userId,
          title: "Budget Warning",
          message: `You've spent ${Math.round(percentage)}% of your ${budget.category} budget`,
          type: "budget_alert",
          priority: "high",
          relatedEntityType: "budget",
          relatedEntityId: budget._id,
          actionUrl: "/budget",
          currentSpending: spent,
          budgetLimit: budget.goal,
          percentage,
          category: budget.category,
          threshold: "80",
        });
      }

      if (percentage >= 100) {
        alerts.push({
          userId,
          title: "Budget Exceeded",
          message: `You've exceeded your ${budget.category} budget!`,
          type: "budget_alert",
          priority: "critical",
          relatedEntityType: "budget",
          relatedEntityId: budget._id,
          actionUrl: "/budget",
          currentSpending: spent,
          budgetLimit: budget.goal,
          percentage,
          category: budget.category,
          threshold: "100",
        });
      }
    }

    // Create notifications (avoid duplicates)
    for (const alert of alerts) {
      // Check if similar notification already exists today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await Notification.findOne({
        userId: alert.userId,
        type: alert.type,
        relatedEntityId: alert.relatedEntityId,
        createdAt: { $gte: today },
        isRead: false,
      });

      if (!existing) {
        // Add email data for budget alerts
        const notificationData = {
          ...alert,
          currentSpending: alert.currentSpending,
          budgetLimit: alert.budgetLimit,
          percentage: alert.percentage,
          category: alert.category,
          threshold: alert.threshold,
        };
        
        // Store notification and send email
        await createNotification(alert.userId, notificationData, true);
      }
    }

    return alerts.length;
  } catch (error) {
    console.error("Error checking budget alerts:", error);
    throw error;
  }
};

/**
 * Check goal deadline reminders
 */
const checkGoalReminders = async (userId) => {
  try {
    const reminders = [];

    // This can be extended to check actual goal deadlines
    // For now, we'll create a simple reminder system
    // You can extend this based on your goal model structure

    return reminders.length;
  } catch (error) {
    console.error("Error checking goal reminders:", error);
    throw error;
  }
};

/**
 * Get all notifications for a user
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limit = 50, unreadOnly = false, type = null } = options;

    const query = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }
    if (type) {
      query.type = type;
    }

    // Remove expired notifications
    const now = new Date();
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ];

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Count unread
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    });

    return {
      notifications,
      unreadCount,
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return result.modifiedCount;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Delete notification
 */
const deleteNotification = async (userId, notificationId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};

module.exports = {
  createNotification,
  checkBudgetAlerts,
  checkGoalReminders,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
