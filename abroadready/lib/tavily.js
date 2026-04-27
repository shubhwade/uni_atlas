const fetch = require("node-fetch");

const BASE = "https://api.tavily.com/search";

const cache = new Map(); // key -> { expiresAt, data }
const TTL_MS = 24 * 60 * 60 * 1000;

function requireKey() {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is missing");
  return key;
}

async function tavilySearch(query) {
  const cached = cache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const key = requireKey();
  const resp = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "advanced",
      max_results: 5,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Tavily search failed: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  const normalized = results.map((r) => ({
    title: r?.title || "",
    url: r?.url || "",
    content: r?.content || "",
  }));

  cache.set(query, { expiresAt: Date.now() + TTL_MS, data: normalized });
  return normalized;
}

function searchUniversityPlacement(uniName, courseName) {
  return tavilySearch(`Placement rate and outcomes for ${uniName} ${courseName}`);
}
function searchScholarshipDeadlines(name) {
  return tavilySearch(`Deadline date for scholarship ${name} for Indian students`);
}
function searchCourseFees(uniName, courseName) {
  return tavilySearch(`Tuition fee and cost of attendance for ${uniName} ${courseName}`);
}
function searchVisaRequirements(country) {
  return tavilySearch(`${country} student visa requirements official site`);
}
function searchLenderReviews(lenderName) {
  return tavilySearch(`${lenderName} education loan reviews processing time interest rate`);
}

module.exports = {
  tavilySearch,
  searchUniversityPlacement,
  searchScholarshipDeadlines,
  searchCourseFees,
  searchVisaRequirements,
  searchLenderReviews,
};

