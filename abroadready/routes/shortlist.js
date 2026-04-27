const express = require("express");
const { getDB } = require("../database/db");
const { requireAuth } = require("../lib/middleware");

const router = express.Router();

// Get user's shortlist
router.get("/", requireAuth, (req, res) => {
  const db = getDB();
  const userId = req.session.userId;

  try {
    const row = db.prepare("SELECT kanban_state FROM user_shortlists WHERE user_id = ?").get(userId);
    if (!row) {
      return res.json({ ok: true, kanban_state: null });
    }
    return res.json({ ok: true, kanban_state: JSON.parse(row.kanban_state) });
  } catch (e) {
    console.error("Failed to fetch shortlist:", e);
    return res.status(500).json({ error: "Database error" });
  }
});

// Save user's shortlist
router.post("/save", requireAuth, (req, res) => {
  const db = getDB();
  const userId = req.session.userId;
  const { state } = req.body;

  if (!state) {
    return res.status(400).json({ error: "State required" });
  }

  try {
    const kanban_state = JSON.stringify(state);
    db.prepare(`
      INSERT INTO user_shortlists (user_id, kanban_state, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        kanban_state = excluded.kanban_state,
        updated_at = datetime('now')
    `).run(userId, kanban_state);

    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to save shortlist:", e);
    return res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
