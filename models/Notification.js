const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
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

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["budget_alert", "goal_reminder", "system", "info", "warning"],
      default: "info",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Link to related entity (optional)
    relatedEntityType: {
      type: String,
      enum: ["budget", "goal", "transaction", "debt", null],
      default: null,
    },

    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Action URL or route (optional)
    actionUrl: {
      type: String,
      default: null,
    },

    // Expiry date (optional, for time-sensitive notifications)
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
