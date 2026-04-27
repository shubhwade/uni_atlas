const fetch = require("node-fetch");
const { getDB } = require("../database/db");
const { crawlProgramPage } = require("./firecrawl");
const { chatCompletion } = require("./huggingface");

async function getCostOfLivingFromNumbeoApi(city, currency = "USD") {
  const key = process.env.NUMBEO_API_KEY;
  if (!key) return null;

  const url = new URL("https://www.numbeo.com/api/city_prices");
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", city);
  url.searchParams.set("currency", currency);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Numbeo API failed: ${resp.status} ${t}`);
  }
  return resp.json();
}

function pickPrice(items, includesText) {
  const it = (items || []).find((x) => String(x?.item_name || "").toLowerCase().includes(includesText));
  return it ? Number(it.average_price || it.avg || 0) : 0;
}

function mapNumbeoApiToCosts(data) {
  const prices = data?.prices || [];
  return {
    rentShared1BHK: pickPrice(prices, "apartment (1 bedroom) in city centre") * 0.6,
    rentSolo1BHK: pickPrice(prices, "apartment (1 bedroom) in city centre"),
    groceries: pickPrice(prices, "milk") * 30 + pickPrice(prices, "rice") * 5 + pickPrice(prices, "eggs") * 4,
    transport: pickPrice(prices, "monthly pass") || pickPrice(prices, "one-way ticket") * 40,
    restaurantMeal: pickPrice(prices, "meal, inexpensive restaurant"),
    coffee: pickPrice(prices, "cappuccino"),
    healthInsurance: 0,
    utilities: pickPrice(prices, "basic (electricity, heating, cooling, water, garbage)"),
    phone: pickPrice(prices, "mobile phone monthly plan"),
  };
}

async function scrapeNumbeoPage(cityName) {
  const url = `https://www.numbeo.com/cost-of-living/in/${encodeURIComponent(cityName)}`;
  const scraped = await crawlProgramPage(url);
  return { url, markdown: scraped.markdown || "" };
}

async function extractCostsWithGPT(markdown, city, country) {
  const systemPrompt =
    "You extract cost-of-living numbers from text. Return valid JSON only with keys: rentShared1BHK, rentSolo1BHK, groceries, transport, restaurantMeal, coffee, healthInsurance, utilities, phone. All numbers must be monthly (except restaurantMeal and coffee as single item prices). If missing, use 0.";
  const userPrompt = `City: ${city}\nCountry: ${country}\n\nContent:\n${markdown}\n\nReturn JSON only.`;
  const text = await chatCompletion(systemPrompt, userPrompt, true);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Failed to parse GPT JSON for Numbeo extraction");
  }
}

async function getCostOfLiving(city, countryCode) {
  const cityName = String(city || "").trim();
  const country = String(countryCode || "").trim();
  if (!cityName) throw new Error("City is required");

  const apiData = await getCostOfLivingFromNumbeoApi(cityName, "USD").catch(() => null);
  if (apiData) return mapNumbeoApiToCosts(apiData);

  const scraped = await scrapeNumbeoPage(cityName);
  const extracted = await extractCostsWithGPT(scraped.markdown || "", cityName, country);
  return extracted;
}

async function updateCountryLivingCosts(countryCode) {
  const db = getDB();
  const code = String(countryCode || "").toLowerCase();
  const row = db.prepare("SELECT id, code, numbeo_city FROM countries WHERE code = ?").get(code);
  if (!row) throw new Error("Country not found");
  const city = row.numbeo_city || "";
  if (!city) throw new Error("Country has no numbeo_city configured");

  const costs = await getCostOfLiving(city, code);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE countries SET
      avg_rent_shared_1bhk = ?,
      avg_rent_solo_1bhk = ?,
      avg_groceries_monthly = ?,
      avg_transport_monthly = ?,
      avg_meal_restaurant = ?,
      avg_coffee = ?,
      avg_health_insurance_monthly = ?,
      avg_phone_internet_monthly = ?,
      living_cost_updated_at = ?,
      updated_at = datetime('now')
     WHERE code = ?`,
  ).run(
    costs.rentShared1BHK || 0,
    costs.rentSolo1BHK || 0,
    costs.groceries || 0,
    costs.transport || 0,
    costs.restaurantMeal || 0,
    costs.coffee || 0,
    costs.healthInsurance || 0,
    (costs.phone || 0) + (costs.utilities || 0),
    now,
    code,
  );

  return { updated: true, at: now, costs };
}

module.exports = {
  getCostOfLiving,
  updateCountryLivingCosts,
};

