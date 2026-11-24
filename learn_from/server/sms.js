require("dotenv").config();

const axios = require("axios");

const SMS_API_HOST = process.env.SMS_API_HOST || "api.smsonlinegh.com";
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID;

async function sendSms(phoneNumber, message) {
  if (!SMS_API_KEY || !SMS_SENDER_ID) {
    console.error("SMS configuration missing: SMS_API_KEY and SMS_SENDER_ID are required.");
    return;
  }

  const msgData = {
    text: message,
    type: 0,
    sender: SMS_SENDER_ID,
    destinations: [phoneNumber],
  };

  try {
    const response = await axios.request({
      method: "POST",
      url: `http://${SMS_API_HOST}/v5/message/sms/send`,
      data: msgData,
      headers: {
        Host: SMS_API_HOST,
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `key ${SMS_API_KEY}`,
      },
    });

    if (response.status === 200) {
      console.log("SMS sent successfully to", phoneNumber);
    } else {
      console.error("SMS API non-200:", response.status, response.data);
    }
  } catch (smsErr) {
    console.error("SMS API error:", smsErr.message);
  }
}

module.exports = { sendSms };
