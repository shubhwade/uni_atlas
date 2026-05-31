// Polyfill DOMMatrix and DOMPoint for Vercel Node 18+ (required by pdf-parse)
if (typeof global.DOMMatrix === "undefined") {
  global.DOMMatrix = class DOMMatrix {
    constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
  };
}
if (typeof global.DOMPoint === "undefined") {
  global.DOMPoint = class DOMPoint {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  };
}

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
