const nextMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

// Future billing must resolve a price at the START of a service cycle, then snapshot it
// on the bill. Never use the latest configured plans.amount to recalculate old periods.
async function resolvePlanPrice(connection, planId, cycleStart) {
  const date = new Date(`${cycleStart}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleStart || '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== cycleStart) throw new Error('A valid service-cycle start date is required.');
  const [rows] = await connection.query(`SELECT amount, effective_from FROM plan_prices
    WHERE plan_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1`, [planId, cycleStart]);
  if (!rows.length) throw new Error('No recorded plan price exists for this service cycle. Historical pricing needs review.');
  return rows[0];
}

module.exports = { nextMonthStart, resolvePlanPrice };
