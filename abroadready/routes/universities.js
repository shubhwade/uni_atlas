const express = require("express");
const { getDB } = require("../database/db");
const { requireAuth } = require("../lib/middleware");

const router = express.Router();

function buildWhere(params, bindings) {
  const where = [];

  if (params.country) {
    const codes = String(params.country)
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    if (codes.length) {
      where.push(`co.code IN (${codes.map(() => "?").join(",")})`);
      bindings.push(...codes);
    }
  }

  if (params.minRank) {
    where.push("u.qs_ranking_world >= ?");
    bindings.push(Number(params.minRank));
  }
  if (params.maxRank) {
    where.push("u.qs_ranking_world <= ?");
    bindings.push(Number(params.maxRank));
  }

  if (params.search) {
    where.push("(u.name LIKE ? OR u.city LIKE ?)");
    const q = `%${params.search}%`;
    bindings.push(q, q);
  }

  if (params.type) {
    where.push("u.university_type LIKE ?");
    bindings.push(`%${params.type}%`);
  }

  if (params.placementMin) {
    where.push("u.overall_placement_rate >= ?");
    bindings.push(Number(params.placementMin));
  }

  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

router.get("/", (req, res) => {
  const db = getDB();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  const bindings = [];
  const where = buildWhere(req.query, bindings);

  let sortSql = "ORDER BY u.qs_ranking_world ASC NULLS LAST";
  const sortBy = String(req.query.sortBy || "");
  if (sortBy === "qsRanking") sortSql = "ORDER BY u.qs_ranking_world ASC NULLS LAST";
  if (sortBy === "tuition") sortSql = "ORDER BY (SELECT MIN(coa_total_inr) FROM courses c WHERE c.university_id=u.id) ASC";
  if (sortBy === "placement") sortSql = "ORDER BY u.overall_placement_rate DESC";

  const baseSql = `
    FROM universities u
    JOIN countries co ON co.id = u.country_id
    ${where}
  `;

  const total = db.prepare(`SELECT COUNT(*) AS c ${baseSql}`).get(...bindings).c;
  const rows = db
    .prepare(
      `SELECT
        u.id, u.name, u.short_name, u.slug, u.city, u.state_province,
        u.website, u.logo_url,
        u.qs_ranking_world, u.university_type, u.campus_type,
        u.overall_placement_rate, u.avg_student_rating_out_of_5,
        co.code AS country_code, co.name AS country_name, co.flag_emoji,
        (SELECT MIN(coa_total_inr) FROM courses c WHERE c.university_id = u.id) AS min_coa_inr
      ${baseSql}
      ${sortSql}
      LIMIT ? OFFSET ?`,
    )
    .all(...bindings, limit, offset);

  const pages = Math.ceil(total / limit) || 1;
  return res.json({ ok: true, universities: rows, total, page, pages });
});

router.get("/global-search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) return res.json({ ok: true, universities: [] });

  try {
    const url = `http://universities.hipolabs.com/search?name=${encodeURIComponent(q)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    // Map to a consistent format
    const crypto = require("crypto");
    const unis = data.slice(0, 30).map((u) => {
      // Create a stable ID based on name and country
      const hash = crypto.createHash("md5").update(`${u.name}_${u.country}`).digest("hex").slice(0, 10);
      return {
        id: `global_${hash}`,
        name: u.name,
        country_name: u.country,
        country_code: u.alpha_two_code,
        website: u.web_pages && u.web_pages[0],
        is_global: true
      };
    });

    return res.json({ ok: true, universities: unis });
  } catch (e) {
    console.error("Global search failed:", e);
    return res.status(500).json({ error: "External API failed" });
  }
});

router.get("/compare", (req, res) => {
  const db = getDB();
  const ids = String(req.query.ids || "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n))
    .slice(0, 5);
  if (!ids.length) return res.status(400).json({ error: "ids required" });
  const rows = db
    .prepare(
      `SELECT u.*, co.code AS country_code, co.flag_emoji
       FROM universities u
       JOIN countries co ON co.id=u.country_id
       WHERE u.id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(...ids);
  return res.json({ ok: true, universities: rows });
});

router.get("/:slug", (req, res) => {
  const db = getDB();
  const slug = String(req.params.slug || "");
  const uni = db
    .prepare(
      `SELECT u.*, co.code AS country_code, co.name AS country_name, co.flag_emoji, co.currency, co.exchange_rate_to_inr
       FROM universities u
       JOIN countries co ON co.id = u.country_id
       WHERE u.slug = ?`,
    )
    .get(slug);
  if (!uni) return res.status(404).json({ error: "Not found" });

  const courses = db
    .prepare(
      `SELECT id, name, degree, duration_months, coa_total_inr, gre_required, stem_designated, placement_rate_percent, median_starting_salary_local
       FROM courses WHERE university_id = ? ORDER BY degree, name LIMIT 200`,
    )
    .all(uni.id);

  return res.json({ ok: true, university: uni, courses });
});

router.get("/:slug/courses", (req, res) => {
  const db = getDB();
  const slug = String(req.params.slug || "");
  const uniId = db.prepare("SELECT id FROM universities WHERE slug = ?").pluck().get(slug);
  if (!uniId) return res.status(404).json({ error: "Not found" });
  const rows = db.prepare("SELECT * FROM courses WHERE university_id = ? ORDER BY name").all(uniId);
  return res.json({ ok: true, courses: rows });
});

router.post("/:slug/save", requireAuth, (req, res) => {
  const db = getDB();
  const slug = String(req.params.slug || "");
  const uniId = db.prepare("SELECT id FROM universities WHERE slug = ?").pluck().get(slug);
  if (!uniId) return res.status(404).json({ error: "Not found" });

  const existing = db
    .prepare("SELECT id FROM saved_universities WHERE user_id = ? AND university_id = ?")
    .get(req.session.userId, uniId);

  if (existing) {
    db.prepare("DELETE FROM saved_universities WHERE user_id=? AND university_id=?").run(req.session.userId, uniId);
    return res.json({ ok: true, saved: false });
  }
  db.prepare("INSERT INTO saved_universities (user_id, university_id) VALUES (?, ?)").run(req.session.userId, uniId);
  return res.json({ ok: true, saved: true });
});

module.exports = router;

