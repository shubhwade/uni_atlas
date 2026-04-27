const express = require("express");
const { getDB } = require("../database/db");
const { requireAuth } = require("../lib/middleware");

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDB();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  const where = [];
  const bindings = [];

  if (req.query.degree) {
    where.push("c.degree = ?");
    bindings.push(String(req.query.degree));
  }
  if (req.query.country) {
    where.push("co.code = ?");
    bindings.push(String(req.query.country).toLowerCase());
  }
  if (req.query.stemOnly === "1" || req.query.stemOnly === "true") {
    where.push("c.stem_designated = 1");
  }
  if (req.query.taAvailable === "1" || req.query.taAvailable === "true") {
    where.push("c.ta_positions_available > 0");
  }
  if (req.query.tuitionMaxINR) {
    where.push("c.coa_total_inr <= ?");
    bindings.push(Number(req.query.tuitionMaxINR));
  }
  if (req.query.placementMin) {
    where.push("c.placement_rate_percent >= ?");
    bindings.push(Number(req.query.placementMin));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const baseSql = `
    FROM courses c
    JOIN universities u ON u.id = c.university_id
    JOIN countries co ON co.id = u.country_id
    ${whereSql}
  `;

  const total = db.prepare(`SELECT COUNT(*) AS c ${baseSql}`).get(...bindings).c;

  let sortSql = "ORDER BY c.coa_total_inr ASC";
  const sortBy = String(req.query.sortBy || "");
  if (sortBy === "placement") sortSql = "ORDER BY c.placement_rate_percent DESC";
  if (sortBy === "salary") sortSql = "ORDER BY c.median_starting_salary_local DESC";

  const rows = db
    .prepare(
      `SELECT c.*, u.name AS university_name, u.slug AS university_slug, co.code AS country_code, co.flag_emoji
       ${baseSql}
       ${sortSql}
       LIMIT ? OFFSET ?`,
    )
    .all(...bindings, limit, offset);

  const pages = Math.ceil(total / limit) || 1;
  return res.json({ ok: true, courses: rows, total, page, pages });
});

router.get("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT c.*, u.name AS university_name, u.slug AS university_slug, u.city, u.state_province,
              co.code AS country_code, co.name AS country_name, co.currency, co.exchange_rate_to_inr
       FROM courses c
       JOIN universities u ON u.id = c.university_id
       JOIN countries co ON co.id = u.country_id
       WHERE c.id = ?`,
    )
    .get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, course: row });
});

router.get("/:id/crowdsourced", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const rows = db
    .prepare(
      `SELECT gpa_forty, gpa_percent, gre_total, gre_verbal, gre_quant, gmat_total, ielts_score, toefl_score,
              work_exp_years, bachelors_institution_tier, bachelors_field,
              has_research, research_papers_count, internships_count, projects_count,
              result, result_date, admit_with_scholarship, scholarship_amount_local, scholarship_type,
              took_loan, loan_amount_lakhs, loan_bank_name, loan_interest_rate,
              got_internship, internship_company, got_job_offer, first_job_title, first_job_company, first_job_salary_local,
              verified, submitted_at
       FROM crowdsourced_data_points WHERE course_id = ?
       ORDER BY submitted_at DESC LIMIT 200`,
    )
    .all(id);
  return res.json({ ok: true, dataPoints: rows });
});

router.post("/:id/crowdsource", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT id FROM courses WHERE id=?").get(id);
  if (!exists) return res.status(404).json({ error: "Not found" });

  const payload = req.body || {};
  const cols = [
    "course_id",
    "submitted_by_user_id",
    "gpa_forty",
    "gpa_percent",
    "gre_total",
    "gre_verbal",
    "gre_quant",
    "gmat_total",
    "ielts_score",
    "toefl_score",
    "work_exp_years",
    "bachelors_institution_tier",
    "bachelors_field",
    "has_research",
    "research_papers_count",
    "has_publications",
    "internships_count",
    "projects_count",
    "india_city",
    "application_round",
    "semester_applied",
    "result",
    "result_date",
    "admit_with_scholarship",
    "scholarship_amount_local",
    "scholarship_type",
    "took_loan",
    "loan_amount_lakhs",
    "loan_bank_name",
    "loan_interest_rate",
    "collateral_used",
    "collateral_type",
    "got_internship",
    "internship_company",
    "internship_compensation_local",
    "got_job_offer",
    "employed_within_3_months",
    "first_job_title",
    "first_job_company",
    "first_job_salary_local",
    "current_country_of_work",
    "verified",
  ];

  const insert = db.prepare(
    `INSERT INTO crowdsourced_data_points (${cols.join(",")})
     VALUES (${cols.map((c) => `@${c}`).join(",")})`,
  );

  insert.run({
    course_id: id,
    submitted_by_user_id: req.session.userId,
    ...cols.reduce((acc, c) => {
      if (c === "course_id" || c === "submitted_by_user_id") return acc;
      acc[c] = payload[c] ?? null;
      return acc;
    }, {}),
  });

  return res.json({ ok: true });
});

router.post("/:id/save", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT id FROM courses WHERE id=?").get(id);
  if (!exists) return res.status(404).json({ error: "Not found" });

  const existing = db.prepare("SELECT id FROM saved_courses WHERE user_id=? AND course_id=?").get(req.session.userId, id);
  if (existing) {
    db.prepare("DELETE FROM saved_courses WHERE user_id=? AND course_id=?").run(req.session.userId, id);
    return res.json({ ok: true, saved: false });
  }
  db.prepare("INSERT INTO saved_courses (user_id, course_id) VALUES (?, ?)").run(req.session.userId, id);
  return res.json({ ok: true, saved: true });
});

module.exports = router;

