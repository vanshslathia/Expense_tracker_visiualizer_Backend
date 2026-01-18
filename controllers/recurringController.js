const RecurringTransaction = require("../models/RecurringTransaction");
const recurringService = require("../services/recurringService");

// Create a new recurring transaction rule
exports.createRecurringRule = async (req, res) => {
  try {
    const { title, amount, category, note, tags, frequency, dayOfWeek, dayOfMonth, startDate, endDate } = req.body;
    const userId = req.user;

    if (!title || amount === undefined || !frequency || !startDate) {
      return res.status(400).json({
        success: false,
        message: "Title, amount, frequency, and startDate are required",
      });
    }

    // Validate frequency-specific fields
    if (frequency === "weekly" && dayOfWeek === undefined) {
      return res.status(400).json({
        success: false,
        message: "dayOfWeek is required for weekly frequency",
      });
    }

    if (frequency === "monthly" && dayOfMonth === undefined) {
      return res.status(400).json({
        success: false,
        message: "dayOfMonth is required for monthly frequency",
      });
    }

    // Calculate next process date
    const nextProcessDate = recurringService.calculateNextProcessDate(
      frequency,
      new Date(startDate),
      dayOfWeek,
      dayOfMonth
    );

    const newRule = new RecurringTransaction({
      userId,
      title: title.trim(),
      amount: Number(amount),
      category: category?.trim() || "Others",
      note: note?.trim() || "",
      tags: tags?.map((t) => t.trim()) || [],
      frequency,
      dayOfWeek,
      dayOfMonth,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      nextProcessDate,
      isActive: true,
    });

    const savedRule = await newRule.save();
    res.status(201).json({
      success: true,
      message: "Recurring transaction rule created successfully",
      data: savedRule,
    });
  } catch (error) {
    console.error("Error creating recurring rule:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get all recurring rules for the logged-in user
exports.getRecurringRules = async (req, res) => {
  try {
    const userId = req.user;
    const { isActive } = req.query;

    const query = { userId };
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const rules = await RecurringTransaction.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: rules.length,
      data: rules,
    });
  } catch (error) {
    console.error("Error fetching recurring rules:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get a single recurring rule by ID
exports.getRecurringRuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const rule = await RecurringTransaction.findOne({ _id: id, userId });
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Recurring rule not found",
      });
    }

    res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("Error fetching recurring rule:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Update a recurring rule
exports.updateRecurringRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;
    const updates = req.body;

    // If frequency or date fields change, recalculate nextProcessDate
    if (updates.frequency || updates.startDate || updates.dayOfWeek || updates.dayOfMonth) {
      const existingRule = await RecurringTransaction.findOne({ _id: id, userId });
      if (!existingRule) {
        return res.status(404).json({
          success: false,
          message: "Recurring rule not found",
        });
      }

      const frequency = updates.frequency || existingRule.frequency;
      const startDate = updates.startDate ? new Date(updates.startDate) : existingRule.startDate;
      const dayOfWeek = updates.dayOfWeek !== undefined ? updates.dayOfWeek : existingRule.dayOfWeek;
      const dayOfMonth = updates.dayOfMonth !== undefined ? updates.dayOfMonth : existingRule.dayOfMonth;

      updates.nextProcessDate = recurringService.calculateNextProcessDate(
        frequency,
        startDate,
        dayOfWeek,
        dayOfMonth
      );
    }

    const updatedRule = await RecurringTransaction.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedRule) {
      return res.status(404).json({
        success: false,
        message: "Recurring rule not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Recurring rule updated successfully",
      data: updatedRule,
    });
  } catch (error) {
    console.error("Error updating recurring rule:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Delete a recurring rule
exports.deleteRecurringRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const deletedRule = await RecurringTransaction.findOneAndDelete({ _id: id, userId });
    if (!deletedRule) {
      return res.status(404).json({
        success: false,
        message: "Recurring rule not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Recurring rule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting recurring rule:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Toggle active status
exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const rule = await RecurringTransaction.findOne({ _id: id, userId });
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: "Recurring rule not found",
      });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    res.status(200).json({
      success: true,
      message: `Recurring rule ${rule.isActive ? "activated" : "deactivated"}`,
      data: rule,
    });
  } catch (error) {
    console.error("Error toggling active status:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Manually trigger processing (for testing/admin)
exports.processRecurringRules = async (req, res) => {
  try {
    const result = await recurringService.processAllRecurringTransactions();
    res.status(200).json({
      success: true,
      message: "Recurring transactions processed",
      data: result,
    });
  } catch (error) {
    console.error("Error processing recurring rules:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
