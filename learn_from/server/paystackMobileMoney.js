const axios = require("axios");
const runQuery = require("./Routes/runQuery");
const { calculatePlanFromAmount } = require("./Routes/General/subscriptionManager");

const PAYSTACK_PROVIDERS = {
  mtn: "mtn",
  vod: "vod",
  vodafone: "vod",
  tgo: "tgo",
  airteltigo: "tgo",
  airtel_tigo: "tgo",
};

const normalizePaystackProvider = (network) => {
  const normalized = String(network || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return PAYSTACK_PROVIDERS[normalized] || null;
};

const initiatePaystackMobileMoneyCharge = async ({ username, amount, phone, provider, email }) => {
  if (!username || !phone || !provider || !amount || !email) {
    throw new Error("Missing payment details.");
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error("Paystack payment is not configured.");

  const calculatedPlan = await calculatePlanFromAmount(amount);
  const reference = `ussd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const response = await axios.post(
    "https://api.paystack.co/charge",
    {
      amount: Math.round(Number(amount) * 100),
      email,
      currency: "GHS",
      mobile_money: { phone, provider },
      reference,
      metadata: {
        custom_fields: [
          { display_name: "Username", variable_name: "username", value: username },
          { display_name: "Amount", variable_name: "amount", value: amount },
        ],
      },
    },
    {
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      timeout: 15000,
    },
  );

  const data = response.data.data;
  const [logError] = await runQuery(
    `INSERT INTO paystack_transactions (reference, username, plan_id, amount, email, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [reference, username, calculatedPlan.planId, amount, email],
  );
  if (logError) throw new Error("Payment started but could not be recorded for activation.");

  return { reference: data.reference || reference, status: data.status, displayText: data.display_text || data.message };
};

module.exports = { initiatePaystackMobileMoneyCharge, normalizePaystackProvider };
