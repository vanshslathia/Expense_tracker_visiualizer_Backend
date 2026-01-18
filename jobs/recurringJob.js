const cron = require("node-cron");
const recurringService = require("../services/recurringService");

/**
 * Scheduled job to process recurring transactions
 * Runs daily at 2:00 AM (configurable)
 */
const startRecurringTransactionJob = () => {
  // Run daily at 2:00 AM
  // Format: minute hour day month day-of-week
  const schedule = process.env.RECURRING_JOB_SCHEDULE || "0 2 * * *";

  console.log(`🕐 Scheduling recurring transaction job: ${schedule}`);

  cron.schedule(schedule, async () => {
    console.log("🔄 Starting recurring transaction processing job...");
    try {
      const result = await recurringService.processAllRecurringTransactions();
      console.log(`✅ Recurring transaction job completed:`, {
        total: result.total,
        processed: result.processed,
      });
    } catch (error) {
      console.error("❌ Error in recurring transaction job:", error);
    }
  });

  console.log("✅ Recurring transaction job scheduled successfully");
};

module.exports = {
  startRecurringTransactionJob,
};
