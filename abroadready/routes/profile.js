const express = require("express");
const { getDB } = require("../database/db");
const { chatCompletion } = require("../lib/gemini");

const router = express.Router();

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fallbackScores(p, reason) {
  const bGpa = clamp(Math.round((Number(p.bachelors_gpa || 0) / Number(p.bachelors_gpa_scale || 10)) * 100), 0, 100);
  const tenth = Number(p.tenth_percent || 0);
  const twelfth = Number(p.twelfth_percent || 0);
  const academics = clamp(Math.round(bGpa * 0.7 + tenth * 0.15 + twelfth * 0.15), 35, 95);

  let tests = 45;
  const gre = p.gre_total ? clamp(Math.round((Number(p.gre_total) - 260) / 80 * 100), 0, 100) : 0;
  const gmat = p.gmat_total ? clamp(Math.round((Number(p.gmat_total) - 200) / 600 * 100), 0, 100) : 0;
  
  // English Proficiency best-of
  const ielts = p.ielts_overall ? clamp(Math.round(Number(p.ielts_overall) / 9 * 100), 0, 100) : 0;
  const toefl = p.toefl_total ? clamp(Math.round(Number(p.toefl_total) / 120 * 100), 0, 100) : 0;
  const duolingo = p.duolingo_score ? clamp(Math.round((Number(p.duolingo_score) - 10) / 150 * 100), 0, 100) : 0;
  const english = Math.max(ielts, toefl, duolingo);

  const bestAptitude = Math.max(gre, gmat);
  if (bestAptitude > 0) {
    tests = clamp(Math.round(bestAptitude * 0.8 + english * 0.2), 35, 98);
  } else if (english > 0) {
    tests = clamp(Math.round(english), 35, 90);
  }

  const work = clamp(45 + Math.min(35, Number(p.total_work_exp_months || 0) * 1.4), 35, 90);
  const research = clamp(35 + Number(p.research_papers || 0) * 18 + Number(p.projects_count || 0) * 4, 35, 92);
  const extracurric = clamp(45 + Number(p.projects_count || 0) * 7 + Number(p.open_source_contribs || 0) * 3, 35, 90);
  const finance = clamp(45 + Number(p.savings_lakhs || 0) * 2 + Number(p.family_income_lpa || 0) + (Number(p.cibil_score || 0) >= 720 ? 12 : 0), 35, 95);
  const overall = Math.round((academics * 0.24) + (tests * 0.18) + (work * 0.14) + (research * 0.16) + (extracurric * 0.1) + (finance * 0.18));
  return {
    overall,
    academics,
    tests,
    work,
    research,
    extracurric,
    finance,
    summary: `Fallback profile scoring used because AI scoring was unavailable: ${reason || "external service unavailable"}.`,
    actionItems: [
      "Add missing test scores and target fields.",
      "Quantify project, work, and research impact.",
      "Clarify funding mix across savings, loan, and scholarships.",
    ],
  };
}

function getProfile(db, userId) {
  return db.prepare("SELECT * FROM student_profiles WHERE user_id = ?").get(userId);
}

router.get("/", (req, res) => {
  const db = getDB();
  const profile = getProfile(db, req.session.userId);
  return res.json({ ok: true, profile });
});

