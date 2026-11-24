const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { runQuery } = require("../db");

const router = express.Router();
const captivePortalPath = path.join(__dirname, "..", "..", "captive_portal", "index.html");
const failedAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const SUPPORT_PHONE = "0207430883";
const SUPPORT_WHATSAPP = "https://wa.me/233207430883";
const API_BASE_URL = "https://api.kayfigh.com";

const fallbackLoginPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KayFi App</title>
    <style>
      * { box-sizing: border-box; font-family: Arial, sans-serif; margin: 0; padding: 0; }
      body { align-items: center; background: linear-gradient(to bottom right, #4a00e0, #8e2de2); display: flex; justify-content: center; min-height: 100vh; padding: 80px 16px 24px; }
      .container { background: rgba(255, 255, 255, 0.94); border-radius: 15px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); max-width: 100%; padding: 40px 30px; position: relative; text-align: center; width: 350px; }
      .brand { color: #1479a6; font-size: 42px; font-weight: 900; margin-bottom: 18px; }
      h1 { color: #333; font-size: 24px; font-weight: 600; margin-bottom: 18px; }
      .error-message { background: #b91c1c; border: 1px solid rgba(255, 255, 255, 0.45); border-radius: 10px; box-shadow: 0 14px 35px rgba(0, 0, 0, 0.24); color: #fff; font-size: 14px; font-weight: 600; left: 0; line-height: 1.4; padding: 12px 14px; position: absolute; right: 0; text-align: center; top: -62px; }
      input[type="text"], input[type="tel"], input[type="password"] { border: 1px solid #ddd; border-radius: 8px; font-size: 16px; margin-bottom: 20px; padding: 12px; width: 100%; }
      input[type="submit"] { background: linear-gradient(to right, #4a00e0, #8e2de2); border: 0; border-radius: 8px; color: #fff; cursor: pointer; font-size: 18px; font-weight: 600; padding: 12px 20px; width: 100%; }
      .field-help { color: #777; font-size: 13px; margin: -12px 0 14px; text-align: left; }
      a { color: #4a00e0; display: inline-block; font-weight: 700; margin-top: 14px; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="brand">KayFi</div>
      <h1>Wifi Manager</h1>
      <!-- CAPTIVE_ERROR -->
      <form method="post" action="${API_BASE_URL}/captive-login">
        <input name="auth_user" type="tel" inputmode="numeric" pattern="[0-9]*" oninput="this.value = this.value.replace(/[^0-9]/g, '')" placeholder="Phone Number" required />
        <p class="field-help">Enter your phone number only, e.g. 024XXXXXXX.</p>
        <input name="auth_pass" type="password" placeholder="Password" required />
        <a href="https://www.kayfigh.com/forgot-password" target="_blank" rel="noopener noreferrer">Forgot Password?</a>
        <input name="portal_action" type="hidden" value="$PORTAL_ACTION$" />
        <input name="redirurl" type="hidden" value="$PORTAL_REDIRURL$" />
        <input name="zone" type="hidden" value="$PORTAL_ZONE$" />
        <input name="accept" type="submit" value="Continue" />
      </form>
    </div>
  </body>
</html>`;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isDisabled(user) {
  if (user.disabled !== undefined) return Number(user.disabled) === 1;
  if (user.is_disabled !== undefined) return Number(user.is_disabled) === 1;
  if (user.active !== undefined) return Number(user.active) === 0;
  if (user.status !== undefined) {
    return ["disabled", "inactive", "blocked", "suspended"].includes(
      String(user.status).toLowerCase(),
    );
  }
  if (user.account_status !== undefined) {
    return ["disabled", "inactive", "blocked", "suspended"].includes(
      String(user.account_status).toLowerCase(),
    );
  }
  return false;
}

function canBypassSubscription(user) {
  return Number(user.bypass_subscription_check) === 1;
}

function getClientKey(req, username) {
  return `${username || "unknown"}:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
}

function isRateLimited(key) {
  const attempt = failedAttempts.get(key);
  if (!attempt) return false;

  if (Date.now() > attempt.resetAt) {
    failedAttempts.delete(key);
    return false;
  }

  return attempt.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const attempt = failedAttempts.get(key);

  if (!attempt || now > attempt.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  attempt.count += 1;
}

function clearFailedAttempts(key) {
  failedAttempts.delete(key);
}

function logFailedLogin(req, username, reason) {
  console.warn("Captive login failed:", {
    username,
    reason,
    ip: req.ip,
    forwardedFor: req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
  });
}

function getErrorActions(reason) {
  if (reason === "wrong_password") {
    return {
      title: "Wrong Password",
      secondaryLabel: "Forgot Password?",
      secondaryHref: "https://www.kayfigh.com/forgot-password",
    };
  }

  if (reason === "expired_subscription") {
    return {
      title: "Subscription Expired",
      secondaryLabel: "Renew Plan",
      secondaryHref: "https://www.kayfigh.com/quick-purchase",
    };
  }

  if (reason === "no_subscription" || reason === "no_data") {
    return {
      title: reason === "no_data" ? "No Data Balance" : "No Active Plan",
      secondaryLabel: "Buy Wifi Data",
      secondaryHref: "https://www.kayfigh.com/quick-purchase",
    };
  }

  if (reason === "user_not_found") {
    return {
      title: "Account Not Found",
      secondaryLabel: "Register on KayFi",
      secondaryHref: "https://www.kayfigh.com",
    };
  }

  return {
    title: "Login Failed",
    secondaryLabel: "WhatsApp Support",
    secondaryHref: SUPPORT_WHATSAPP,
  };
}

function getFailureResponse(reason, message) {
  const actions = getErrorActions(reason);

  return {
    reason,
    title: actions.title,
    message,
    actionLabel: actions.secondaryLabel,
    actionHref: actions.secondaryHref,
  };
}

async function explainFailureForUser(username) {
  if (!username) {
    return getFailureResponse(
      "missing_credentials",
      "Enter your phone number to check why login failed.",
    );
  }

  if (!/^\d+$/.test(username)) {
    return getFailureResponse(
      "invalid_phone",
      "Phone number must contain only numbers.",
    );
  }

  const [userError, users] = await runQuery(
    "SELECT * FROM radcheck_client WHERE username = ? LIMIT 1",
    [username],
  );

  if (userError) {
    console.error("Captive failure explanation user lookup failed:", userError);
    return getFailureResponse(
      "server_error",
      "Unable to verify your account right now. Please try again.",
    );
  }

  if (users.length === 0) {
    return getFailureResponse(
      "user_not_found",
      "This phone number is not registered on KayFi.",
    );
  }

  const user = users[0];

  if (isDisabled(user)) {
    return getFailureResponse(
      "disabled_account",
      "This account is disabled. Please contact KayFi support.",
    );
  }

  if (canBypassSubscription(user)) {
    return getFailureResponse(
      "wrong_password",
      "The password you entered is incorrect.",
    );
  }

  const [activeSubError, activeSubs] = await runQuery(
    `SELECT rs.*, sp.plan_name, sp.data_limit
     FROM radcheck_subs rs
     LEFT JOIN subscription_plans sp ON rs.plan_subs = sp.id
     WHERE rs.username = ? AND rs.plan_status = 0 AND rs.end_date > NOW()
     ORDER BY rs.end_date DESC
     LIMIT 1`,
    [username],
  );

  if (activeSubError) {
    console.error("Captive failure explanation subscription lookup failed:", activeSubError);
    return getFailureResponse(
      "server_error",
      "Unable to verify your subscription right now. Please try again.",
    );
  }

  if (activeSubs.length === 0) {
    const [latestSubError, latestSubs] = await runQuery(
      `SELECT end_date
       FROM radcheck_subs
       WHERE username = ?
       ORDER BY end_date DESC
       LIMIT 1`,
      [username],
    );

    if (latestSubError) {
      console.error("Captive failure explanation latest subscription lookup failed:", latestSubError);
      return getFailureResponse(
        "server_error",
        "Unable to verify your subscription right now. Please try again.",
      );
    }

    if (latestSubs.length > 0 && new Date(latestSubs[0].end_date) <= new Date()) {
      return getFailureResponse(
        "expired_subscription",
        "Your subscription has expired. Please renew your plan.",
      );
    }

    return getFailureResponse(
      "no_subscription",
      "You do not have an active subscription. Please buy a WiFi plan.",
    );
  }

  const activeSub = activeSubs[0];
  const dataLimit = Number(activeSub.plan_data ?? activeSub.data_limit ?? 0);

  if (dataLimit > 0) {
    const [usageError, usageRows] = await runQuery(
      `SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) / (1024 * 1024 * 1024) AS used_data_gb
       FROM radacct
       WHERE username = ?`,
      [username],
    );

    if (usageError) {
      console.error("Captive failure explanation data usage lookup failed:", usageError);
      return getFailureResponse(
        "server_error",
        "Unable to verify your data balance right now. Please try again.",
      );
    }

    const usedData = Number(usageRows[0]?.used_data_gb ?? 0);
    if (usedData >= dataLimit) {
      return getFailureResponse(
        "no_data",
        "You have no data balance left. Please buy more data.",
      );
    }
  }

  return getFailureResponse(
    "wrong_password",
    "The password you entered is incorrect.",
  );
}

function renderErrorPage({ message, reason, username, portalAction, redirurl, zone }) {
  const actions = getErrorActions(reason);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KayFi Login Error</title>
    <style>
      * { box-sizing: border-box; font-family: Arial, sans-serif; margin: 0; padding: 0; }
      body { align-items: center; background: linear-gradient(to bottom right, #4a00e0, #8e2de2); display: flex; justify-content: center; min-height: 100vh; padding: 24px 16px; }
      .card { background: rgba(255, 255, 255, 0.94); border-radius: 18px; box-shadow: 0 18px 45px rgba(0, 0, 0, 0.2); max-width: 420px; padding: 34px 28px; text-align: center; width: 100%; }
      .badge { align-items: center; background: #fee2e2; border-radius: 999px; color: #b91c1c; display: inline-flex; font-size: 30px; font-weight: 700; height: 64px; justify-content: center; margin-bottom: 18px; width: 64px; }
      h1 { color: #2f165f; font-size: 28px; margin-bottom: 12px; }
      .error-text { background: #fff1f2; border: 2px solid #fb7185; border-radius: 14px; box-shadow: 0 10px 24px rgba(185, 28, 28, 0.12); color: #9f1239; font-size: 20px; font-weight: 800; line-height: 1.35; margin-bottom: 20px; padding: 16px 14px; }
      .input-wrap { margin-bottom: 14px; text-align: left; }
      label { color: #4b3f5f; display: block; font-size: 13px; font-weight: 800; margin-bottom: 6px; }
      input[type="tel"], input[type="password"] { border: 1px solid #ddd; border-radius: 10px; font-size: 17px; padding: 13px 14px; width: 100%; }
      input[type="tel"]:focus, input[type="password"]:focus { border-color: #4a00e0; outline: none; }
      button, .primary-action { background: linear-gradient(to right, #4a00e0, #8e2de2); border: 0; border-radius: 10px; color: #fff; cursor: pointer; display: block; font-size: 18px; font-weight: 700; padding: 13px 20px; text-decoration: none; width: 100%; }
      button:disabled { cursor: wait; opacity: 0.75; }
      .secondary-action { border: 2px solid #4a00e0; border-radius: 10px; color: #4a00e0; display: block; font-size: 17px; font-weight: 800; margin-top: 12px; padding: 11px 18px; text-decoration: none; }
      .support { color: #5f5570; font-size: 14px; line-height: 1.45; margin-top: 20px; }
      .support a { color: #4a00e0; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">!</div>
      <h1>${escapeHtml(actions.title)}</h1>
      <div class="error-text">${escapeHtml(message)}</div>
      <form method="post" action="${API_BASE_URL}/captive-login" id="errorLoginForm">
        <div class="input-wrap">
          <label for="auth_user">Phone Number</label>
          <input id="auth_user" name="auth_user" type="tel" inputmode="numeric" pattern="[0-9]*" oninput="this.value = this.value.replace(/[^0-9]/g, '')" value="${escapeHtml(username)}" placeholder="024XXXXXXX" required />
        </div>
        <div class="input-wrap">
          <label for="auth_pass">Password</label>
          <input id="auth_pass" name="auth_pass" type="password" placeholder="Password" required autofocus />
        </div>
        <input type="hidden" name="portal_action" value="${escapeHtml(portalAction)}" />
        <input type="hidden" name="redirurl" value="${escapeHtml(redirurl)}" />
        <input type="hidden" name="zone" value="${escapeHtml(zone)}" />
        <button type="submit" id="errorSubmitButton">Try Again</button>
      </form>
      <a class="secondary-action" href="${escapeHtml(actions.secondaryHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(actions.secondaryLabel)}</a>
      <p class="support">
        Need help? Call <a href="tel:${SUPPORT_PHONE}" target="_blank" rel="noopener noreferrer">${SUPPORT_PHONE}</a> or
        <a href="${SUPPORT_WHATSAPP}" target="_blank" rel="noopener noreferrer">WhatsApp KayFi Support</a>.
      </p>
    </main>
    <script>
      document.getElementById("errorLoginForm").addEventListener("submit", function () {
        var button = document.getElementById("errorSubmitButton");
        button.textContent = "Checking account...";
        button.disabled = true;
      });
    </script>
  </body>
</html>`;
}

function renderForgotPasswordPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KayFi Password Help</title>
    <style>
      * { box-sizing: border-box; font-family: Arial, sans-serif; margin: 0; padding: 0; }
      body { align-items: center; background: linear-gradient(to bottom right, #4a00e0, #8e2de2); display: flex; justify-content: center; min-height: 100vh; padding: 24px 16px; }
      .card { background: rgba(255, 255, 255, 0.95); border-radius: 18px; box-shadow: 0 18px 45px rgba(0, 0, 0, 0.2); max-width: 420px; padding: 34px 28px; text-align: center; width: 100%; }
      .brand { color: #1479a6; font-size: 42px; font-weight: 900; margin-bottom: 14px; }
      h1 { color: #2f165f; font-size: 27px; margin-bottom: 12px; }
      p { color: #5f5570; font-size: 17px; line-height: 1.5; margin-bottom: 22px; }
      a { border-radius: 10px; display: block; font-size: 18px; font-weight: 800; margin-top: 12px; padding: 13px 18px; text-decoration: none; }
      .primary { background: linear-gradient(to right, #4a00e0, #8e2de2); color: #fff; }
      .secondary { border: 2px solid #4a00e0; color: #4a00e0; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="brand">KayFi</div>
      <h1>Password Help</h1>
      <p>For the fastest help inside the captive portal, contact KayFi support to reset your password.</p>
      <a class="primary" href="${SUPPORT_WHATSAPP}">WhatsApp 0207430883</a>
      <a class="secondary" href="tel:${SUPPORT_PHONE}">Call 0207430883</a>
      <a class="secondary" href="https://www.kayfigh.com/forgot-password">Open Full Reset Page</a>
    </main>
  </body>
</html>`;
}

async function renderLoginPage({ error, username, portalAction, redirurl, zone }) {
  let html;

  try {
    html = await fs.readFile(captivePortalPath, "utf8");
  } catch (error) {
    console.warn("Captive portal HTML not found. Rendering fallback login page.", error.message);
    html = fallbackLoginPage;
  }

  const errorHtml = error
    ? `<div class="error-message" role="alert">${escapeHtml(error)}</div>`
    : "";

  return html
    .replace("<!-- CAPTIVE_ERROR -->", errorHtml)
    .replace(
      /name="auth_user"\s+type="tel"/,
      `name="auth_user" type="tel" value="${escapeHtml(username)}"`,
    )
    .replace('value="$PORTAL_ACTION$"', `value="${escapeHtml(portalAction)}"`)
    .replace('value="$PORTAL_REDIRURL$"', `value="${escapeHtml(redirurl)}"`)
    .replace('value="$PORTAL_ZONE$"', `value="${escapeHtml(zone)}"`);
}

function renderPfSenseSubmit({ portalAction, username, password, redirurl, zone }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Connecting to KayFi</title>
    <style>
      * { box-sizing: border-box; font-family: Arial, sans-serif; margin: 0; padding: 0; }
      body { align-items: center; background: linear-gradient(to bottom right, #4a00e0, #8e2de2); display: flex; justify-content: center; min-height: 100vh; padding: 24px 16px; }
      .card { background: rgba(255, 255, 255, 0.95); border-radius: 18px; box-shadow: 0 18px 45px rgba(0, 0, 0, 0.2); max-width: 420px; padding: 36px 28px; text-align: center; width: 100%; }
      .check { align-items: center; background: #dcfce7; border-radius: 999px; color: #16a34a; display: inline-flex; font-size: 34px; font-weight: 900; height: 72px; justify-content: center; margin-bottom: 20px; width: 72px; }
      h1 { color: #2f165f; font-size: 28px; margin-bottom: 10px; }
      p { color: #5f5570; font-size: 16px; line-height: 1.45; margin-bottom: 22px; }
      button { background: linear-gradient(to right, #4a00e0, #8e2de2); border: 0; border-radius: 10px; color: #fff; cursor: pointer; font-size: 18px; font-weight: 700; padding: 13px 20px; width: 100%; }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="check">&check;</div>
      <h1>Login Approved</h1>
      <p>Connecting you to KayFi now. If nothing happens, tap Continue.</p>
      <form id="pfSenseLogin" method="post" action="${escapeHtml(portalAction)}">
      <input type="hidden" name="auth_user" value="${escapeHtml(username)}" />
      <input type="hidden" name="auth_pass" value="${escapeHtml(password)}" />
      <input type="hidden" name="redirurl" value="${escapeHtml(redirurl)}" />
      <input type="hidden" name="zone" value="${escapeHtml(zone)}" />
      <input type="hidden" name="accept" value="Continue" />
      <button type="submit">Continue</button>
      </form>
    </main>
    <script>document.getElementById("pfSenseLogin").submit();</script>
  </body>
</html>`;
}

router.post("/", async (req, res) => {
  const {
    auth_user: username,
    auth_pass: password,
    portal_action: portalAction,
    redirurl = "",
    zone = "",
  } = req.body;
  const clientKey = getClientKey(req, username);

  const fail = async (message, reason = "login_failed", status = 400) => {
    if (status < 500) {
      recordFailedAttempt(clientKey);
      logFailedLogin(req, username, reason);
    }

    const html = renderErrorPage({
      message,
      reason,
      username,
      portalAction,
      redirurl,
      zone,
    });
    return res.status(status >= 500 ? status : 200).send(html);
  };

  try {
    if (isRateLimited(clientKey)) {
      return fail(
        "Too many failed attempts. Please wait 2 minutes, then try again.",
        "rate_limited",
        429,
      );
    }

    if (!username || !password) {
      return fail("Phone number and password are required.", "missing_credentials");
    }

    if (!/^\d+$/.test(username)) {
      return fail("Phone number must contain only numbers.", "invalid_phone");
    }

    if (!portalAction) {
      return fail(
        "Captive portal login details are missing. Please reload the login page.",
        "missing_portal_details",
      );
    }

    const [userError, users] = await runQuery(
      "SELECT * FROM radcheck_client WHERE username = ? LIMIT 1",
      [username],
    );

    if (userError) {
      console.error("Captive login user lookup failed:", userError);
      return fail("Unable to verify your account right now. Please try again.", "server_error", 500);
    }

    if (users.length === 0) {
      return fail("This phone number is not registered on KayFi.", "user_not_found", 401);
    }

    const user = users[0];
    if (user.value !== password) {
      return fail("The password you entered is incorrect.", "wrong_password", 401);
    }

    if (isDisabled(user)) {
      return fail("This account is disabled. Please contact KayFi support.", "disabled_account", 403);
    }

    if (canBypassSubscription(user)) {
      clearFailedAttempts(clientKey);
      return res.send(
        renderPfSenseSubmit({
          portalAction,
          username,
          password,
          redirurl,
          zone,
        }),
      );
    }

    const [activeSubError, activeSubs] = await runQuery(
      `SELECT rs.*, sp.plan_name
       FROM radcheck_subs rs
       LEFT JOIN subscription_plans sp ON rs.plan_subs = sp.id
       WHERE rs.username = ? AND rs.plan_status = 0 AND rs.end_date > NOW()
       ORDER BY rs.end_date DESC
       LIMIT 1`,
      [username],
    );

    if (activeSubError) {
      console.error("Captive login subscription lookup failed:", activeSubError);
      return fail("Unable to verify your subscription right now. Please try again.", "server_error", 500);
    }

    if (activeSubs.length === 0) {
      const [latestSubError, latestSubs] = await runQuery(
        `SELECT end_date
         FROM radcheck_subs
         WHERE username = ?
         ORDER BY end_date DESC
         LIMIT 1`,
        [username],
      );

      if (latestSubError) {
        console.error("Captive login latest subscription lookup failed:", latestSubError);
        return fail("Unable to verify your subscription right now. Please try again.", "server_error", 500);
      }

      if (latestSubs.length > 0 && new Date(latestSubs[0].end_date) <= new Date()) {
        return fail("Your subscription has expired. Please renew your plan.", "expired_subscription", 403);
      }

      return fail("You do not have an active subscription. Please buy a WiFi plan.", "no_subscription", 403);
    }

    clearFailedAttempts(clientKey);
    return res.send(
      renderPfSenseSubmit({
        portalAction,
        username,
        password,
        redirurl,
        zone,
      }),
    );
  } catch (error) {
    console.error("Captive login error:", error);
    return fail("An unexpected error occurred. Please try again.", "server_error", 500);
  }
});

async function retryLogin(req, res) {
  const {
    auth_user: username = "",
    portal_action: portalAction = "",
    redirurl = "",
    zone = "",
  } = req.body;

  const html = await renderLoginPage({
    error: "",
    username,
    portalAction,
    redirurl,
    zone,
  });

  return res.status(200).send(html);
}

router.get("/retry", retryLogin);
router.post("/retry", retryLogin);

router.get("/forgot-password", (req, res) => {
  return res.status(200).send(renderForgotPasswordPage());
});

router.get("/explain-failure", async (req, res) => {
  try {
    const username = String(req.query.auth_user || "").trim();
    const explanation = await explainFailureForUser(username);

    return res.status(200).json(explanation);
  } catch (error) {
    console.error("Captive failure explanation error:", error);
    return res.status(200).json(
      getFailureResponse(
        "server_error",
        "Unable to check the exact login issue right now. Please try again.",
      ),
    );
  }
});

module.exports = router;
