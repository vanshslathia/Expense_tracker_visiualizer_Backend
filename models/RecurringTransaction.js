const mongoose = require("mongoose");

const RecurringTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      enum: [
        "Food",
        "Entertainment",
        "Travel",
        "Shopping",
        "Savings",
        "Income",
        "Others",
        "Utilities",
      ],
      default: "Others",
      trim: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    tags: [{
      type: String,
      trim: true,
    }],

    // Recurrence pattern
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },

    // Day of week (0-6, Sunday = 0) for weekly
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
    },

    // Day of month (1-31) for monthly
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },

    // Start date for the recurring transaction
    startDate: {
      type: Date,
      required: true,
    },

    // End date (optional, null means no end)
    endDate: {
      type: Date,
      default: null,
    },

    // Active status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Last processed date to prevent duplicates
    lastProcessedDate: {
      type: Date,
      default: null,
    },

    // Next processing date (for optimization)
    nextProcessDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RecurringTransaction", RecurringTransactionSchema);
