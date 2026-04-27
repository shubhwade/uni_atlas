const express = require("express");
const { getDB } = require("../database/db");
const { requireAuth } = require("../lib/middleware");

const router = express.Router();

router.get("/", (req, res) => {
  const db = getDB();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  const where = [];
  const bindings = [];
  if (req.query.category) {
    where.push("category = ?");
    bindings.push(String(req.query.category));
  }
  if (req.query.countryCode) {
    where.push("country_code = ?");
    bindings.push(String(req.query.countryCode).toLowerCase());
  }
  if (req.query.universitySlug) {
    where.push("university_slug = ?");
    bindings.push(String(req.query.universitySlug));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let order = "ORDER BY created_at DESC";
  if (req.query.sortBy === "top") order = "ORDER BY upvotes DESC, created_at DESC";

  const rows = db
    .prepare(
      `SELECT id, category, country_code, university_slug, title, content,
              upvotes, downvotes, comments_count, views_count, is_verified, is_pinned, is_anonymous,
              created_at
       FROM community_posts
       ${whereSql}
       ${order}
       LIMIT ? OFFSET ?`,
    )
    .all(...bindings, limit, offset);

  return res.json({ ok: true, posts: rows, page });
});

router.post("/", requireAuth, (req, res) => {
  const db = getDB();
  const p = req.body || {};
  if (!p.category || !p.title || !p.content) return res.status(400).json({ error: "category, title, content required" });

  const info = db
    .prepare(
      `INSERT INTO community_posts (user_id, category, country_code, university_slug, course_id, city, title, content, structured_data, is_anonymous)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.session.userId,
      p.category,
      (p.country_code || "").toLowerCase(),
      p.university_slug || "",
      p.course_id || null,
      p.city || "",
      p.title,
      p.content,
      p.structured_data ? JSON.stringify(p.structured_data) : "",
      p.is_anonymous ? 1 : 0,
    );
  return res.json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.get("/:id", (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const post = db.prepare("SELECT * FROM community_posts WHERE id=?").get(id);
  if (!post) return res.status(404).json({ error: "Not found" });
  const comments = db
    .prepare("SELECT id, content, upvotes, is_anonymous, created_at FROM community_comments WHERE post_id=? ORDER BY created_at ASC")
    .all(id);
  return res.json({ ok: true, post, comments });
});

router.put("/:id", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const post = db.prepare("SELECT * FROM community_posts WHERE id=?").get(id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (post.user_id !== req.session.userId) return res.status(403).json({ error: "Forbidden" });

  db.prepare("UPDATE community_posts SET title=?, content=?, updated_at=datetime('now') WHERE id=?").run(
    req.body.title || post.title,
    req.body.content || post.content,
    id,
  );
  return res.json({ ok: true });
});

router.delete("/:id", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const post = db.prepare("SELECT * FROM community_posts WHERE id=?").get(id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (post.user_id !== req.session.userId) return res.status(403).json({ error: "Forbidden" });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM community_comments WHERE post_id=?").run(id);
    db.prepare("DELETE FROM community_votes WHERE post_id=?").run(id);
    db.prepare("DELETE FROM community_posts WHERE id=?").run(id);
  });
  tx();
  return res.json({ ok: true });
});

router.post("/:id/vote", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const type = req.body?.type === "down" ? "down" : "up";
  const post = db.prepare("SELECT id FROM community_posts WHERE id=?").get(id);
  if (!post) return res.status(404).json({ error: "Not found" });

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO community_votes (post_id, user_id, type) VALUES (?, ?, ?) ON CONFLICT(post_id, user_id) DO UPDATE SET type=excluded.type").run(
      id,
      req.session.userId,
      type,
    );
    const up = db.prepare("SELECT COUNT(*) AS c FROM community_votes WHERE post_id=? AND type='up'").get(id).c;
    const down = db.prepare("SELECT COUNT(*) AS c FROM community_votes WHERE post_id=? AND type='down'").get(id).c;
    db.prepare("UPDATE community_posts SET upvotes=?, downvotes=?, updated_at=datetime('now') WHERE id=?").run(up, down, id);
  });
  tx();

  const updated = db.prepare("SELECT upvotes, downvotes FROM community_posts WHERE id=?").get(id);
  return res.json({ ok: true, ...updated });
});

router.post("/:id/comment", requireAuth, (req, res) => {
  const db = getDB();
  const id = Number(req.params.id);
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "content required" });
  const post = db.prepare("SELECT id FROM community_posts WHERE id=?").get(id);
  if (!post) return res.status(404).json({ error: "Not found" });

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO community_comments (post_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)").run(
      id,
      req.session.userId,
      content,
      req.body?.is_anonymous ? 1 : 0,
    );
    db.prepare("UPDATE community_posts SET comments_count = comments_count + 1, updated_at=datetime('now') WHERE id=?").run(id);
  });
  tx();
  return res.json({ ok: true });
});

module.exports = router;

