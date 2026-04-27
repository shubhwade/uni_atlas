const express = require("express");
const { getDB } = require("../database/db");
const { calculateTrueLoanCost, generateBudgetPlan, rankLenders } = require("../lib/financialAdvisor");

const router = express.Router();

router.get("/lenders", (req, res) => {
  const db = getDB();
  const country = String(req.query.country || "").toLowerCase();
  const amount = Number(req.query.loanAmountLakhs || 0);
  const hasCollateral = String(req.query.hasCollateral || "") === "1" || String(req.query.hasCollateral) === "true";

  let rows = db.prepare("SELECT * FROM lenders").all();
  if (country) rows = rows.filter((l) => String(l.countries_supported || "").toLowerCase().includes(country));
  if (amount) rows = rows.filter((l) => Number(l.max_loan_lakhs_secured || 0) >= amount);
  if (!hasCollateral) rows = rows.filter((l) => Number(l.max_loan_lakhs_unsecured || 0) >= amount);

  return res.json({ ok: true, lenders: rows });
});

router.get("/lenders/rank", (req, res) => {
  const db = getDB();
  const profile = db.prepare("SELECT * FROM student_profiles WHERE user_id = ?").get(req.session.userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const loanAmountLakhs = Number(req.query.loanAmountLakhs || 0);
  const countryCode = String(req.query.country || "").toLowerCase();
  const ranked = rankLenders(profile, loanAmountLakhs, countryCode);
  return res.json({ ok: true, ranked });
});

router.get("/lenders/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM lenders WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, lender: row });
});

router.post("/lenders/compare", (req, res) => {
  const db = getDB();
  const lenderIds = Array.isArray(req.body?.lenderIds) ? req.body.lenderIds.slice(0, 3) : [];
  const loanAmount = Number(req.body?.loanAmount || 0);
  const tenureMonths = Number(req.body?.tenure || 120);
  if (!lenderIds.length) return res.status(400).json({ error: "lenderIds required" });

  const lenders = db
    .prepare(`SELECT * FROM lenders WHERE id IN (${lenderIds.map(() => "?").join(",")})`)
    .all(...lenderIds.map((x) => Number(x)));

  const comparisons = lenders.map((l) => {
    const rate = Number(l.rate_min || 11);
    const cost = calculateTrueLoanCost(loanAmount, rate, 2, 18);
    return { lender: l, sampleCost: cost, tenureMonths };
  });

  return res.json({ ok: true, comparisons });
});

router.get("/calculator", (req, res) => {
  const principal = Number(req.query.principal || 0);
  const rate = Number(req.query.rate || 0);
  const tenureMonths = Number(req.query.tenureMonths || 120);
  const courseYears = Number(req.query.courseYears || 2);
  const moratoriumMonths = Number(req.query.moratoriumMonths || 18);

  const result = calculateTrueLoanCost(principal, rate, courseYears, moratoriumMonths, tenureMonths);
  return res.json({ ok: true, result });
});

router.post("/budget-plan", (req, res) => {
  const { countryCode, courseMonths, partTimeIncome } = req.body || {};
  const plan = generateBudgetPlan(countryCode, Number(courseMonths || 12), Number(partTimeIncome || 0));
  return res.json({ ok: true, plan });
});

router.get("/earning/:country", (req, res) => {
  const db = getDB();
  const code = String(req.params.country || "").toLowerCase();
  const countryId = db.prepare("SELECT id FROM countries WHERE code=?").pluck().get(code);
  if (!countryId) return res.status(404).json({ error: "Not found" });
  const rows = db.prepare("SELECT * FROM earning_resources WHERE country_id=? ORDER BY category").all(countryId);
  return res.json({ ok: true, earning: rows });
});

module.exports = router;

