const runQuery = require("../runQuery");

const ensureSubscriptionAuditTable = async () => {
  const [error] = await runQuery(`
    CREATE TABLE IF NOT EXISTS subscription_audit_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      subscription_id BIGINT UNSIGNED NULL,
      username VARCHAR(64) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      source VARCHAR(32) NOT NULL,
      actor_username VARCHAR(64) NULL,
      usage_bytes BIGINT UNSIGNED NULL,
      fair_use_limit_gb DECIMAL(10,2) NULL,
      down_kbps INT UNSIGNED NULL,
      up_kbps INT UNSIGNED NULL,
      details JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_subscription_audit_subscription (subscription_id, created_at),
      INDEX idx_subscription_audit_username (username, created_at),
      INDEX idx_subscription_audit_event (event_type, created_at)
    )
  `);
  if (error) throw error;
};

const recordSubscriptionAuditEvent = async (event, connection = null) => {
  const details = event.details == null ? null : JSON.stringify(event.details);
  const query = `
    INSERT INTO subscription_audit_events (
      subscription_id, username, event_type, source, actor_username,
      usage_bytes, fair_use_limit_gb, down_kbps, up_kbps, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    event.subscriptionId || null,
    event.username,
    event.eventType,
    event.source,
    event.actorUsername || null,
    event.usageBytes == null ? null : Math.round(event.usageBytes),
    event.fairUseLimitGb == null ? null : event.fairUseLimitGb,
    event.downKbps == null ? null : event.downKbps,
    event.upKbps == null ? null : event.upKbps,
    details,
  ];

  if (connection) {
    await connection.query(query, values);
    return;
  }

  const [error] = await runQuery(query, values);
  if (error) throw error;
};

module.exports = { ensureSubscriptionAuditTable, recordSubscriptionAuditEvent };
