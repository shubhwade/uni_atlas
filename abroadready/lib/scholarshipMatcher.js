const { getDB } = require("../database/db");
const { chatCompletion } = require("./huggingface");

function includesToken(listStr, token) {
  const s = String(listStr || "")
    .toLowerCase()
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return s.includes(String(token || "").toLowerCase());
}

function scoreScholarship(profile, sch) {
  let score = 50;

  const degree = String(profile.target_degree || "").toLowerCase();
  if (sch.target_degrees && degree) {
    const ok = includesToken(sch.target_degrees, degree) || includesToken(sch.target_degrees, degree.toUpperCase());
    score += ok ? 15 : -25;
  }

  const income = Number(profile.family_income_lpa || 0);
  const maxIncome = Number(sch.target_income_lpa_max || 0);
  if (maxIncome > 0) score += income > 0 && income <= maxIncome ? 10 : -15;

  const gpa = Number(profile.bachelors_gpa || 0);
  const minGpa = Number(sch.min_gpa || 0);
  if (minGpa > 0) score += gpa >= minGpa ? 10 : -20;

  if (String(sch.provider_type || "").toLowerCase() === "government") score += 5;
  if (String(sch.competition_level || "").toLowerCase().includes("very high")) score -= 5;

  return Math.max(0, Math.min(100, score));
}

async function tipsForScholarship(profile, sch) {
  const systemPrompt =
    "You are a scholarship advisor for Indian students. Return valid JSON only: {tips:[{action,impact:'high|medium|low',detail}],keyAngles:[string],commonMistakes:[string]}.";
  const userPrompt = `Student profile:\n${JSON.stringify(
    {
      target_degree: profile.target_degree,
      target_fields: profile.target_fields,
      target_countries: profile.target_countries,
      bachelors_field: profile.bachelors_field,
      total_work_exp_months: profile.total_work_exp_months,
      research_papers: profile.research_papers,
      projects_count: profile.projects_count,
      awards_and_honors: profile.awards_and_honors,
    },
    null,
    2,
  )}\n\nScholarship:\n${JSON.stringify(
    {
      name: sch.name,
      provider: sch.provider,
      target_degrees: sch.target_degrees,
      target_fields: sch.target_fields,
      deadline: sch.deadline,
      competition_level: sch.competition_level,
      eligibility_details: sch.eligibility_details,
    },
    null,
    2,
  )}\n\nReturn JSON only.`;
  try {
    const text = await chatCompletion(systemPrompt, userPrompt, true);
    return JSON.parse(text);
  } catch (err) {
    return {
      tips: [
        { action: "Confirm eligibility before drafting essays", impact: "high", detail: "Check nationality, degree, field, income, and deadline constraints." },
        { action: "Write a mission-driven essay", impact: "medium", detail: "Tie your goals, India context, and target program into one coherent story." },
      ],
      keyAngles: [profile.target_degree || "Target degree", profile.bachelors_field || "Academic background", "Financial need and impact"],
      commonMistakes: ["Missing deadline documents", "Generic essays", "Weak proof of fit"],
      fallbackReason: err.message || "AI unavailable",
    };
  }
}

async function matchScholarships(userId) {
  const db = getDB();
  const profile = db.prepare("SELECT * FROM student_profiles WHERE user_id = ?").get(userId);
  if (!profile) throw new Error("Student profile not found");

  const scholarships = db.prepare("SELECT * FROM scholarships WHERE is_active = 1").all();

  const filtered = scholarships.filter((s) => {
    if (s.target_nationalities && !includesToken(s.target_nationalities, "in")) return false;
    if (s.target_degrees && profile.target_degree && !includesToken(s.target_degrees, profile.target_degree)) return false;
    
    // Country matching
    if (s.target_countries && profile.target_countries) {
      const sCountries = s.target_countries.toLowerCase().split(",").map(c => c.trim());
      const pCountries = profile.target_countries.toLowerCase().split(",").map(c => c.trim());
      const match = pCountries.some(pc => sCountries.includes(pc) || sCountries.includes("global") || sCountries.includes("any"));
      if (!match) return false;
    }

    const maxIncome = Number(s.target_income_lpa_max || 0);
    if (maxIncome > 0 && Number(profile.family_income_lpa || 0) > maxIncome) return false;
    return true;
  });

  const ranked = filtered
    .map((s) => ({ scholarship: s, score: scoreScholarship(profile, s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // Add AI tips for top 5 (best-effort)
  const out = [];
  for (let i = 0; i < ranked.length; i += 1) {
    const item = ranked[i];
    let ai = null;
    if (i < 5) {
      ai = await tipsForScholarship(profile, item.scholarship).catch(() => null);
    }
    out.push({
      id: item.scholarship.id,
      name: item.scholarship.name,
      provider: item.scholarship.provider,
      deadline: item.scholarship.deadline,
      application_url: item.scholarship.application_url,
      total_value_inr: item.scholarship.total_value_inr || item.scholarship.amount_inr || 0,
      score: item.score,
      ai,
    });
  }

  return out;
}

module.exports = {
  matchScholarships,
};

