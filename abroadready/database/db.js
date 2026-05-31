const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getDbPath() {
  const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
  const raw = process.env.DB_PATH || "./database/abroadready.db";
  const sourcePath = path.isAbsolute(raw) ? raw : path.join(__dirname, "..", raw);
  
  if (isVercel) {
    const tmpPath = path.join("/tmp", "abroadready.db");
    if (!fs.existsSync(tmpPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, tmpPath);
      // Also copy WAL and SHM if they exist to prevent corruption
      if (fs.existsSync(sourcePath + "-wal")) fs.copyFileSync(sourcePath + "-wal", tmpPath + "-wal");
      if (fs.existsSync(sourcePath + "-shm")) fs.copyFileSync(sourcePath + "-shm", tmpPath + "-shm");
    }
    return tmpPath;
  }
  return sourcePath;
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
  ensureColumn(db, "users", "is_admin", "INTEGER DEFAULT 0");
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

