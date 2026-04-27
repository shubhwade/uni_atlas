const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getDbPath() {
  const raw = process.env.DB_PATH || "./database/abroadready.db";
  return path.isAbsolute(raw) ? raw : path.join(__dirname, "..", raw);
}

function loadSchemaSql() {
  const schemaPath = path.join(__dirname, "schema.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

let dbSingleton = null;

function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function runMigrations(db) {
  ensureColumn(db, "resumes", "updated_at", "TEXT");
  ensureColumn(db, "portfolios", "updated_at", "TEXT");
}

function getDB() {
  if (dbSingleton) return dbSingleton;

  const dbPath = getDbPath();
  ensureDir(dbPath);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaSql = loadSchemaSql();
  db.exec(schemaSql);
  runMigrations(db);

  dbSingleton = db;
  return dbSingleton;
}

module.exports = {
  getDB,
  getDbPath,
};

