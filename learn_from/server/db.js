require("dotenv").config();

const mysql2 = require("mysql2/promise");

const requiredDatabaseVariables = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
];
const missingDatabaseVariables = requiredDatabaseVariables.filter(
  (variable) => !process.env[variable],
);

if (missingDatabaseVariables.length > 0) {
  throw new Error(
    `Missing database environment variables: ${missingDatabaseVariables.join(", ")}`,
  );
}

const db_new = mysql2.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 30000),
});

async function runQuery(sql, params = []) {
  let connection;
  try {
    // Get a connection from the pool
    connection = await db_new.getConnection();
    // Execute the query
    const [rows] = await connection.query(sql, params);
    return [null, rows];
  } catch (err) {
    console.error("Query error:", err);
    return [err, null];
  } finally {
    // Ensure the connection is always released back to the pool
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { db_new, runQuery };
