const express = require("express");
const Transaction = require("../models/Transaction");
const OpenAI = require("openai");
require("dotenv").config();

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 Analyze User's Transactions
router.get("/analyze/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const transactions = await Transaction.find({ userId });

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ message: "No transactions found for this user. Please add some transactions first." });
    }

    const categories = {};
    let total = 0;

    transactions.forEach((t) => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
      total += t.amount;
    });

    const summary = Object.entries(categories)
      .map(([cat, amt]) => `${cat}: ₹${amt}`)
      .join(", ");

    const prompt = `
    A user spent money in these categories this month: ${summary}.
    Analyze their spending pattern.
    - Identify overspending categories.
    - Mention where they did well.
    - Suggest how to optimize spending next month.
    Be concise (max 4 lines).
    `;

    let insights;
    try {
    const aiResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a financial assistant helping users manage expenses." },
        { role: "user", content: prompt },
      ],
    });

      insights = aiResponse.choices[0].message.content;
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);
      // Fallback response if OpenAI fails
      insights = `Your spending summary: ${summary}. Total: ₹${total}. Please review your spending patterns and consider setting budget goals for better financial management.`;
    }

    res.json({
      total,
      categories,
      insights,
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    res.status(500).json({ 
      message: error.message || "Error analyzing expenses. Please try again later." 
    });
  }
});

// Helper function to filter transactions by month
const filterTransactionsByMonth = (transactions, monthType) => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  
  if (monthType === "this month" || monthType === "current month") {
    return transactions.filter(t => {
      const txDate = new Date(t.date || t.createdAt);
      return txDate >= currentMonthStart && txDate <= currentMonthEnd;
    });
  } else if (monthType === "last month" || monthType === "previous month") {
    return transactions.filter(t => {
      const txDate = new Date(t.date || t.createdAt);
      return txDate >= lastMonthStart && txDate <= lastMonthEnd;
    });
  }
  return transactions; // Return all if no month specified
};

