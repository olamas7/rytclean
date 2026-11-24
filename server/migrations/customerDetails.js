// Shared by initial setup and isolated tests. Does not renumber customers.
async function migrateCustomerDetails(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS client_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  for (const name of ['Commercial', 'Household']) {
    await connection.query(
      'INSERT INTO client_categories (name) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM client_categories WHERE name = ?)',
      [name, name],
    );
  }

  const [columns] = await connection.query(
    'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['customers'],
  );
  const existing = new Set(columns.map((column) => column.name));
  const additions = {
    category_id: 'INT NULL',
    joined_date: 'DATE NULL',
    location_description: 'VARCHAR(500) NULL',
  };
  for (const [name, definition] of Object.entries(additions)) {
    if (!existing.has(name)) {
      await connection.query(`ALTER TABLE customers ADD COLUMN \`${name}\` ${definition}`);
    }
  }
  const [constraints] = await connection.query(
    'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
    ['customers', 'fk_customers_category'],
  );
  if (!constraints.length) {
    await connection.query('ALTER TABLE customers ADD CONSTRAINT fk_customers_category FOREIGN KEY (category_id) REFERENCES client_categories(id) ON DELETE RESTRICT');
  }
  await connection.query('UPDATE customers SET joined_date = DATE(created_at) WHERE joined_date IS NULL');
}

module.exports = migrateCustomerDetails;
