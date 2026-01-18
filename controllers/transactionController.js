const Transaction = require("../models/Transaction");
const User = require("../models/User");
const PDFDocument = require("pdfkit");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const PptxGenJS = require("pptxgenjs");
const budgetAlertService = require("../services/budgetAlertService");

// Shared chart renderer (used for PDF & PPT exports)
const chartRenderer = new ChartJSNodeCanvas({
    width: 900,
    height: 500,
    backgroundColour: "white",
});

const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

const buildTotals = (transactions) => {
    return transactions.reduce(
        (acc, txn) => {
            if (txn.amount >= 0) {
                acc.income += txn.amount;
            } else {
                acc.expense += Math.abs(txn.amount);
            }
            return acc;
        },
        { income: 0, expense: 0 }
    );
};

const buildCategorySpending = (transactions) => {
    const totals = {};
    transactions.forEach((txn) => {
        if (txn.amount >= 0) return; // spending only
        const category = txn.category || "Uncategorized";
        totals[category] = (totals[category] || 0) + Math.abs(txn.amount);
    });
    return totals;
};

const buildMonthlySpending = (transactions) => {
    const monthly = {};
    transactions.forEach((txn) => {
        if (txn.amount >= 0) return; // spending only
        const monthKey = new Date(txn.date || txn.createdAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
        });
        monthly[monthKey] = (monthly[monthKey] || 0) + Math.abs(txn.amount);
    });
    // Sort by date
    return Object.entries(monthly).sort(
        ([a], [b]) => new Date(a) - new Date(b)
    );
};

const renderCharts = async (transactions) => {
    const categoryTotals = buildCategorySpending(transactions);
    const monthlyTotals = buildMonthlySpending(transactions);

    const pieLabels = Object.keys(categoryTotals);
    const pieData = Object.values(categoryTotals);

    const barLabels = monthlyTotals.map(([label]) => label);
    const barData = monthlyTotals.map(([_, value]) => value);

    const safePieData = pieData.length ? pieData : [1];
    const safePieLabels = pieLabels.length ? pieLabels : ["No spending data"];

    const safeBarData = barData.length ? barData : [0];
    const safeBarLabels = barLabels.length ? barLabels : ["No spending"];

    const pieBuffer = await chartRenderer.renderToBuffer({
        type: "pie",
        data: {
            labels: safePieLabels,
            datasets: [
                {
                    data: safePieData,
                    backgroundColor: [
                        "#6366F1",
                        "#22D3EE",
                        "#F97316",
                        "#10B981",
                        "#EF4444",
                        "#8B5CF6",
                        "#14B8A6",
                    ],
                },
            ],
        },
        options: {
            plugins: {
                legend: { position: "right" },
                title: {
                    display: true,
                    text: "Spending by Category",
                },
            },
        },
    });

    const barBuffer = await chartRenderer.renderToBuffer({
        type: "bar",
        data: {
            labels: safeBarLabels,
            datasets: [
                {
                    label: "Monthly Spending",
                    data: safeBarData,
                    backgroundColor: "#6366F1",
                },
            ],
        },
        options: {
            scales: {
                y: { beginAtZero: true, title: { display: true, text: "Amount" } },
                x: { title: { display: true, text: "Month" } },
            },
        },
    });

    return { pieBuffer, barBuffer, pieLabels: safePieLabels, barLabels: safeBarLabels };
};

const buildCsv = (transactions) => {
    const escapeCell = (value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = transactions.map((txn) => [
        formatDate(txn.date || txn.createdAt),
        txn.category || "Uncategorized",
        txn.amount,
        txn.note || "",
    ]);
    const header = ["Date", "Category", "Amount", "Note"];
    return [header.join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join(
        "\n"
    );
};

const createPdfBuffer = async ({
    transactions,
    userName,
    totals,
    pieBuffer,
    barBuffer,
    exportDate,
    monthLabel,
    monthlySpending,
}) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (d) => chunks.push(d));

    // Title & meta
    doc.fontSize(20).text(`Monthly Expense Report (${monthLabel})`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`User: ${userName}`);
    doc.text(`Exported: ${exportDate}`);
    doc.moveDown(0.5);
    doc.text(
        `Summary: Income ₹${totals.income.toLocaleString()} | Expense ₹${totals.expense.toLocaleString()} | Net ₹${(totals.income - totals.expense).toLocaleString()}`
    );
    doc.moveDown(0.3);
    doc.text(`Total spending (${monthLabel}): ₹${monthlySpending.toLocaleString()}`);
    doc.moveDown();

    // Charts
    doc.fontSize(14).text("Spending Insights", { underline: true });
    doc.moveDown(0.5);
    doc.image(pieBuffer, { fit: [480, 280], align: "center" });
    doc.moveDown(0.3);
    doc.image(barBuffer, { fit: [480, 280], align: "center" });
    doc.addPage();

    // Table header
    const columns = [
        { key: "date", label: "Date", width: 90 },
        { key: "category", label: "Category", width: 130 },
        { key: "amount", label: "Amount", width: 90 },
        { key: "note", label: "Note", width: 180 },
    ];

    const drawHeader = () => {
        doc.fontSize(14).text("Transactions", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica-Bold");
        const startX = doc.x;
        let x = startX;
        columns.forEach((col) => {
            doc.text(col.label, x, doc.y, { width: col.width });
            x += col.width;
        });
        doc.moveDown(0.3);
        doc.moveTo(startX, doc.y).lineTo(startX + columns.reduce((a, c) => a + c.width, 0), doc.y).stroke();
        doc.moveDown(0.3);
    };

    const startNewPage = () => {
        doc.addPage();
        drawHeader();
    };

    drawHeader();
    doc.fontSize(10).font("Helvetica");

    transactions.forEach((txn) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
            startNewPage();
        }
        const row = {
            date: formatDate(txn.date || txn.createdAt),
            category: txn.category || "Uncategorized",
            amount: `₹${txn.amount.toLocaleString()}`,
            note: txn.note || "",
        };
        let x = doc.x;
        columns.forEach((col) => {
            doc.text(row[col.key], x, doc.y, {
                width: col.width,
                ellipsis: true,
            });
            x += col.width;
        });
        doc.moveDown(0.6);
    });

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
};

