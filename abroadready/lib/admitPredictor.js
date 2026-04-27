const { getDB } = require("../database/db");
const { chatCompletion: geminiCompletion } = require("./gemini");
const { chatCompletion: openaiCompletion } = require("./openai");
const { chatCompletion: hfCompletion } = require("./huggingface");

const SYSTEM_PROMPT = `You are an expert graduate admissions consultant who has helped 1000+ Indian students. Be honest — students need accurate information to make ₹40-80 lakh loan decisions. Return valid JSON only:
{
  admitProbability: 0.0-1.0,
  admitCategory: 'safety|moderate|reach|dream|unqualified',
  confidenceLevel: 'high|medium|low',
  confidenceReason: 'string',
  hardDisqualifiers: ['array'],
  profileVsRequirements: {
    gpa: {yours, minimum, average, verdict:'strong|meets|below'},
    gre: {yours, minimum, average, verdict},
    workExp: {yours, required, verdict},
    research: {verdict:'strong|adequate|weak|none', impact},
    projects: {verdict, impact}
  },
  competitiveStrengths: [{factor, impact:'high|medium', detail}],
  competitiveWeaknesses: [{factor, impact:'high|medium|low', detail, fixable:true|false}],
  indianApplicantContext: 'specific assessment for Indian applicant pool',
  improvementPlan: {
    ifApplyingNow: [{action, timeRequired, probabilityImpact:'+X%'}],
    ifApplyingNextYear: [{action, timeRequired, probabilityImpact:'+X%'}]
  },
  financialFeasibility: {
    totalCostINR: number,
    loanRequiredINR: number,
    score: 0-100,
    risks: ['array'],
    verdict: 'feasible|risky|very risky'
  },
  applicationStrategy: {
    timing: 'apply now|wait|apply next year',
    round: 'early|regular|rolling',
    strengthenBefore: ['array'],
    essayAngles: ['array']
  },
  narrative: '3-4 paragraph honest assessment'
}`;

function normalizeAiResponse(ai) {
  if (!ai || typeof ai !== "object") return null;
  if (typeof ai.admitProbability === "string") ai.admitProbability = Number(ai.admitProbability);
  if (typeof ai.admitProbability !== "number" || Number.isNaN(ai.admitProbability)) return null;
  if (!ai.admitCategory && typeof ai.admitProbability === "number") {
    ai.admitCategory = categorize(ai.admitProbability);
  }
  return ai;
}