router.put("/", (req, res) => {
  const db = getDB();
  const userId = req.session.userId;
  let profile = getProfile(db, userId);
  if (!profile) {
    db.prepare("INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)").run(userId);
    profile = getProfile(db, userId);
  }

  const body = req.body || {};
  const fields = Object.keys(body);
  if (!fields.length) return res.json({ ok: true });

  // Get all columns from the table to ensure we allow all valid fields
  const columns = db.prepare("PRAGMA table_info(student_profiles)").all();
  const allowed = new Set(columns.map(c => c.name).filter(n => !["id", "user_id", "created_at", "updated_at", "overall_profile_score", "academic_score", "test_score", "work_exp_score", "research_score", "extracurric_score", "financial_health_score", "last_analyzed_at"].includes(n)));
  
  // Strict Validation Rules
  const rules = {
    gre_total: { min: 260, max: 340 },
    gre_verbal: { min: 130, max: 170 },
    gre_quant: { min: 130, max: 170 },
    gmat_total: { min: 200, max: 800 },
    gmat_verbal: { min: 6, max: 60 },
    gmat_quant: { min: 6, max: 60 },
    ielts_overall: { min: 0, max: 9 },
    toefl_total: { min: 0, max: 120 },
    duolingo_score: { min: 10, max: 160 },
    bachelors_gpa: { min: 0, max: 100 },
    bachelors_gpa_scale: { min: 4, max: 100 },
    bachelors_graduation_year: { min: 1990, max: 2030 },
    tenth_percent: { min: 0, max: 100 },
    twelfth_percent: { min: 0, max: 100 },
    projects_count: { min: 0, max: 100 },
    research_papers: { min: 0, max: 50 },
    open_source_contribs: { min: 0, max: 1000 },
    cibil_score: { min: 300, max: 900 },
    target_year: { min: 2024, max: 2035 },
    family_income_lpa: { min: 0, max: 5000 },
    savings_lakhs: { min: 0, max: 5000 },
    property_value_lakhs: { min: 0, max: 10000 },
    existing_emis_monthly: { min: 0, max: 1000000 },
    max_loan_lakhs: { min: 0, max: 500 },
    total_work_exp_months: { min: 0, max: 600 }
  };

  const updates = [];
  const cleanBody = {};

  for (const f of fields) {
    if (!allowed.has(f)) continue;
    
    let val = body[f];
    
    // Validate numbers
    if (rules[f]) {
      if (val !== null && val !== "") {
        const n = Number(val);
        if (isNaN(n) || n < rules[f].min || n > rules[f].max) {
          return res.status(400).json({ error: `Invalid value for ${f}. Must be between ${rules[f].min} and ${rules[f].max}.` });
        }
        val = n;
      } else {
        val = null;
      }
    }
    
    updates.push(f);
    cleanBody[f] = val;
  }

  if (!updates.length) return res.json({ ok: true });

  const setSql = updates.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(
    `UPDATE student_profiles SET ${setSql}, updated_at=datetime('now') WHERE user_id = @user_id`,
  ).run({ ...cleanBody, user_id: userId });

  // Update scores using fallback logic so dashboard reflects changes immediately
  const updated = getProfile(db, userId);
  const s = fallbackScores(updated, "Profile updated; fallback scores used until AI recompute.");
  
  console.log(`[Profile Update] User ${userId} updated fields:`, updates);
  console.log(`[Profile Update] Recalculated scores:`, s);

  const now = new Date().toISOString();
  const scoreUpdate = db.prepare(
    `UPDATE student_profiles
     SET overall_profile_score=?,
         academic_score=?,
         test_score=?,
         work_exp_score=?,
         research_score=?,
         extracurric_score=?,
         financial_health_score=?,
         last_analyzed_at=?,
         updated_at=datetime('now')
     WHERE user_id=?`,
  ).run(
    s.overall ?? 0,
    s.academics ?? 0,
    s.tests ?? 0,
    s.work ?? 0,
    s.research ?? 0,
    s.extracurric ?? 0,
    s.finance ?? 0,
    now,
    userId,
  );

  console.log(`[Profile Update] Score update result:`, scoreUpdate);

  const final = getProfile(db, userId);
  return res.json({ ok: true, profile: final });
});

router.get("/completeness", (req, res) => {
  const db = getDB();
  const p = getProfile(db, req.session.userId);
  if (!p) return res.json({ ok: true, percent: 0, missing: [] });

  // Human-readable field name map
  const fieldLabels = {
    tenth_board: "10th board", tenth_percent: "10th %",
    twelfth_board: "12th board", twelfth_stream: "12th stream", twelfth_percent: "12th %",
    bachelors_university: "University", bachelors_field: "Field of study",
    bachelors_gpa: "GPA", bachelors_graduation_year: "Graduation year",
    gre_total: "GRE score", ielts_overall: "IELTS score", toefl_total: "TOEFL score",
    total_work_exp_months: "Work experience", current_role: "Current role",
    target_degree: "Target degree", target_countries: "Target countries",
    target_year: "Target year", budget_total_lakhs: "Total budget",
    family_income_lpa: "Family income", savings_lakhs: "Savings",
    cibil_score: "CIBIL score", research_papers: "Research papers",
    projects_count: "Projects count", github_url: "GitHub URL",
  };

  // Only check the important fields for completeness
  const importantFields = Object.keys(fieldLabels);
  const missing = [];
  let filled = 0;

  for (const k of importantFields) {
    const v = p[k];
    const ok = v !== null && v !== "" && v !== 0 && v !== undefined;
    if (ok) filled += 1;
    else missing.push(fieldLabels[k] || k);
  }

  const percent = Math.round((filled / importantFields.length) * 100);
  return res.json({ ok: true, percent, missing });
});

router.post("/recompute-scores", async (req, res) => {
  const db = getDB();
  const userId = req.session.userId;
  const p = getProfile(db, userId);
  if (!p) return res.status(404).json({ error: "Profile not found" });

  const systemPrompt =
    "You score student profiles for abroad admissions. Return JSON only: {overall:0-100, academics:0-100, tests:0-100, work:0-100, research:0-100, extracurric:0-100, finance:0-100, summary:'string', actionItems:[string]}";
  const userPrompt = `Profile:\n${JSON.stringify(p, null, 2)}\n\nReturn JSON only.`;
  let s;
  try {
    const text = await chatCompletion(systemPrompt, userPrompt, true);
    s = JSON.parse(text);
  } catch (err) {
    s = fallbackScores(p, err.message);
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE student_profiles
     SET overall_profile_score=?,
         academic_score=?,
         test_score=?,
         work_exp_score=?,
         research_score=?,
         extracurric_score=?,
         financial_health_score=?,
         last_analyzed_at=?,
         updated_at=datetime('now')
     WHERE user_id=?`,
  ).run(
    s.overall ?? 0,
    s.academics ?? 0,
    s.tests ?? 0,
    s.work ?? 0,
    s.research ?? 0,
    s.extracurric ?? 0,
    s.finance ?? 0,
    now,
    userId,
  );

  return res.json({ ok: true, scores: s });
});

module.exports = router;

