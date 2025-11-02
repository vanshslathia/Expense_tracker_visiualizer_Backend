const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const aiRoutes = require("./routes/aiRoutes");

// Load environment variables from .env file
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error("❌ ERROR: JWT_SECRET is not set in .env file!");
  process.exit(1);
}
if (!process.env.REFRESH_TOKEN_SECRET) {
  console.error("❌ ERROR: REFRESH_TOKEN_SECRET is not set in .env file!");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not set in .env file!");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Test Route
app.get("/", (req, res) => {
  res.send("API running 🎯");
});

app.get("/api/v1", (req, res) => {
  res.send("Backend is running!");
});

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// API Routes
app.use("/api/ai", aiRoutes);
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/transactions", require("./routes/transactions"));
app.use("/api/v1/budgets", require("./routes/budgets"));
app.use("/api/v1/category-goals", require("./routes/categoryBudgetRoutes"));
app.use("/api/v1/debts", require("./routes/debts"));
app.use("/api/v1/summary", require("./routes/summary"));     
app.use("/api/v1/reminders", require("./routes/reminders"));

// 404 Handler for unmatched routes
app.use((req, res, next) => {
  console.log(`⚠️ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "/api/ai/analyze/:userId",
      "/api/ai/trend-insights/:userId",
      "/api/ai/chat/:userId",
      "/api/v1/category-goals/alerts",
      "/api/v1/category-goals",
      "/api/v1/auth/login",
      "/api/v1/transactions",
      "/api/v1/budgets",
      "/api/v1/debts",
      "/api/v1/summary",
      "/api/v1/reminders"
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("📋 Registered routes:");
  console.log("   - /api/ai/*");
  console.log("   - /api/v1/category-goals/alerts");
  console.log("   - /api/v1/auth/*");
  console.log("   - /api/v1/transactions/*");
  console.log("   - /api/v1/budgets/*");
  console.log("   - /api/v1/debts/*");
  console.log("   - /api/v1/summary/*");
  console.log("   - /api/v1/reminders/*");
});
