const RecurringTransaction = require("../models/RecurringTransaction");
const Transaction = require("../models/Transaction");

/**
 * Calculate next process date based on frequency
 */
const calculateNextProcessDate = (frequency, lastDate, dayOfWeek, dayOfMonth) => {
  const date = new Date(lastDate || new Date());
  date.setHours(0, 0, 0, 0);

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;

    case "weekly":
      if (dayOfWeek !== undefined) {
        // Find next occurrence of the specified day
        const currentDay = date.getDay();
        let daysToAdd = dayOfWeek - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        date.setDate(date.getDate() + daysToAdd);
      } else {
        date.setDate(date.getDate() + 7);
      }
      break;

    case "monthly":
      if (dayOfMonth !== undefined) {
        // Set to the specified day of next month
        date.setMonth(date.getMonth() + 1);
        // Handle edge case: if day doesn't exist in target month (e.g., Feb 30)
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      } else {
        date.setMonth(date.getMonth() + 1);
      }
      break;

    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;

    default:
      date.setDate(date.getDate() + 1);
  }

  return date;
};

/**
 * Check if a recurring transaction should be processed today
 */
const shouldProcessToday = (recurringRule) => {
  if (!recurringRule.isActive) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(recurringRule.startDate);
  startDate.setHours(0, 0, 0, 0);

  // Check if start date has passed
  if (startDate > today) return false;

  // Check if end date has passed
  if (recurringRule.endDate) {
    const endDate = new Date(recurringRule.endDate);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return false;
  }

  // Check if already processed today
  if (recurringRule.lastProcessedDate) {
    const lastProcessed = new Date(recurringRule.lastProcessedDate);
    lastProcessed.setHours(0, 0, 0, 0);
    if (lastProcessed.getTime() === today.getTime()) return false;
  }

  // Check frequency-specific logic
  const nextProcessDate = new Date(recurringRule.nextProcessDate);
  nextProcessDate.setHours(0, 0, 0, 0);

  return nextProcessDate.getTime() <= today.getTime();
};

/**
 * Process a single recurring transaction rule
 */
const processRecurringRule = async (recurringRule) => {
  try {
    if (!shouldProcessToday(recurringRule)) {
      return { processed: false, reason: "Not due today or already processed" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create the transaction
    const transaction = new Transaction({
      userId: recurringRule.userId,
      title: recurringRule.title,
      amount: recurringRule.amount,
      category: recurringRule.category,
      note: recurringRule.note || `Recurring: ${recurringRule.frequency}`,
      tags: [...(recurringRule.tags || []), "recurring"],
      date: today,
    });

    await transaction.save();

    // Update last processed date and next process date
    const nextProcessDate = calculateNextProcessDate(
      recurringRule.frequency,
      today,
      recurringRule.dayOfWeek,
      recurringRule.dayOfMonth
    );

    recurringRule.lastProcessedDate = today;
    recurringRule.nextProcessDate = nextProcessDate;
    await recurringRule.save();

    return { processed: true, transactionId: transaction._id };
  } catch (error) {
    console.error(`Error processing recurring rule ${recurringRule._id}:`, error);
    return { processed: false, reason: error.message };
  }
};

/**
 * Process all active recurring transactions
 */
const processAllRecurringTransactions = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active recurring transactions that are due
    const dueRules = await RecurringTransaction.find({
      isActive: true,
      startDate: { $lte: today },
      $and: [
        {
          $or: [
            { endDate: null },
            { endDate: { $gte: today } },
          ],
        },
        {
          $or: [
            { nextProcessDate: { $lte: today } },
            { lastProcessedDate: null },
            { nextProcessDate: null },
          ],
        },
      ],
    });

    console.log(`Found ${dueRules.length} recurring transactions to process`);

    const results = [];
    for (const rule of dueRules) {
      const result = await processRecurringRule(rule);
      results.push({
        ruleId: rule._id,
        title: rule.title,
        ...result,
      });
    }

    return {
      total: dueRules.length,
      processed: results.filter((r) => r.processed).length,
      results,
    };
  } catch (error) {
    console.error("Error processing all recurring transactions:", error);
    throw error;
  }
};

module.exports = {
  calculateNextProcessDate,
  shouldProcessToday,
  processRecurringRule,
  processAllRecurringTransactions,
};
