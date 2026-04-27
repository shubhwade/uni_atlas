const express = require("express");

const { getDB } = require("../database/db");
const { crawlPortfolio } = require("../lib/firecrawl");
const { visionCompletion, chatCompletion } = require("../lib/openai");

const router = express.Router();

function parseJsonOrFallback(text, url, reason) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      designScore: 6,
      technicalScore: 6,
      contentScore: 6,
      overallScore: 6,
      techStackFound: [],
      projectsFound: [],
      aiSummary: `Fallback portfolio analysis for ${url}. External AI analysis was unavailable: ${reason || "unknown error"}.`,
      improvementTips: [
        { action: "Add measurable project outcomes", impact: "high", detail: "Admissions reviewers need proof of impact, not only screenshots." },
        { action: "Clarify tech stack per project", impact: "medium", detail: "List languages, frameworks, data sources, and deployment details." },
      ],
      firstImpressionQuote: "The portfolio is trackable, but deeper scoring needs AI/API configuration.",
      admissionsImpact: "medium",
      jobImpact: "medium",
    };
  }
}

router.post("/", async (req, res) => {
  const db = getDB();
  const userId = req.session.userId;
  const url = String(req.body?.url || "").trim();
  if (!url) return res.status(400).json({ error: "url required" });

  const info = db
    .prepare("INSERT INTO portfolios (user_id, url, crawl_status) VALUES (?, ?, 'processing')")
    .run(userId, url);
  const portfolioId = Number(info.lastInsertRowid);

  (async () => {
    try {
      const scraped = await crawlPortfolio(url);
      const screenshotUrl = scraped.screenshotUrl || "";
      let vision = null;
      if (screenshotUrl) {
        const v = await visionCompletion(
          "You are a portfolio reviewer. Provide a short assessment.",
          screenshotUrl,
          "Assess design quality, clarity, and professionalism. Keep it concise.",
        );
        vision = v;
      }

      const systemPrompt =
        "You score developer portfolios. Return JSON only: {designScore:0-10,technicalScore:0-10,contentScore:0-10,overallScore:0-10,techStackFound:[string],projectsFound:[string],aiSummary:string,improvementTips:[{action,impact:'high|medium|low',detail}],firstImpressionQuote:string,admissionsImpact:'high|medium|low',jobImpact:'high|medium|low'}";
      const userPrompt = `URL: ${url}\n\nMarkdown:\n${scraped.markdown}\n\nVisionNotes:\n${vision || ""}\n\nReturn JSON only.`;
      let parsed;
      try {
        const text = await chatCompletion(systemPrompt, userPrompt, true);
        parsed = parseJsonOrFallback(text, url);
      } catch (err) {
        parsed = parseJsonOrFallback("", url, err.message);
      }

      db.prepare(
        `UPDATE portfolios SET
          screenshot_url=?,
          crawled_content=?,
          tech_stack_found=?,
          projects_found=?,
          design_score=?,
          technical_score=?,
          content_score=?,
          overall_score=?,
          ai_summary=?,
          improvement_tips=?,
          crawl_status='done',
          crawled_at=?
         WHERE id=? AND user_id=?`,
      ).run(
        screenshotUrl,
        scraped.markdown || "",
        JSON.stringify(parsed.techStackFound || []),
        JSON.stringify(parsed.projectsFound || []),
        parsed.designScore ?? null,
        parsed.technicalScore ?? null,
        parsed.contentScore ?? null,
        parsed.overallScore ?? null,
        parsed.aiSummary || "",
        JSON.stringify(parsed.improvementTips || []),
        new Date().toISOString(),
        portfolioId,
        userId,
      );
    } catch (e) {
      db.prepare("UPDATE portfolios SET crawl_status='failed', improvement_tips=? WHERE id=? AND user_id=?").run(
        String(e?.message || "crawl failed"),
        portfolioId,
        userId,
      );
    }
  })();

  return res.json({ ok: true, portfolioId });
});

router.get("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM portfolios WHERE id=? AND user_id=?").get(id, req.session.userId);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true, portfolio: row });
});

module.exports = router;