async function tryAiProviders(systemPrompt, userPrompt) {
  const providers = [
    { name: "Gemini", fn: geminiCompletion, envKey: "GEMINI_API_KEY" },
    { name: "OpenAI", fn: openaiCompletion, envKey: "OPENAI_API_KEY" },
    { name: "HuggingFace", fn: hfCompletion, envKey: "HUGGINGFACE_API_KEY" },
  ];

  let lastError = null;
  for (const provider of providers) {
    if (!process.env[provider.envKey]) continue;
    try {
      const response = await provider.fn(systemPrompt, userPrompt, true);
      const ai = normalizeAiResponse(safeJsonParse(response));
      if (ai) {
        ai.provider = provider.name;
        return ai;
      }
      lastError = new Error(`${provider.name} returned invalid JSON response`);
      console.error(lastError.message, response);
    } catch (err) {
      lastError = err;
      console.error(`${provider.name} prediction failed:`, err.message);
    }
  }

  if (lastError) throw lastError;
  throw new Error("No AI provider configured or returned usable output");
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function computeBaseRate(points) {
  const total = points.length;
  const admitted = points.filter((p) => String(p.result || "").toLowerCase() === "admit").length;
  return { total, admitted, baseRate: total ? admitted / total : 0 };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function categorize(probability) {
  if (probability > 0.7) return "safety";
  if (probability >= 0.4) return "moderate";
  if (probability >= 0.2) return "reach";
  return "dream";
}

function heuristicPrediction(profile, course, base, costInr, resumeScore, portfolioScore, reason) {
  const gpa = Number(profile.bachelors_gpa || 0);
  const gpaScale = Number(profile.bachelors_gpa_scale || 10) || 10;
  const gpaForty = gpaScale === 4 ? gpa : (gpa / gpaScale) * 4;
  const minGpa = Number(course.min_gpa_forty || 2.8);
  const preferredGpa = Number(course.preferred_gpa_forty || course.avg_gpa_accepted || minGpa + 0.35);

  const greTotal = Number(profile.gre_total || 0);
  const greQuant = Number(profile.gre_quant || 0);
  const gmatTotal = Number(profile.gmat_total || 0);
  const minGre = Number(course.min_gre_total || 310);
  const minGreQuant = Number(course.min_gre_quant || 155);
  const minGmat = Number(course.min_gmat || 600);
  const ielts = Number(profile.ielts_overall || 0);
  const minIelts = Number(course.min_ielts || 6.5);
  const workMonths = Number(profile.total_work_exp_months || 0);
  const requiredWorkYears = Number(course.min_work_exp_years || 0);
  const projects = Number(profile.projects_count || 0);
  const research = Number(profile.research_papers || 0);

  let score = 0.48;
  const strengths = [];
  const weaknesses = [];
  const disqualifiers = [];

  const addStrength = (factor, detail, impact = "medium") => strengths.push({ factor, detail, impact });
  const addWeakness = (factor, detail, impact = "medium", fixable = true) => weaknesses.push({ factor, detail, impact, fixable });

  if (gpaForty) {
    const gpaDelta = gpaForty - preferredGpa;
    score += clamp(gpaDelta * 0.12, -0.16, 0.16);
    if (gpaForty >= preferredGpa) addStrength("Academics", `GPA converts to about ${gpaForty.toFixed(2)}/4.0, at or above the preferred range.`);
    else if (gpaForty >= minGpa) addWeakness("Academics", `GPA converts to about ${gpaForty.toFixed(2)}/4.0, which meets minimums but may not stand out.`);
    else {
      score -= 0.16;
      disqualifiers.push("GPA appears below the stated minimum.");
      addWeakness("Academics", `GPA converts to about ${gpaForty.toFixed(2)}/4.0, below the listed minimum.`, "high", false);
    }
  } else {
    score -= 0.08;
    addWeakness("Academics", "GPA is missing, so the prediction confidence is lower.", "high");
  }

  // Standardized Tests (GRE/GMAT)
  if (course.gre_required && !greTotal && !gmatTotal) {
    score -= 0.12;
    addWeakness("Standardized Tests", "GRE/GMAT is marked as required or expected, but no score is present.", "high");
  } else if (greTotal) {
    const greDelta = greTotal - minGre;
    score += clamp(greDelta / 100, -0.1, 0.12);
    if (greTotal >= minGre + 12) addStrength("GRE", `GRE ${greTotal} is comfortably above the listed baseline.`);
    else if (greTotal >= minGre) addStrength("GRE", `GRE ${greTotal} meets the listed baseline.`, "medium");
    else addWeakness("GRE", `GRE ${greTotal} is below the listed baseline of ${minGre}.`, "high");
  } else if (gmatTotal) {
    const gmatDelta = gmatTotal - minGmat;
    score += clamp(gmatDelta / 200, -0.1, 0.12);
    if (gmatTotal >= minGmat + 40) addStrength("GMAT", `GMAT ${gmatTotal} is comfortably above the listed baseline.`);
    else if (gmatTotal >= minGmat) addStrength("GMAT", `GMAT ${gmatTotal} meets the listed baseline.`, "medium");
    else addWeakness("GMAT", `GMAT ${gmatTotal} is below the listed baseline of ${minGmat}.`, "high");
  }

  if (greQuant) {
    if (greQuant >= minGreQuant + 5) addStrength("Quant readiness", `GRE Quant ${greQuant} supports analytical program fit.`);
    else if (greQuant < minGreQuant) {
      score -= 0.06;
      addWeakness("Quant readiness", `GRE Quant ${greQuant} is below the listed baseline of ${minGreQuant}.`, "high");
    }
  }

  if ((course.ielts_required || course.toefl_required) && ielts && ielts < minIelts) {
    score -= 0.07;
    addWeakness("English test", `IELTS ${ielts} is below the listed baseline of ${minIelts}.`, "high");
  } else if (ielts >= minIelts) {
    addStrength("English test", `IELTS ${ielts} clears the language baseline.`, "medium");
  }

  if (requiredWorkYears && workMonths < requiredWorkYears * 12) {
    score -= 0.08;
    addWeakness("Work experience", `Work experience is below the preferred ${requiredWorkYears} year mark.`, "medium");
  } else if (workMonths >= 12) {
    score += clamp(workMonths / 240, 0.02, 0.08);
    addStrength("Work experience", `${Math.round(workMonths / 12)} year(s) of experience adds practical credibility.`, "medium");
  }

  if (research > 0) {
    score += clamp(research * 0.025, 0.02, 0.08);
    addStrength("Research", `${research} research paper(s) strengthen academic fit.`);
  }
  if (projects > 2) {
    score += 0.04;
    addStrength("Projects", `${projects} projects help support applied readiness.`);
  }
  if (resumeScore) score += clamp((Number(resumeScore) - 70) / 500, -0.04, 0.06);
  if (portfolioScore) score += clamp((Number(portfolioScore) - 7) / 50, -0.03, 0.05);
  if (base.total) score = base.baseRate * 0.4 + score * 0.6;

  const savingsInr = Number(profile.savings_lakhs || 0) * 100000;
  const maxLoanInr = Number(profile.max_loan_lakhs || 0) * 100000;
  const expectedFunding = savingsInr + maxLoanInr;
  const loanRequiredINR = Math.max(0, costInr - savingsInr);
  const financialScore = costInr ? clamp(Math.round((expectedFunding / costInr) * 100), 20, 100) : 55;
  const financialRisks = [];
  if (costInr && expectedFunding < costInr) financialRisks.push("Declared savings and maximum loan may not cover total cost.");
  if (Number(profile.cibil_score || 0) && Number(profile.cibil_score) < 700) financialRisks.push("CIBIL score may make unsecured loan approval harder.");
  if (Number(profile.property_value_lakhs || 0) > 0) financialRisks.push("Collateral-backed loan may put family property at risk.");

  const finalProb = clamp(score, 0.05, 0.92);
  const category = categorize(finalProb);

  return {
    admitProbability: finalProb,
    admitCategory: category,
    provider: "Heuristic",
    confidenceLevel: base.total >= 20 ? "high" : base.total >= 5 ? "medium" : "low",
    confidenceReason: reason
      ? `Heuristic fallback used because AI provider was unavailable: ${reason}`
      : "Heuristic model calibrated with profile, course requirements, and crowdsourced baseline.",
    hardDisqualifiers: disqualifiers,
    profileVsRequirements: {
      gpa: { yours: gpaForty || null, minimum: minGpa, average: preferredGpa, verdict: gpaForty >= preferredGpa ? "strong" : gpaForty >= minGpa ? "meets" : "below" },
      gre: { yours: greTotal || null, minimum: minGre, average: course.avg_gre_accepted_total || null, verdict: greTotal >= minGre ? "meets" : "below" },
      workExp: { yours: workMonths, required: requiredWorkYears * 12, verdict: workMonths >= requiredWorkYears * 12 ? "meets" : "below" },
      research: { verdict: research > 1 ? "strong" : research === 1 ? "adequate" : "none", impact: research ? "positive" : "neutral" },
      projects: { verdict: projects > 3 ? "strong" : projects > 0 ? "adequate" : "weak", impact: projects ? "positive" : "needs evidence" },
    },
    competitiveStrengths: strengths,
    competitiveWeaknesses: weaknesses,
    indianApplicantContext: "Assessment is calibrated for an Indian applicant using available academic, test, work, finance, and course requirement data.",
    improvementPlan: {
      ifApplyingNow: weaknesses.slice(0, 3).map((w) => ({ action: `Address ${w.factor}: ${w.detail}`, timeRequired: "1-4 weeks", probabilityImpact: "+2-6%" })),
      ifApplyingNextYear: [
        { action: "Strengthen one major project or research artifact with measurable outcomes.", timeRequired: "2-4 months", probabilityImpact: "+5-10%" },
        { action: "Improve test scores if below program baseline.", timeRequired: "6-10 weeks", probabilityImpact: "+4-8%" },
      ],
    },
    financialFeasibility: {
      totalCostINR: costInr,
      loanRequiredINR,
      score: financialScore,
      risks: financialRisks,
      verdict: financialScore >= 80 ? "feasible" : financialScore >= 55 ? "risky" : "very risky",
    },
    applicationStrategy: {
      timing: category === "dream" ? "apply next year" : "apply now",
      round: "regular",
      strengthenBefore: weaknesses.map((w) => w.factor).slice(0, 4),
      essayAngles: ["Quantified project outcomes", "Academic fit with target coursework", "Clear post-study financial plan"],
    },
    narrative: `This ${course.name} prediction is based on your stored profile, listed course requirements, and ${base.total} similar crowdsourced data point(s). The current estimate is ${Math.round(finalProb * 100)}%, categorized as ${category}. The main drivers are academics, test readiness, work/projects, and financial feasibility. Use this as a planning signal, not a guarantee.`,
  };
}

async function runPrediction(userId, courseId, opts = {}) {
  const db = getDB();

  const profile = db.prepare("SELECT * FROM student_profiles WHERE user_id = ?").get(userId);
  if (!profile) throw new Error("Student profile not found");

  const course = db
    .prepare(
      `SELECT c.*, u.name AS university_name, u.slug AS university_slug, u.id AS university_id,
              co.code AS country_code, co.currency AS country_currency, co.exchange_rate_to_inr
       FROM courses c
       JOIN universities u ON u.id = c.university_id
       JOIN countries co ON co.id = u.country_id
       WHERE c.id = ?`,
    )
    .get(courseId);
  if (!course) throw new Error("Course not found");

  const resumeScore = opts.resumeId
    ? db.prepare("SELECT ai_score_overall FROM resumes WHERE id=? AND user_id=?").pluck().get(opts.resumeId, userId)
    : null;
  const portfolioScore = opts.portfolioId
    ? db.prepare("SELECT overall_score FROM portfolios WHERE id=? AND user_id=?").pluck().get(opts.portfolioId, userId)
    : null;

  const gpa = Number(profile.bachelors_gpa || 0);
  const gpaMin = gpa ? gpa - 0.3 : 0;
  const gpaMax = gpa ? gpa + 0.3 : 10;
  const gre = Number(profile.gre_total || 0);
  const greMin = gre ? gre - 20 : 0;
  const greMax = gre ? gre + 20 : 400;

  const points = db
    .prepare(
      `SELECT * FROM crowdsourced_data_points
       WHERE course_id = ?
         AND (gpa_forty IS NULL OR (gpa_forty BETWEEN ? AND ?))
         AND (gre_total IS NULL OR (gre_total BETWEEN ? AND ?))
       ORDER BY submitted_at DESC
       LIMIT 200`,
    )
    .all(courseId, gpaMin, gpaMax, greMin, greMax);

  const base = computeBaseRate(points);

  const profileSnapshot = {
    academics: {
      bachelors_gpa: profile.bachelors_gpa,
      bachelors_gpa_scale: profile.bachelors_gpa_scale,
      bachelors_university_tier: profile.bachelors_university_tier,
      bachelors_field: profile.bachelors_field,
      graduation_year: profile.bachelors_graduation_year,
      tenth_percent: profile.tenth_percent,
      twelfth_percent: profile.twelfth_percent,
      twelfth_stream: profile.twelfth_stream,
    },
    tests: {
      gre_total: profile.gre_total,
      gre_verbal: profile.gre_verbal,
      gre_quant: profile.gre_quant,
      gmat_total: profile.gmat_total,
      ielts_overall: profile.ielts_overall,
      toefl_total: profile.toefl_total,
      duolingo_score: profile.duolingo_score,
    },
    experience: {
      total_work_exp_months: profile.total_work_exp_months,
      research_papers: profile.research_papers,
      projects_count: profile.projects_count,
      awards_and_honors: profile.awards_and_honors,
      github_url: profile.github_url,
    },
    finances: {
      family_income_lpa: profile.family_income_lpa,
      savings_lakhs: profile.savings_lakhs,
      property_value_lakhs: profile.property_value_lakhs,
      cibil_score: profile.cibil_score,
      existing_emis_monthly: profile.existing_emis_monthly,
    },
  };

  const costInr =
    Number(course.coa_total_inr || 0) ||
    Number(course.coa_total_local || 0) * Number(course.exchange_rate_to_inr || 0) ||
    0;

  const userPrompt = `Student profile:\n${JSON.stringify(profileSnapshot, null, 2)}\n\nCourse:\n${JSON.stringify(
    {
      id: course.id,
      name: course.name,
      degree: course.degree,
      university: course.university_name,
      country: course.country_code,
      requirements: {
        min_gpa_forty: course.min_gpa_forty,
        min_gre_total: course.min_gre_total,
        gre_required: course.gre_required,
        work_exp_required: course.work_exp_required,
        min_work_exp_years: course.min_work_exp_years,
        ielts_required: course.ielts_required,
        min_ielts: course.min_ielts,
        toefl_required: course.toefl_required,
        min_toefl: course.min_toefl,
      },
      costs: { coa_total_inr: costInr },
    },
    null,
    2,
  )}\n\nCrowdsourced baseline:\n${JSON.stringify(base, null, 2)}\n\nReturn JSON only.`;

  let ai = null;
  let aiError = null;
  try {
    ai = await tryAiProviders(SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    aiError = err;
    console.error("AI prediction failed:", err.message);
    ai = heuristicPrediction(profile, course, base, costInr, resumeScore, portfolioScore, err.message || "AI unavailable");
  }

  if (!ai.admitProbability && typeof ai.admitProbability !== "number") {
    ai = heuristicPrediction(profile, course, base, costInr, resumeScore, portfolioScore, aiError?.message || "AI unavailable");
  }

  if (!ai.admitCategory) {
    ai.admitCategory = categorize(Number(ai.admitProbability || 0));
  }

  const gptProb = Number(ai.admitProbability || 0);
  const finalProbability = base.total ? base.baseRate * 0.4 + gptProb * 0.6 : gptProb;

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO admit_predictions (
      user_id, course_id, university_id,
      profile_snapshot, resume_score_used, portfolio_score_used,
      admit_probability, admit_category, confidence_score,
      strength_factors, weakness_factors, missing_requirements,
      improvement_actions, total_cost_inr, loan_required_inr,
      financial_feasibility_score, financial_risks,
      similar_admitted, similar_rejected, similar_data_points,
      ai_narrative, checklist, created_at, updated_at
    ) VALUES (
      @user_id, @course_id, @university_id,
      @profile_snapshot, @resume_score_used, @portfolio_score_used,
      @admit_probability, @admit_category, @confidence_score,
      @strength_factors, @weakness_factors, @missing_requirements,
      @improvement_actions, @total_cost_inr, @loan_required_inr,
      @financial_feasibility_score, @financial_risks,
      @similar_admitted, @similar_rejected, @similar_data_points,
      @ai_narrative, @checklist, @created_at, @updated_at
    )`,
  );

  const loanRequired = Number(ai?.financialFeasibility?.loanRequiredINR || 0);
  const ffScore = Number(ai?.financialFeasibility?.score || 0);

  const res = insert.run({
    user_id: userId,
    course_id: courseId,
    university_id: course.university_id,
    profile_snapshot: JSON.stringify(profileSnapshot),
    resume_score_used: resumeScore,
    portfolio_score_used: portfolioScore,
    admit_probability: finalProbability,
    admit_category: ai.admitCategory || "",
    confidence_score: ai.confidenceLevel === "high" ? 80 : ai.confidenceLevel === "medium" ? 60 : 40,
    strength_factors: JSON.stringify(ai.competitiveStrengths || []),
    weakness_factors: JSON.stringify(ai.competitiveWeaknesses || []),
    missing_requirements: JSON.stringify(ai.hardDisqualifiers || []),
    improvement_actions: JSON.stringify(ai.improvementPlan || {}),
    total_cost_inr: Number(ai?.financialFeasibility?.totalCostINR || costInr || 0),
    loan_required_inr: loanRequired,
    financial_feasibility_score: ffScore,
    financial_risks: JSON.stringify(ai?.financialFeasibility?.risks || []),
    similar_admitted: base.admitted,
    similar_rejected: base.total - base.admitted,
    similar_data_points: base.total,
    ai_narrative: ai.narrative || "",
    checklist: JSON.stringify(ai.applicationStrategy || {}),
    created_at: now,
    updated_at: now,
  });

  const predictionId = res.lastInsertRowid;
  return { id: Number(predictionId), finalProbability, base, ai };
}

module.exports = {
  runPrediction,
};

