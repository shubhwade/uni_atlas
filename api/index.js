const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../abroadready/.env") });

const { securityHeaders, rateLimitMiddleware } = require("../abroadready/lib/security");
const { errorHandler, notFoundHandler } = require("../abroadready/lib/errors");

const app = express();

app.disable("x-powered-by");
app.use(securityHeaders);
app.use(rateLimitMiddleware(1000, 15 * 60 * 1000));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "../abroadready/public")));
app.use("/uploads", express.static(path.join(__dirname, "../abroadready/uploads")));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../abroadready/views/landing.html"));
});

// Import and mount all routes
try {
  const authRoutes = require("../abroadready/routes/auth");
  const adminRoutes = require("../abroadready/routes/admin");
  const budgetRoutes = require("../abroadready/routes/budget");
  const communityRoutes = require("../abroadready/routes/community");
  const countriesRoutes = require("../abroadready/routes/countries");
  const coursesRoutes = require("../abroadready/routes/courses");
  const financeRoutes = require("../abroadready/routes/finance");
  const loansRoutes = require("../abroadready/routes/loans");
  const notificationsRoutes = require("../abroadready/routes/notifications");
  const portfolioRoutes = require("../abroadready/routes/portfolio");
  const predictionsRoutes = require("../abroadready/routes/predictions");
  const profileRoutes = require("../abroadready/routes/profile");
  const resumesRoutes = require("../abroadready/routes/resumes");
  const scholarshipsRoutes = require("../abroadready/routes/scholarships");
  const shortlistRoutes = require("../abroadready/routes/shortlist");
  const universitiesRoutes = require("../abroadready/routes/universities");

  app.use("/", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/community", communityRoutes);
  app.use("/api/countries", countriesRoutes);
  app.use("/api/courses", coursesRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/loans", loansRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/portfolios", portfolioRoutes);
  app.use("/api/predictions", predictionsRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/resumes", resumesRoutes);
  app.use("/api/scholarships", scholarshipsRoutes);
  app.use("/api/shortlist", shortlistRoutes);
  app.use("/api/universities", universitiesRoutes);
} catch (err) {
  console.error("Error loading routes:", err);
}

app.use(notFoundHandler);
app.use(errorHandler);

// Export as serverless handler
module.exports = app;
