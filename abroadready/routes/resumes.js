const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { getDB } = require("../database/db");
const { uploadFile, deleteFile } = require("../lib/cloudinary");
const { analyzeResume } = require("../lib/resumeAnalyzer");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    return cb(new Error("Only PDF files allowed"));
  },
});

router.get("/", (req, res) => {
  const db = getDB();
  const rows = db
    .prepare(
      `SELECT id, file_name, file_url, file_size, uploaded_at, is_primary,
              ai_score_overall, ai_score_academic, ai_score_skills, ai_score_presentation,
              ai_feedback_summary, analysis_status
       FROM resumes WHERE user_id = ?
       ORDER BY uploaded_at DESC`,
    )
    .all(req.session.userId);
  return res.json({ ok: true, resumes: rows });
});

router.post("/upload", upload.single("file"), async (req, res) => {
  const db = getDB();
  const userId = req.session.userId;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const localPath = req.file.path;
  const fileName = req.file.originalname;
  const fileSize = req.file.size;

  let fileUrl = `/uploads/${path.basename(localPath)}`;
  try {
    const uploaded = await uploadFile(localPath, "abroadready/resumes");
    fileUrl = uploaded.secure_url;
    fs.unlink(localPath, () => null);
  } catch {
    // Keep the local upload available when Cloudinary is not configured.
  }

  const info = db
    .prepare(
      `INSERT INTO resumes (user_id, file_name, file_url, file_size, is_primary, analysis_status)
       VALUES (?, ?, ?, ?, 0, 'pending')`,
    )
    .run(userId, fileName, fileUrl, fileSize);
  const resumeId = Number(info.lastInsertRowid);

  // Kick off analysis async (do not await)
  analyzeResume(userId, resumeId, { localPath }).catch(() => null);

  return res.json({ ok: true, resumeId, fileUrl });
});

router.get("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?").get(id, req.session.userId);
  if (!row) return res.status(404).json({ error: "Not found" });
  let ai = null;
  if (row.ai_analysis) {
    try {
      ai = JSON.parse(row.ai_analysis);
    } catch {
      ai = { summary: row.ai_feedback_summary || "Analysis could not be parsed." };
    }
  }
  return res.json({ ok: true, resume: row, ai });
});

router.delete("/:id", async (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?").get(id, req.session.userId);
  if (!row) return res.status(404).json({ error: "Not found" });

  // Best-effort: delete Cloudinary asset if we have public_id stored (not in schema currently)
  if (row.file_url) {
    // no public_id stored in schema; skip deletion unless it was stored elsewhere
  }

  db.prepare("DELETE FROM resumes WHERE id = ? AND user_id = ?").run(id, req.session.userId);
  return res.json({ ok: true });
});

router.post("/:id/reanalyze", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await analyzeResume(req.session.userId, id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Re-analysis failed" });
  }
});

router.put("/:id/primary", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const userId = req.session.userId;
  const exists = db.prepare("SELECT id FROM resumes WHERE id=? AND user_id=?").get(id, userId);
  if (!exists) return res.status(404).json({ error: "Not found" });

  const tx = db.transaction(() => {
    db.prepare("UPDATE resumes SET is_primary=0 WHERE user_id=?").run(userId);
    db.prepare("UPDATE resumes SET is_primary=1 WHERE id=? AND user_id=?").run(id, userId);
  });
  tx();
  return res.json({ ok: true });
});

module.exports = router;

