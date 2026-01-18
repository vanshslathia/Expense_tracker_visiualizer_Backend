const mongoose = require("mongoose");

/**
 * Tracks which budget alerts have been sent to prevent duplicate emails
 * Stores alert status per user per month per threshold
 */
const BudgetAlertStatusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Month identifier (YYYY-MM format)
    monthKey: {
      type: String,
      required: true,
      index: true,
    },

    // Budget type: 'category' or 'general'
    budgetType: {
      type: String,
      enum: ["category", "general"],
      required: true,
    },

    // Budget ID (CategoryBudgetGoal._id or Budget._id)
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Thresholds that have been triggered
    thresholdsTriggered: {
      type: [String],
      enum: ["80", "100"],
      default: [],
    },

    // Last alert sent date
    lastAlertSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per user/month/budget/threshold
BudgetAlertStatusSchema.index({ userId: 1, monthKey: 1, budgetId: 1, budgetType: 1 }, { unique: true });

module.exports = mongoose.model("BudgetAlertStatus", BudgetAlertStatusSchema);
