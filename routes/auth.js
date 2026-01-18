const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const emailVerificationService = require("../services/emailVerificationService");

const router = express.Router();


// Rate Limiter (Brute-force protection)

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // max 5 attempts per IP
    message: { msg: "Too many login attempts. Try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // ✅ Only count failed login attempts
});


// Signup

router.post("/signup", async (req, res) => {
    try {
        console.log("📢 Signup request received:", { name: req.body.name, email: req.body.email });
        
        const { name, email, password } = req.body;
        
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false,
                msg: "Please provide all required fields: name, email, and password." 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false,
                msg: "Please provide a valid email address." 
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false,
                msg: "Password must be at least 6 characters long." 
            });
        }

        // Check if user already exists
        let user = await User.findOne({ email: email.toLowerCase().trim() });
        if (user) {
            return res.status(400).json({ 
                success: false,
                msg: "User already exists with this email." 
            });
        }

        // Optional: Check for disposable email domains
        if (process.env.BLOCK_DISPOSABLE_EMAILS === "true") {
            if (emailVerificationService.isDisposableEmail(email)) {
                return res.status(400).json({ 
                    success: false,
                    msg: "Disposable email addresses are not allowed. Please use a permanent email address." 
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user
        user = new User({ 
            name: name.trim(),
            email: email.toLowerCase().trim(), 
            password: hashedPassword,
        });
        
        await user.save();
        
        console.log("✅ User registered successfully:", user.email);

        res.status(201).json({ 
            success: true,
            msg: "User registered successfully!" 
        });
    } catch (err) {
        console.error("❌ Signup error:", err);
        
        // Handle specific MongoDB errors
        if (err.code === 11000) {
            return res.status(400).json({ 
                success: false,
                msg: "User already exists with this email." 
            });
        }
        
        if (err.name === 'ValidationError') {
            const errorMessages = Object.values(err.errors).map(e => e.message).join(', ');
            return res.status(400).json({ 
                success: false,
                msg: `Validation error: ${errorMessages}` 
            });
        }

        res.status(500).json({ 
            success: false,
            msg: err.message || "Server Error. Please try again later.",
            ...(process.env.NODE_ENV === 'development' && { error: err.toString() })
        });
    }
});


// Login

router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ msg: "Please provide both email and password." });
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

        // Store refresh token in user
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.json({ accessToken, refreshToken });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
});


// Refresh Token

router.post("/refresh-token", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ msg: "No refresh token provided" });

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(403).json({ msg: "Refresh token not recognized" });
        }

        const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
        res.json({ accessToken });
    } catch (err) {
        res.status(403).json({ msg: "Invalid or expired refresh token" });
    }
});


// Logout

router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ msg: "Refresh token required" });

    try {
        const user = await User.findOne({ refreshTokens: refreshToken });
        if (user) {
            user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
            await user.save();
        }
        res.json({ msg: "Logged out successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server Error" });
    }
});

// Verify Email
router.get("/verify-email", async (req, res) => {
    try {
        const { token } = req.query;
        
        console.log("🔍 Verification request received, token:", token ? token.substring(0, 10) + "..." : "missing");
        
        if (!token) {
            console.warn("⚠️ Verification attempt without token");
            return res.status(400).json({ 
                success: false,
                msg: "Verification token is required." 
            });
        }

        // Find user with this token
        const user = await User.findOne({ 
            emailVerificationToken: token,
            emailVerified: false,
        });

        if (!user) {
            console.warn("⚠️ Verification token not found or user already verified");
            // Check if user exists but is already verified
            const verifiedUser = await User.findOne({ emailVerificationToken: token });
            if (verifiedUser && verifiedUser.emailVerified) {
                return res.status(400).json({ 
                    success: false,
                    msg: "This email has already been verified. You can log in normally." 
                });
            }
            return res.status(400).json({ 
                success: false,
                msg: "Invalid or expired verification token." 
            });
        }

        // Check if token has expired
        if (user.emailVerificationTokenExpiry && new Date() > user.emailVerificationTokenExpiry) {
            return res.status(400).json({ 
                success: false,
                msg: "Verification token has expired. Please request a new verification email.",
                tokenExpired: true,
            });
        }

        // Mark email as verified and clear token
        user.emailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationTokenExpiry = null;
        await user.save();

        console.log("✅ Email verified successfully:", user.email);

        res.json({ 
            success: true,
            msg: "Email verified successfully! You can now log in to your account." 
        });
    } catch (err) {
        console.error("Error verifying email:", err);
        res.status(500).json({ 
            success: false,
            msg: "Server Error. Please try again later." 
        });
    }
});

