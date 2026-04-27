const fetch = require("node-fetch");

const BASE = "https://api.affinda.com/v3";

function requireEnv() {
  const apiKey = process.env.AFFINDA_API_KEY;
  const workspace = process.env.AFFINDA_WORKSPACE;
  if (!apiKey) throw new Error("AFFINDA_API_KEY is missing");
  if (!workspace) throw new Error("AFFINDA_WORKSPACE is missing");
  return { apiKey, workspace };
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function parseResume(fileUrl) {
  const { apiKey, workspace } = requireEnv();

  const createResp = await fetch(`${BASE}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: fileUrl, collection: workspace }),
  });
  if (!createResp.ok) {
    const t = await createResp.text();
    throw new Error(`Affinda create failed: ${createResp.status} ${t}`);
  }
  const created = await createResp.json();
  const identifier = created?.identifier;
  if (!identifier) throw new Error("Affinda did not return identifier");

  const start = Date.now();
  while (Date.now() - start < 60_000) {
    const pollResp = await fetch(`${BASE}/documents/${identifier}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollResp.ok) {
      const t = await pollResp.text();
      throw new Error(`Affinda poll failed: ${pollResp.status} ${t}`);
    }
    const doc = await pollResp.json();
    const status = doc?.status;
    if (status === "complete") {
      const data = doc?.data || {};
      const result = {
        name: data?.name?.raw || "",
        email: (data?.emails && data.emails[0]) || "",
        phone: (data?.phoneNumbers && data.phoneNumbers[0]) || "",
        education: data?.education || [],
        experience: data?.workExperience || [],
        skills: data?.skills || [],
        certifications: data?.certifications || [],
        raw: doc,
      };
      return result;
    }
    if (status === "failed") throw new Error("Affinda parsing failed");
    await sleep(3000);
  }

  throw new Error("Affinda parsing timed out after 60s");
}

function mapAffindaToProfile(parsed) {
  const education = Array.isArray(parsed?.education) ? parsed.education : [];
  const experience = Array.isArray(parsed?.experience) ? parsed.experience : [];
  const skills = Array.isArray(parsed?.skills) ? parsed.skills : [];

  // Heuristic mapping: pick highest/most recent education for bachelors fields where possible
  const topEdu = education[0] || {};
  const uni = topEdu?.organization || topEdu?.institution || "";
  const degree = topEdu?.qualification || "";
  const field = topEdu?.accreditation?.education || topEdu?.field || "";

  const totalWorkYears =
    experience.reduce((acc, e) => {
      const s = e?.dates?.startDate || e?.startDate || null;
      const en = e?.dates?.endDate || e?.endDate || null;
      if (!s) return acc;
      const start = new Date(s);
      const end = en ? new Date(en) : new Date();
      const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
      return acc + (Number.isFinite(years) ? years : 0);
    }, 0) || 0;

  return {
    bachelors_university: uni || "",
    bachelors_field: field || "",
    target_degree: degree || "",
    total_work_exp_months: Math.round(totalWorkYears * 12),
    work_exp_details: JSON.stringify(experience || []),
    github_url: "",
    projects_count: 0,
    open_source_contribs: 0,
    research_papers: 0,
    // also expose a few parsed values for convenience
    _skills: skills.map((s) => s?.name || s).filter(Boolean),
  };
}

module.exports = {
  parseResume,
  mapAffindaToProfile,
};

