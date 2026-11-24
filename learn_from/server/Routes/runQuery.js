// runQuery.js
const { db_new } = require("../db");

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

module.exports = runQuery;
