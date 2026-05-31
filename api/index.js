const path = require("path");

// Load environment variables from the nested app when present.
require("dotenv").config({ path: path.join(__dirname, "../abroadready/.env") });

const { app } = require("../abroadready/server");

module.exports = app;
