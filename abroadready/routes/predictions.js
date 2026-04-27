const express = require("express");
const { getDB } = require("../database/db");
const { runPrediction } = require("../lib/admitPredictor");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { courseId, resumeId, portfolioId } = req.body || {};
    if (!courseId) return res.status(400).json({ error: "courseId required" });
    const result = await runPrediction(req.session.userId, Number(courseId), {
      resumeId: resumeId ? Number(resumeId) : null,
      portfolioId: portfolioId ? Number(portfolioId) : null,
    });
    return res.json({ ok: true, prediction: result });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Prediction failed" });
  }
});

router.get("/", (req, res) => {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT p.id, p.admit_probability, p.admit_category, p.created_at,
              c.name AS course_name, u.name AS university_name
       FROM admit_predictions p
       JOIN courses c ON c.id = p.course_id
       JOIN universities u ON u.id = p.university_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC
       LIMIT 200`,
    )
    .all(req.session.userId);
  return res.json({ ok: true, predictions: rows });
});

router.get("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM admit_predictions WHERE id = ? AND user_id = ?").get(id, req.session.userId);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, prediction: row });
});

router.post("/shortlist", async (req, res) => {
  try {
    const courseIds = Array.isArray(req.body?.courseIds) ? req.body.courseIds.slice(0, 10) : [];
    if (!courseIds.length) return res.status(400).json({ error: "courseIds required" });

    const out = [];
    for (const cid of courseIds) {
      const r = await runPrediction(req.session.userId, Number(cid), {});
      out.push({ courseId: Number(cid), ...r });
    }

    const categorize = (p) => {
      const v = Number(p.finalProbability || 0) * 100;
      if (v > 70) return "Safety";
      if (v >= 40) return "Moderate";
      if (v >= 20) return "Reach";
      return "Dream";
    };

    return res.json({
      ok: true,
      results: {
        Safety: out.filter((x) => categorize(x) === "Safety"),
        Moderate: out.filter((x) => categorize(x) === "Moderate"),
        Reach: out.filter((x) => categorize(x) === "Reach"),
        Dream: out.filter((x) => categorize(x) === "Dream"),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Prediction failed" });
  }
});

module.exports = router;

