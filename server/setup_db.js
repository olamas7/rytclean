require('dotenv').config();
const mysql = require('mysql2/promise');

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
} = process.env;

async function setupDatabase() {
  if (!DB_HOST || !DB_USER || !DB_DATABASE) {
    throw new Error('Missing DB_HOST, DB_USER, or DB_DATABASE in server/.env');
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_DATABASE}\`;`);
    await connection.query(`USE \`${DB_DATABASE}\`;`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullname VARCHAR(150) NOT NULL,
        username VARCHAR(80) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(80) NOT NULL DEFAULT 'Admin',
        work_title VARCHAR(80) NOT NULL DEFAULT 'admin',
        status TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS work_title VARCHAR(80) NOT NULL DEFAULT 'admin' AFTER role");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(120) NOT NULL,
        details TEXT NULL,
        ip_address VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activity_user_id (user_id),
        CONSTRAINT fk_activity_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE SET NULL
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        zone_code VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        city VARCHAR(120) NOT NULL,
        coverage_area VARCHAR(255) NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        boundary_geojson JSON NULL,
        center_lat DECIMAL(10, 7) NULL,
        center_lng DECIMAL(10, 7) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await connection.query('ALTER TABLE zones ADD COLUMN IF NOT EXISTS boundary_geojson JSON NULL');
    await connection.query('ALTER TABLE zones ADD COLUMN IF NOT EXISTS center_lat DECIMAL(10, 7) NULL');
    await connection.query('ALTER TABLE zones ADD COLUMN IF NOT EXISTS center_lng DECIMAL(10, 7) NULL');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS collection_routes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        route_code VARCHAR(40) NOT NULL UNIQUE,
        route_name VARCHAR(150) NOT NULL,
        zone_id INT NOT NULL,
        start_point VARCHAR(150) NOT NULL,
        end_point VARCHAR(150) NOT NULL,
        estimated_duration_mins INT NOT NULL,
        status ENUM('active', 'inactive', 'draft') NOT NULL DEFAULT 'active',
        notes TEXT NULL,
        route_geojson JSON NULL,
        start_lat DECIMAL(10, 7) NULL,
        start_lng DECIMAL(10, 7) NULL,
        end_lat DECIMAL(10, 7) NULL,
        end_lng DECIMAL(10, 7) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_routes_zone (zone_id),
        CONSTRAINT fk_routes_zone
          FOREIGN KEY (zone_id)
          REFERENCES zones(id)
          ON DELETE RESTRICT
      );
    `);

    await connection.query('ALTER TABLE collection_routes ADD COLUMN IF NOT EXISTS route_geojson JSON NULL');
    await connection.query('ALTER TABLE collection_routes ADD COLUMN IF NOT EXISTS start_lat DECIMAL(10, 7) NULL');
    await connection.query('ALTER TABLE collection_routes ADD COLUMN IF NOT EXISTS start_lng DECIMAL(10, 7) NULL');
    await connection.query('ALTER TABLE collection_routes ADD COLUMN IF NOT EXISTS end_lat DECIMAL(10, 7) NULL');
    await connection.query('ALTER TABLE collection_routes ADD COLUMN IF NOT EXISTS end_lng DECIMAL(10, 7) NULL');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        driver_code VARCHAR(40) NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        vehicle_number VARCHAR(40) NOT NULL,
        zone_id INT NOT NULL,
        status ENUM('available', 'on-route', 'off-duty', 'inactive') NOT NULL DEFAULT 'available',
        completion_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_drivers_zone (zone_id),
        CONSTRAINT fk_drivers_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_drivers_zone
          FOREIGN KEY (zone_id)
          REFERENCES zones(id)
          ON DELETE RESTRICT
      );
    `);

    await connection.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER id');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS pickup_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pickup_code VARCHAR(40) NOT NULL UNIQUE,
        customer_code VARCHAR(40) NOT NULL,
        zone_id INT NOT NULL,
        driver_id INT NULL,
        waste_type VARCHAR(80) NOT NULL,
        pickup_date DATE NOT NULL,
        pickup_time TIME NOT NULL,
        status ENUM('scheduled', 'assigned', 'on the way', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
        emergency TINYINT(1) NOT NULL DEFAULT 0,
        extra_bin TINYINT(1) NOT NULL DEFAULT 0,
        address VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pickups_zone (zone_id),
        INDEX idx_pickups_driver (driver_id),
        CONSTRAINT fk_pickups_zone
          FOREIGN KEY (zone_id)
          REFERENCES zones(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_pickups_driver
          FOREIGN KEY (driver_id)
          REFERENCES drivers(id)
          ON DELETE SET NULL
      );
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS driver_assignments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        pickup_request_id INT NOT NULL,
        driver_id INT NOT NULL,
        assigned_by_user_id INT NULL,
        status ENUM('active', 'reassigned', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unassigned_at TIMESTAMP NULL,
        INDEX idx_assignments_pickup (pickup_request_id),
        INDEX idx_assignments_driver (driver_id),
        INDEX idx_assignments_user (assigned_by_user_id),
        CONSTRAINT fk_assignments_pickup
          FOREIGN KEY (pickup_request_id)
          REFERENCES pickup_requests(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_assignments_driver
          FOREIGN KEY (driver_id)
          REFERENCES drivers(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_assignments_user
          FOREIGN KEY (assigned_by_user_id)
          REFERENCES users(id)
          ON DELETE SET NULL
      );
    `);

    await connection.query(
      `
        INSERT INTO users (fullname, username, password, role, work_title, status)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM users WHERE username = ?
        );
      `,
      ['System Admin', 'admin', 'admin123', 'Admin', 'admin', 1, 'admin'],
    );

    await connection.query(
      `
        INSERT INTO users (fullname, username, password, role, work_title, status)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM users WHERE username = ?
        );
      `,
      ['Samuel Addo', 'driver001', 'driver123', 'Driver', 'driver', 1, 'driver001'],
    );

    await connection.query(
      `
        INSERT INTO users (fullname, username, password, role, work_title, status)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM users WHERE username = ?
        );
      `,
      ['Josephine Quaye', 'driver002', 'driver123', 'Driver', 'driver', 1, 'driver002'],
    );

    await connection.query(
      `
        INSERT INTO zones (zone_code, name, city, coverage_area, status)
        SELECT ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM zones WHERE zone_code = ?
        );
      `,
      ['ZONE-AC-01', 'East Legon Zone', 'Accra', 'East Legon and Adjiringanor', 'active', 'ZONE-AC-01'],
    );

    await connection.query(
      `
        INSERT INTO zones (zone_code, name, city, coverage_area, status)
        SELECT ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM zones WHERE zone_code = ?
        );
      `,
      ['ZONE-AC-02', 'Central Accra Zone', 'Accra', 'Osu, Ridge, and Ministries', 'active', 'ZONE-AC-02'],
    );

    await connection.query(
      `
        UPDATE zones
        SET
          boundary_geojson = ?,
          center_lat = ?,
          center_lng = ?
        WHERE zone_code = ?
          AND (boundary_geojson IS NULL OR center_lat IS NULL OR center_lng IS NULL);
      `,
      [
        JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-0.1618, 5.6482], [-0.143, 5.6482], [-0.143, 5.6204], [-0.1618, 5.6204], [-0.1618, 5.6482]]],
        }),
        5.6343,
        -0.1524,
        'ZONE-AC-01',
      ],
    );

    await connection.query(
      `
        UPDATE zones
        SET
          boundary_geojson = ?,
          center_lat = ?,
          center_lng = ?
        WHERE zone_code = ?
          AND (boundary_geojson IS NULL OR center_lat IS NULL OR center_lng IS NULL);
      `,
      [
        JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-0.2255, 5.5827], [-0.1984, 5.5827], [-0.1984, 5.5534], [-0.2255, 5.5534], [-0.2255, 5.5827]]],
        }),
        5.568,
        -0.212,
        'ZONE-AC-02',
      ],
    );

    await connection.query(
      `
        INSERT INTO collection_routes (route_code, route_name, zone_id, start_point, end_point, estimated_duration_mins, status, notes)
        SELECT ?, ?, z.id, ?, ?, ?, ?, ?
        FROM zones z
        WHERE z.zone_code = ?
          AND NOT EXISTS (
            SELECT 1 FROM collection_routes WHERE route_code = ?
          );
      `,
      ['RTE-AC-01', 'East Legon Morning Route', 'A&C Junction', 'Otano Junction', 120, 'active', 'Weekday residential collection', 'ZONE-AC-01', 'RTE-AC-01'],
    );

    await connection.query(
      `
        INSERT INTO collection_routes (route_code, route_name, zone_id, start_point, end_point, estimated_duration_mins, status, notes)
        SELECT ?, ?, z.id, ?, ?, ?, ?, ?
        FROM zones z
        WHERE z.zone_code = ?
          AND NOT EXISTS (
            SELECT 1 FROM collection_routes WHERE route_code = ?
          );
      `,
      ['RTE-AC-02', 'Central Accra Core Route', 'Independence Avenue', 'Oxford Street', 95, 'active', 'Dense commercial corridor pickups', 'ZONE-AC-02', 'RTE-AC-02'],
    );

    await connection.query(
      `
        INSERT INTO drivers (user_id, driver_code, full_name, phone, vehicle_number, zone_id, status, completion_rate)
        SELECT u.id, ?, ?, ?, ?, z.id, ?, ?
        FROM users u
        JOIN zones z ON z.zone_code = ?
        WHERE u.username = ?
          AND NOT EXISTS (
            SELECT 1 FROM drivers WHERE driver_code = ?
          );
      `,
      ['DRV-001', 'Samuel Addo', '+233-24-300-7781', 'GC-4123-22', 'available', 96, 'ZONE-AC-01', 'driver001', 'DRV-001'],
    );

    await connection.query(
      `
        INSERT INTO drivers (user_id, driver_code, full_name, phone, vehicle_number, zone_id, status, completion_rate)
        SELECT u.id, ?, ?, ?, ?, z.id, ?, ?
        FROM users u
        JOIN zones z ON z.zone_code = ?
        WHERE u.username = ?
          AND NOT EXISTS (
            SELECT 1 FROM drivers WHERE driver_code = ?
          );
      `,
      ['DRV-002', 'Josephine Quaye', '+233-55-404-3002', 'GT-2301-24', 'on-route', 93, 'ZONE-AC-02', 'driver002', 'DRV-002'],
    );

    await connection.query(
      `
        UPDATE drivers d
        JOIN users u ON u.username = 'driver001'
        SET d.user_id = u.id
        WHERE d.driver_code = 'DRV-001'
          AND d.user_id IS NULL;
      `,
    );

    await connection.query(
      `
        UPDATE drivers d
        JOIN users u ON u.username = 'driver002'
        SET d.user_id = u.id
        WHERE d.driver_code = 'DRV-002'
          AND d.user_id IS NULL;
      `,
    );

    await connection.query(
      `
        INSERT INTO pickup_requests
        (pickup_code, customer_code, zone_id, driver_id, waste_type, pickup_date, pickup_time, status, emergency, extra_bin, address)
        SELECT ?, ?, z.id, d.id, ?, ?, ?, ?, ?, ?, ?
        FROM zones z
        LEFT JOIN drivers d ON d.driver_code = ?
        WHERE z.zone_code = ?
          AND NOT EXISTS (
            SELECT 1 FROM pickup_requests WHERE pickup_code = ?
          );
      `,
      ['PK-2026-001', 'CUST-001', 'Household', '2026-04-24', '08:30:00', 'scheduled', 0, 1, '14 Palm Street, East Legon, Accra', 'DRV-001', 'ZONE-AC-01', 'PK-2026-001'],
    );

    await connection.query(
      `
        INSERT INTO pickup_requests
        (pickup_code, customer_code, zone_id, driver_id, waste_type, pickup_date, pickup_time, status, emergency, extra_bin, address)
        SELECT ?, ?, z.id, d.id, ?, ?, ?, ?, ?, ?, ?
        FROM zones z
        LEFT JOIN drivers d ON d.driver_code = ?
        WHERE z.zone_code = ?
          AND NOT EXISTS (
            SELECT 1 FROM pickup_requests WHERE pickup_code = ?
          );
      `,
      ['PK-2026-002', 'CUST-002', 'Recyclables', '2026-04-27', '09:00:00', 'assigned', 0, 0, '6 Ring Road Central, Accra', 'DRV-002', 'ZONE-AC-02', 'PK-2026-002'],
    );

    await connection.query(
      `
        INSERT INTO pickup_requests
        (pickup_code, customer_code, zone_id, driver_id, waste_type, pickup_date, pickup_time, status, emergency, extra_bin, address)
        SELECT ?, ?, z.id, d.id, ?, ?, ?, ?, ?, ?, ?
        FROM zones z
        LEFT JOIN drivers d ON d.driver_code = ?
        WHERE z.zone_code = ?
          AND NOT EXISTS (
            SELECT 1 FROM pickup_requests WHERE pickup_code = ?
          );
      `,
      ['PK-2026-003', 'CUST-003', 'Commercial', '2026-04-23', '07:40:00', 'on the way', 1, 1, '22 Liberation Road, Airport Residential, Accra', 'DRV-001', 'ZONE-AC-01', 'PK-2026-003'],
    );

    await connection.query(
      `
        INSERT INTO pickup_requests
        (pickup_code, customer_code, zone_id, driver_id, waste_type, pickup_date, pickup_time, status, emergency, extra_bin, address)
        SELECT ?, ?, z.id, d.id, ?, ?, ?, ?, ?, ?, ?
        FROM zones z
        LEFT JOIN drivers d ON d.driver_code = ?
        WHERE z.zone_code = ?
          AND NOT EXISTS (
            SELECT 1 FROM pickup_requests WHERE pickup_code = ?
          );
      `,
      ['PK-2026-004', 'CUST-005', 'General Waste', '2026-04-20', '10:15:00', 'completed', 0, 0, '17 Spintex Road, Accra', 'DRV-002', 'ZONE-AC-02', 'PK-2026-004'],
    );

    await connection.query(
      `
        INSERT INTO driver_assignments (pickup_request_id, driver_id, assigned_by_user_id, status)
        SELECT pr.id, d.id, u.id, 'active'
        FROM pickup_requests pr
        JOIN drivers d ON d.driver_code = 'DRV-002'
        JOIN users u ON u.username = 'admin'
        WHERE pr.pickup_code = 'PK-2026-002'
          AND NOT EXISTS (
            SELECT 1
            FROM driver_assignments da
            WHERE da.pickup_request_id = pr.id
              AND da.driver_id = d.id
              AND da.status = 'active'
          );
      `,
    );

    console.log(`Database ready: ${DB_DATABASE}`);
    console.log('Tables ensured: users, activity_logs, zones, collection_routes, drivers, pickup_requests, driver_assignments');
    console.log('Default login: admin / admin123');
  } finally {
    await connection.end();
  }
}

setupDatabase().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