const createPptBuffer = async ({
    transactions,
    userName,
    totals,
    pieBuffer,
    barBuffer,
    exportDate,
    monthLabel,
    monthlySpending,
}) => {
    const pptx = new PptxGenJS();
    const net = totals.income - totals.expense;

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(`Monthly Expense Report (${monthLabel})`, {
        x: 0.5,
        y: 0.7,
        fontSize: 34,
        bold: true,
        color: "363636",
    });
    titleSlide.addText(`User: ${userName}`, { x: 0.5, y: 1.8, fontSize: 18 });
    titleSlide.addText(`Exported: ${exportDate}`, {
        x: 0.5,
        y: 2.3,
        fontSize: 18,
    });

    // Key metrics
    const metricsSlide = pptx.addSlide();
    metricsSlide.addText("Key Metrics", {
        x: 0.5,
        y: 0.5,
        fontSize: 24,
        bold: true,
    });
    metricsSlide.addText(
        [
            { text: `Total Income: ₹${totals.income.toLocaleString()}\n`, options: { fontSize: 18, bold: true } },
            { text: `Total Expense: ₹${totals.expense.toLocaleString()}\n`, options: { fontSize: 18, bold: true } },
            { text: `Net: ₹${net.toLocaleString()}\n`, options: { fontSize: 18, bold: true, color: net >= 0 ? "00AA55" : "CC0000" } },
            { text: `Spending (${monthLabel}): ₹${monthlySpending.toLocaleString()}\n`, options: { fontSize: 18, bold: true } },
        ],
        { x: 0.5, y: 1.2, fontSize: 16 }
    );

    // Insights
    const categoryTotals = buildCategorySpending(transactions);
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const monthlyTotals = buildMonthlySpending(transactions);
    const lastMonth = monthlyTotals[monthlyTotals.length - 1];
    const insights = [];
    if (topCategory) insights.push(`Highest spending category: ${topCategory[0]} (₹${topCategory[1].toLocaleString()})`);
    if (lastMonth) insights.push(`Latest month spend: ${lastMonth[0]} (₹${lastMonth[1].toLocaleString()})`);
    if (!insights.length) insights.push("No spending insights available yet.");
    metricsSlide.addText(insights.map((t) => `• ${t}`).join("\n"), {
        x: 0.5,
        y: 2.4,
        fontSize: 16,
    });

    // Charts slide
    const chartsSlide = pptx.addSlide();
    chartsSlide.addText("Spending Charts", {
        x: 0.5,
        y: 0.5,
        fontSize: 24,
        bold: true,
    });
    chartsSlide.addImage({
        data: `data:image/png;base64,${pieBuffer.toString("base64")}`,
        x: 0.5,
        y: 1,
        w: 4.5,
        h: 3,
    });
    chartsSlide.addImage({
        data: `data:image/png;base64,${barBuffer.toString("base64")}`,
        x: 5.2,
        y: 1,
        w: 4.5,
        h: 3,
    });

    // Transactions table (recent 12)
    const tableSlide = pptx.addSlide();
    tableSlide.addText("Recent Transactions", {
        x: 0.5,
        y: 0.5,
        fontSize: 24,
        bold: true,
    });
    const tableRows = [
        [
            { text: "Date", options: { bold: true } },
            { text: "Category", options: { bold: true } },
            { text: "Amount", options: { bold: true } },
            { text: "Note", options: { bold: true } },
        ],
        ...transactions.slice(0, 12).map((txn) => [
            formatDate(txn.date || txn.createdAt),
            txn.category || "Uncategorized",
            `₹${txn.amount.toLocaleString()}`,
            txn.note || "",
        ]),
    ];
    tableSlide.addTable(tableRows, {
        x: 0.5,
        y: 1.1,
        w: 9,
        colW: [1.7, 2.4, 1.6, 3.3],
        border: { color: "DDDDDD" },
        fontSize: 12,
    });

    return pptx.write("nodebuffer");
};

