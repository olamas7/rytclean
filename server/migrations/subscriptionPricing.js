async function migrateSubscriptionPricing(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS plan_prices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    effective_from DATE NOT NULL,
    updated_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plan_price_date (plan_id, effective_from),
    CONSTRAINT fk_plan_prices_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
  )`);
  // Establish the currently known price, without inventing historical charges.
  await connection.query(`INSERT INTO plan_prices (plan_id, amount, effective_from)
    SELECT p.id, p.amount, UTC_DATE() FROM plans p
    WHERE NOT EXISTS (SELECT 1 FROM plan_prices pp WHERE pp.plan_id = p.id)`);
  await connection.query(`CREATE TABLE IF NOT EXISTS billing_settings (
    id TINYINT PRIMARY KEY,
    first_month_policy ENUM('full_month', 'prorated') NOT NULL DEFAULT 'full_month',
    updated_by_user_id INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await connection.query("INSERT INTO billing_settings (id, first_month_policy) SELECT 1, 'full_month' WHERE NOT EXISTS (SELECT 1 FROM billing_settings WHERE id = 1)");
}

module.exports = migrateSubscriptionPricing;
