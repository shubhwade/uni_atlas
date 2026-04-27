const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const { getDB } = require("../database/db");
const { sendMagicLink, sendVerificationEmail } = require("../lib/email");
const { validateInput } = require("../lib/security");

const router = express.Router();

function safeEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function hmacSign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function makeMagicToken(email, ttlMinutes = 15) {
  const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
  const exp = Date.now() + ttlMinutes * 60 * 1000;
  const nonce = uuidv4();
  const payload = Buffer.from(JSON.stringify({ email, exp, nonce })).toString("base64url");
  const sig = hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

function verifyMagicToken(token) {
  try {
    const secret = process.env.SESSION_SECRET || "dev_secret_change_me";
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = hmacSign(secret, payload);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!obj?.email || !obj?.exp) return null;
    if (Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

router.post("/register", (req, res) => {
  try {
    const db = getDB();
    
    // Input validation
    const emailCheck = validateInput(req.body.email, "email", { required: true });
    if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });
    const email = emailCheck.value;

    const passwordCheck = validateInput(req.body.password, "string", { required: true, min: 8, max: 128 });
    if (!passwordCheck.valid) return res.status(400).json({ error: passwordCheck.error });
    const password = passwordCheck.value;

    const nameCheck = validateInput(req.body.name, "string", { required: false, max: 256 });
    if (!nameCheck.valid) return res.status(400).json({ error: nameCheck.error });
    const name = nameCheck.value || "";

    // Check if email already exists
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    // Hash password
    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    
    const info = db
      .prepare("INSERT INTO users (email, name, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)")
      .run(email, name, hash, now, now);
    const userId = Number(info.lastInsertRowid);

    db.prepare("INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)").run(userId);

    // Generate verification token
    const verificationToken = makeMagicToken(email, 24 * 60); // 24 hours
    
    // Send verification email
    (async () => {
      try {
        await sendVerificationEmail(email, verificationToken);
      } catch (err) {
        console.error("Failed to send verification email:", err);
        // Don't fail registration if email send fails
      }
    })();

    req.session.userId = userId;
    req.session.isAdmin = 0;

    return res.json({ 
      ok: true, 
      userId,
      message: "Registration successful. Please check your email to verify your account."
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/login", (req, res) => {
  try {
    const db = getDB();
    
    // Input validation
    const emailCheck = validateInput(req.body.email, "email", { required: true });
    if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });
    const email = emailCheck.value;

    const passwordCheck = validateInput(req.body.password, "string", { required: true, max: 128 });
    if (!passwordCheck.valid) return res.status(400).json({ error: passwordCheck.error });
    const password = passwordCheck.value;

    const user = db.prepare("SELECT id, password_hash, name, email FROM users WHERE email = ?").get(email);
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid email or password" });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    req.session.userId = user.id;
    req.session.isAdmin = 0;
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  const db = getDB();
  const user = db
    .prepare("SELECT id, email, name, avatar, onboarding_done, subscription_tier FROM users WHERE id = ?")
    .get(req.session.userId);
  return res.json({ ok: true, user });
});

router.post("/magic-link", async (req, res) => {
  const db = getDB();
  const email = safeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: "Email required" });

  const user = db.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
  if (!user) return res.status(404).json({ error: "No account for this email" });

  try {
    const token = makeMagicToken(email, 15);
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const link = `${baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLink(email, link);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Failed to send magic link:", err);
    return res.status(500).json({ error: "Failed to send email. Please try again later." });
  }
});

router.get("/magic-link/verify", (req, res) => {
  const db = getDB();
  const token = String(req.query.token || "");
  const payload = verifyMagicToken(token);
  if (!payload) return res.status(400).send("Invalid or expired token");

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(payload.email);
  if (!user) return res.status(404).send("Account not found");

  req.session.userId = user.id;
  req.session.isAdmin = 0;
  return res.redirect("/dashboard");
});

router.post("/onboarding-complete", (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  const db = getDB();
  db.prepare("UPDATE users SET onboarding_done=1, updated_at=datetime('now') WHERE id=?").run(req.session.userId);
  return res.json({ ok: true });
});

// Email verification endpoints
router.get("/verify-email", (req, res) => {
  try {
    const db = getDB();
    const token = String(req.query.token || "");
    const payload = verifyMagicToken(token);
    if (!payload) return res.status(400).send("Invalid or expired verification link");

    const user = db.prepare("SELECT id, email_verified FROM users WHERE email = ?").get(payload.email);
    if (!user) return res.status(404).send("Account not found");

    // Mark email as verified
    db.prepare("UPDATE users SET email_verified=1, updated_at=datetime('now') WHERE id=?").run(user.id);

    // Log user in and redirect to dashboard
    req.session.userId = user.id;
    req.session.isAdmin = 0;
    return res.redirect("/dashboard?verified=1");
  } catch (err) {
    console.error("Email verification error:", err);
    return res.status(500).send("Verification failed. Please try again.");
  }
});

router.post("/resend-verification", (req, res) => {
  try {
    const db = getDB();
    
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Please log in first" });
    }

    const user = db.prepare("SELECT id, email, email_verified FROM users WHERE id = ?").get(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.email_verified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Generate and send verification token
    const token = makeMagicToken(user.email, 24 * 60); // 24 hours
    
    (async () => {
      try {
        await sendVerificationEmail(user.email, token);
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    })();

    return res.json({ ok: true, message: "Verification email sent. Please check your inbox." });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ error: "Failed to send verification email" });
  }
});

router.post("/password-reset-request", async (req, res) => {
  try {
    const emailCheck = validateInput(req.body.email, "email", { required: true });
    if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });
    const email = emailCheck.value;

    const db = getDB();
    const user = db.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
    
    // For security, don't reveal if email exists or not
    if (user) {
      try {
        const token = makeMagicToken(email, 60); // 1 hour for password reset
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const link = `${baseUrl}/auth/password-reset?token=${encodeURIComponent(token)}`;
        await sendMagicLink(email, link);
      } catch (err) {
        console.error("Failed to send password reset email:", err);
      }
    }

    return res.json({ ok: true, message: "If an account exists, a password reset link has been sent." });
  } catch (err) {
    console.error("Password reset request error:", err);
    return res.status(500).json({ error: "Failed to process password reset request" });
  }
});

router.post("/password-reset", (req, res) => {
  try {
    const token = String(req.body.token || "");
    const newPasswordCheck = validateInput(req.body.newPassword, "string", { 
      required: true, min: 8, max: 128 
    });
    if (!newPasswordCheck.valid) return res.status(400).json({ error: newPasswordCheck.error });
    const newPassword = newPasswordCheck.value;

    const payload = verifyMagicToken(token);
    if (!payload) return res.status(400).json({ error: "Invalid or expired reset link" });

    const db = getDB();
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(payload.email);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Hash new password
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(hash, user.id);

    return res.json({ ok: true, message: "Password reset successful" });
  } catch (err) {
    console.error("Password reset error:", err);
    return res.status(500).json({ error: "Password reset failed" });
  }
});

module.exports = router;

