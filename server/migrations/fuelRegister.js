// Additive fuel-voucher fields. Existing amounts/issue records are not rewritten.
module.exports = async function migrate(connection) {
  const [columns] = await connection.query("SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fleet_fuel'");
  const existing = new Set(columns.map((column) => column.name));
  for (const [name, definition] of Object.entries({
    vehicle_id: 'INT NULL', driver_id: 'INT NULL', issue_date: 'DATE NULL', unit_price_units: 'BIGINT NULL',
    vehicle_registration: 'VARCHAR(30) NULL', driver_name: 'VARCHAR(150) NULL'
  })) if (!existing.has(name)) await connection.query(`ALTER TABLE fleet_fuel ADD COLUMN \`${name}\` ${definition}`);
  if (columns.find((column) => column.name === 'run_id')?.nullable === 'NO') await connection.query('ALTER TABLE fleet_fuel MODIFY run_id BIGINT NULL');
  const [indexes] = await connection.query("SELECT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fleet_fuel'");
  if (!indexes.some((index) => index.name === 'fleet_fuel_issue_lookup')) await connection.query('ALTER TABLE fleet_fuel ADD INDEX fleet_fuel_issue_lookup (issue_date, vehicle_id, driver_id)');
  const [constraints] = await connection.query("SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'fleet_fuel'");
  if (!constraints.some((constraint) => constraint.name === 'fleet_fuel_vehicle_fk')) await connection.query('ALTER TABLE fleet_fuel ADD CONSTRAINT fleet_fuel_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE RESTRICT');
  if (!constraints.some((constraint) => constraint.name === 'fleet_fuel_driver_fk')) await connection.query('ALTER TABLE fleet_fuel ADD CONSTRAINT fleet_fuel_driver_fk FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE RESTRICT');
};
