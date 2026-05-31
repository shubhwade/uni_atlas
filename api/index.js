const path = require("path");

// Load environment variables from the nested app when present.
require("dotenv").config({ path: path.join(__dirname, "../abroadready/.env") });

let app;
try {
  app = require("../abroadready/server").app;
} catch (err) {
  const express = require("express");
  app = express();
  app.all("*", (req, res) => {
    res.status(500).json({
      error: "Vercel Initialization Crash",
      message: err.message,
      stack: err.stack,
    });
  });
}

module.exports = app;
