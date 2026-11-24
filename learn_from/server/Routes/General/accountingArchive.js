const { db_new } = require("../../db");
const runQuery = require("../runQuery");

let schemaReady = null;

const initializeAccountingArchiveSchema = async () => {
  const [columnError, columns] = await runQuery("SHOW COLUMNS FROM radcheck_subs LIKE 'usage_baseline_bytes'");
  if (columnError) throw columnError;

  if (columns.length === 0) {
    const [alterError] = await runQuery(
      "ALTER TABLE radcheck_subs ADD COLUMN usage_baseline_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER fair_use_up_kbps",
    );
    if (alterError) throw alterError;

    // Preserve existing package usage while allowing ongoing sessions to be measured from now on.
    const [baselineError] = await runQuery(`
      UPDATE radcheck_subs s
      SET usage_baseline_bytes = COALESCE((
        SELECT SUM(r.acctinputoctets + r.acctoutputoctets)
        FROM radacct r
        WHERE r.username = s.username
          AND r.acctstarttime < s.start_date
      ), 0)
      WHERE s.plan_status = 0
    `);
    if (baselineError) throw baselineError;
  }

  const [pendingAtError, pendingAtColumns] = await runQuery(
    "SHOW COLUMNS FROM radcheck_subs LIKE 'fair_use_pending_at'",
  );
  if (pendingAtError) throw pendingAtError;
  if (pendingAtColumns.length === 0) {
    const [alterPendingAtError] = await runQuery(
      "ALTER TABLE radcheck_subs ADD COLUMN fair_use_pending_at DATETIME NULL AFTER fair_use_throttled_at",
    );
    if (alterPendingAtError) throw alterPendingAtError;
  }

  const [pendingUsageError, pendingUsageColumns] = await runQuery(
    "SHOW COLUMNS FROM radcheck_subs LIKE 'fair_use_pending_usage_bytes'",
  );
  if (pendingUsageError) throw pendingUsageError;
  if (pendingUsageColumns.length === 0) {
    const [alterPendingUsageError] = await runQuery(
      "ALTER TABLE radcheck_subs ADD COLUMN fair_use_pending_usage_bytes BIGINT UNSIGNED NULL AFTER fair_use_pending_at",
    );
    if (alterPendingUsageError) throw alterPendingUsageError;
  }

  const [archiveError] = await runQuery("CREATE TABLE IF NOT EXISTS radacct_archive LIKE radacct");
  if (archiveError) throw archiveError;

  const [archiveColumnError, archiveColumns] = await runQuery("SHOW COLUMNS FROM radacct_archive LIKE 'archived_at'");
  if (archiveColumnError) throw archiveColumnError;
  if (archiveColumns.length === 0) {
    const [alterArchiveError] = await runQuery(
      "ALTER TABLE radacct_archive ADD COLUMN archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD INDEX idx_radacct_archive_username_start (username, acctstarttime)",
    );
    if (alterArchiveError) throw alterArchiveError;
  }

  const [triggerError, triggers] = await runQuery("SHOW TRIGGERS");
  if (triggerError) throw triggerError;
  if (!triggers.some((trigger) => trigger.Trigger === "radacct_preserve_usage_counters")) {
    const [createTriggerError] = await runQuery(`
      CREATE TRIGGER radacct_preserve_usage_counters
      BEFORE UPDATE ON radacct
      FOR EACH ROW
      SET NEW.acctinputoctets = GREATEST(COALESCE(OLD.acctinputoctets, 0), COALESCE(NEW.acctinputoctets, 0)),
          NEW.acctoutputoctets = GREATEST(COALESCE(OLD.acctoutputoctets, 0), COALESCE(NEW.acctoutputoctets, 0))
    `);
    if (createTriggerError && createTriggerError.code !== "ER_TRG_ALREADY_EXISTS") {
      throw createTriggerError;
    }
  }
};

