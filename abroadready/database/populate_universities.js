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

async function populateCountries() {
  const db = getDB();

  console.log("Fetching countries from REST Countries API...");
  const response = await fetch("https://restcountries.com/v3.1/all");
  if (!response.ok) {
    throw new Error(`Countries API error: ${response.status}`);
  }
  const countriesData = await response.json();

  const insertCountryStmt = db.prepare(`
    INSERT OR IGNORE INTO countries (
      code, name, continent, currency, currency_symbol, flag_emoji,
      exchange_rate_to_inr, exchange_rate_updated_at,
      student_visa_name, student_visa_fee_local, student_visa_fee_inr,
      visa_processing_days_min, visa_processing_days_max, visa_rejection_rate_percent,
      visa_renewal_required, dependent_visa_allowed, visa_application_url, visa_requirements,
      work_hrs_week_during_study, work_hrs_week_during_holiday, work_starts_after,
      post_study_work_name, post_study_work_months, post_study_work_extension,
      campus_jobs_allowed, off_campus_jobs_allowed, freelance_allowed,
      avg_rent_shared_1bhk, avg_rent_shared_2bhk, avg_rent_solo_1bhk,
      avg_groceries_monthly, avg_transport_monthly, avg_health_insurance_monthly,
      avg_phone_internet_monthly, avg_meal_restaurant, avg_coffee, avg_cinema_ticket,
      living_cost_updated_at, numbeo_city, numbeo_city_budget,
      avg_min_wage_hourly, avg_grad_salary_local, avg_salary_ms, avg_salary_mba,
      avg_salary_engineering, avg_salary_data_science, unemployment_rate_percent,
      tech_job_market_rating, top_cities_for_jobs, top_companies_hiring,
      healthcare_system_type, student_healthcare_free, mandatory_health_insurance,
      avg_health_insurance_annual, emergency_room_cost, gp_visit_cost, healthcare_notes,
      recommended_banks, banking_setup_docs, remittance_services,
      tax_treaty_with_india, dtaa_active, income_tax_rates,
      tax_free_threshold_local, tax_free_threshold_inr, section_80e_applicable,
      tax_filing_required, tax_filing_deadline, tax_filing_notes,
      sim_card_providers, transport_passes, grocery_stores, indian_grocery_tip,
      indian_restaurants, indian_student_association, indian_embassy_url,
      emergency_number, police_number, safety_rating_out_of_10, safety_notes,
      racism_incidents_rating, indian_community_size, weather_summary, climate_type,
      driving_license_exchange, public_transport_quality, internet_quality
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 1, datetime('now'),
      'Student Visa', 0, 0, 30, 90, 20, 0, 0, '', '{}', 20, 40, 'After 1 year',
      'Post Study Work', 12, 'Extension possible', 1, 1, 0,
      500, 800, 1000, 200, 50, 50, 50, 10, 3, 8,
      datetime('now'), '', 'moderate',
      5, 30000, 40000, 50000, 45000, 50000, 5,
      'moderate', '', '',
      'Public', 0, 0, 500, 100, 20, '',
      '', '', '',
      0, 0, '',
      0, 0, 0, 0, '', '',
      '', '', '', '', '', 0, '',
      '', '', '', '', '', '', '', '', '', '', '',
      5, '', '', '', '', '', '', 0, '', ''
    )
  `);

  for (const c of countriesData) {
    const code = c.cca2 ? c.cca2.toLowerCase() : c.cca3.toLowerCase();
    const name = c.name.common;
    const continent = c.region || "Unknown";
    const currency = c.currencies ? Object.keys(c.currencies)[0] : "USD";
    const currency_symbol = c.currencies && c.currencies[currency] ? c.currencies[currency].symbol : "$";
    const flag_emoji = c.flag || "🏳️";

    insertCountryStmt.run(code, name, continent, currency, currency_symbol, flag_emoji);
  }

  console.log(`Inserted/updated countries`);
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