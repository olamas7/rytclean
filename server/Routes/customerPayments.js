const express = require('express');
const payments = require('../services/customerPayments');
const router = express.Router();
const limits = new Map();
const handle = (work) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ code: 1, data: await work(req) }); }
  catch (error) { res.status(error.code === 'ER_DUP_ENTRY' ? 409 : error.status || 500).json({ code: 2, message: error.code === 'ER_DUP_ENTRY' ? 'This payment request already exists. Check its status before retrying.' : error.status ? error.message : 'Unable to process payment. Keep your reference and contact the office before paying again.' }); }
};
function limit(label, max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    const key = `${label}:${req.ip}`;
    const value = limits.get(key) || { count: 0, until: now + windowMs };
    value.count += 1; limits.set(key, value);
    if (value.count > max || limits.size > 10000) return res.status(429).json({ code: 2, message: 'Too many payment requests. Wait a few minutes before retrying.' });
    next();
  };
}
router.get('/config', handle(() => payments.configuration()));
router.post('/lookup', limit('lookup', 20, 60000), handle((req) => payments.lookup(req.body.customerId)));
router.post('/charge', limit('charge', 10, 600000), handle((req) => payments.initiate(req.headers['x-payment-session'], req.body)));
router.get('/status/:reference', limit('status', 60, 60000), handle((req) => payments.status(req.headers['x-payment-session'], req.params.reference)));
router.get('/current', limit('status', 60, 60000), handle((req) => payments.current(req.headers['x-payment-session'])));
router.post('/otp', limit('otp', 10, 600000), handle((req) => payments.submitOtp(req.headers['x-payment-session'], req.body.reference, req.body.otp)));
module.exports = router;
module.exports.webhook = async (req, res) => {
  try { await payments.webhook(req.body, req.headers['x-paystack-signature']); res.sendStatus(200); }
  catch (error) { res.sendStatus(error.status || 500); }
};
