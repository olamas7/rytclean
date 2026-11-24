// Additive payment provenance and private checkout capabilities. No financial postings.
module.exports = async function migrate(connection) {
  const [columns] = await connection.query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_ledger'");
  for (const [name, definition] of Object.entries({ payment_source: 'VARCHAR(30) NULL', collector_name: 'VARCHAR(150) NULL' })) {
    if (!columns.some((column) => column.name === name)) await connection.query(`ALTER TABLE account_ledger ADD COLUMN \`${name}\` ${definition}`);
  }
  await connection.query(`CREATE TABLE IF NOT EXISTS payment_sessions (
    token_hash CHAR(64) PRIMARY KEY, customer_id INT NOT NULL, expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX payment_session_expiry(expires_at),
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT)`);
  await connection.query(`CREATE TABLE IF NOT EXISTS gateway_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, reference VARCHAR(80) NOT NULL UNIQUE,
    customer_id INT NOT NULL, session_hash CHAR(64) NOT NULL, amount_cents BIGINT NOT NULL,
    phone VARCHAR(10) NOT NULL, provider VARCHAR(10) NOT NULL, email VARCHAR(150) NOT NULL,
    environment VARCHAR(10) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'created',
    request_key VARCHAR(80) NOT NULL UNIQUE, fingerprint CHAR(64) NOT NULL,
    ledger_id BIGINT NULL UNIQUE, last_checked_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX gateway_pending(status, last_checked_at),
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY(session_hash) REFERENCES payment_sessions(token_hash) ON DELETE RESTRICT,
    FOREIGN KEY(ledger_id) REFERENCES account_ledger(id) ON DELETE RESTRICT)`);
};
