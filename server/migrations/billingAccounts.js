async function migrateBillingAccounts(connection) {
  const [columns] = await connection.query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing_settings'");
  if (!columns.some((column) => column.name === 'automatic_billing')) await connection.query('ALTER TABLE billing_settings ADD COLUMN automatic_billing TINYINT(1) NOT NULL DEFAULT 0');
  await connection.query(`CREATE TABLE IF NOT EXISTS customer_plan_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, plan_id INT NOT NULL,
    effective_from DATE NOT NULL, created_by_user_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_plan_date (customer_id, effective_from),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS billing_subscriptions (
    customer_id INT PRIMARY KEY,
    status ENUM('needs_review','active','paused') NOT NULL DEFAULT 'needs_review',
    hold_reason VARCHAR(255) NULL,
    service_start DATE NULL, next_cycle_start DATE NULL,
    cycle_plan_id INT NULL, cycle_plan_code VARCHAR(60) NULL, cycle_plan_name VARCHAR(150) NULL,
    cycle_amount_cents BIGINT NULL, cycle_grace_days INT NOT NULL DEFAULT 0,
    first_month_policy ENUM('full_month','prorated') NOT NULL DEFAULT 'full_month',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (cycle_plan_id) REFERENCES plans(id) ON DELETE RESTRICT
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS billing_invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, reference VARCHAR(80) NOT NULL UNIQUE, customer_id INT NOT NULL,
    period_start DATE NOT NULL, period_end DATE NOT NULL, service_start DATE NOT NULL,
    plan_code VARCHAR(60) NOT NULL, plan_name VARCHAR(150) NOT NULL,
    rate_cents BIGINT NOT NULL, amount_cents BIGINT NOT NULL, settled_cents BIGINT NOT NULL DEFAULT 0,
    first_month_policy VARCHAR(20) NOT NULL, service_days INT NOT NULL, month_days INT NOT NULL,
    issued_on DATE NOT NULL, due_on DATE NOT NULL, voided TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_period (customer_id, period_start, period_end),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
  )`);
  await connection.query(`CREATE TABLE IF NOT EXISTS account_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL,
    entry_type ENUM('invoice','payment','credit_adjustment','debit_adjustment','reversal') NOT NULL,
    debit_cents BIGINT NOT NULL DEFAULT 0, credit_cents BIGINT NOT NULL DEFAULT 0,
    occurred_on DATE NOT NULL, description VARCHAR(500) NOT NULL,
    payment_method VARCHAR(30) NULL, payment_reference VARCHAR(120) NULL,
    invoice_id BIGINT NULL UNIQUE, reverses_entry_id BIGINT NULL UNIQUE,
    request_key VARCHAR(100) NOT NULL UNIQUE, request_fingerprint CHAR(64) NULL,
    external_payment_key CHAR(64) NULL UNIQUE,
    created_by_user_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ledger_customer (customer_id, id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE RESTRICT,
    FOREIGN KEY (reverses_entry_id) REFERENCES account_ledger(id) ON DELETE RESTRICT
  )`);
  // Existing accounts need explicit activation: never manufacture past arrears during migration.
  await connection.query(`INSERT INTO billing_subscriptions (customer_id)
    SELECT c.id FROM customers c WHERE NOT EXISTS (SELECT 1 FROM billing_subscriptions s WHERE s.customer_id = c.id)`);
  await connection.query(`INSERT INTO customer_plan_history (customer_id, plan_id, effective_from)
    SELECT c.id, p.id, UTC_DATE() FROM customers c JOIN plans p ON p.plan_code = c.plan_code
    WHERE NOT EXISTS (SELECT 1 FROM customer_plan_history h WHERE h.customer_id = c.id)`);
}
module.exports = migrateBillingAccounts;
