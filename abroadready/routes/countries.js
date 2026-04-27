const express = require("express");
const { getDB } = require("../database/db");
const { updateCountryLivingCosts } = require("../lib/numbeo");

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT code, name, continent, currency, currency_symbol, flag_emoji,
              exchange_rate_to_inr, exchange_rate_updated_at,
              post_study_work_months, safety_rating_out_of_10,
              avg_rent_shared_1bhk, avg_groceries_monthly, avg_transport_monthly,
              living_cost_updated_at
       FROM countries ORDER BY name`,
    )
    .all();
  return res.json({ ok: true, countries: rows });
});

router.get("/compare", (req, res) => {
  const db = getDB();
  const codes = String(req.query.codes || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3);
  if (!codes.length) return res.status(400).json({ error: "codes required" });

  const q = `SELECT * FROM countries WHERE code IN (${codes.map(() => "?").join(",")})`;
  const rows = db.prepare(q).all(...codes);
  return res.json({ ok: true, countries: rows });
});

router.get("/:code", (req, res) => {
  const db = getDB();
  const code = String(req.params.code || "").toLowerCase();
  const row = db.prepare("SELECT * FROM countries WHERE code = ?").get(code);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, country: row });
});

router.get("/:code/living-costs", async (req, res) => {
  const code = String(req.params.code || "").toLowerCase();
  const updated = await updateCountryLivingCosts(code);
  return res.json({ ok: true, ...updated });
});

router.get("/:code/jobs", (req, res) => {
  const db = getDB();
  const code = String(req.params.code || "").toLowerCase();
  const row = db.prepare("SELECT tech_job_market_rating, top_cities_for_jobs, top_companies_hiring FROM countries WHERE code=?").get(code);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, jobs: row });
});

router.get("/:code/banks", (req, res) => {
  const db = getDB();
  const code = String(req.params.code || "").toLowerCase();
  const row = db.prepare("SELECT recommended_banks, banking_setup_docs, remittance_services FROM countries WHERE code=?").get(code);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, banks: row });
});

router.get("/:code/earning", (req, res) => {
  const db = getDB();
  const code = String(req.params.code || "").toLowerCase();
  const countryId = db.prepare("SELECT id FROM countries WHERE code=?").pluck().get(code);
  if (!countryId) return res.status(404).json({ error: "Not found" });
  const rows = db.prepare("SELECT * FROM earning_resources WHERE country_id=? ORDER BY category").all(countryId);
  return res.json({ ok: true, earning: rows });
});

module.exports = router;

