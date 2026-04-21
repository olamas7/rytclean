const mysql2 = require("mysql2/promise");

const DATABASE_NAME = process.env.DB_DATABASE || "app_starter";

const pool = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
});

async function runQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return [null, rows];
  } catch (err) {
    console.error("Query error:", err);
    return [err, null];
  }
}

async function logActivity(userId, action, details = null, ip = null) {
  try {
    await runQuery(
      "INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)",
      [userId, action, details, ip],
    );
  } catch (err) {
    console.error("Activity log skipped:", err.message);
  }
}

module.exports = {
  DATABASE_NAME,
  runQuery,
  logActivity,
};
