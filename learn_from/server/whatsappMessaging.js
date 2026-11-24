const axios = require("axios");
const { db_new } = require("./db");

const SUBSCRIPTION_ACTIVATED_TEMPLATE = "subscription_activated";
const SUBSCRIPTION_ACTIVATED_LANGUAGE = "en";
const USER_TEMPLATE_FIELDS = new Set(["fullname", "username", "phone", "email", "hostel", "room"]);

let schemaReady = null;

const ensureWhatsAppOutboundMessagesTable = async () => {
  if (!schemaReady) {
    schemaReady = db_new.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_outbound_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        subscription_id BIGINT UNSIGNED NULL,
        recipient_phone VARCHAR(32) NOT NULL,
        template_name VARCHAR(128) NOT NULL,
        language_code VARCHAR(32) NOT NULL,
        template_variables JSON NOT NULL,
        source VARCHAR(32) NOT NULL,
        whatsapp_message_id VARCHAR(128) NULL,
        status VARCHAR(32) NOT NULL,
        error_message TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_whatsapp_outbound_message_id (whatsapp_message_id),
        KEY idx_whatsapp_outbound_source_created (source, created_at),
        KEY idx_whatsapp_outbound_subscription (subscription_id)
      )
    `).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
};

const formatWhatsAppRecipient = (phoneNumber) => {
  let digits = String(phoneNumber || "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) digits = `233${digits.slice(1)}`;
  if (!/^233\d{9}$/.test(digits)) {
    throw new Error("Enter a valid Ghana phone number, for example 0247016017.");
  }
  return digits;
};

const requireText = (value, label, maxLength) => {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
};

const getWhatsAppConfig = () => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  if (!accessToken || !phoneNumberId || !apiVersion) {
    throw new Error("WhatsApp sending is not configured. Check the access token, phone number ID, and API version.");
  }
  return { accessToken, phoneNumberId, apiVersion };
};

const getTemplateVariableSlots = (template) => {
  const slots = [];
  for (const component of template.components || []) {
    const type = String(component.type || "").toLowerCase();
    if (type === "header" && component.format && component.format !== "TEXT") return null;
    if (type === "button" || type === "buttons") {
      if (/{{\d+}}/.test(JSON.stringify(component))) return null;
      continue;
    }
    if (type !== "header" && type !== "body" && type !== "footer") continue;
    const allVariables = String(component.text || "").match(/{{[^}]+}}/g) || [];
    if (allVariables.some((variable) => !/^{{\d+}}$/.test(variable))) return null;
    const variables = allVariables;
    variables.forEach((variable, index) => {
      slots.push({ component: type, variable, parameterIndex: index });
    });
  }
  return slots;
};

const getApprovedWhatsAppTemplates = async () => {
  const { accessToken, apiVersion } = getWhatsAppConfig();
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!businessAccountId) {
    throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID is required to load WhatsApp templates.");
  }

  let response;
  try {
    response = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates`,
      {
        params: { fields: "name,language,status,category,components", limit: 250 },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      },
    );
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    throw new Error(`Meta could not load WhatsApp templates: ${message}`);
  }

  return (response.data?.data || [])
    .filter((template) => template.status === "APPROVED")
    .map((template) => ({ ...template, variableSlots: getTemplateVariableSlots(template) }))
    .filter((template) => template.variableSlots !== null)
    .sort((left, right) => left.name.localeCompare(right.name) || left.language.localeCompare(right.language));
};

const recordOutboundMessage = async ({ recipientPhone, templateName, languageCode, variables, source, subscriptionId, messageId, status, errorMessage = null }) => {
  await ensureWhatsAppOutboundMessagesTable();
  await db_new.query(
    `INSERT INTO whatsapp_outbound_messages
      (subscription_id, recipient_phone, template_name, language_code, template_variables, source, whatsapp_message_id, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      subscriptionId || null,
      recipientPhone,
      templateName,
      languageCode,
      JSON.stringify(variables),
      source,
      messageId || null,
      status,
      errorMessage,
    ],
  );
};

const sendWhatsAppTemplate = async ({
  recipientPhone,
  templateName,
  languageCode,
  componentParameters,
  variables,
  source = "campaign",
  subscriptionId = null,
}) => {
  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
  const recipient = formatWhatsAppRecipient(recipientPhone);
  const name = requireText(templateName, "Template name", 128);
  const language = requireText(languageCode, "Template language", 32);

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name,
          language: { code: language },
          ...(componentParameters.length > 0 ? { components: componentParameters } : {}),
        },
      },
      {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        timeout: 15000,
      },
    );

    const messageId = response.data?.messages?.[0]?.id;
    await recordOutboundMessage({ recipientPhone: recipient, templateName: name, languageCode: language, variables, source, subscriptionId, messageId, status: "submitted" });
    console.log(`WhatsApp ${source} template ${name} submitted for ${recipient}.`);
    return { messageId, recipient, status: "submitted" };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    try {
      await recordOutboundMessage({ recipientPhone: recipient, templateName: name, languageCode: language, variables, source, subscriptionId, status: "failed", errorMessage });
    } catch (recordError) {
      console.error("Failed to record WhatsApp send failure:", recordError.message);
    }
    throw new Error(`WhatsApp template could not be sent: ${errorMessage}`);
  }
};

const sendSubscriptionActivationTemplate = async ({ recipientPhone, customerName, accountNumber, expiryDate, source = "test", subscriptionId = null }) => {
  const variables = {
    customerName: requireText(customerName, "Customer name", 120),
    accountNumber: requireText(accountNumber, "Account number", 64),
    expiryDate: requireText(expiryDate, "Expiry date", 64),
  };

  return sendWhatsAppTemplate({
    recipientPhone,
    templateName: SUBSCRIPTION_ACTIVATED_TEMPLATE,
    languageCode: SUBSCRIPTION_ACTIVATED_LANGUAGE,
    componentParameters: [{
      type: "body",
      parameters: [
        { type: "text", text: variables.customerName },
        { type: "text", text: variables.accountNumber },
        { type: "text", text: variables.expiryDate },
      ],
    }],
    variables,
    source,
    subscriptionId,
  });
};

const getRecentWhatsAppMessages = async (source, limit = 20) => {
  await ensureWhatsAppOutboundMessagesTable();
  const [rows] = await db_new.query(
    `SELECT id, recipient_phone, template_name, language_code, template_variables, source,
            whatsapp_message_id, status, error_message, created_at, updated_at
     FROM whatsapp_outbound_messages
     WHERE source = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [source, limit],
  );
  return rows;
};

const updateWhatsAppMessageStatus = async (messageId, status) => {
  if (!messageId || !status) return;
  await ensureWhatsAppOutboundMessagesTable();
  await db_new.query(
    "UPDATE whatsapp_outbound_messages SET status = ? WHERE whatsapp_message_id = ?",
    [status, messageId],
  );
};

module.exports = {
  SUBSCRIPTION_ACTIVATED_LANGUAGE,
  SUBSCRIPTION_ACTIVATED_TEMPLATE,
  USER_TEMPLATE_FIELDS,
  ensureWhatsAppOutboundMessagesTable,
  getApprovedWhatsAppTemplates,
  getRecentWhatsAppMessages,
  getTemplateVariableSlots,
  sendWhatsAppTemplate,
  sendSubscriptionActivationTemplate,
  updateWhatsAppMessageStatus,
};
