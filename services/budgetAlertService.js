const Transaction = require("../models/Transaction");
const CategoryBudgetGoal = require("../models/CategoryBudgetGoal");
const Budget = require("../models/Budget");
const User = require("../models/User");
const BudgetAlertStatus = require("../models/BudgetAlertStatus");

/**
 * Get current month key (YYYY-MM format)
 */
const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Check if alert has already been sent for this threshold
 */
const hasAlertBeenSent = async (userId, monthKey, budgetId, budgetType, threshold) => {
  try {
    const alertStatus = await BudgetAlertStatus.findOne({
      userId,
      monthKey,
      budgetId,
      budgetType,
    });

    if (!alertStatus) {
      return false;
    }

    return alertStatus.thresholdsTriggered.includes(threshold);
  } catch (error) {
    console.error("Error checking alert status:", error);
    return false; // If error, allow alert to be sent (fail-safe)
  }
};

/**
 * Mark alert as sent
 */
const markAlertAsSent = async (userId, monthKey, budgetId, budgetType, threshold) => {
  try {
    await BudgetAlertStatus.findOneAndUpdate(
      {
        userId,
        monthKey,
        budgetId,
        budgetType,
      },
      {
        $addToSet: { thresholdsTriggered: threshold },
        lastAlertSentAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );
  } catch (error) {
    console.error("Error marking alert as sent:", error);
  }
};

/**
 * Check budget thresholds and send alerts (email + notification)
 * This is called after a transaction is created/updated
 */
const checkAndSendBudgetAlerts = async (userId) => {
  try {
    // Get user info for email
    const user = await User.findById(userId);
    if (!user || !user.email) {
      console.warn(`User ${userId} not found or has no email`);
      return;
    }

    const monthKey = getCurrentMonthKey();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get current month transactions
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

      // Check 80% threshold
      if (percentage >= 80 && percentage < 100) {
        const alreadySent = await hasAlertBeenSent(userId, monthKey, goal._id, "category", "80");
        
        if (!alreadySent) {
          // Create notification (will send email automatically)
          const notificationService = require("./notificationService");
          await notificationService.createNotification(userId, {
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
          }, true);

          // Mark as sent
          await markAlertAsSent(userId, monthKey, goal._id, "category", "80");
        }
      }

      // Check 100% threshold
      if (percentage >= 100) {
        const alreadySent = await hasAlertBeenSent(userId, monthKey, goal._id, "category", "100");
        
        if (!alreadySent) {
          // Create notification (will send email automatically)
          const notificationService = require("./notificationService");
          await notificationService.createNotification(userId, {
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
          }, true);

          // Mark as sent
          await markAlertAsSent(userId, monthKey, goal._id, "category", "100");
        }
      }
    }

    // Check general budgets
    const budgets = await Budget.find({ user: userId });
    for (const budget of budgets) {
      // Calculate spent from transactions for this category
      const categorySpent = transactions
        .filter((t) => t.category === budget.category && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const budgetLimit = budget.goal || 0;
      const percentage = budgetLimit > 0 ? (categorySpent / budgetLimit) * 100 : 0;

      // Check 80% threshold
      if (percentage >= 80 && percentage < 100) {
        const alreadySent = await hasAlertBeenSent(userId, monthKey, budget._id, "general", "80");
        
        if (!alreadySent) {
          // Create notification (will send email automatically)
          const notificationService = require("./notificationService");
          await notificationService.createNotification(userId, {
            title: "Budget Warning",
            message: `You've spent ${Math.round(percentage)}% of your ${budget.category} budget (₹${categorySpent.toLocaleString()} / ₹${budgetLimit.toLocaleString()})`,
            type: "budget_alert",
            priority: "high",
            relatedEntityType: "budget",
            relatedEntityId: budget._id,
            actionUrl: "/budget",
            currentSpending: categorySpent,
            budgetLimit,
            percentage,
            category: budget.category,
            threshold: "80",
          }, true);

          await markAlertAsSent(userId, monthKey, budget._id, "general", "80");
        }
      }

      // Check 100% threshold
      if (percentage >= 100) {
        const alreadySent = await hasAlertBeenSent(userId, monthKey, budget._id, "general", "100");
        
        if (!alreadySent) {
          // Create notification (will send email automatically)
          const notificationService = require("./notificationService");
          await notificationService.createNotification(userId, {
            title: "Budget Exceeded",
            message: `You've exceeded your ${budget.category} budget! Spent ₹${categorySpent.toLocaleString()} out of ₹${budgetLimit.toLocaleString()}`,
            type: "budget_alert",
            priority: "critical",
            relatedEntityType: "budget",
            relatedEntityId: budget._id,
            actionUrl: "/budget",
            currentSpending: categorySpent,
            budgetLimit,
            percentage,
            category: budget.category,
            threshold: "100",
          }, true);

          await markAlertAsSent(userId, monthKey, budget._id, "general", "100");
        }
      }
    }
  } catch (error) {
    console.error("Error checking and sending budget alerts:", error);
    // Don't throw - we don't want to break transaction creation if alert fails
  }
};

module.exports = {
  checkAndSendBudgetAlerts,
};
