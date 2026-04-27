const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const { getDB } = require("../database/db");
const cloudinary = require("./cloudinary");
const affinda = require("./affinda");
const gemini = require("./gemini");
const openai = require("./openai");
const huggingface = require("./huggingface");
const { sendResumeReadyNotification } = require("./email");

const SYSTEM_PROMPT = `You are an expert admissions consultant and HR professional with deep knowledge of top university requirements globally. Analyze this resume for an Indian student applying to graduate programs abroad. Be specific, actionable, and honest.

Extract and analyze the following structured data from the resume to populate a comprehensive student profile:
1. Contact & Basic Info (Name, Email, Phone, Location)
2. Education (Degree, University, GPA, GPA Scale, Graduation Year, Key Courses)
3. Work Experience (Total months of experience, Current Employer, Current Role, Key Achievements)
4. Skills (Technical, Soft, Tools, Languages)
5. Projects & Research (Title, Description, Impact, Tech Stack, Research Papers Count)
6. Awards & Honors

Return valid JSON only with this structure:
{
  "extractedData": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "gpa": 0.0,
    "gpaScale": 10.0,
    "degree": "string",
    "fieldOfStudy": "string",
    "university": "string",
    "graduationYear": 0,
    "workExperienceMonths": 0,
    "currentEmployer": "string",
    "currentRole": "string",
    "skills": ["array of strings"],
    "projectsCount": 0,
    "topProjects": [{"title": "string", "description": "string", "impact": "string"}],
    "researchPapers": 0,
    "researchExperience": [{"title": "string", "role": "string", "summary": "string"}],
    "awards": ["array of strings"]
  },
  "overallScore": 0-100,
  "academicScore": 0-100,
  "skillsScore": 0-100,
  "presentationScore": 0-100,
  "experienceScore": 0-100,
  "summary": "3-sentence assessment",
  "strengths": [{"point": "string", "impact": "high|medium|low", "detail": "string"}],
  "weaknesses": [{"point": "string", "impact": "high|medium|low", "detail": "string", "fix": "string"}],
  "missingForTopSchools": [{"item": "string", "urgency": "critical|important|nice-to-have"}],
  "skillsFound": ["array"],
  "skillsGap": ["array"],
  "experienceQuality": "excellent|good|average|weak",
  "projectsQuality": "excellent|good|average|weak|none",
  "researchPresence": "strong|moderate|weak|none",
  "formattingIssues": ["array"],
  "atsScore": 0-100,
  "keywordsForTarget": ["array"],
  "forTopPrograms": {
    "mit_stanford_cmu": {"verdict": "competitive|not competitive|borderline", "reason": "string"},
    "top50": {"verdict": "competitive|not competitive|borderline", "reason": "string"},
    "top100": {"verdict": "competitive|not competitive|borderline", "reason": "string"}
  }
}`;

/**
 * Robust PDF text extraction function
 * @param {string} filePathOrUrl 
 * @returns {Promise<string>}
 */
