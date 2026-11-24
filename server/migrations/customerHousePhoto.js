async function migrateCustomerHousePhoto(connection) {
  const [columns] = await connection.query(
    'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['customers'],
  );
  const existing = new Set(columns.map((column) => column.name));
  for (const [name, definition] of Object.entries({ house_photo_key: 'VARCHAR(80) NULL', house_photo_mime: 'VARCHAR(32) NULL' })) {
    if (!existing.has(name)) await connection.query(`ALTER TABLE customers ADD COLUMN \`${name}\` ${definition}`);
  }
}

module.exports = migrateCustomerHousePhoto;
