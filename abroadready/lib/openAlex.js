const fetch = require("node-fetch");
const { getDB } = require("../database/db");

const BASE = "https://api.openalex.org";

async function getJson(url) {
  const resp = await fetch(url, {
    headers: { "User-Agent": "abroadready/1.0 (mailto:noreply@abroadready.in)" },
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAlex failed: ${resp.status} ${t}`);
  }
  return resp.json();
}

async function getInstitution(name, countryCode) {
  const url = new URL(`${BASE}/institutions`);
  url.searchParams.set("search", name);
  if (countryCode) url.searchParams.set("filter", `country_code:${countryCode.toUpperCase()}`);
  const data = await getJson(url.toString());
  return (data?.results || [])[0] || null;
}

async function getTopResearchAreas(openAlexId) {
  if (!openAlexId) return [];
  const data = await getJson(`${BASE}/institutions/${encodeURIComponent(openAlexId)}`);
  const concepts = Array.isArray(data?.x_concepts) ? data.x_concepts : [];
  return concepts
    .slice(0, 5)
    .map((c) => c?.display_name)
    .filter(Boolean);
}

async function syncResearchData(universityId, name) {
  const db = getDB();
  const uni = db
    .prepare(
      `SELECT u.id, u.name, c.code AS country_code
       FROM universities u
       JOIN countries c ON c.id = u.country_id
       WHERE u.id = ?`,
    )
    .get(universityId);
  if (!uni) throw new Error("University not found");

  const inst = await getInstitution(name || uni.name, uni.country_code === "usa" ? "US" : "");
  if (!inst) return { updated: false };

  const topAreas = (inst?.x_concepts || [])
    .slice(0, 5)
    .map((c) => c?.display_name)
    .filter(Boolean)
    .join(", ");

  const works = inst?.works_count || 0;
  const citations = inst?.cited_by_count || 0;
  const hIndex = inst?.summary_stats?.h_index || inst?.h_index || 0;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE universities
     SET open_alex_id = ?,
         research_output_score = ?,
         citation_score = ?,
         h_index = ?,
         top_research_areas = ?,
         last_synced_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(inst.id, works, citations, hIndex, topAreas, now, universityId);

  return { updated: true, openAlexId: inst.id, works_count: works, cited_by_count: citations, h_index: hIndex };
}

module.exports = {
  getInstitution,
  getTopResearchAreas,
  syncResearchData,
};

