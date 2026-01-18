const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const CategoryBudgetGoal = require("../models/CategoryBudgetGoal");
const Debt = require("../models/Debt");

/**
 * Calculate financial health score (0-100)
 * Based on multiple factors:
 * - Savings rate (40%)
 * - Budget adherence (30%)
 * - Debt-to-income ratio (20%)
 * - Spending consistency (10%)
 */
const calculateFinancialHealthScore = async (userId) => {
  try {
    // Get all transactions
    const transactions = await Transaction.find({ userId }).sort({ date: -1 });
    
    // Calculate income and expenses
    let totalIncome = 0;
    let totalExpense = 0;
    const monthlyData = {};

    transactions.forEach((txn) => {
      const monthKey = new Date(txn.date || txn.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }

      if (txn.amount >= 0) {
        totalIncome += txn.amount;
        monthlyData[monthKey].income += txn.amount;
      } else {
        totalExpense += Math.abs(txn.amount);
        monthlyData[monthKey].expense += Math.abs(txn.amount);
      }
    });

    // Get current month data
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthData = monthlyData[currentMonth] || { income: 0, expense: 0 };

    // Get budget goals
    const categoryGoals = await CategoryBudgetGoal.find({ user: userId });
    const budgets = await Budget.find({ user: userId });

    // Get debts
    const debts = await Debt.find({ user: userId });

    // 1. Savings Rate Score (40% weight)
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;
    const savingsRateScore = Math.min(100, Math.max(0, savingsRate * 200)); // 0-50% savings = 0-100 score

    // 2. Budget Adherence Score (30% weight)
    let budgetAdherenceScore = 100;
    if (categoryGoals.length > 0 || budgets.length > 0) {
      let totalBudget = 0;
      let totalSpent = 0;

      // Calculate from category goals
      categoryGoals.forEach((goal) => {
        totalBudget += goal.goal;
        const categorySpent = transactions
          .filter((t) => t.category === goal.category && t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        totalSpent += Math.min(categorySpent, goal.goal); // Cap at goal
      });

      // Calculate from budgets
      budgets.forEach((budget) => {
        totalBudget += budget.goal;
        totalSpent += Math.min(budget.spent || 0, budget.goal);
      });

      if (totalBudget > 0) {
        const adherenceRatio = totalSpent / totalBudget;
        // Perfect adherence (0-100% of budget) = 100 score
        // Over budget = decreasing score
        budgetAdherenceScore = adherenceRatio <= 1 ? 100 - (adherenceRatio * 50) : Math.max(0, 100 - ((adherenceRatio - 1) * 100));
      }
    }

    // 3. Debt-to-Income Score (20% weight)
    const totalDebt = debts.reduce((sum, debt) => sum + (debt.amount || 0), 0);
    const debtToIncomeRatio = totalIncome > 0 ? totalDebt / totalIncome : 0;
    // Lower ratio is better: 0-0.3 = 100, 0.3-0.5 = 80, 0.5-0.7 = 60, >0.7 = 40
    let debtScore = 100;
    if (debtToIncomeRatio > 0.7) debtScore = 40;
    else if (debtToIncomeRatio > 0.5) debtScore = 60;
    else if (debtToIncomeRatio > 0.3) debtScore = 80;
    else if (debtToIncomeRatio > 0) debtScore = 100 - (debtToIncomeRatio * 100);

    // 4. Spending Consistency Score (10% weight)
    const monthlyExpenses = Object.values(monthlyData).map((m) => m.expense);
    let consistencyScore = 100;
    if (monthlyExpenses.length > 1) {
      const avgExpense = monthlyExpenses.reduce((a, b) => a + b, 0) / monthlyExpenses.length;
      const variance = monthlyExpenses.reduce((sum, exp) => sum + Math.pow(exp - avgExpense, 2), 0) / monthlyExpenses.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = avgExpense > 0 ? stdDev / avgExpense : 0;
      // Lower CV = more consistent = higher score
      consistencyScore = Math.max(0, 100 - (coefficientOfVariation * 50));
    }

    // Calculate weighted score
    const finalScore = Math.round(
      savingsRateScore * 0.4 +
      budgetAdherenceScore * 0.3 +
      debtScore * 0.2 +
      consistencyScore * 0.1
    );

    // Generate breakdown
    const breakdown = {
      savingsRate: {
        value: Math.round(savingsRate * 100),
        score: Math.round(savingsRateScore),
        weight: 40,
      },
      budgetAdherence: {
        value: Math.round(budgetAdherenceScore),
        score: Math.round(budgetAdherenceScore),
        weight: 30,
      },
      debtManagement: {
        value: Math.round(debtToIncomeRatio * 100),
        score: Math.round(debtScore),
        weight: 20,
      },
      spendingConsistency: {
        value: Math.round(consistencyScore),
        score: Math.round(consistencyScore),
        weight: 10,
      },
    };

    // Generate insights
    const insights = generateInsights(finalScore, breakdown, {
      savingsRate,
      totalIncome,
      totalExpense,
      totalDebt,
      currentMonthData,
    });

    return {
      score: Math.min(100, Math.max(0, finalScore)),
      breakdown,
      insights,
      metadata: {
        totalIncome,
        totalExpense,
        totalDebt,
        savingsRate: Math.round(savingsRate * 100),
        currentMonthIncome: currentMonthData.income,
        currentMonthExpense: currentMonthData.expense,
      },
    };
  } catch (error) {
    console.error("Error calculating financial health score:", error);
    throw error;
  }
};

/**
 * Generate motivational insights based on score
 */
const generateInsights = (score, breakdown, metrics) => {
  const insights = [];

  // Overall score message
  if (score >= 80) {
    insights.push({
      type: "success",
      message: "Excellent! You're managing your finances very well. Keep up the great work!",
    });
  } else if (score >= 60) {
    insights.push({
      type: "info",
      message: "Good progress! You're on the right track. A few adjustments can boost your score even higher.",
    });
  } else if (score >= 40) {
    insights.push({
      type: "warning",
      message: "There's room for improvement. Focus on building savings and sticking to your budget.",
    });
  } else {
    insights.push({
      type: "error",
      message: "Let's work on improving your financial health. Start by tracking expenses and setting realistic budgets.",
    });
  }

  // Specific recommendations
  if (breakdown.savingsRate.value < 20) {
    insights.push({
      type: "recommendation",
      message: `Your savings rate is ${breakdown.savingsRate.value}%. Aim for at least 20% to build a strong financial foundation.`,
    });
  }

  if (breakdown.budgetAdherence.score < 70) {
    insights.push({
      type: "recommendation",
      message: "Try to stay within your budget limits. Review your spending categories and adjust if needed.",
    });
  }

  if (breakdown.debtManagement.value > 30) {
    insights.push({
      type: "recommendation",
      message: `Your debt-to-income ratio is ${breakdown.debtManagement.value}%. Consider creating a debt repayment plan.`,
    });
  }

  if (metrics.totalIncome > 0 && metrics.totalExpense / metrics.totalIncome > 0.9) {
    insights.push({
      type: "recommendation",
      message: "You're spending most of your income. Try to reduce expenses or increase income to improve savings.",
    });
  }

  return insights;
};

/**
 * Get historical health scores (for trend chart)
 */
const getHistoricalHealthScores = async (userId, months = 6) => {
  try {
    const transactions = await Transaction.find({ userId }).sort({ date: -1 });
    const monthlyData = {};

    transactions.forEach((txn) => {
      const monthKey = new Date(txn.date || txn.createdAt).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, transactions: [] };
      }

      if (txn.amount >= 0) {
        monthlyData[monthKey].income += txn.amount;
      } else {
        monthlyData[monthKey].expense += Math.abs(txn.amount);
      }
      monthlyData[monthKey].transactions.push(txn);
    });

    // Get last N months
    const monthsList = [];
    const today = new Date();
    for (let i = 0; i < months; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7);
      monthsList.unshift(monthKey);
    }

    const historicalScores = monthsList.map((monthKey) => {
      const data = monthlyData[monthKey] || { income: 0, expense: 0 };
      const savingsRate = data.income > 0 ? (data.income - data.expense) / data.income : 0;
      // Simplified score for historical data
      const score = Math.min(100, Math.max(0, savingsRate * 150 + 30));
      return {
        month: monthKey,
        score: Math.round(score),
        income: data.income,
        expense: data.expense,
      };
    });

    return historicalScores;
  } catch (error) {
    console.error("Error getting historical health scores:", error);
    throw error;
  }
};

module.exports = {
  calculateFinancialHealthScore,
  getHistoricalHealthScores,
};