const ensureAccountingArchiveSchema = async () => {
  if (!schemaReady) {
    schemaReady = initializeAccountingArchiveSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
};

const getAccountingTotalBytes = async (username, connection = null) => {
  const executor = connection || db_new;
  const [rows] = await executor.query(
    "SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) AS usage_bytes FROM radacct WHERE username = ?",
    [username],
  );
  return Number(rows[0]?.usage_bytes || 0);
};

const getAccountingBaselineBytes = async (username, connection = null) => {
  const executor = connection || db_new;
  const [rows] = await executor.query(
    `SELECT
       COALESCE(SUM(COALESCE(l.acctinputoctets, 0) + COALESCE(l.acctoutputoctets, 0)), 0)
       + COALESCE(SUM(GREATEST(
           COALESCE(a.archived_input, 0) + COALESCE(a.archived_output, 0)
           - COALESCE(l.acctinputoctets, 0) - COALESCE(l.acctoutputoctets, 0),
           0
         )), 0) AS usage_bytes
     FROM radacct l
     LEFT JOIN (
       SELECT acctuniqueid,
              MAX(acctinputoctets) AS archived_input,
              MAX(acctoutputoctets) AS archived_output
       FROM radacct_archive
       WHERE username = ?
       GROUP BY acctuniqueid
     ) a ON a.acctuniqueid = l.acctuniqueid AND l.acctstoptime IS NULL
     WHERE l.username = ?`,
    [username, username],
  );
  return Number(rows[0]?.usage_bytes || 0);
};

const getUsageBytes = async (username, baselineBytes = 0, connection = null) => {
  const accountingTotalBytes = await getAccountingTotalBytes(username, connection);
  return Math.max(0, accountingTotalBytes - Number(baselineBytes || 0));
};

const archiveClosedSessions = async ({ username = null, before = null, excludeActiveSubscribers = false, limit = 5000, connection = null }) => {
  const executor = connection || db_new;
  const filters = ["acctstoptime IS NOT NULL"];
  const params = [];
  if (username) {
    filters.push("username = ?");
    params.push(username);
  }
  if (before) {
    filters.push("acctstoptime < ?");
    params.push(before);
  }
  if (excludeActiveSubscribers) {
    filters.push(`NOT EXISTS (
      SELECT 1 FROM radcheck_subs s
      WHERE s.username = radacct.username
        AND s.plan_status = 0
        AND s.start_date <= NOW()
        AND s.end_date > NOW()
    )`);
  }

  const [rows] = await executor.query(
    `SELECT radacctid FROM radacct WHERE ${filters.join(" AND ")} ORDER BY radacctid ASC LIMIT ?`,
    [...params, limit],
  );
  if (rows.length === 0) return 0;

  const ids = rows.map((row) => row.radacctid);
  const placeholders = ids.map(() => "?").join(", ");
  // Repeated RADIUS stop packets can leave a live row whose unique accounting
  // identifier is already archived. Preserve the existing archive row and
  // still remove the duplicate live row so it cannot block subscription work.
  await executor.query(
    `INSERT IGNORE INTO radacct_archive
     SELECT radacct.*, NOW() FROM radacct WHERE radacctid IN (${placeholders})`,
    ids,
  );
  await executor.query(`DELETE FROM radacct WHERE radacctid IN (${placeholders})`, ids);
  return ids.length;
};

const archiveOldClosedSessions = async () => {
  await ensureAccountingArchiveSchema();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  let archived = 0;
  while (true) {
    const connection = await db_new.getConnection();
    try {
      await connection.beginTransaction();
      const batchCount = await archiveClosedSessions({ before: cutoff, excludeActiveSubscribers: true, connection });
      await connection.commit();
      archived += batchCount;
      if (batchCount === 0) break;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return archived;
};

module.exports = {
  archiveClosedSessions,
  archiveOldClosedSessions,
  ensureAccountingArchiveSchema,
  getAccountingBaselineBytes,
  getAccountingTotalBytes,
  getUsageBytes,
};
