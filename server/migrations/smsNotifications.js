const { events } = require('../services/smsTemplates');
module.exports = async function migrate(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS sms_settings (
    id TINYINT PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 0,
    sender VARCHAR(11) NOT NULL DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await connection.query('INSERT IGNORE INTO sms_settings (id) VALUES (1)');
  await connection.query(`CREATE TABLE IF NOT EXISTS sms_events (
    event_key VARCHAR(40) PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 0, message TEXT NOT NULL
  )`);
  for (const [key, event] of Object.entries(events)) await connection.query('INSERT IGNORE INTO sms_events (event_key, message) VALUES (?, ?)', [key, event.message]);
  await connection.query(`CREATE TABLE IF NOT EXISTS sms_outbox (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, dedupe_key VARCHAR(190) NOT NULL UNIQUE,
    event_key VARCHAR(40) NOT NULL, customer_id INT NULL, invoice_id BIGINT NULL,
    phone VARCHAR(20) NOT NULL, message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'queued', detail VARCHAR(200) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, attempted_at TIMESTAMP NULL,
    INDEX sms_pending (status, id)
  )`);
};
