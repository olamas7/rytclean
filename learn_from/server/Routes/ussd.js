const express = require("express");
const router = express.Router();
const runQuery = require("./runQuery");
const { calculatePlanFromAmount } = require("./General/subscriptionManager");
const { getUsageBytes } = require("./General/accountingArchive");
const {
  initiatePaystackMobileMoneyCharge,
  normalizePaystackProvider,
} = require("../paystackMobileMoney");

const sessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000;

const normalizeGhanaPhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12)
    digits = `0${digits.slice(3)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
};

const isNewSession = (value) =>
  value === true ||
  String(value).toLowerCase() === "true" ||
  value === 1 ||
  value === "1";

const respond = (res, request, message, continueSession) =>
  res.json({
    sessionID: request.sessionID,
    userID: request.userID,
    msisdn: request.msisdn,
    message,
    continueSession,
  });

const welcomeMessage =
  "Welcome to KayFi\n1. Get a subscription\n2. Subscribe for others\n3. Check fair-use usage\n4. Set or reset password";
const amountMessage = "Enter amount in GHS\nMinimum: GHS 10\n0. Back";

router.post("/ussd", async (req, res) => {
  const { sessionID, userID, msisdn, userData, network } = req.body || {};
  if (!sessionID || !msisdn) {
    return respond(res, req.body || {}, "Invalid USSD request.", false);
  }

  const username = normalizeGhanaPhone(msisdn);
  if (!username)
    return respond(res, req.body, "Use a valid Ghana phone number.", false);

  if (isNewSession(req.body.newSession)) {
    sessions.set(sessionID, {
      state: "menu",
      callerUsername: username,
      targetUsername: username,
      network,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return respond(res, req.body, welcomeMessage, true);
  }

  const session = sessions.get(sessionID);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionID);
    return respond(res, req.body, "Session expired. Please dial again.", false);
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  session.network = network || session.network;
  const input = String(userData || "").trim();

  try {
    if (session.state === "menu") {
      if (input === "1") {
        session.state = "amount";
        session.amountBackState = "menu";
      } else if (input === "2") {
        session.state = "recipient";
        return respond(
          res,
          req.body,
          "Enter recipient phone number.\n0. Back",
          true,
        );
      } else if (input === "3") {
        const [subscriptionError, subscriptions] = await runQuery(
          `SELECT fair_use_limit_gb, usage_baseline_bytes, end_date
           FROM radcheck_subs
           WHERE username = ?
             AND plan_status = 0
             AND start_date <= NOW()
             AND end_date > NOW()
           ORDER BY end_date DESC
           LIMIT 1`,
          [session.callerUsername],
        );
        if (subscriptionError) throw subscriptionError;
        sessions.delete(sessionID);
        if (subscriptions.length === 0) {
          return respond(
            res,
            req.body,
            "You do not have an active subscription.",
            false,
          );
        }

        const subscription = subscriptions[0];
        const limitGb = Number(subscription.fair_use_limit_gb || 0);
        if (limitGb <= 0) {
          return respond(
            res,
            req.body,
            `Your active subscription has no fair-use limit.\nExpires: ${new Date(subscription.end_date).toLocaleDateString("en-GB")}`,
            false,
          );
        }

        const usedGb =
          (await getUsageBytes(
            session.callerUsername,
            subscription.usage_baseline_bytes,
          )) /
          (1024 * 1024 * 1024);
        return respond(
          res,
          req.body,
          `Fair-use usage\nUsed: ${usedGb.toFixed(2)} GB / ${limitGb.toFixed(2)} GB\nRemaining: ${Math.max(0, limitGb - usedGb).toFixed(2)} GB\nExpires: ${new Date(subscription.end_date).toLocaleDateString("en-GB")}`,
          false,
        );
      } else if (input === "4") {
        const [clientError, clients] = await runQuery(
          "SELECT username FROM radcheck_client WHERE username = ? LIMIT 1",
          [session.callerUsername],
        );
        if (clientError) throw clientError;
        if (clients.length === 0) {
          sessions.delete(sessionID);
          return respond(
            res,
            req.body,
            "No KayFi account was found for this number. Get a subscription first.",
            false,
          );
        }
        session.state = "new_password";
        return respond(
          res,
          req.body,
          "Enter new password.\nMinimum 4 characters.\n0. Back",
          true,
        );
      } else {
        return respond(res, req.body, "Invalid option. Dial again.", false);
      }
      return respond(res, req.body, amountMessage, true);
    }

    if (session.state === "new_password") {
      if (input === "0") {
        session.state = "menu";
        return respond(res, req.body, welcomeMessage, true);
      }
      if (input.length < 4 || input.length > 64) {
        return respond(
          res,
          req.body,
          "Password must be 4 to 64 characters.\n0. Back",
          true,
        );
      }
      session.newPassword = input;
      session.state = "confirm_password";
      return respond(res, req.body, "Confirm new password.\n0. Back", true);
    }

    if (session.state === "confirm_password") {
      if (input === "0") {
        session.newPassword = null;
        session.state = "new_password";
        return respond(
          res,
          req.body,
          "Enter new password.\nMinimum 4 characters.\n0. Back",
          true,
        );
      }
      if (input !== session.newPassword) {
        session.newPassword = null;
        session.state = "new_password";
        return respond(
          res,
          req.body,
          "Passwords do not match. Enter new password again.\n0. Back",
          true,
        );
      }

      const [clientUpdateError] = await runQuery(
        "UPDATE radcheck_client SET value = ? WHERE username = ?",
        [session.newPassword, session.callerUsername],
      );
      if (clientUpdateError) throw clientUpdateError;
      const [radiusUpdateError] = await runQuery(
        "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'",
        [session.newPassword, session.callerUsername],
      );
      if (radiusUpdateError) throw radiusUpdateError;

      sessions.delete(sessionID);
      return respond(
        res,
        req.body,
        "Password updated successfully. Use your phone number and new password to connect.",
        false,
      );
    }

    if (session.state === "recipient") {
      if (input === "0") {
        session.state = "menu";
        return respond(res, req.body, welcomeMessage, true);
      }
      const recipient = normalizeGhanaPhone(input);
      if (!recipient)
        return respond(
          res,
          req.body,
          "Enter a valid Ghana phone number.\n0. Back",
          true,
        );
      session.targetUsername = recipient;
      session.state = "amount";
      session.amountBackState = "recipient";
      return respond(res, req.body, amountMessage, true);
    }

    if (session.state === "amount") {
      if (input === "0") {
        session.state = session.amountBackState || "menu";
        if (session.state === "recipient") {
          return respond(
            res,
            req.body,
            "Enter recipient phone number.\n0. Back",
            true,
          );
        }
        return respond(res, req.body, welcomeMessage, true);
      }
      if (!/^\d+(\.\d{1,2})?$/.test(input)) {
        return respond(
          res,
          req.body,
          "Enter a valid amount in GHS.\n0. Back",
          true,
        );
      }
      const amount = Number(input);
      let plan;
      try {
        plan = await calculatePlanFromAmount(amount);
      } catch (error) {
        return respond(res, req.body, `${error.message}\n0. Back`, true);
      }
      const expiry = new Date(
        Date.now() + Number(plan.expireDays) * 24 * 60 * 60 * 1000,
      );
      session.state = "confirm";
      session.amount = amount;
      session.plan = plan;
      return respond(
        res,
        req.body,
        `${session.targetUsername !== session.callerUsername ? `For: ${session.targetUsername}\n` : ""}GHS ${amount.toFixed(2)}\nFair use: ${Number(plan.fairUseLimitGb).toFixed(2)} GB\nExpires: ${expiry.toLocaleDateString("en-GB")}\n1. Confirm\n2. Cancel\n0. Back`,
        true,
      );
    }

    if (session.state === "confirm") {
      if (input === "0") {
        session.state = "amount";
        session.amount = null;
        session.plan = null;
        return respond(res, req.body, amountMessage, true);
      }
      if (input === "2") {
        sessions.delete(sessionID);
        return respond(res, req.body, "Payment cancelled.", false);
      }
      if (input !== "1")
        return respond(res, req.body, "1. Confirm\n2. Cancel\n0. Back", true);

      const provider = normalizePaystackProvider(session.network);
      if (!provider) {
        console.warn(
          `Unsupported Arkesel USSD network '${session.network}' for ${username}.`,
        );
        sessions.delete(sessionID);
        return respond(
          res,
          req.body,
          "Your mobile network is not supported for payment yet.",
          false,
        );
      }

      session.state = "processing";
      const [clientError, clients] = await runQuery(
        "SELECT email FROM radcheck_client WHERE username = ? LIMIT 1",
        [session.callerUsername],
      );
      if (clientError) throw clientError;
      const email =
        clients[0]?.email || `${session.callerUsername}@kayfigh.com`;
      await initiatePaystackMobileMoneyCharge({
        username: session.targetUsername,
        amount: session.amount,
        phone: session.callerUsername,
        provider,
        email,
      });
      sessions.delete(sessionID);
      return respond(
        res,
        req.body,
        "Approve the payment prompt on your phone. Your subscription activates after payment confirmation.",
        false,
      );
    }

    if (session.state === "processing") {
      return respond(
        res,
        req.body,
        "Payment is being started. Please check your phone.",
        false,
      );
    }
  } catch (error) {
    console.error(
      `USSD purchase error for ${username}:`,
      error.response?.data || error.message,
    );
    if (session.state === "processing") session.state = "confirm";
    return respond(
      res,
      req.body,
      "Payment could not be started. Please try again.",
      false,
    );
  }

  sessions.delete(sessionID);
  return respond(res, req.body, "Session ended. Please dial again.", false);
});

module.exports = router;
