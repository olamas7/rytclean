const currencyFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' });
const dateFormatter = new Intl.DateTimeFormat('en-GH', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' });

export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return currencyFormatter.format(Number(value));
};

export const formatDate = (value) => {
  if (!value) return '—';
  // Treat database DATE values as calendar dates, not browser-local timestamps.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
};
