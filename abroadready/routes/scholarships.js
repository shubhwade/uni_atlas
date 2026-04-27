const express = require("express");
const { getDB } = require("../database/db");
const { requireAuth } = require("../lib/middleware");
const { matchScholarships } = require("../lib/scholarshipMatcher");

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDB();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  const where = ["is_active = 1"];
  const bindings = [];

  if (req.query.country) {
    where.push("target_countries LIKE ?");
    bindings.push(`%${String(req.query.country).toLowerCase()}%`);
  }
  if (req.query.degree) {
    where.push("target_degrees LIKE ?");
    bindings.push(`%${String(req.query.degree)}%`);
  }
  if (req.query.field) {
    where.push("target_fields LIKE ?");
    bindings.push(`%${String(req.query.field)}%`);
  }
  if (req.query.gender) {
    where.push("(target_gender = 'all' OR target_gender = ?)");
    bindings.push(String(req.query.gender));
  }
  if (req.query.maxIncomeLPA) {
    where.push("(target_income_lpa_max = 0 OR target_income_lpa_max >= ?)");
    bindings.push(Number(req.query.maxIncomeLPA));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS c FROM scholarships ${whereSql}`).get(...bindings).c;
  const rows = db
    .prepare(
      `SELECT id, name, provider, provider_country, amount_inr, total_value_inr, currency,
              deadline, deadline_month, deadline_day, competition_level, eligibility_details,
              application_url
       FROM scholarships
       ${whereSql}
       ORDER BY deadline_month ASC, deadline_day ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...bindings, limit, offset);

  const pages = Math.ceil(total / limit) || 1;
  return res.json({ ok: true, scholarships: rows, total, page, pages });
});

router.get("/matched", requireAuth, async (req, res) => {
  const matched = await matchScholarships(req.session.userId);
  return res.json({ ok: true, matched });
});

router.get("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM scholarships WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, scholarship: row });
});

router.post("/:id/save", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT id FROM scholarships WHERE id=? AND is_active=1").get(id);
  if (!exists) return res.status(404).json({ error: "Not found" });

  const existing = db
    .prepare("SELECT id FROM scholarship_saves WHERE user_id=? AND scholarship_id=?")
    .get(req.session.userId, id);

  if (existing) {
    db.prepare("DELETE FROM scholarship_saves WHERE user_id=? AND scholarship_id=?").run(req.session.userId, id);
    return res.json({ ok: true, saved: false });
  }
  db.prepare("INSERT INTO scholarship_saves (user_id, scholarship_id) VALUES (?, ?)").run(req.session.userId, id);
  return res.json({ ok: true, saved: true });
});

module.exports = router;

