const express = require("express");
const { getDB } = require("../database/db");

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200")
    .all(req.session.userId);
  return res.json({ ok: true, notifications: rows });
});

router.post("/mark-all-read", (req, res) => {
  const db = getDB();
  db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(req.session.userId);
  return res.json({ ok: true });
});

module.exports = router;