async function parsePDF(filePathOrUrl) {
  try {
    let buffer;
    if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
      const response = await fetch(filePathOrUrl);
      if (!response.ok) throw new Error(`Failed to download PDF: ${response.status}`);
      buffer = await response.buffer();
    } else {
      buffer = fs.readFileSync(filePathOrUrl);
    }

    // pdf-parse exports a single async function directly
    const data = await pdfParse(buffer);
    const cleanText = String(data.text || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText || cleanText.length < 50) {
      throw new Error("Extracted text is too short or empty");
    }

    return cleanText;
  } catch (err) {
    console.error("parsePDF Error:", err.message);
    throw new Error(`PDF Parsing failed: ${err.message}`);
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function aiCompletion(systemPrompt, userPrompt, jsonMode = false) {
  const providers = [];
  if (process.env.GEMINI_API_KEY) providers.push({ name: "Gemini", fn: gemini.chatCompletion });
  if (process.env.OPENAI_API_KEY) providers.push({ name: "OpenAI", fn: openai.chatCompletion });
  if (process.env.HUGGINGFACE_API_KEY) providers.push({ name: "HuggingFace", fn: huggingface.chatCompletion });

  if (!providers.length) {
    throw new Error("No AI provider configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or HUGGINGFACE_API_KEY.");
  }

  let lastError;
  for (const provider of providers) {
    try {
      const text = await provider.fn(systemPrompt, userPrompt, jsonMode);
      if (text && text.trim().length) {
        return { text, provider: provider.name };
      }
      throw new Error(`Empty response from ${provider.name}`);
    } catch (err) {
      lastError = { provider: provider.name, error: err };
      console.warn(`AI provider ${provider.name} failed:`, err.message || err);
      continue;
    }
  }

  throw new Error(`All AI providers failed. Last error from ${lastError?.provider}: ${lastError?.error?.message || lastError?.error}`);
}

function fallbackResumeAnalysis(parsed, reason) {
  const skills = Array.isArray(parsed?.skills) ? parsed.skills.map((s) => s?.name || s).filter(Boolean) : [];
  const educationCount = Array.isArray(parsed?.education) ? parsed.education.length : 0;
  const experienceCount = Array.isArray(parsed?.experience) ? parsed.experience.length : 0;
  const skillsScore = Math.min(90, 45 + skills.length * 5);
  const academicScore = educationCount ? 70 : 45;
  const experienceScore = Math.min(88, 50 + experienceCount * 10);
  const presentationScore = parsed?.raw ? 70 : 58;
  const overallScore = Math.round((skillsScore + academicScore + experienceScore + presentationScore) / 4);
  return {
    extractedData: {
      name: parsed?.name || "",
      email: parsed?.email || "",
      phone: parsed?.phone || "",
      location: "",
      gpa: 0,
      gpaScale: 10,
      degree: "",
      fieldOfStudy: "",
      university: "",
      graduationYear: 0,
      workExperienceMonths: experienceCount * 12,
      currentEmployer: "",
      currentRole: "",
      skills: skills,
      projectsCount: 0,
      topProjects: [],
      researchPapers: 0,
      researchExperience: [],
      awards: [],
    },
    overallScore,
    academicScore,
    skillsScore,
    presentationScore,
    experienceScore,
    summary: `Fallback analysis completed because AI parsing was unavailable: ${reason || "external service unavailable"}. Add quantified projects, clear education details, and target-program keywords to improve competitiveness.`,
    strengths: [
      { point: "Readable upload", impact: "medium", detail: "The resume was uploaded and can be tracked in the system." },
      ...(skills.length ? [{ point: "Skills detected", impact: "medium", detail: `${skills.slice(0, 8).join(", ")} detected.` }] : []),
    ],
    weaknesses: [
      { point: "Deep parsing unavailable", impact: "high", detail: "AI analysis could not complete.", fix: "Configure Gemini API key for deep resume scoring." },
      { point: "Admissions evidence", impact: "medium", detail: "Top programs need quantified impact and selective achievements.", fix: "Add metrics, research outputs, rankings, and project outcomes." },
    ],
    missingForTopSchools: [
      { item: "Quantified project impact", urgency: "important" },
      { item: "Research/publication evidence if targeting research-heavy programs", urgency: "nice-to-have" },
    ],
    skillsFound: skills,
    skillsGap: ["Research narrative", "Leadership impact", "Program-specific keywords"],
    experienceQuality: experienceCount > 2 ? "good" : "average",
    projectsQuality: "average",
    researchPresence: "weak",
    formattingIssues: ["Deep formatting inspection requires full parser configuration."],
    atsScore: Math.max(55, Math.min(86, overallScore)),
    keywordsForTarget: ["GPA", "research", "projects", "leadership", "quantified impact"],
    forTopPrograms: {
      mit_stanford_cmu: { verdict: "borderline", reason: "Needs exceptionally strong research/projects and clearer evidence." },
      top50: { verdict: overallScore >= 72 ? "competitive" : "borderline", reason: "Improve quantified impact and target fit." },
      top100: { verdict: "competitive", reason: "Baseline profile can be workable with strong SOP and fit." },
    },
  };
}

// Remove extractTextFromPDF and keep analyzeResume logic
async function analyzeResume(userId, resumeId, opts = {}) {
  const db = getDB();
  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId);
  if (!user) throw new Error("User not found");

  const resume = db
    .prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?")
    .get(resumeId, userId);
  if (!resume) throw new Error("Resume not found");

  db.prepare("UPDATE resumes SET analysis_status='processing', updated_at=datetime('now') WHERE id=?").run(resumeId);

  let fileUrl = resume.file_url;
  let publicId = null;

  try {
    // Upload to Cloudinary if not already uploaded
    if (!fileUrl || fileUrl.startsWith("/uploads/")) {
      const localPath = opts.localPath || path.join(__dirname, "..", fileUrl);
      if (!fs.existsSync(localPath)) throw new Error("Resume file not found locally");
      
      try {
        const uploaded = await cloudinary.uploadFile(localPath, "abroadready/resumes");
        fileUrl = uploaded.secure_url;
        publicId = uploaded.public_id;
        db.prepare("UPDATE resumes SET file_url=?, updated_at=datetime('now') WHERE id=?").run(fileUrl, resumeId);
        // Clean up local file
        fs.unlink(localPath, () => null);
      } catch (err) {
        console.warn("Cloudinary upload failed, using local file:", err.message);
        fileUrl = localPath;
      }
    }

    // Extract text using new parsePDF
    const resumeText = await parsePDF(fileUrl);

    // Try Affinda parsing first
    let parsed = { skills: [], education: [], experience: [] };
    try {
      if (process.env.AFFINDA_API_KEY && process.env.AFFINDA_WORKSPACE) {
        parsed = await affinda.parseResume(fileUrl);
      }
    } catch (err) {
      console.warn("Affinda parsing skipped or failed:", err.message);
    }

    // Use AI provider fallback for deep analysis
    const userPrompt = `Resume text:\n${resumeText.slice(0, 10000)}\n\nReturn JSON only with the exact structure specified. Analyze thoroughly for profile population.`;
    let ai = null;
    let aiProvider = null;
    try {
      const aiResponse = await aiCompletion(SYSTEM_PROMPT, userPrompt, true);
      aiProvider = aiResponse.provider;
      const aText = aiResponse.text;
      ai = safeJsonParse(aText);
      if (!ai || typeof ai.overallScore !== "number") {
        throw new Error(`AI returned invalid JSON structure from ${aiProvider}`);
      }
    } catch (err) {
      console.error("AI analysis failed:", err.message);
      ai = fallbackResumeAnalysis(parsed, err.message || "AI unavailable");
      ai.ai_provider = "fallback";
    }
    if (aiProvider) {
      ai.ai_provider = aiProvider;
    }

    const ex = ai.extractedData || {};
    const extractedSkills = Array.isArray(ai.skillsFound) ? ai.skillsFound : Array.isArray(parsed?.skills) ? parsed.skills.map((s) => s?.name || s).filter(Boolean) : ex.skills || [];
    
    // Combine extraction for database
    const extracted = {
      extracted_name: ex.name || parsed?.name || "",
      extracted_email: ex.email || parsed?.email || "",
      extracted_phone: ex.phone || parsed?.phone || "",
      extracted_skills: JSON.stringify([...new Set(extractedSkills)]),
      extracted_gpa: ex.gpa || 0,
      extracted_degree: ex.degree || "",
      extracted_university: ex.university || "",
      extracted_work_years: (ex.workExperienceMonths || 0) / 12,
    };

    const richData = { ...ai, affinda: parsed };
    const now = new Date().toISOString();

    // Update Resume Record
    db.prepare(
      `UPDATE resumes SET
        parsed_data=?,
        extracted_name=?,
        extracted_email=?,
        extracted_phone=?,
        extracted_skills=?,
        extracted_gpa=?,
        extracted_degree=?,
        extracted_university=?,
        extracted_work_years=?,
        ai_analysis=?,
        ai_score_overall=?,
        ai_score_academic=?,
        ai_score_skills=?,
        ai_score_presentation=?,
        ai_feedback_summary=?,
        ai_analyzed_at=?,
        analysis_status='done',
        updated_at=datetime('now')
       WHERE id=? AND user_id=?`,
    ).run(
      JSON.stringify(richData),
      extracted.extracted_name,
      extracted.extracted_email,
      extracted.extracted_phone,
      extracted.extracted_skills,
      extracted.extracted_gpa,
      extracted.extracted_degree,
      extracted.extracted_university,
      extracted.extracted_work_years,
      JSON.stringify(ai),
      ai.overallScore ?? null,
      ai.academicScore ?? null,
      ai.skillsScore ?? null,
      ai.presentationScore ?? null,
      ai.summary || "",
      now,
      resumeId,
      userId,
    );

    // ACTION: Update User's Name if not set
    if (ex.name) {
      db.prepare("UPDATE users SET name = COALESCE(NULLIF(name, ''), ?), updated_at = datetime('now') WHERE id = ?").run(ex.name, userId);
    }

    // ACTION: Update Student Profile with all extracted data
    db.prepare(
      `UPDATE student_profiles
       SET bachelors_university = COALESCE(NULLIF(?, ''), bachelors_university),
           bachelors_field = COALESCE(NULLIF(?, ''), bachelors_field),
           bachelors_gpa = COALESCE(NULLIF(?, 0), bachelors_gpa),
           bachelors_gpa_scale = COALESCE(NULLIF(?, 0), bachelors_gpa_scale),
           bachelors_graduation_year = COALESCE(NULLIF(?, 0), bachelors_graduation_year),
           total_work_exp_months = COALESCE(NULLIF(?, 0), total_work_exp_months),
           current_employer = COALESCE(NULLIF(?, ''), current_employer),
           current_role = COALESCE(NULLIF(?, ''), current_role),
           projects_count = COALESCE(NULLIF(?, 0), projects_count),
           research_papers = COALESCE(NULLIF(?, 0), research_papers),
           awards_and_honors = COALESCE(NULLIF(?, ''), awards_and_honors),
           overall_profile_score = COALESCE(?, overall_profile_score),
           academic_score = COALESCE(?, academic_score),
           work_exp_score = COALESCE(?, work_exp_score),
           research_score = COALESCE(?, research_score),
           last_analyzed_at = ?,
           updated_at = datetime('now')
       WHERE user_id = ?`,
    ).run(
      ex.university || "",
      ex.fieldOfStudy || "",
      ex.gpa || 0,
      ex.gpaScale || 0,
      ex.graduationYear || 0,
      ex.workExperienceMonths || 0,
      ex.currentEmployer || "",
      ex.currentRole || "",
      ex.projectsCount || 0,
      ex.researchPapers || 0,
      (ex.awards || []).join(", "),
      ai.overallScore ?? null,
      ai.academicScore ?? null,
      ai.experienceScore ?? null,
      ai.researchPresence === 'strong' ? 90 : ai.researchPresence === 'moderate' ? 70 : 40,
      now,
      userId
    );

    // ACTION: Send Notification
    if (user.email) {
      await sendResumeReadyNotification(user.email, resumeId).catch(() => null);
    }

    return { ok: true, resumeId, fileUrl, publicId, ai };
  } catch (err) {
    db.prepare(
      "UPDATE resumes SET analysis_status='failed', ai_feedback_summary=?, updated_at=datetime('now') WHERE id=? AND user_id=?",
    ).run(String(err?.message || "analysis failed"), resumeId, userId);
    throw err;
  }
}

module.exports = {
  analyzeResume,
  parsePDF,
};
