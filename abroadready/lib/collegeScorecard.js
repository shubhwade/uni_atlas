const fetch = require("node-fetch");
const { getDB } = require("../database/db");

const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";

function requireKey() {
  const key = process.env.COLLEGE_SCORECARD_API_KEY;
  if (!key) throw new Error("COLLEGE_SCORECARD_API_KEY is missing");
  return key;
}

function fieldsParam() {
  return [
    "id",
    "school.name",
    "school.city",
    "school.state",
    "school.school_url",
    "school.ownership",
    "latest.student.size",
    "latest.student.grad_students",
    "latest.admissions.admission_rate.overall",
    "latest.cost.tuition.out_of_state",
    "latest.cost.attendance.academic_year",
    "latest.earnings.10_yrs_after_entry.median",
    "latest.completion.rate_suppressed.overall",
  ].join(",");
}

async function scorecardFetch(params) {
  const key = requireKey();
  const url = new URL(BASE);
  url.searchParams.set("api_key", key);
  url.searchParams.set("_fields", fieldsParam());
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`College Scorecard failed: ${resp.status} ${t}`);
  }
  return resp.json();
}

async function searchUniversities(query, page = 0) {
  const data = await scorecardFetch({
    "school.name": query,
    page,
    per_page: 20,
  });
  return data?.results || [];
}

async function getUniversityById(unitId) {
  const data = await scorecardFetch({ id: unitId });
  const r = (data?.results || [])[0];
  return r || null;
}

function mapOwnership(v) {
  // 1: Public, 2: Private nonprofit, 3: Private for-profit
  if (v === 1) return "public";
  if (v === 2) return "private nonprofit";
  if (v === 3) return "private for-profit";
  return "";
}

async function syncTopUniversities() {
  const db = getDB();
  const countryId = db.prepare("SELECT id FROM countries WHERE code = 'usa'").pluck().get();
  if (!countryId) throw new Error("USA country row missing; seed countries first");

  // Top 500 by grad enrollment (proxy: latest.student.grad_students desc)
  // API supports sort order via `sort` and `order` keys.
  const perPage = 100;
  const pages = 5;
  const now = new Date().toISOString();

  const upsert = db.prepare(
    `INSERT INTO universities (
      country_id, name, short_name, slug, city, state_province, website,
      college_scorecard_id, university_type, total_students, grad_students,
      overall_placement_rate, data_source, last_synced_at
    ) VALUES (
      @country_id, @name, @short_name, @slug, @city, @state, @website,
      @unitid, @utype, @total_students, @grad_students,
      @placement_rate, 'collegeScorecard', @last_synced_at
    )
    ON CONFLICT(slug) DO UPDATE SET
      name=excluded.name,
      city=excluded.city,
      state_province=excluded.state_province,
      website=excluded.website,
      college_scorecard_id=excluded.college_scorecard_id,
      university_type=excluded.university_type,
      total_students=excluded.total_students,
      grad_students=excluded.grad_students,
      data_source='collegeScorecard',
      last_synced_at=excluded.last_synced_at,
      updated_at=datetime('now')`,
  );

  let count = 0;
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const name = r?.["school.name"] || "";
      const city = r?.["school.city"] || "";
      const state = r?.["school.state"] || "";
      const website = r?.["school.school_url"] || "";
      const unitid = r?.id || null;
      if (!name || !unitid) continue;

      const slug = `us-${unitid}`;
      upsert.run({
        country_id: countryId,
        name,
        short_name: "",
        slug,
        city,
        state,
        website,
        unitid,
        utype: mapOwnership(r?.["school.ownership"]),
        total_students: r?.["latest.student.size"] || 0,
        grad_students: r?.["latest.student.grad_students"] || 0,
        placement_rate: (r?.["latest.completion.rate_suppressed.overall"] || 0) * 100,
        last_synced_at: now,
      });
      count += 1;
    }
  });

  for (let p = 0; p < pages; p += 1) {
    const data = await scorecardFetch({
      per_page: perPage,
      page: p,
      sort: "latest.student.grad_students",
      order: "desc",
    });
    const results = data?.results || [];
    tx(results);
  }

  return { synced: count, lastSyncedAt: now };
}

module.exports = {
  searchUniversities,
  getUniversityById,
  syncTopUniversities,
};

