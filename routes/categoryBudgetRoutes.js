const express = require("express");
const router = express.Router();
const { setCategoryGoal, getCategoryGoals } = require("../controllers/categoryBudgetController");
const authMiddleware = require("../middleware/auth");

router.post("/set", authMiddleware, setCategoryGoal);
router.get("/", authMiddleware, getCategoryGoals);

// 🔔 Get Budget Alerts - Check spending against goals
router.get("/alerts", authMiddleware, async (req, res) => {
  try {
    console.log("📢 Budget alerts route called");
    const Transaction = require("../models/Transaction");
    const CategoryBudgetGoal = require("../models/CategoryBudgetGoal");
    const mongoose = require("mongoose");
    
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const userId = new mongoose.Types.ObjectId(req.user);
    
    // Get current month's start date
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get all budget goals
    const goals = await CategoryBudgetGoal.find({ user: userId });
    
    // Get current month transactions
    const transactions = await Transaction.find({
      userId,
      date: { $gte: startOfMonth }
    });
    
    // Calculate spending per category this month
    const spendingPerCategory = {};
    transactions.forEach(t => {
      if (t.amount < 0) {
        const category = t.category;
        spendingPerCategory[category] = (spendingPerCategory[category] || 0) + Math.abs(t.amount);
      }
    });
    
    // Check each goal against spending
    const alerts = [];
    goals.forEach(goal => {
      const spent = spendingPerCategory[goal.category] || 0;
      const percentage = (spent / goal.goal) * 100;
      
      if (percentage >= 100) {
        // 🔴 Exceeded budget
        alerts.push({
          category: goal.category,
          type: "exceeded",
          message: `You exceeded your ${goal.category} budget by ₹${(spent - goal.goal).toLocaleString()}.`,
          goal: goal.goal,
          spent: spent,
          percentage: percentage.toFixed(1),
          severity: "high"
        });
      } else if (percentage >= 80) {
        // 🟡 Warning - approaching budget
        alerts.push({
          category: goal.category,
          type: "warning",
          message: `You reached ${percentage.toFixed(0)}% of your ${goal.category} budget.`,
          goal: goal.goal,
          spent: spent,
          percentage: percentage.toFixed(1),
          severity: "medium"
        });
      }
    });
    
    console.log(`✅ Budget alerts retrieved: ${alerts.length} alerts`);
    res.json({
      success: true,
      alerts,
      hasAlerts: alerts.length > 0
    });
  } catch (error) {
    console.error("❌ Budget alerts error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching budget alerts", 
      error: error.message 
    });
  }
});

module.exports = router;
