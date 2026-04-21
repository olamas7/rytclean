export const subscriptionPlans = [
  {
    id: 'PLAN-WEEKLY',
    name: 'Weekly Pickup',
    price: 160,
    currency: 'GHS',
    frequency: 'Weekly',
    features: ['One standard bin', 'Fixed day pickup', 'SMS reminders']
  },
  {
    id: 'PLAN-BIWEEKLY',
    name: 'Bi-Weekly Pickup',
    price: 95,
    currency: 'GHS',
    frequency: 'Every 2 weeks',
    features: ['One standard bin', 'Flexible date selection', 'Basic support']
  },
  {
    id: 'PLAN-ONETIME',
    name: 'One-Time Pickup',
    price: 60,
    currency: 'GHS',
    frequency: 'Single request',
    features: ['Adhoc cleanup', 'Same-week slot', 'Pay per request']
  },
  {
    id: 'PLAN-BUSINESS',
    name: 'Business Plan',
    price: 520,
    currency: 'GHS',
    frequency: 'Twice weekly',
    features: ['Multiple bins', 'Priority support', 'Monthly invoice']
  }
];
