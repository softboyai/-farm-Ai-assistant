const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "farm.db");

// sql.js: pure-JS SQLite, no native compilation needed
const initSqlJs = require("sql.js");

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS queries (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      question  TEXT    NOT NULL,
      language  TEXT    NOT NULL,
      crop      TEXT    NOT NULL,
      answer    TEXT    NOT NULL,
      timestamp TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  persist();
  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function saveQuery({ question, language, crop, answer }) {
  const d = await getDb();
  d.run(
    "INSERT INTO queries (question, language, crop, answer) VALUES (?, ?, ?, ?)",
    [question, language, crop, answer]
  );
  persist();
}

async function getHistory() {
  const d = await getDb();
  const stmt = d.prepare(
    "SELECT id, question, language, crop, answer, timestamp FROM queries ORDER BY id DESC LIMIT 10"
  );
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function getStats() {
  const d = await getDb();

  const cropStmt = d.prepare("SELECT crop, COUNT(*) AS count FROM queries GROUP BY crop");
  const byCrop = [];
  while (cropStmt.step()) byCrop.push(cropStmt.getAsObject());
  cropStmt.free();

  const langStmt = d.prepare("SELECT language, COUNT(*) AS count FROM queries GROUP BY language");
  const byLanguage = [];
  while (langStmt.step()) byLanguage.push(langStmt.getAsObject());
  langStmt.free();

  return { byCrop, byLanguage };
}

module.exports = { saveQuery, getHistory, getStats };
