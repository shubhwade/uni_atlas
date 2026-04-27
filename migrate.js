const { getDB } = require("./abroadready/database/db");
const db = getDB();

try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_shortlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id),
      kanban_state TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  console.log("user_shortlists table created/verified.");
} catch (e) {
  console.error("Migration failed:", e);
}
