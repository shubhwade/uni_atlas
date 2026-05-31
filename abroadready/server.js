const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cookieSession = require("cookie-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const { getDB } = require("./database/db");
const { requireAuth, requireAdmin } = require("./lib/middleware");
const { registerCronJobs } = require("./lib/cron");
const { securityHeaders, rateLimitMiddleware } = require("./lib/security");
const { errorHandler, notFoundHandler } = require("./lib/errors");
const { getLogger } = require("./lib/logger");

const app = express();

app.disable("x-powered-by");
app.enable("trust proxy");
app.use(securityHeaders);
// Rate limit: 1000 requests per 15 minutes per IP (generous for dev/personal use)
app.use(rateLimitMiddleware(1000, 15 * 60 * 1000));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "dev_secret_change_me"],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  }),
);

// Patch for Passport 0.6.0+ which requires regenerate/save methods not provided by cookie-session
app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = (cb) => cb();
  }
  if (req.session && !req.session.save) {
    req.session.save = (cb) => cb();
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

const staticOptions = {
  maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  etag: true,
};
app.use(express.static(path.join(__dirname, "public"), staticOptions));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), staticOptions));

function sendView(res, fileName) {
  res.sendFile(path.join(__dirname, "views", fileName));
}

// Passport (Google OAuth) - optional if env vars present
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.NODE_ENV === "production" 
          ? "https://abroadready.vercel.app/auth/google/callback" 
          : (process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"),
        proxy: true
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          const db = getDB();
          const googleId = profile.id;
          const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
          const name = profile.displayName || "";
          const avatar = (profile.photos && profile.photos[0] && profile.photos[0].value) || "";

          let user = null;
          if (email) user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
          if (!user) user = db.prepare("SELECT * FROM users WHERE google_id=?").get(googleId);

          const now = new Date().toISOString();
          if (!user) {
            const info = db
              .prepare("INSERT INTO users (email, name, google_id, avatar, email_verified, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
              .run(email || `google_${googleId}@example.com`, name, googleId, avatar, 1, now, now);
            const userId = Number(info.lastInsertRowid);
            db.prepare("INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)").run(userId);
            return done(null, { id: userId });
          }

          db.prepare("UPDATE users SET google_id=?, avatar=?, updated_at=? WHERE id=?").run(googleId, avatar, now, user.id);
          return done(null, { id: user.id });
        } catch (e) {
          return done(e);
        }
      },
    ),
  );
}

// Marketing landing page (public)
app.get(["/landing", "/"], (req, res) => {
  return sendView(res, "landing.html");
});

// View routes
const viewRoutes = [
  "login",
  "register",
  "onboarding",
  "dashboard",
  "profile",
  "resume",
  "portfolio",
  "universities",
  "university-detail",
  "course-detail",
  "predict",
  "shortlist",
  "finance",
  "scholarships",
  "countries",
  "country-detail",
  "earning",
  "community",
  "notifications",
  "admin",
];

for (const page of viewRoutes) {
  app.get(`/${page === "login" ? "login" : page}`, (req, res) => {
    const file = `${page}.html`;
    return sendView(res, file);
  });
}

// Root routing: send to dashboard if logged in
app.get("/home", (req, res) => {
  if (req.session?.userId) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// Mount routes
app.use("/auth", require("./routes/auth"));
app.use("/api/profile", requireAuth, require("./routes/profile"));
app.use("/api/resumes", requireAuth, require("./routes/resumes"));
app.use("/api/portfolios", requireAuth, require("./routes/portfolio"));
app.use("/api/universities", require("./routes/universities"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/predictions", requireAuth, require("./routes/predictions"));
app.use("/api/finance", require("./routes/finance"));
app.use("/api/scholarships", require("./routes/scholarships"));
app.use("/api/countries", require("./routes/countries"));
app.use("/api/community", require("./routes/community"));
app.use("/api/budget", requireAuth, require("./routes/budget"));
app.use("/api/loans", requireAuth, require("./routes/loans"));
app.use("/api/shortlist", requireAuth, require("./routes/shortlist"));
app.use("/api/notifications", requireAuth, require("./routes/notifications"));
app.use("/api/admin", requireAdmin, require("./routes/admin"));

// Google OAuth endpoints (only if configured)
app.get("/auth/google", (req, res, next) => {
  if (!passport._strategy("google")) {
    return res.redirect("/login?error=google_not_configured");
  }
  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});
app.get(
  "/auth/google/callback",
  (req, res, next) => {
    if (!passport._strategy("google")) {
      return res.redirect("/login?error=google_not_configured");
    }
    return passport.authenticate("google", { failureRedirect: "/login?error=google_failed" })(req, res, next);
  },
  (req, res) => {
    const db = require("./database/db").getDB();
    const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(req.user.id);
    req.session.userId = req.user.id;
    req.session.isAdmin = user?.is_admin || 0;
    return res.redirect("/dashboard");
  },
);

// 404 Not Found handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
const logger = getLogger('Server');

function createApp() {
  return app;
}

function startServer() {
  const server = app.listen(port, () => {
    logger.info(`AbroadReady listening on http://localhost:${port}`, { port });
  });

  return server;
}

if (require.main === module) {
  startServer();

  try {
    registerCronJobs();
    logger.info('Cron jobs registered');
  } catch (err) {
    logger.error('Failed to register cron jobs', {}, err);
  }
}

module.exports = {
  app,
  startServer,
  createApp,
};

