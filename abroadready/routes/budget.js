const express = require("express");
const { getDB } = require("../database/db");
const { chatCompletion } = require("../lib/openai");

const router = express.Router();

function safeJson(text) {
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

function fallbackInsights(rows, reason) {
  const latest = rows[0] || {};
  const avgExpense = rows.reduce((a, r) => a + Number(r.total_expense || 0), 0) / rows.length;
  const avgIncome = rows.reduce((a, r) => a + Number(r.total_income || 0), 0) / rows.length;
  return {
    summary: `Fallback budget insight generated because AI was unavailable: ${reason || "external service unavailable"}. Average monthly net is ${(avgIncome - avgExpense).toFixed(0)} in the tracked currency.`,
    risks: [
      ...(Number(latest.net_savings || 0) < 0 ? ["Latest month is running a deficit."] : []),
      ...(avgExpense > avgIncome ? ["Average expenses are above average income."] : []),
    ],
    quickWins: ["Review dining, transport, and miscellaneous categories.", "Set a weekly cap for flexible spending.", "Track part-time income separately from recurring stipend income."],
    nextMonthPlan: [
      { action: "Lock rent and groceries as fixed budget lines", impact: "high", effort: "low" },
      { action: "Reduce the largest flexible category by 10%", impact: "medium", effort: "medium" },
    ],
  };
}

router.get("/", (req, res) => {
  const db = getDB();
  const year = req.query.year ? Number(req.query.year) : null;
  const rows = year
    ? db.prepare("SELECT * FROM budget_logs WHERE user_id=? AND year=? ORDER BY year DESC, month DESC").all(req.session.userId, year)
    : db.prepare("SELECT * FROM budget_logs WHERE user_id=? ORDER BY year DESC, month DESC LIMIT 36").all(req.session.userId);
  return res.json({ ok: true, logs: rows });
});

router.post("/", (req, res) => {
  const db = getDB();
  const p = req.body || {};
  if (!p.month || !p.year) return res.status(400).json({ error: "month and year required" });

  const cols = [
    "user_id",
    "month",
    "year",
    "country_code",
    "city_name",
    "currency",
    "exchange_rate_used",
    "part_time_income",
    "ta_ra_stipend",
    "freelance_income",
    "other_income",
    "rent",
    "groceries",
    "dining_out",
    "transport",
    "utilities",
    "phone_internet",
    "health_insurance",
    "medical_expenses",
    "entertainment",
    "clothing",
    "books",
    "travel_within_country",
    "travel_to_india",
    "remittance_to_india",
    "university_fees",
    "miscellaneous",
    "notes",
    "total_income",
    "total_expense",
    "net_savings",
  ];

  const payload = { user_id: req.session.userId };
  for (const c of cols) {
    if (c === "user_id") continue;
    payload[c] = p[c] ?? 0;
  }

  // compute totals if not provided
  const incomeKeys = ["part_time_income", "ta_ra_stipend", "freelance_income", "other_income"];
  const expenseKeys = [
    "rent",
    "groceries",
    "dining_out",
    "transport",
    "utilities",
    "phone_internet",
    "health_insurance",
    "medical_expenses",
    "entertainment",
    "clothing",
    "books",
    "travel_within_country",
    "travel_to_india",
    "remittance_to_india",
    "university_fees",
    "miscellaneous",
  ];
  const totalIncome = incomeKeys.reduce((a, k) => a + Number(payload[k] || 0), 0);
  const totalExpense = expenseKeys.reduce((a, k) => a + Number(payload[k] || 0), 0);
  payload.total_income = payload.total_income || totalIncome;
  payload.total_expense = payload.total_expense || totalExpense;
  payload.net_savings = payload.net_savings || totalIncome - totalExpense;

  const stmt = db.prepare(
    `INSERT INTO budget_logs (${cols.join(",")})
     VALUES (${cols.map((c) => `@${c}`).join(",")})
     ON CONFLICT(user_id, month, year) DO UPDATE SET
       ${cols
         .filter((c) => !["user_id", "month", "year"].includes(c))
         .map((c) => `${c}=excluded.${c}`)
         .join(",")}, updated_at=datetime('now')`,
  );
  stmt.run(payload);
  return res.json({ ok: true });
});

router.get("/:year/:month", (req, res) => {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM budget_logs WHERE user_id=? AND year=? AND month=?")
    .get(req.session.userId, Number(req.params.year), Number(req.params.month));
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, log: row });
});

router.post("/insights", async (req, res) => {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM budget_logs WHERE user_id=? ORDER BY year DESC, month DESC LIMIT 3")
    .all(req.session.userId);
  if (!rows.length) return res.status(400).json({ error: "No budget data" });

  const systemPrompt =
    "You are a budgeting coach for Indian students abroad. Return JSON only: {summary:string, risks:[string], quickWins:[string], nextMonthPlan:[{action,impact,effort:'low|medium|high'}]}";
  const userPrompt = `Last 3 months budget logs:\n${JSON.stringify(rows, null, 2)}\n\nReturn JSON only.`;
  try {
    const text = await chatCompletion(systemPrompt, userPrompt, true);
    return res.json({ ok: true, insights: safeJson(text) || fallbackInsights(rows, "invalid AI JSON") });
  } catch (err) {
    return res.json({ ok: true, insights: fallbackInsights(rows, err.message) });
  }
});

module.exports = router;