// Create a new transaction
exports.createTransaction = async (req, res) => {
    try {
        const { title, amount, category, note, tags, date } = req.body;
        const userId = req.user;

        if (!title || amount === undefined) {
            return res.status(400).json({ message: "Title and amount are required" });
        }

        const newTransaction = new Transaction({
            title: title.trim(),
            amount: Number(amount),
            category: category?.trim() || "Others",
            note: note?.trim() || '',
            tags: tags?.map(t => t.trim()) || [],
            date: date ? new Date(date) : Date.now(),
            userId,
        });

        const savedTransaction = await newTransaction.save();
        
        // Check budget alerts asynchronously (don't block response)
        // Only check if it's an expense (negative amount)
        if (savedTransaction.amount < 0) {
          budgetAlertService.checkAndSendBudgetAlerts(userId).catch((err) => {
            console.error("Error checking budget alerts (non-blocking):", err);
          });
        }
        
        res.status(201).json(savedTransaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// GET /transactions?page=1&limit=10 (PAGINATION)
// GET /transactions?page=1&limit=10&search=food&filter=Food
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", filter = "" } = req.query;
    const skip = (page - 1) * limit;

    // 🔎 Base query: only user's transactions
    const query = { userId: req.user };

    // ✅ Search (case-insensitive on title, note, tags)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // ✅ Filter by category
    if (filter) {
      query.category = filter;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 }) // latest first
      .skip(skip)
      .limit(Number(limit))
      .lean(); // ⚡ light payload

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Failed to fetch transactions" });
  }
};


// Transaction summary
exports.getTransactionSummary = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user });

        let income = 0, expense = 0;
        transactions.forEach(txn => {
            if (txn.amount >= 0) income += txn.amount;
            else expense += Math.abs(txn.amount);
        });

        res.status(200).json({
            totalTransactions: transactions.length,
            income,
            expense,
            net: income - expense,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching summary", error: error.message });
    }
};

// Delete transaction with authorization
exports.deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;

        const deletedTransaction = await Transaction.findOneAndDelete({ _id: id, userId });
        if (!deletedTransaction) {
            return res.status(404).json({ message: "Transaction not found or unauthorized" });
        }

        const transactions = await Transaction.find({ userId }).sort({ date: -1 });
        res.status(200).json({
            message: "Transaction deleted successfully",
            transactions,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting transaction", error: error.message });
    }
};

// Export transactions in PDF/CSV/PPT
exports.exportTransactions = async (req, res) => {
    try {
        const { format = "pdf", search = "", filter = "", month, year } = req.query;
        const userId = req.user;
        const user = await User.findById(userId).lean();
        const userName = user?.name || "User";

        const monthInt = parseInt(month, 10);
        const yearInt = parseInt(year, 10);
        if (
            Number.isNaN(monthInt) ||
            Number.isNaN(yearInt) ||
            monthInt < 1 ||
            monthInt > 12 ||
            yearInt < 1970
        ) {
            return res.status(400).json({ message: "Invalid month or year" });
        }

        const startDate = new Date(Date.UTC(yearInt, monthInt - 1, 1, 0, 0, 0));
        const endDate = new Date(Date.UTC(yearInt, monthInt, 0, 23, 59, 59, 999));
        const monthLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        const query = {
            userId,
            date: { $gte: startDate, $lte: endDate },
        };
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { note: { $regex: search, $options: "i" } },
                { tags: { $regex: search, $options: "i" } },
            ];
        }
        if (filter) {
            query.category = filter;
        }

        const transactions = await Transaction.find(query).sort({ date: -1 }).lean();
        if (!transactions.length) {
            return res.status(404).json({ message: "No records found for this month." });
        }

        const totals = buildTotals(transactions);
        const monthlySpending = transactions.reduce((acc, txn) => {
            if (txn.amount < 0) acc += Math.abs(txn.amount);
            return acc;
        }, 0);
        const { pieBuffer, barBuffer } = await renderCharts(transactions);
        const exportDate = new Date().toISOString().split("T")[0];
        const baseName = `Expense_Report_${monthLabel.replace(/\s+/g, "_")}.${format === "ppt" ? "pptx" : format}`;

        if (format === "csv") {
            const csv = buildCsv(transactions);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`);
            return res.send(csv);
        }

        if (format === "ppt" || format === "pptx") {
            const pptBuffer = await createPptBuffer({
                transactions,
                userName,
                totals,
                pieBuffer,
                barBuffer,
                exportDate,
                monthLabel,
                monthlySpending,
            });
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            );
            res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`);
            return res.send(pptBuffer);
        }

        // Default to PDF
        const pdfBuffer = await createPdfBuffer({
            transactions,
            userName,
            totals,
            pieBuffer,
            barBuffer,
            exportDate,
            monthLabel,
            monthlySpending,
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error exporting transactions:", error);
        res.status(500).json({ message: "Failed to export data", error: error.message });
    }
};