// Helper function to generate intelligent fallback responses
const generateFallbackResponse = (message, transactions) => {
  const lowerMessage = message.toLowerCase();
  
  // Check for month-specific queries
  let monthType = "";
  let filteredTransactions = transactions;
  
  if (lowerMessage.includes("this month") || lowerMessage.includes("current month") || 
      lowerMessage.includes("this month's") || lowerMessage.includes("current month's")) {
    monthType = "this month";
    filteredTransactions = filterTransactionsByMonth(transactions, "this month");
  } else if (lowerMessage.includes("last month") || lowerMessage.includes("previous month") ||
             lowerMessage.includes("last month's") || lowerMessage.includes("previous month's")) {
    monthType = "last month";
    filteredTransactions = filterTransactionsByMonth(transactions, "last month");
  }
  
  // Calculate transaction statistics from filtered transactions
  const categories = {};
  let totalIncome = 0;
  let totalExpense = 0;
  
  filteredTransactions.forEach((t) => {
    if (!categories[t.category]) {
      categories[t.category] = { income: 0, expense: 0, count: 0 };
    }
    if (t.amount > 0) {
      categories[t.category].income += t.amount;
      totalIncome += t.amount;
    } else {
      categories[t.category].expense += Math.abs(t.amount);
      totalExpense += Math.abs(t.amount);
    }
    categories[t.category].count++;
  });

  const totalBalance = totalIncome - totalExpense;
  const monthPrefix = monthType ? `${monthType.charAt(0).toUpperCase() + monthType.slice(1)}: ` : "";
  
  // For non-financial questions, politely redirect
  const nonFinancialKeywords = ["who is", "what is", "who are", "tell me about", "elon", "musk", "trump", "biden", "person", "celebrity", "famous"];
  const isNonFinancial = nonFinancialKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (isNonFinancial && !lowerMessage.includes("spend") && !lowerMessage.includes("save") && !lowerMessage.includes("budget")) {
    return `👋 I'm Expensync AI, a financial assistant focused on helping you manage your expenses and budget. I can help you with:\n\n• Questions about your spending and income\n• Budgeting advice and tips\n• Analyzing your financial data\n• Suggestions on where to spend less\n\nFor general knowledge questions, I recommend using a search engine or AI assistant like ChatGPT. How can I help with your finances?`;
  }
  
  // Check for "where to spend remaining/saved money" questions
  if (lowerMessage.includes("where should i spend") || lowerMessage.includes("where to spend") || 
      lowerMessage.includes("where can i spend") || lowerMessage.includes("rest money") ||
      lowerMessage.includes("remaining money") || lowerMessage.includes("extra money") ||
      lowerMessage.includes("saved money") || lowerMessage.includes("where invest") ||
      lowerMessage.includes("how to spend") || lowerMessage.includes("best way to spend")) {
    
    // Calculate savings and provide investment/spending suggestions
    const savings = totalBalance > 0 ? totalBalance : 0;
    const expenseCategories = Object.entries(categories)
      .filter(([_, data]) => data.expense > 0)
      .sort((a, b) => b[1].expense - a[1].expense);
    
    if (savings > 0) {
      const recommendations = [];
      
      // Investment suggestions
      if (savings >= 10000) {
        recommendations.push(`💰 **Emergency Fund**: Set aside 6 months of expenses (₹${(totalExpense * 6).toLocaleString()}) for emergencies`);
        recommendations.push(`📈 **Investments**: Consider investing 30-40% in mutual funds, stocks, or fixed deposits`);
      }
      
      // Spending suggestions based on their current patterns
      if (expenseCategories.length > 0) {
        const lowSpendingCategories = expenseCategories
          .filter(([cat]) => !["Food", "Entertainment"].includes(cat))
          .slice(0, 2);
        
        recommendations.push(`🎯 **Wise Spending**: Your current spending is highest in ${expenseCategories[0][0]}. Consider balancing by spending on personal growth or health`);
      }
      
      recommendations.push(`📚 **Personal Development**: Invest in courses, books, or skills that can increase your income`);
      recommendations.push(`🏥 **Health & Insurance**: Set aside money for health insurance or medical expenses`);
      recommendations.push(`🏠 **Savings Goals**: Create specific savings goals for things you want (vacation, gadgets, etc.)`);
      
      return `Based on your current financial situation, here are some smart ways to use your remaining ₹${savings.toLocaleString()}:\n\n${recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join("\n")}\n\n💡 **My Recommendation**:\nSince you have ₹${savings.toLocaleString()} available:\n• Save 40% for emergencies (₹${(savings * 0.4).toLocaleString()})\n• Invest 30% for future growth (₹${(savings * 0.3).toLocaleString()})\n• Use 20% for personal development (₹${(savings * 0.2).toLocaleString()})\n• Keep 10% for flexible spending (₹${(savings * 0.1).toLocaleString()})\n\nThis balanced approach helps you build wealth while still enjoying life!`;
    } else {
      return `I see you currently have a negative balance (₹${Math.abs(totalBalance).toLocaleString()}), which means you're spending more than you earn.\n\n💡 **My Suggestion**:\nBefore thinking about where to spend extra money, focus on:\n1. **Reduce Current Spending**: Cut down on non-essential expenses\n2. **Increase Income**: Look for ways to earn more\n3. **Build Savings**: Once you have positive savings, then we can plan where to spend wisely\n\nWould you like me to help you identify areas where you can reduce spending?`;
    }
  }
  
  // Check for spending reduction suggestions
  if (lowerMessage.includes("spend less") || lowerMessage.includes("reduce spending") || 
      lowerMessage.includes("cut down") || lowerMessage.includes("save money") ||
      lowerMessage.includes("how to save") || lowerMessage.includes("reduce expenses")) {
    const expenseCategories = Object.entries(categories)
      .filter(([_, data]) => data.expense > 0)
      .sort((a, b) => b[1].expense - a[1].expense);
    
    if (expenseCategories.length > 0) {
      const topSpending = expenseCategories.slice(0, 3);
      const suggestions = topSpending.map(([cat, data], idx) => {
        const percentage = totalExpense > 0 ? ((data.expense / totalExpense) * 100).toFixed(1) : 0;
        return `${idx + 1}. **${cat}**: You're spending ₹${data.expense.toLocaleString()} here (${percentage}% of total expenses)`;
      }).join("\n");
      
      const actionableTips = [
        "Review your ${topSpending[0][0]} transactions - cancel unused subscriptions",
        "Compare prices before buying in your top spending categories",
        "Set monthly limits for ${topSpending[0][0]} category",
        "Use the Budget feature to track and control spending",
        "Look for cheaper alternatives or wait for sales"
      ];
      
      return `Here's how you can reduce your spending:\n\n**Your Top Spending Categories:**\n${suggestions}\n\n**Actionable Steps:**\n${actionableTips.map((tip, idx) => `${idx + 1}. ${tip.replace(/\$\{[^}]+\}/g, topSpending[0][0])}`).join("\n")}\n\n**Potential Savings:**\nIf you reduce your top 3 categories by just 20%, you could save ₹${(topSpending.reduce((sum, [_, data]) => sum + data.expense, 0) * 0.2).toLocaleString()} per month!\n\nThat's ₹${(topSpending.reduce((sum, [_, data]) => sum + data.expense, 0) * 0.2 * 12).toLocaleString()} per year that you could invest or save for something important.`;
    }
    return `Here are general tips to reduce spending:\n\n• Track all expenses carefully\n• Identify unnecessary subscriptions\n• Compare prices before purchasing\n• Set category-based budgets\n• Review your spending weekly\n• Use the Budget feature to set limits\n• Avoid impulse purchases\n• Plan meals to reduce food waste\n\nStart by tracking your expenses in Expensync, then we can identify specific areas to reduce!`;
  }
  
  // Check for month-specific comparisons
  if (monthType === "this month" && (lowerMessage.includes("compare") || lowerMessage.includes("vs") || lowerMessage.includes("versus"))) {
    const lastMonthTransactions = filterTransactionsByMonth(transactions, "last month");
    let lastMonthExpense = 0;
    let lastMonthIncome = 0;
    
    lastMonthTransactions.forEach((t) => {
      if (t.amount < 0) {
        lastMonthExpense += Math.abs(t.amount);
      } else {
        lastMonthIncome += t.amount;
      }
    });
    
    const expenseChange = lastMonthExpense > 0 ? ((totalExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;
    const incomeChange = lastMonthIncome > 0 ? ((totalIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    
    let comparison = `📊 ${monthPrefix}Comparison with Last Month:\n\n`;
    comparison += `💸 Expenses: ₹${totalExpense.toLocaleString()} ${expenseChange > 0 ? `(${expenseChange.toFixed(0)}% more)` : expenseChange < 0 ? `(${Math.abs(expenseChange).toFixed(0)}% less)` : `(similar)`} than last month\n`;
    comparison += `💰 Income: ₹${totalIncome.toLocaleString()} ${incomeChange > 0 ? `(${incomeChange.toFixed(0)}% more)` : incomeChange < 0 ? `(${Math.abs(incomeChange).toFixed(0)}% less)` : `(similar)`} than last month\n`;
    comparison += `📈 Balance: ₹${totalBalance.toLocaleString()}`;
    
    return comparison;
  }
  
  // Check for common question patterns
  if (lowerMessage.includes("income") || lowerMessage.includes("earn") || lowerMessage.includes("earned")) {
    if (filteredTransactions.length === 0 && monthType) {
      return `💰 ${monthPrefix}You haven't recorded any income transactions yet.`;
    }
    const topIncomeCategories = Object.entries(categories)
      .filter(([_, data]) => data.income > 0)
      .sort((a, b) => b[1].income - a[1].income)
      .slice(0, 2)
      .map(([cat, data]) => `${cat}: ₹${data.income.toLocaleString()}`)
      .join(", ");
    return `💰 ${monthPrefix}Your total income is ₹${totalIncome.toLocaleString()}.${topIncomeCategories ? ` Main sources: ${topIncomeCategories}` : ""}`;
  }
  
  if (lowerMessage.includes("expense") || lowerMessage.includes("spend") || lowerMessage.includes("spent")) {
    if (filteredTransactions.length === 0 && monthType) {
      return `💸 ${monthPrefix}You haven't recorded any expense transactions yet.`;
    }
    const topExpense = Object.entries(categories)
      .filter(([_, data]) => data.expense > 0)
      .sort((a, b) => (b[1].expense - a[1].expense))
      .slice(0, 3)
      .map(([cat, data]) => `${cat}: ₹${data.expense.toLocaleString()}`)
      .join(", ");
    return `💸 ${monthPrefix}Your total expenses are ₹${totalExpense.toLocaleString()}.${topExpense ? ` Top spending categories: ${topExpense}.` : " No expenses recorded yet."}`;
  }
  
  if (lowerMessage.includes("balance") || lowerMessage.includes("saving") || lowerMessage.includes("save")) {
    if (filteredTransactions.length === 0 && monthType) {
      return `📊 ${monthPrefix}You haven't recorded any transactions yet.`;
    }
    const savings = totalBalance > 0 ? totalBalance : 0;
    return `📊 ${monthPrefix}Your current balance is ₹${totalBalance.toLocaleString()}. ${totalBalance > 0 ? `Great job! You have ₹${savings.toLocaleString()} in savings.` : `You're spending ₹${Math.abs(totalBalance).toLocaleString()} more than your income. Consider reviewing your expenses.`}`;
  }
  
  if (lowerMessage.includes("category") || lowerMessage.includes("categories")) {
    const categoryList = Object.entries(categories)
      .filter(([_, data]) => data.expense > 0 || data.income > 0)
      .map(([cat, data]) => {
        const total = data.income + data.expense;
        return `• ${cat}: ₹${Math.abs(total).toLocaleString()}`;
      })
      .join("\n");
    return `📁 Your spending by category:\n${categoryList || "No transactions recorded yet."}`;
  }
  
  if (lowerMessage.includes("budget") || lowerMessage.includes("tip") || lowerMessage.includes("advice") || lowerMessage.includes("suggestion")) {
    const expenseCategories = Object.entries(categories)
      .filter(([_, data]) => data.expense > 0)
      .sort((a, b) => b[1].expense - a[1].expense);
    
    const savingsRate = totalIncome > 0 ? ((totalBalance / totalIncome) * 100) : 0;
    
    let personalizedAdvice = "";
    if (expenseCategories.length > 0) {
      const topCategory = expenseCategories[0];
      const categoryPercentage = totalExpense > 0 ? ((topCategory[1].expense / totalExpense) * 100).toFixed(1) : 0;
      
      personalizedAdvice = `\n\n**Based on Your Spending:**\n• Your highest expense is ${topCategory[0]} (₹${topCategory[1].expense.toLocaleString()} - ${categoryPercentage}% of expenses)\n• If you reduce ${topCategory[0]} by 15%, you'd save ₹${(topCategory[1].expense * 0.15).toLocaleString()} monthly\n• That's ₹${(topCategory[1].expense * 0.15 * 12).toLocaleString()} annually!`;
    }
    
    let savingsStatus = "";
    if (savingsRate >= 20) {
      savingsStatus = `\n\n✅ **Great job!** You're saving ${savingsRate.toFixed(1)}% which is excellent. Consider asking "Where should I spend my rest money?" for investment ideas.`;
    } else if (savingsRate > 0 && savingsRate < 20) {
      savingsStatus = `\n\n⚠️ **Note**: You're saving ${savingsRate.toFixed(1)}%. Aim for at least 20% for better financial security.`;
    } else {
      savingsStatus = `\n\n⚠️ **Alert**: You're spending ${Math.abs(savingsRate).toFixed(1)}% more than your income. Focus on reducing expenses first.`;
    }
    
    return `Here are my budgeting recommendations:\n\n**Essential Tips:**\n• Track every expense - awareness is the first step\n• Set category-based spending limits using the Budget feature\n• Review your spending weekly to catch patterns\n• Save at least 20% of income (aim for 30% if possible)\n• Create an emergency fund (6 months of expenses)\n• Avoid impulse purchases - wait 24 hours before buying\n• Compare prices - a little research can save a lot\n• Use cashback and discounts when available${personalizedAdvice}${savingsStatus}\n\n**Next Steps:**\n1. Set up budgets for your top spending categories\n2. Review transactions weekly\n3. Adjust budgets based on your actual spending\n4. Celebrate when you meet your savings goals!`;
  }
  
  if (lowerMessage.includes("help") || lowerMessage.includes("what can you do")) {
    return `🤖 I can help you with:\n\n• Analyzing your income and expenses\n• Providing spending breakdown by category\n• Calculating your savings and balance\n• Budgeting tips and financial advice\n• Suggestions on where to spend less\n• Answering questions about your transactions\n\nTry asking:\n• "What's my total income?"\n• "How much did I spend?"\n• "Where should I spend less?"\n• "Show my expenses by category"\n• "What's my balance?"\n• "Give me budgeting tips"`;
  }
  
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
    return `👋 Hello! I'm your Expensync AI assistant. I can help you analyze your finances, answer questions about your spending, and provide budgeting tips. What would you like to know?`;
  }
  
  // Default response with transaction summary and intelligent suggestions
  if (transactions.length > 0) {
    const expenseCategories = Object.entries(categories)
      .filter(([_, data]) => data.expense > 0)
      .sort((a, b) => b[1].expense - a[1].expense);
    
    let intelligentSuggestion = "";
    if (expenseCategories.length > 0) {
      const topCategory = expenseCategories[0];
      const savings = totalBalance > 0 ? totalBalance : 0;
      
      if (savings > 0) {
        intelligentSuggestion = `\n\n💡 **Smart Suggestion**: You have ₹${savings.toLocaleString()} in savings! Consider asking me "Where should I spend my rest money?" for personalized investment and spending recommendations.`;
      } else {
        intelligentSuggestion = `\n\n💡 **Insight**: Your highest spending is in ${topCategory[0]} at ₹${topCategory[1].expense.toLocaleString()} (${totalExpense > 0 ? ((topCategory[1].expense / totalExpense) * 100).toFixed(1) : 0}% of expenses). Ask me "Where should I spend less?" for specific reduction strategies.`;
      }
    }
    
    return `Here's your financial overview:\n\n💰 **Total Income**: ₹${totalIncome.toLocaleString()}\n💸 **Total Expenses**: ₹${totalExpense.toLocaleString()}\n📈 **Current Balance**: ₹${totalBalance.toLocaleString()}${intelligentSuggestion}\n\n**I can help you with:**\n• Analyzing your spending patterns\n• Suggesting where to spend wisely or save\n• Budgeting advice tailored to your data\n• Investment and savings recommendations\n\nTry asking:\n• "Where should I spend my rest money?"\n• "Where should I spend less?"\n• "Give me budgeting tips"\n• "What's my balance?"`;
  } else {
    return `I notice you haven't recorded any transactions yet. Once you start adding your income and expenses, I can provide personalized financial advice!\n\n**Here's what I can help with once you have data:**\n• Analyzing your spending patterns\n• Suggesting where to invest or save money\n• Identifying areas to reduce expenses\n• Providing budgeting strategies\n• Answering questions about your finances\n\n**To get started:**\n1. Add your income transactions\n2. Add your expense transactions\n3. Then ask me questions like:\n   - "Where should I spend my rest money?"\n   - "Where should I spend less?"\n   - "Give me budgeting tips"`;
  }
};

// 💬 Chat with AI Assistant
router.post("/chat/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { message, chatHistory = [] } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message is required." });
    }

    // Get user's transaction data for context
    const transactions = await Transaction.find({ userId });
    
    // Check if message is about "this month" or "last month"
    const lowerMessage = message.toLowerCase();
    let contextTransactions = transactions;
    
    if (lowerMessage.includes("this month") || lowerMessage.includes("current month")) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      contextTransactions = transactions.filter(t => {
        const txDate = new Date(t.date || t.createdAt);
        return txDate >= monthStart;
      });
    } else if (lowerMessage.includes("last month") || lowerMessage.includes("previous month")) {
      const now = new Date();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      contextTransactions = transactions.filter(t => {
        const txDate = new Date(t.date || t.createdAt);
        return txDate >= lastMonthStart && txDate <= lastMonthEnd;
      });
    }
    
    let contextSummary = "";
    if (contextTransactions && contextTransactions.length > 0) {
      const categories = {};
      let total = 0;
      let income = 0;
      let expense = 0;
      
      contextTransactions.forEach((t) => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
        total += t.amount;
        if (t.amount > 0) income += t.amount;
        else expense += Math.abs(t.amount);
      });

      const summary = Object.entries(categories)
        .map(([cat, amt]) => `${cat}: ₹${amt}`)
        .join(", ");
      
      const timeContext = lowerMessage.includes("this month") ? "this month" : 
                         lowerMessage.includes("last month") ? "last month" : "";
      
      contextSummary = `${timeContext ? `User's ${timeContext} ` : "User's "}spending: ${summary}. Income: ₹${income}, Expenses: ₹${expense}, Balance: ₹${total}. `;
    }

    // Check if OpenAI API key is valid
    const hasValidOpenAIKey = process.env.OPENAI_API_KEY && 
                               process.env.OPENAI_API_KEY !== "your-openai-api-key-here" &&
                               process.env.OPENAI_API_KEY.trim() !== "";

    let aiResponse;
    
    if (hasValidOpenAIKey) {
      try {
        // Build conversation history
        const messages = [
          {
            role: "system",
            content: "You are a helpful financial assistant named Expensync AI. Help users manage their expenses, answer questions about their spending, provide budgeting tips, and offer financial advice. Be friendly, concise, and practical. " + contextSummary
          },
          ...chatHistory.slice(-10), // Keep last 10 messages for context
          { role: "user", content: message }
        ];

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.7,
          max_tokens: 300,
        });

        aiResponse = completion.choices[0].message.content;
      } catch (openaiError) {
        console.error("OpenAI API error:", openaiError);
        // Fallback to intelligent responses
        aiResponse = generateFallbackResponse(message, transactions);
      }
    } else {
      // Use intelligent fallback when OpenAI is not configured
      aiResponse = generateFallbackResponse(message, transactions);
    }

    res.json({
      response: aiResponse,
      success: true
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ 
      message: error.message || "Error processing chat message. Please try again later.",
      success: false
    });
  }
});

