const crypto = require("crypto");
const express = require("express");
const { db_new } = require("../db");
const { updateWhatsAppMessageStatus } = require("../whatsappMessaging");

const router = express.Router();

let schemaReady = null;

const ensureWebhookEventTable = async () => {
  if (!schemaReady) {
    schemaReady = db_new
      .query(
        `
      CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_key CHAR(64) NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        whatsapp_message_id VARCHAR(128) NULL,
        contact_wa_id VARCHAR(64) NULL,
        phone_number_id VARCHAR(64) NULL,
        status VARCHAR(32) NULL,
        event_timestamp BIGINT UNSIGNED NULL,
        payload JSON NOT NULL,
        received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_whatsapp_webhook_event_key (event_key),
        KEY idx_whatsapp_webhook_message (whatsapp_message_id),
        KEY idx_whatsapp_webhook_contact (contact_wa_id, received_at)
      )
    `,
      )
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
};

const createEventKey = (parts) =>
  crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part || "")).join(":"))
    .digest("hex");

const verifyMetaSignature = (rawBody, signature) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !rawBody || !signature) return false;

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const received = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return (
    received.length === calculated.length &&
    crypto.timingSafeEqual(received, calculated)
  );
};

const saveEvents = async (body) => {
  const events = [];

  body.entry?.forEach((entry) => {
    entry.changes?.forEach((change) => {
      if (change.field !== "messages") return;

      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id || null;
      value.messages?.forEach((message) => {
        events.push({
          eventKey: createEventKey(["message", message.id]),
          eventType: "message",
          messageId: message.id || null,
          contactWaId: message.from || null,
          phoneNumberId,
          status: null,
          timestamp: Number(message.timestamp) || null,
          payload: message,
        });
      });
      value.statuses?.forEach((status) => {
        events.push({
          eventKey: createEventKey([
            "status",
            status.id,
            status.status,
            status.timestamp,
          ]),
          eventType: "status",
          messageId: status.id || null,
          contactWaId: status.recipient_id || null,
          phoneNumberId,
          status: status.status || null,
          timestamp: Number(status.timestamp) || null,
          payload: status,
        });
      });
    });
  });

  if (events.length === 0) return;

  await ensureWebhookEventTable();
  await db_new.query(
    `INSERT INTO whatsapp_webhook_events
      (event_key, event_type, whatsapp_message_id, contact_wa_id, phone_number_id, status, event_timestamp, payload)
     VALUES ?
     ON DUPLICATE KEY UPDATE event_key = VALUES(event_key)`,
    [
      events.map((event) => [
        event.eventKey,
        event.eventType,
        event.messageId,
        event.contactWaId,
        event.phoneNumberId,
        event.status,
        event.timestamp,
        JSON.stringify(event.payload),
      ]),
    ],
  );

  await Promise.all(
    events
      .filter((event) => event.eventType === "status")
      .map((event) =>
        updateWhatsAppMessageStatus(event.messageId, event.status),
      ),
  );

  const messageCount = events.filter(
    (event) => event.eventType === "message",
  ).length;
  const statusCount = events.length - messageCount;
  console.log(
    `WhatsApp webhook stored ${messageCount} message event(s) and ${statusCount} status event(s).`,
  );
};

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    console.error(
      "WhatsApp webhook verification is not configured: WHATSAPP_VERIFY_TOKEN is missing.",
    );
    return res.sendStatus(503);
  }
  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post("/webhook", (req, res) => {
  if (!process.env.WHATSAPP_APP_SECRET) {
    console.error(
      "WhatsApp webhook event rejected: WHATSAPP_APP_SECRET is missing.",
    );
    return res.sendStatus(503);
  }
  if (!verifyMetaSignature(req.rawBody, req.get("x-hub-signature-256"))) {
    console.warn("WhatsApp webhook event rejected: invalid signature.");
    return res.sendStatus(401);
  }
  if (req.body?.object !== "whatsapp_business_account") {
    return res.sendStatus(404);
  }

  res.status(200).send("EVENT_RECEIVED");
  void saveEvents(req.body).catch((error) => {
    console.error("Failed to store WhatsApp webhook events:", error.message);
  });
});

router.ensureWebhookEventTable = ensureWebhookEventTable;

module.exports = router;