// Resend Verification Email
router.post("/resend-verification", async (req, res) => {
    try {
        console.log("📧 Resend verification request received");
        const { email } = req.body;
        
        if (!email) {
            console.warn("⚠️ Resend verification: No email provided");
            return res.status(400).json({ 
                success: false,
                msg: "Email address is required." 
            });
        }

        console.log("🔍 Looking for user with email:", email.toLowerCase().trim());
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            // Don't reveal if user exists (security best practice)
            console.log("ℹ️ User not found (or security response)");
            return res.json({ 
                success: true,
                msg: "If an account exists with this email, a verification link has been sent." 
            });
        }

        console.log("✅ User found:", user.email, "Verified:", user.emailVerified);

        if (user.emailVerified) {
            return res.status(400).json({ 
                success: false,
                msg: "Email is already verified. You can log in normally." 
            });
        }

        // Generate new verification token
        console.log("🔑 Generating new verification token...");
        const verificationToken = emailVerificationService.generateVerificationToken();
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 24);

        user.emailVerificationToken = verificationToken;
        user.emailVerificationTokenExpiry = tokenExpiry;
        await user.save();
        console.log("✅ Token saved to database");

        // Send verification email (non-blocking, but we wait for result)
        console.log("📧 Sending verification email...");
        try {
            const emailResult = await emailVerificationService.sendVerificationEmail(
                user.email,
                user.name,
                verificationToken
            );

            console.log("📧 Email send result:", emailResult);

            if (emailResult && emailResult.sent) {
                res.json({ 
                    success: true,
                    msg: "Verification email sent successfully. Please check your inbox." 
                });
            } else {
                // Even if email fails, we still return success (user can try again)
                // But log the error for debugging
                console.warn("⚠️ Email send failed:", emailResult?.reason || "Unknown error");
                res.json({ 
                    success: true,
                    msg: "Verification email request processed. If you don't receive an email, please check your email configuration or try again later.",
                    emailSent: false,
                    reason: emailResult?.reason,
                });
            }
        } catch (emailError) {
            console.error("❌ Error in email sending:", emailError);
            // Don't fail the request if email fails - user can try again
            res.json({ 
                success: true,
                msg: "Verification email request processed. If you don't receive an email, please check your email configuration or try again later.",
                emailSent: false,
                reason: emailError.message,
            });
        }
    } catch (err) {
        console.error("❌ Error resending verification email:", err);
        console.error("Error stack:", err.stack);
        res.status(500).json({ 
            success: false,
            msg: err.message || "Server Error. Please try again later.",
            ...(process.env.NODE_ENV === 'development' && { error: err.toString(), stack: err.stack })
        });
    }
});

// Test endpoint for debugging (remove in production)
if (process.env.NODE_ENV === 'development') {
    router.get("/test-email-config", async (req, res) => {
        try {
            const hasConfig = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            
            res.json({
                emailConfigured: hasConfig,
                emailHost: process.env.EMAIL_HOST || "not set",
                emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 3) + "***" : "not set",
                frontendUrl: frontendUrl,
                message: hasConfig 
                    ? "Email configuration looks good. Check server logs when sending emails." 
                    : "Email not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env",
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = router;