// 📊 Get Smart Trend Insights for Dashboard
router.get("/trend-insights/:userId", async (req, res) => {
  try {
    console.log("📢 AI trend-insights route called for userId:", req.params.userId);
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required." 
      });
    }

    // Convert userId to ObjectId if it's a string
    const mongoose = require("mongoose");
    let userIdObjectId;
    try {
      userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
    } catch (err) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid user ID format." 
      });
    }

    // Get current month transactions
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentMonthTransactions = await Transaction.find({
      userId: userIdObjectId,
      date: { $gte: startOfCurrentMonth }
    });

    const lastMonthTransactions = await Transaction.find({
      userId: userIdObjectId,
      date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    // Calculate current month spending and income
    let currentMonthExpense = 0;
    let currentMonthIncome = 0;
    const currentMonthCategories = {};
    const allCategories = {};
    
    currentMonthTransactions.forEach((t) => {
      if (t.amount < 0) {
        const expense = Math.abs(t.amount);
        currentMonthExpense += expense;
        currentMonthCategories[t.category] = (currentMonthCategories[t.category] || 0) + expense;
        allCategories[t.category] = (allCategories[t.category] || 0) + expense;
      } else {
        currentMonthIncome += t.amount;
      }
    });

    // Calculate last month spending
    let lastMonthExpense = 0;
    lastMonthTransactions.forEach((t) => {
      if (t.amount < 0) {
        lastMonthExpense += Math.abs(t.amount);
      }
    });

    // Calculate percentage change
    let spendingChange = 0;
    let spendingChangeText = "";
    if (lastMonthExpense > 0) {
      spendingChange = ((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100;
      if (spendingChange > 0) {
        spendingChangeText = `You spent ${spendingChange.toFixed(0)}% more than last month.`;
      } else if (spendingChange < 0) {
        spendingChangeText = `You spent ${Math.abs(spendingChange).toFixed(0)}% less than last month.`;
      } else {
        spendingChangeText = `Your spending is similar to last month.`;
      }
    } else {
      spendingChangeText = `This is your first month of tracking expenses.`;
    }

    // Find top spending category
    let topCategory = "";
    let topCategoryPercentage = 0;
    let topCategoryAmount = 0;
    if (Object.keys(currentMonthCategories).length > 0) {
      const sortedCategories = Object.entries(currentMonthCategories)
        .sort((a, b) => b[1] - a[1]);
      topCategory = sortedCategories[0][0];
      topCategoryAmount = sortedCategories[0][1];
      topCategoryPercentage = currentMonthExpense > 0 
        ? ((topCategoryAmount / currentMonthExpense) * 100).toFixed(0)
        : 0;
    }

    // Find top 2 spending categories
    const sortedCategories = Object.entries(currentMonthCategories)
      .sort((a, b) => b[1] - a[1]);
    const topCategories = sortedCategories.slice(0, 2).map(([cat, amt]) => ({ category: cat, amount: amt }));

    // Generate personalized savings suggestions (2-3 suggestions)
    const savingsSuggestions = [];
    
    // Suggestion 1: Food category specific
    if (topCategory === "Food" && topCategoryAmount > 5000) {
      const weeklySpending = topCategoryAmount / 4;
      const savings = Math.round(weeklySpending * 0.3 * 2); // 30% savings if cooking at home twice a week
      savingsSuggestions.push(`Try reducing dining out to save ₹${savings.toLocaleString()} next month`);
    }
    
    // Suggestion 2: Entertainment category
    if (topCategory === "Entertainment" && topCategoryAmount > 3000) {
      const savings = Math.round(topCategoryAmount * 0.2);
      savingsSuggestions.push(`Cut ${topCategory} expenses by 20% to save ₹${savings.toLocaleString()} monthly`);
    }
    
    // Suggestion 3: General top category reduction
    if (topCategoryAmount > 0 && savingsSuggestions.length < 2) {
      const savings = Math.round(topCategoryAmount * 0.15);
      savingsSuggestions.push(`Reduce ${topCategory} spending by 15% to save ₹${savings.toLocaleString()} next month`);
    }

    // Generate conversational summary (under 6 sentences)
    let summary = "";
    const percentageChange = lastMonthExpense > 0 ? ((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;
    
    // Build concise summary
    if (currentMonthTransactions.length === 0) {
      summary = "You haven't recorded any transactions this month yet. Start tracking to get personalized insights! 📊";
    } else {
      // Sentence 1: Total spent and comparison
      if (percentageChange > 0) {
        summary += `This month, you spent ₹${currentMonthExpense.toLocaleString()} — ${Math.abs(percentageChange).toFixed(0)}% more than last month 📈`;
      } else if (percentageChange < 0) {
        summary += `This month, you spent ₹${currentMonthExpense.toLocaleString()} — ${Math.abs(percentageChange).toFixed(0)}% less than last month 📉`;
      } else if (lastMonthExpense > 0) {
        summary += `This month, you spent ₹${currentMonthExpense.toLocaleString()} — similar to last month 📊`;
      } else {
        summary += `This month, you spent ₹${currentMonthExpense.toLocaleString()}`;
      }
      
      // Sentence 2: Top spending categories
      if (topCategories.length > 0) {
        const categoryList = topCategories.map(c => c.category).join(" and ");
        summary += `. Most of your spending went into ${categoryList} ${topCategories.length === 1 ? "💸" : "🛍️"}`;
      }
      
      // Sentence 3: One personalized suggestion
      if (savingsSuggestions.length > 0) {
        summary += `. ${savingsSuggestions[0]}`;
      }
      
      // Final encouragement (part of last sentence)
      summary += `. Great work tracking your expenses! 💪`;
    }

    console.log("✅ AI trend-insights retrieved successfully");
    res.json({
      success: true,
      summary: summary,
      spendingChange: spendingChangeText,
      topCategory: topCategory || "N/A",
      topCategoryPercentage: topCategoryPercentage || 0,
      topCategoryAmount: topCategoryAmount || 0,
      topCategories: topCategories,
      savingsSuggestions: savingsSuggestions.slice(0, 3),
      currentMonthExpense,
      currentMonthIncome,
      lastMonthExpense,
      percentageChange: percentageChange.toFixed(1)
    });
  } catch (error) {
    console.error("❌ Trend insights error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message || "Error fetching trend insights. Please try again later." 
    });
  }
});

module.exports = router;
