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


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
