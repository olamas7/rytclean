const events = {
  registration: { title: 'Customer registration', message: 'Welcome to RytClean, {name}. Your customer ID is {customerId}. Thank you for joining us.' },
  payment: { title: 'Payment received', message: 'Hello {name}, RytClean received GHS {amount}. Receipt: {reference}. Customer ID: {customerId}. Thank you.' },
  bill: { title: 'Bill issued', message: 'Hello {name}, your RytClean bill {reference} is GHS {amount}, due {dueDate}. Customer ID: {customerId}.' },
  due: { title: 'Payment due today', message: 'Hello {name}, RytClean bill {reference} has GHS {amount} outstanding, due today ({dueDate}). Please arrange payment.' },
  overdue: { title: 'Payment overdue (7 days)', message: 'Hello {name}, RytClean bill {reference} is overdue. Outstanding: GHS {amount}. Due date: {dueDate}. Please arrange payment.' },
  plan_change: { title: 'Plan change scheduled', message: 'Hello {name}, your RytClean plan will change to {plan} on {effectiveDate}. Customer ID: {customerId}.' }
};
const placeholders = ['name', 'customerId', 'amount', 'reference', 'dueDate', 'plan', 'effectiveDate'];
const eventPlaceholders = {
  registration: ['name', 'customerId'], payment: ['name', 'customerId', 'amount', 'reference'],
  bill: ['name', 'customerId', 'amount', 'reference', 'dueDate'],
  due: ['name', 'customerId', 'amount', 'reference', 'dueDate'],
  overdue: ['name', 'customerId', 'amount', 'reference', 'dueDate'],
  plan_change: ['name', 'customerId', 'plan', 'effectiveDate']
};
function validateTemplate(message, event) {
  if (typeof message !== 'string' || !message.trim() || message.length > 1000) throw new Error('Enter a message of 1–1000 characters.');
  const allowed = eventPlaceholders[event] || placeholders;
  const remaining = message.replace(/\{([A-Za-z]+)\}/g, (match, key) => allowed.includes(key) ? '' : match);
  if (/[{}]/.test(remaining)) throw new Error('Use only the supported message placeholders.');
  return message.trim();
}
const render = (message, values) => message.replace(/\{([A-Za-z]+)\}/g, (_, key) => String(values[key] ?? ''));
function phone(value) {
  if (!/^0\d{9}$/.test(String(value))) throw new Error('Enter a Ghana phone number with 10 digits starting with 0.');
  return `233${String(value).slice(1)}`;
}
module.exports = { events, placeholders, eventPlaceholders, validateTemplate, render, phone };
