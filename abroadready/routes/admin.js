const express = require("express");
const { getDB } = require("../database/db");
const { requireAdmin } = require("../lib/middleware");
const { syncTopUniversities } = require("../lib/collegeScorecard");
const { updateAllForexRates } = require("../lib/cron");

const router = express.Router();

router.post("/sync/universities", requireAdmin, async (req, res) => {
  const r = await syncTopUniversities();
  return res.json({ ok: true, ...r });
});

router.post("/sync/forex", requireAdmin, async (req, res) => {
  const r = await updateAllForexRates();
  return res.json({ ok: true, ...r });
});

router.post("/sync/scholarships", requireAdmin, async (req, res) => {
  // Future: refresh via Firecrawl/Tavily + GPT; currently seeded in DB.
  return res.json({ ok: true });
});

router.get("/stats", requireAdmin, (req, res) => {
  const db = getDB();
  const counts = {
    users: db.prepare("SELECT COUNT(*) AS c FROM users").get().c,
    universities: db.prepare("SELECT COUNT(*) AS c FROM universities").get().c,
    courses: db.prepare("SELECT COUNT(*) AS c FROM courses").get().c,
    predictions: db.prepare("SELECT COUNT(*) AS c FROM admit_predictions").get().c,
    scholarships: db.prepare("SELECT COUNT(*) AS c FROM scholarships").get().c,
  };
  return res.json({ ok: true, counts });
});

module.exports = router;

