const healthService = require("../services/financialHealthService");

// Get current financial health score
exports.getFinancialHealthScore = async (req, res) => {
  try {
    const userId = req.user;
    const result = await healthService.calculateFinancialHealthScore(userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching financial health score:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get historical health scores for trend chart
exports.getHistoricalHealthScores = async (req, res) => {
  try {
    const userId = req.user;
    const months = parseInt(req.query.months) || 6;

    const result = await healthService.getHistoricalHealthScores(userId, months);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching historical health scores:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
