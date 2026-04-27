const fetch = require("node-fetch");
const { getDB } = require("../database/db");

const PRIMARY_URL =
  "https://api.frankfurter.app/latest?from=USD&to=INR,GBP,CAD,EUR,AUD,SGD,SEK,JPY,NZD,AED";

function nowIso() {
  return new Date().toISOString();
}

function hoursAgo(updatedAtIso) {
  if (!updatedAtIso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(updatedAtIso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / (60 * 60 * 1000);
}

function getCachedRates(db) {
  const rows = db
    .prepare("SELECT currency_code, rate_to_inr, updated_at FROM forex_cache")
    .all();
  if (!rows.length) return null;
  const maxUpdatedAt = rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), rows[0].updated_at);
  const rates = {};
  for (const r of rows) rates[r.currency_code] = r.rate_to_inr;
  return { rates, updatedAt: maxUpdatedAt };
}

async function fetchPrimary() {
  const resp = await fetch(PRIMARY_URL);
  if (!resp.ok) throw new Error(`Frankfurter failed: ${resp.status}`);
  const data = await resp.json();
  // Frankfurter is from USD; we want rate_to_inr per currency.
  // It returns USD->INR and USD->others; so currency->INR = (USD->INR)/(USD->currency).
  const usdToInr = data?.rates?.INR;
  if (!usdToInr) throw new Error("Frankfurter missing INR");
  const out = { USD: usdToInr };
  for (const [ccy, usdToCcy] of Object.entries(data.rates || {})) {
    if (ccy === "INR") continue;
    if (!usdToCcy) continue;
    out[ccy] = usdToInr / usdToCcy;
  }
  // Ensure INR itself
  out.INR = 1;
  return out;
}

async function fetchFallback() {
  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) throw new Error("EXCHANGE_RATE_API_KEY missing for fallback");

  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ExchangeRate-API failed: ${resp.status}`);
  const data = await resp.json();
  const usdRates = data?.conversion_rates || {};
  const usdToInr = usdRates.INR;
  if (!usdToInr) throw new Error("ExchangeRate-API missing INR");

  const out = { USD: usdToInr };
  for (const ccy of ["GBP", "CAD", "EUR", "AUD", "SGD", "SEK", "JPY", "NZD", "AED"]) {
    const usdToCcy = usdRates[ccy];
    if (!usdToCcy) continue;
    out[ccy] = usdToInr / usdToCcy;
  }
  out.INR = 1;
  return out;
}

function persistRates(db, rates) {
  const up = db.prepare(
    `INSERT INTO forex_cache (currency_code, rate_to_inr, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(currency_code) DO UPDATE SET
       rate_to_inr=excluded.rate_to_inr,
       updated_at=excluded.updated_at`,
  );
  const ts = nowIso();
  const tx = db.transaction(() => {
    for (const [ccy, rate] of Object.entries(rates)) {
      if (!rate) continue;
      up.run(ccy, rate, ts);
    }
  });
  tx();
  return ts;
}

async function getCurrentRates() {
  const db = getDB();
  const cached = getCachedRates(db);
  if (cached && hoursAgo(cached.updatedAt) < 4) {
    return { rates: cached.rates, updatedAt: cached.updatedAt, source: "cache" };
  }

  let rates;
  let source = "frankfurter";
  try {
    rates = await fetchPrimary();
  } catch (e) {
    rates = await fetchFallback();
    source = "exchangerate-api";
  }

  const updatedAt = persistRates(db, rates);

  // Also update countries exchange rate for their currency (best-effort)
  const updateCountry = db.prepare(
    `UPDATE countries
     SET exchange_rate_to_inr = ?,
         exchange_rate_updated_at = ?,
         updated_at = datetime('now')
     WHERE currency = ?`,
  );
  const tx = db.transaction(() => {
    for (const [ccy, rateToInr] of Object.entries(rates)) {
      updateCountry.run(rateToInr, updatedAt, ccy);
    }
  });
  tx();

  return { rates, updatedAt, source };
}

async function getRate(currency) {
  const { rates } = await getCurrentRates();
  const ccy = String(currency || "").toUpperCase();
  if (ccy === "INR") return 1;
  return rates[ccy] || null;
}

async function convertToINR(amount, currency) {
  const rate = await getRate(currency);
  if (!rate) throw new Error(`Missing forex rate for ${currency}`);
  return Number(amount || 0) * rate;
}

function updateAllCourseINRPrices() {
  const db = getDB();
  const cached = getCachedRates(db);
  if (!cached) return { updated: 0 };

  const getUniCountries = db.prepare(
    `SELECT c.id AS course_id, u.country_id, co.currency
     FROM courses c
     JOIN universities u ON u.id = c.university_id
     JOIN countries co ON co.id = u.country_id`,
  );
  const update = db.prepare(
    `UPDATE courses
     SET coa_total_inr = ?,
         coa_updated_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  );

  const updatedAt = nowIso();
  let count = 0;
  const tx = db.transaction(() => {
    const rows = getUniCountries.all();
    for (const r of rows) {
      const currency = String(r.currency || "").toUpperCase();
      const rate = currency === "INR" ? 1 : cached.rates[currency];
      if (!rate) continue;
      const coa = db.prepare("SELECT coa_total_local FROM courses WHERE id = ?").pluck().get(r.course_id) || 0;
      const inr = Number(coa) * rate;
      update.run(inr, updatedAt, r.course_id);
      count += 1;
    }
  });
  tx();
  return { updated: count, updatedAt };
}

module.exports = {
  getCurrentRates,
  convertToINR,
  getRate,
  updateAllCourseINRPrices,
};

