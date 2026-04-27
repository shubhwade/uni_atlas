const fetch = require("node-fetch");

const BASE = "https://api.firecrawl.dev";

function requireKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is missing");
  return key;
}

async function scrape(url, formats) {
  const key = requireKey();
  const resp = await fetch(`${BASE}/v1/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: formats || ["markdown"] }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Firecrawl scrape failed: ${resp.status} ${t}`);
  }
  return resp.json();
}

async function crawlPortfolio(url) {
  const data = await scrape(url, ["markdown", "screenshot"]);
  return {
    markdown: data?.data?.markdown || data?.markdown || "",
    screenshotUrl: data?.data?.screenshot || data?.screenshotUrl || data?.screenshot || "",
    metadata: data?.data?.metadata || data?.metadata || {},
  };
}

async function crawlProgramPage(url) {
  const data = await scrape(url, ["markdown"]);
  return { markdown: data?.data?.markdown || data?.markdown || "", metadata: data?.data?.metadata || {} };
}

async function crawlScholarshipPage(url) {
  const data = await scrape(url, ["markdown"]);
  return { markdown: data?.data?.markdown || data?.markdown || "", metadata: data?.data?.metadata || {} };
}

module.exports = {
  crawlPortfolio,
  crawlProgramPage,
  crawlScholarshipPage,
};

