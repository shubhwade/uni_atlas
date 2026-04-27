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
  res.json({ status: "ok" });
});

// Import and mount all routes
try {
  app.use("/", require("../abroadready/routes/auth"));
  app.use("/api/admin", require("../abroadready/routes/admin"));
  app.use("/api/budgets", require("../abroadready/routes/budget"));
  app.use("/api/community", require("../abroadready/routes/community"));
  app.use("/api/countries", require("../abroadready/routes/countries"));
  app.use("/api/courses", require("../abroadready/routes/courses"));
  app.use("/api/finance", require("../abroadready/routes/finance"));
  app.use("/api/loans", require("../abroadready/routes/loans"));
  app.use("/api/notifications", require("../abroadready/routes/notifications"));
  app.use("/api/portfolios", require("../abroadready/routes/portfolio"));
  app.use("/api/predictions", require("../abroadready/routes/predictions"));
  app.use("/api/profile", require("../abroadready/routes/profile"));
  app.use("/api/resumes", require("../abroadready/routes/resumes"));
  app.use("/api/scholarships", require("../abroadready/routes/scholarships"));
  app.use("/api/shortlist", require("../abroadready/routes/shortlist"));
  app.use("/api/universities", require("../abroadready/routes/universities"));
} catch (err) {
  console.error("Error loading routes:", err);
}

app.use(notFoundHandler);
app.use(errorHandler);

// Export as serverless handler
module.exports = app;
