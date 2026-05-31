require("dotenv").config();
const fetch = require("node-fetch");
const { getDB } = require("./db");

const BASE_URL = "http://universities.hipolabs.com";

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function populateUniversities() {
  const db = getDB();

  // Get all countries
  const countries = db.prepare("SELECT id, name FROM countries").all();
  const countryMap = {};
  countries.forEach(c => {
    countryMap[c.name.toLowerCase()] = c.id;
    // Also map common variations
    if (c.name === "United States") countryMap["united states of america"] = c.id;
    if (c.name === "United Kingdom") countryMap["united kingdom"] = c.id;
    if (c.name === "New Zealand") countryMap["new zealand"] = c.id;
    if (c.name === "United Arab Emirates") countryMap["uae"] = c.id;
    countryMap["united arab emirates"] = c.id;
  });

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO universities (
      country_id, name, slug, city, state_province, website,
      university_type, data_source, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'hipolabs_api', datetime('now'))
  `);

  console.log("Fetching all universities from API...");
  const response = await fetch(`${BASE_URL}/search`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const universities = await response.json();
  console.log(`Fetched ${universities.length} universities`);

  let totalInserted = 0;
  let skippedCountries = new Set();

  for (const uni of universities) {
    const countryName = uni.country.toLowerCase();
    const countryId = countryMap[countryName];
    if (!countryId) {
      skippedCountries.add(uni.country);
      continue;
    }

    const slug = slugify(uni.name);
    if (!slug) continue;

    const name = uni.name;
    const city = uni.state_province || "";
    const state = "";
    const website = uni.web_pages && uni.web_pages[0] ? uni.web_pages[0] : "";
    const type = "public"; // Default

    insertStmt.run(countryId, name, slug, city, state, website, type);
    totalInserted++;
  }

  console.log(`Inserted ${totalInserted} universities`);
  console.log(`Skipped countries:`, Array.from(skippedCountries).slice(0,10), '...');
  console.log(`Total universities in DB:`, db.prepare("SELECT COUNT(*) as c FROM universities").get().c);
}

if (require.main === module) {
  populateUniversities().catch(console.error);
}

module.exports = { populateUniversities };

module.exports = { populateUniversities };