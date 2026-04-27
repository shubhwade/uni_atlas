require("dotenv").config();
const { getDB } = require("./database/db");
const db = getDB();

// Delete resumes that failed AND have a local/broken file_url
const r = db.prepare("DELETE FROM resumes WHERE analysis_status='failed'").run();
console.log("Deleted", r.changes, "failed resumes. Please re-upload your resume.");
process.exit(0);
