require("dotenv").config();
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
// CORS configuration - Allow requests from Vercel frontend
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
    ];
    
    // Check if origin matches exact strings
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check if origin is a Vercel domain (using string check instead of regex)
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // For development/production, allow all origins for now
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test Route
app.get("/", (req, res) => {
  res.send("API running 🎯");
});

app.get("/api/v1", (req, res) => {
  res.json({ 
    message: "Backend is running!",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    message: "Server is healthy",
    routes: {
      ai: "/api/ai/trend-insights/:userId",
      alerts: "/api/v1/category-goals/alerts",
      categoryGoals: "/api/v1/category-goals"
    }
  });
});

// MongoDB Connection
// Validate MONGO_URI format before attempting connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not set!");
  process.exit(1);
}

if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
  console.error("❌ ERROR: MONGO_URI must start with 'mongodb://' or 'mongodb+srv://'");
  console.error("   Current value starts with:", MONGO_URI.substring(0, 20) + "...");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    // Add connection options for better reliability
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    console.log("📊 Database:", mongoose.connection.name);
    console.log("🔗 Host:", mongoose.connection.host);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    if (err.message.includes('Invalid scheme')) {
      console.error("💡 Your MONGO_URI format is incorrect!");
      console.error("   It should start with: mongodb:// or mongodb+srv://");
      console.error("   Example: mongodb+srv://user:pass@cluster.mongodb.net/dbname");
    } else if (err.message.includes('authentication')) {
      console.error("💡 Check your MongoDB username and password");
    } else if (err.message.includes('timeout')) {
      console.error("💡 Check your MongoDB connection string and network");
    } else {
      console.error("💡 Please verify your MONGO_URI in environment variables");
    }
    // Don't exit - let server start so health check works, but operations will fail
    console.warn("⚠️  Server will start but database operations will fail until MongoDB connects");
  });

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on('disconnected', () => {
  console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
});

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log(`📦 Body:`, req.body);
  }
  next();
});

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

// Export app for Vercel serverless functions
// For Vercel, we need to export the app directly
// For local development, start the server normally
if (require.main === module) {
  // Running locally - start the server
  const startServer = () => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log("📋 Registered routes:");
      console.log("   ✅ GET  /health");
      console.log("   ✅ GET  /api/v1");
      console.log("   ✅ POST /api/v1/auth/signup");
      console.log("   ✅ POST /api/v1/auth/login");
      console.log("   ✅ GET  /api/v1/category-goals/alerts");
      console.log("   ✅ GET  /api/ai/trend-insights/:userId");
      console.log("   ✅ GET  /api/ai/analyze/:userId");
      console.log("   ✅ POST /api/ai/chat/:userId");
      console.log("   ✅ GET  /api/v1/transactions");
      console.log("   ✅ GET  /api/v1/budgets");
      console.log("   ✅ GET  /api/v1/debts");
      console.log("   ✅ GET  /api/v1/summary");
      console.log("   ✅ GET  /api/v1/reminders");
      console.log("\n💡 Server is ready to accept requests!");
      
      // Log MongoDB connection status
      if (mongoose.connection.readyState === 1) {
        console.log("✅ MongoDB: Connected");
      } else if (mongoose.connection.readyState === 2) {
        console.log("🟡 MongoDB: Connecting...");
      } else {
        console.log("⚠️  MongoDB: Not connected (check MONGO_URI)");
      }
    });
  };

  startServer();
}

// Export for Vercel serverless
module.exports = app;
