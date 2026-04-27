const express = require("express");
const { getDB } = require("../database/db");

const router = express.Router();

function amortize(principal, annualRatePct, months) {
  const P = Number(principal || 0);
  const r = Number(annualRatePct || 0) / 100 / 12;
  const n = Number(months || 0);
  if (n <= 0) return [];
  const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let balance = P;
  const out = [];
  for (let i = 1; i <= n; i += 1) {
    const interest = balance * r;
    const principalPart = emi - interest;
    balance = Math.max(0, balance - principalPart);
    out.push({
      month: i,
      emi,
      principalPart,
      interestPart: interest,
      remaining: balance,
    });
  }
  return out;
}

router.get("/", (req, res) => {
  const db = getDB();
  const rows = db.prepare("SELECT * FROM loan_trackers WHERE user_id=? ORDER BY created_at DESC").all(req.session.userId);
  return res.json({ ok: true, loans: rows });
});

router.post("/", (req, res) => {
  const db = getDB();
  const payload = req.body || {};
  const info = db
    .prepare(
      `INSERT INTO loan_trackers (
        user_id, lender_name, product_name, principal_inr, interest_rate, rate_type,
        disbursed_date, first_emi_date, tenure_months, collateral_type, collateral_value_inr,
        emi_amount_monthly, remaining_principal, status, notes
      ) VALUES (
        @user_id, @lender_name, @product_name, @principal_inr, @interest_rate, @rate_type,
        @disbursed_date, @first_emi_date, @tenure_months, @collateral_type, @collateral_value_inr,
        @emi_amount_monthly, @remaining_principal, @status, @notes
      )`,
    )
    .run({
      user_id: req.session.userId,
      lender_name: payload.lender_name || "",
      product_name: payload.product_name || "",
      principal_inr: payload.principal_inr || 0,
      interest_rate: payload.interest_rate || 0,
      rate_type: payload.rate_type || "floating",
      disbursed_date: payload.disbursed_date || "",
      first_emi_date: payload.first_emi_date || "",
      tenure_months: payload.tenure_months || 120,
      collateral_type: payload.collateral_type || "",
      collateral_value_inr: payload.collateral_value_inr || 0,
      emi_amount_monthly: payload.emi_amount_monthly || 0,
      remaining_principal: payload.remaining_principal || payload.principal_inr || 0,
      status: payload.status || "sanctioned",
      notes: payload.notes || "",
    });
  return res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM loan_trackers WHERE id=? AND user_id=?").get(id, req.session.userId);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const allowed = Object.keys(existing).filter((k) => !["id", "user_id", "created_at", "updated_at"].includes(k));
  const updates = Object.keys(req.body || {}).filter((k) => allowed.includes(k));
  if (!updates.length) return res.json({ ok: true });

  const setSql = updates.map((k) => `${k}=@${k}`).join(", ");
  db.prepare(`UPDATE loan_trackers SET ${setSql}, updated_at=datetime('now') WHERE id=@id AND user_id=@user_id`).run({
    ...req.body,
    id,
    user_id: req.session.userId,
  });
  return res.json({ ok: true });
});

router.post("/:id/payment", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const loan = db.prepare("SELECT * FROM loan_trackers WHERE id=? AND user_id=?").get(id, req.session.userId);
  if (!loan) return res.status(404).json({ error: "Not found" });

  const p = req.body || {};
  db.prepare(
    `INSERT INTO emi_payments (loan_tracker_id, due_date, paid_date, amount, principal_part, interest_part, late_fee, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, p.due_date || "", p.paid_date || "", p.amount || 0, p.principal_part || 0, p.interest_part || 0, p.late_fee || 0, p.status || "paid");

  db.prepare(
    `UPDATE loan_trackers
     SET total_paid_so_far = total_paid_so_far + ?,
         principal_repaid = principal_repaid + ?,
         interest_paid_so_far = interest_paid_so_far + ?,
         last_payment_date = ?,
         updated_at=datetime('now')
     WHERE id=? AND user_id=?`,
  ).run(p.amount || 0, p.principal_part || 0, p.interest_part || 0, p.paid_date || "", id, req.session.userId);

  return res.json({ ok: true });
});

router.get("/:id/schedule", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const loan = db.prepare("SELECT * FROM loan_trackers WHERE id=? AND user_id=?").get(id, req.session.userId);
  if (!loan) return res.status(404).json({ error: "Not found" });
  const schedule = amortize(loan.principal_inr, loan.interest_rate, loan.tenure_months);
  return res.json({ ok: true, schedule });
});

module.exports = router;

