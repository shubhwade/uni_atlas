const { getDB } = require("../database/db");
const { chatCompletion } = require("./gemini");

function pmt(ratePerPeriod, nper, pv) {
  if (ratePerPeriod === 0) return -(pv / nper);
  const r = ratePerPeriod;
  return (-(pv * r) * Math.pow(1 + r, nper)) / (Math.pow(1 + r, nper) - 1);
}

function irr(cashflows, guess = 0.1) {
  // Newton-Raphson on monthly IRR
  let x = guess;
  for (let i = 0; i < 50; i += 1) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < cashflows.length; t += 1) {
      const c = cashflows[t];
      const denom = Math.pow(1 + x, t);
      f += c / denom;
      df += (-t * c) / (denom * (1 + x));
    }
    if (Math.abs(df) < 1e-10) break;
    const nx = x - f / df;
    if (!Number.isFinite(nx)) break;
    if (Math.abs(nx - x) < 1e-7) {
      x = nx;
      break;
    }
    x = nx;
  }
  return x;
}

function calculateTrueLoanCost(principal, rate, courseYears, moratoriumMonths, repaymentMonths = 120) {
  const P = Number(principal || 0);
  const annualRate = Number(rate || 0) / 100;
  const morMonths = Number(moratoriumMonths || 0);
  const repayMonths = Number(repaymentMonths || 120);

  // Simple interest during moratorium
  const moratoriumInterestCost = P * annualRate * (morMonths / 12);
  const principalAtRepaymentStart = P + moratoriumInterestCost;

  // EMI calculation
  const monthlyRate = annualRate / 12;
  const emiAmount = monthlyRate === 0 ? principalAtRepaymentStart / repayMonths : -pmt(monthlyRate, repayMonths, principalAtRepaymentStart);

  const totalInterestPaid = emiAmount * repayMonths - principalAtRepaymentStart;
  const totalOutflow = emiAmount * repayMonths; // Total EMI payments only (already includes principal + interest)

  // Effective IRR (monthly) on cashflows: +principal at t0, then -emi payments
  const cashflows = [P];
  for (let i = 0; i < morMonths; i += 1) cashflows.push(0);
  for (let i = 0; i < repayMonths; i += 1) cashflows.push(-emiAmount);
  const monthlyIrr = irr(cashflows, monthlyRate || 0.01);
  const effectiveIRR = (Math.pow(1 + monthlyIrr, 12) - 1) * 100;

  // Opportunity cost: invest principal at 8% for total duration
  const totalYears = courseYears + morMonths / 12 + repayMonths / 12;
  const opportunityCostVsIndia = P * Math.pow(1.08, totalYears) - P;

  const breakEvenSalaryNeeded = Math.max(0, (emiAmount * 12) / 0.25); // crude: EMI <= 25% of annual salary
  const yearsTillDebtFree = repayMonths / 12;

  return {
    principalAtRepaymentStart,
    totalEMI: emiAmount * repayMonths,
    totalInterestPaid,
    totalOutflow,
    emiAmount,
    moratoriumInterestCost,
    effectiveIRR,
    breakEvenSalaryNeeded,
    yearsTillDebtFree,
    opportunityCostVsIndia,
    repaymentMonths: repayMonths,
  };
}

function generateBudgetPlan(countryCode, courseMonths, partTimeIncome) {
  const db = getDB();
  const country = db.prepare("SELECT * FROM countries WHERE code = ?").get(String(countryCode || "").toLowerCase());
  if (!country) throw new Error("Country not found");

  const months = Number(courseMonths || 0) || 12;
  const income = Number(partTimeIncome || 0) || 0;

  const rent = Number(country.avg_rent_shared_1bhk || 0);
  const groceries = Number(country.avg_groceries_monthly || 0);
  const transport = Number(country.avg_transport_monthly || 0);
  const phone = Number(country.avg_phone_internet_monthly || 0);
  const health = Number(country.avg_health_insurance_monthly || 0);
  const dining = Number(country.avg_meal_restaurant || 0) * 10;

  const plan = [];
  for (let i = 1; i <= months; i += 1) {
    const expense = rent + groceries + transport + phone + health + dining;
    plan.push({
      month: i,
      income,
      expense,
      net: income - expense,
      breakdown: { rent, groceries, transport, phone, healthInsurance: health, diningOut: dining },
    });
  }
  return { country: country.code, currency: country.currency, months, plan };
}

function rankLenders(profile, loanAmountLakhs, countryCode) {
  const db = getDB();
  const amount = Number(loanAmountLakhs || 0);
  const code = String(countryCode || "").toLowerCase();
  const cibil = Number(profile.cibil_score || 0);
  const income = Number(profile.family_income_lpa || 0);
  const hasCollateral = Number(profile.property_value_lakhs || 0) > 0;

  const lenders = db.prepare("SELECT * FROM lenders").all();
  const filtered = lenders.filter((l) => {
    const supported = String(l.countries_supported || "").toLowerCase().includes(code) || !code;
    const okMax = Number(l.max_loan_lakhs_secured || 0) >= amount;
    return supported && okMax;
  });

  const scored = filtered
    .map((l) => {
      let score = 50;
      const rate = Number(l.rate_min || 12);
      
      // Rate score (lower is better)
      score += (14 - rate) * 5;

      // Processing speed
      score += Number(l.processing_speed_rating || 3) * 5;

      // CIBIL fit
      if (cibil > 0) {
        if (cibil >= 750 && l.type === "private_bank") score += 10;
        if (cibil < 650 && l.type === "nbfc") score += 5; // NBFCs more likely to approve low CIBIL
        if (cibil < 600 && l.type === "private_bank") score -= 15;
      }

      // Collateral fit
      if (hasCollateral && l.type === "public_bank") score += 15; // Public banks best for secured
      if (!hasCollateral && l.type === "public_bank") score -= 20;

      // Income fit
      if (income >= 10 && l.type === "private_bank") score += 5;

      return { lender: l, score: Math.max(0, Math.min(100, score)) };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 10).map((x) => {
    let reason = `Rate ${x.lender.rate_min}%-${x.lender.rate_max}% and processing rating ${x.lender.processing_speed_rating}/5.`;
    if (hasCollateral && x.lender.type === "public_bank") reason += " Best fit for your available collateral.";
    if (cibil >= 750 && x.lender.type === "private_bank") reason += " High CIBIL unlocks these premium rates.";
    if (!hasCollateral && x.lender.type === "nbfc") reason += " Good option for unsecured loans.";

    return {
      id: x.lender.id,
      name: x.lender.name,
      type: x.lender.type,
      score: Math.round(x.score),
      reason
    };
  });
}

async function generateRiskReport(profile, course, country, lenderName) {
  const systemPrompt =
    "You are a cautious financial advisor for Indian students. Return valid JSON only with scenarios, risks, mitigations, and a final verdict.";
  const userPrompt = `Profile:\n${JSON.stringify(profile || {}, null, 2)}\n\nCourse:\n${JSON.stringify(
    course || {},
    null,
    2,
  )}\n\nCountry:\n${JSON.stringify(country || {}, null, 2)}\n\nLender: ${lenderName || ""}\n\nReturn JSON only.`;
  const text = await chatCompletion(systemPrompt, userPrompt, true);
  return JSON.parse(text);
}

module.exports = {
  calculateTrueLoanCost,
  generateBudgetPlan,
  rankLenders,
  generateRiskReport,
};

