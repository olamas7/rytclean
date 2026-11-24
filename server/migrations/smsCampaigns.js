module.exports = async function migrate(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS sms_campaigns (
    id CHAR(36) PRIMARY KEY, title VARCHAR(100) NOT NULL, created_by_user_id INT NOT NULL,
    message TEXT NOT NULL, filters_json TEXT NOT NULL, recipients_json LONGTEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', selection_hash CHAR(64) NULL,
    recipient_count INT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL, queued_at DATETIME NULL,
    INDEX sms_campaign_actor (created_by_user_id, created_at)
  )`);
  const [columns] = await connection.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['sms_outbox']);
  if (!columns.some((column) => column.name === 'campaign_id')) {
    await connection.query('ALTER TABLE sms_outbox ADD COLUMN campaign_id CHAR(36) NULL, ADD INDEX sms_campaign_messages (campaign_id)');
  }
};
