require("dotenv").config();

const { getDB, getDbPath } = require("./db");

function main() {
  const db = getDB();
  // Touch DB + schema already executed in getDB()
  db.prepare("SELECT 1").get();
  // eslint-disable-next-line no-console
  console.log(`Database initialized at: ${getDbPath()}`);
  db.close();
}

if (require.main === module) {
  main();
}

