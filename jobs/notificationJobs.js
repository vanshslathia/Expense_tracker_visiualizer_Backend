const cron = require("node-cron");
const notificationService = require("../services/notificationService");
const User = require("../models/User");

/**
 * Scheduled job to check budget alerts
 * Runs daily at 9:00 AM (configurable)
 */
const startBudgetAlertJob = () => {
  const schedule = process.env.BUDGET_ALERT_JOB_SCHEDULE || "0 9 * * *";

  console.log(`🕐 Scheduling budget alert job: ${schedule}`);

  cron.schedule(schedule, async () => {
    console.log("🔄 Starting budget alert check job...");
    try {
      // Get all users
      const users = await User.find({}).select("_id");

      let totalAlerts = 0;
      for (const user of users) {
        try {
          const count = await notificationService.checkBudgetAlerts(user._id);
          totalAlerts += count;
        } catch (error) {
          console.error(`Error checking alerts for user ${user._id}:`, error);
        }
      }

      console.log(`✅ Budget alert job completed. Created ${totalAlerts} alerts.`);
    } catch (error) {
      console.error("❌ Error in budget alert job:", error);
    }
  });

  console.log("✅ Budget alert job scheduled successfully");
};

/**
 * Scheduled job to check goal reminders
 * Runs daily at 8:00 AM (configurable)
 */
const startGoalReminderJob = () => {
  const schedule = process.env.GOAL_REMINDER_JOB_SCHEDULE || "0 8 * * *";

  console.log(`🕐 Scheduling goal reminder job: ${schedule}`);

  cron.schedule(schedule, async () => {
    console.log("🔄 Starting goal reminder check job...");
    try {
      const users = await User.find({}).select("_id");

      let totalReminders = 0;
      for (const user of users) {
        try {
          const count = await notificationService.checkGoalReminders(user._id);
          totalReminders += count;
        } catch (error) {
          console.error(`Error checking reminders for user ${user._id}:`, error);
        }
      }

      console.log(`✅ Goal reminder job completed. Created ${totalReminders} reminders.`);
    } catch (error) {
      console.error("❌ Error in goal reminder job:", error);
    }
  });

  console.log("✅ Goal reminder job scheduled successfully");
};

module.exports = {
  startBudgetAlertJob,
  startGoalReminderJob,
};
