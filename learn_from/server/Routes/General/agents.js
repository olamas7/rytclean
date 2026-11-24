const express = require("express");
const router = express.Router();
const runQuery = require("../runQuery");
const { activateSubscription } = require("./subscriptionManager");
const { ensureAccountingArchiveSchema } = require("./accountingArchive");

const PHONE_NUMBER_PATTERN = /^0\d{9}$/;

// Get Subscribers List
router.get("/subscribers", async (req, res) => {
  const { search, agentId } = req.query;
  const throttledOnly = req.query.throttledOnly === "true";
  const requestedPage = Number(req.query.page || 1);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const requestedLimit = Number(req.query.limit || 100);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 100) : 100;
  const offset = (page - 1) * limit;

  try {
    await ensureAccountingArchiveSchema();
    let query = `
      SELECT 
        rs.id,
        rs.username,
        CONCAT(rc.username, ' (', rc.fullname, ')') AS name,
        rs.plan_amount,
        DATE_FORMAT(rs.start_date, '%d-%m-%Y %h:%i %p') AS start_date,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y %h:%i %p') AS subscription_date,
         DATE_FORMAT(rs.end_date, '%d-%m-%Y %h:%i %p') AS end_date,
          rs.fair_use_limit_gb,
          rs.fair_use_throttled,
          rs.fair_use_super_throttled,
        CASE
          WHEN rs.paid_to = 'Bonus' THEN 'Bonus'
          ELSE (SELECT fullname FROM radcheck_client WHERE username = rs.paid_to)
        END AS reg_by,
           GREATEST(0, (SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0)
             FROM radacct WHERE username = rs.username) - rs.usage_baseline_bytes) / (1024 * 1024 * 1024) AS used_data_gb
      FROM radcheck_subs rs
      JOIN radcheck_client rc ON rs.username = rc.username
      WHERE rs.plan_status = 0
    `;

    const params = [];

    if (search) {
      query += ` AND (rs.username LIKE ? OR rc.fullname LIKE ? OR rc.phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (agentId) {
      query += ` AND rs.paid_to = ?`;
      params.push(agentId);
    }
    if (throttledOnly) {
      query += ` AND (rs.fair_use_throttled = 1 OR rs.fair_use_super_throttled = 1)`;
    }

    // The count query needs to be constructed carefully
    let countQuery = `SELECT COUNT(*) as total FROM radcheck_subs rs JOIN radcheck_client rc ON rs.username = rc.username WHERE rs.plan_status = 0`;
    const countParams = [];
    if (search) {
      countQuery += ` AND (rs.username LIKE ? OR rc.fullname LIKE ? OR rc.phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    if (agentId) {
      countQuery += ` AND rs.paid_to = ?`;
      countParams.push(agentId);
    }
    if (throttledOnly) {
      countQuery += ` AND (rs.fair_use_throttled = 1 OR rs.fair_use_super_throttled = 1)`;
    }

    const [countError, countResult] = await runQuery(countQuery, countParams);

    if (countError) {
      console.error("Error fetching subscribers count:", countError);
      return res.status(500).json({ error: "Internal server error" });
    }

    const totalSubscribers = countResult[0].total;

    query += ` ORDER BY rs.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [subsError, subsResult] = await runQuery(query, params);

    if (subsError) {
      console.error("Error fetching subscribers:", subsError);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json({
      subscribers: subsResult,
      totalSubscribers,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error in /subscribers endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all clients (username and fullname)
router.get("/clients", async (req, res) => {
  try {
    const query = `SELECT username, fullname, phone FROM radcheck_client`;
    const [error, result] = await runQuery(query);
    if (error) {
      console.error("Error fetching clients:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error in /clients endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Client List for Agents
router.get("/clients-list", async (req, res) => {
  try {
    const query = `
      SELECT 
        rc.*,       
        rs.plan_amount,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y, %h:%i %p') AS subscription_date,
        DATE_FORMAT(rs.start_date, '%d-%m-%Y, %h:%i %p') AS start_date,
        DATE_FORMAT(rs.end_date, '%d-%m-%Y, %h:%i %p') AS end_date
      FROM radcheck_client rc
      LEFT JOIN (
        SELECT 
          username,
          plan_amount,
          payment_date,
          start_date,
          end_date,
          ROW_NUMBER() OVER(PARTITION BY username ORDER BY end_date DESC) as rn
        FROM radcheck_subs
      ) rs ON rc.username = rs.username AND rs.rn = 1
      WHERE rc.role = '0'
      ORDER BY rc.id DESC
    `;
    const [error, result] = await runQuery(query);

    if (error) {
      console.error("Error fetching clients list:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error in /clients-list endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add New Client
router.post("/add-client", async (req, res) => {
  const { value, fullname, gender, phone, email, hostel, room } = req.body;
  const username = phone?.trim();

  if (!username || !value || !fullname || !gender || !phone) {
    return res.status(400).json({
      error: "Phone number, password, fullname, and gender are required",
    });
  }

  if (!PHONE_NUMBER_PATTERN.test(username)) {
    return res.status(400).json({
      error: "Phone number must start with 0 and be exactly 10 digits",
    });
  }

  try {
    // Check if username already exists
    const checkUserQuery = `SELECT username FROM radcheck_client WHERE username = ? OR phone = ? LIMIT 1`;
    const [checkUserError, checkUserResult] = await runQuery(checkUserQuery, [
      username,
      username,
    ]);

    if (checkUserError) {
      console.error("Error checking for existing user:", checkUserError);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (checkUserResult.length > 0) {
      return res.status(409).json({ error: "Phone number already exists" });
    }

    const query = `
      INSERT INTO radcheck_client (username, value, fullname, gender, phone, email, hostel, room)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [error] = await runQuery(query, [
      username,
      value,
      fullname,
      gender,
      username,
      email,
      hostel,
      room,
    ]);

    if (error) {
      console.error("Error adding new client:", error);
      return res.status(500).json({ error: "Failed to add new client" });
    }

    res.status(201).json({ message: "Client added successfully" });
  } catch (error) {
    console.error("Error in /add-client endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all subscription plans
router.get("/subscription-plans", async (req, res) => {
  try {
    const query = `SELECT * FROM subscription_plans`;
    const [error, result] = await runQuery(query);
    if (error) {
      console.error("Error fetching subscription plans:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error in /subscription-plans endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- HOSTEL OWNER CLIENT LIST ---
router.get("/hostel-owner-clients", async (req, res) => {
  const { username, search, hostelId } = req.query;
  try {
    let query = `
      SELECT rc.*, hl.name AS hostel_name
      FROM radcheck_client rc
      JOIN hostel_list hl ON rc.hostel = hl.name
      JOIN user_hostels uh ON hl.id = uh.hostel_id
      WHERE uh.username = ?
    `;
    const params = [username];

    if (hostelId) {
      query += ` AND uh.hostel_id = ?`;
      params.push(hostelId);
    }

    if (search) {
      query += ` AND (rc.fullname LIKE ? OR rc.username LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY rc.fullname ASC`;

    const [err, rows] = await runQuery(query, params);
    if (err) throw err;
    res.json({ code: 1, data: rows });
  } catch (error) {
    res.status(500).json({ code: 2, message: error.message });
  }
});

// --- HOSTEL OWNER ACTIVE SUBSCRIBERS ---
router.get("/hostel-owner-subscribers", async (req, res) => {
  const { username, search, hostelId } = req.query;
  try {
    await ensureAccountingArchiveSchema();
    let query = `
      SELECT 
        rs.id,
        CONCAT(rc.username, ' (', rc.fullname, ')') AS name,
        rc.hostel AS hostel_name,
        rs.plan_amount,
        DATE_FORMAT(rs.start_date, '%d-%m-%Y %h:%i %p') AS start_date,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y %h:%i %p') AS subscription_date,
        DATE_FORMAT(rs.end_date, '%d-%m-%Y %h:%i %p') AS end_date,
        rs.username,
        GREATEST(0, (SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) FROM radacct WHERE username = rs.username) - rs.usage_baseline_bytes) / (1024 * 1024 * 1024) AS used_data_gb
      FROM radcheck_subs rs
      JOIN radcheck_client rc ON rs.username = rc.username
      JOIN hostel_list hl ON rc.hostel = hl.name
      JOIN user_hostels uh ON hl.id = uh.hostel_id
      WHERE uh.username = ? AND rs.plan_status = 0 AND rs.end_date > NOW()
    `;
    const params = [username];

    if (hostelId) {
      query += ` AND uh.hostel_id = ?`;
      params.push(hostelId);
    }

    if (search) {
      query += ` AND (rc.fullname LIKE ? OR rc.username LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY rs.end_date ASC`;

    const [err, rows] = await runQuery(query, params);
    if (err) throw err;
    res.json({ code: 1, data: rows });
  } catch (error) {
    res.status(500).json({ code: 2, message: error.message });
  }
});

// Get all payment methods
router.get("/payment-methods", async (req, res) => {
  try {
    const query = `SELECT * FROM payment_methods`;
    const [error, result] = await runQuery(query);
    if (error) {
      console.error("Error fetching payment methods:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error in /payment-methods endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add New Subscriber
router.post("/add-subscriber", async (req, res) => {
  const {
    username,
    plan_subs,
    plan_amount,
    expire_days,
    reg_by,
    mode_of_payment,
  } = req.body;

  // Basic validation to ensure all required fields from the form are present
  if (
    !username ||
    !plan_subs ||
    !plan_amount ||
    !expire_days ||
    !reg_by ||
    !mode_of_payment
  ) {
    return res.status(400).json({
      error: "One or more required fields are missing for subscription.",
    });
  }

  try {
    // Prepare the details object for the centralized activation function
    const subscriptionDetails = {
      username: username,
      planId: plan_subs,
      planAmount: plan_amount,
      expireDays: expire_days,
      modeOfPayment: mode_of_payment,
      paidTo: reg_by, // Agent is the one paid
    };

    // Call the centralized function to activate the subscription
    const result = await activateSubscription(subscriptionDetails);

    // Respond with the success message from the activation function
    res.status(201).json({ message: result.message });
  } catch (error) {
    // Catch any errors thrown from the activation function
    console.error("Error in /add-subscriber endpoint:", error);
    res.status(500).json({
      error:
        error.message ||
        "An internal server error occurred during subscription.",
    });
  }
});

// Get Revenue Data
router.get("/revenue", async (req, res) => {
  const { userId } = req.query; // Assuming userId is passed as a query parameter

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const revenueQuery = `
      SELECT
        rs.id,
        CONCAT(rc.username, ' (', rc.fullname, ')') AS subscriber_name,
        rs.plan_amount,
        pm.name AS mode_of_payment,
        DATE_FORMAT(rs.payment_date, '%d-%m-%Y, %h:%i %p') AS payment_date,
        DATE_FORMAT(rs.start_date, '%d-%m-%Y, %h:%i %p') AS start_date,
        DATE_FORMAT(rs.end_date, '%d-%m-%Y, %h:%i %p') AS end_date
      FROM radcheck_subs rs
      JOIN radcheck_client rc ON rs.username = rc.username
      JOIN payment_methods pm ON rs.mode_of_payment = pm.id
      WHERE rs.paid_to = ? AND rs.recieved = 0
      ORDER BY rs.id DESC
    `;
    const [revenueError, revenueResult] = await runQuery(revenueQuery, [
      userId,
    ]);

    if (revenueError) {
      console.error("Error fetching revenue data:", revenueError);
      return res.status(500).json({ error: "Internal server error" });
    }

    let totalSubscriptions = 0;
    let totalAmountCollected = 0;
    let totalAmountByMobileMoney = 0;
    let totalAmountByCash = 0;

    revenueResult.forEach((sub) => {
      totalSubscriptions++;
      totalAmountCollected += parseFloat(sub.plan_amount);
      if (sub.mode_of_payment === "Mobile Money") {
        // Assuming 'Mobile Money' is the name for id 2
        totalAmountByMobileMoney += parseFloat(sub.plan_amount);
      } else if (sub.mode_of_payment === "Cash") {
        // Assuming 'Cash' is the name for id 1
        totalAmountByCash += parseFloat(sub.plan_amount);
      }
    });

    res.json({
      subscriptions: revenueResult,
      stats: {
        totalSubscriptions,
        totalAmountCollected,
        totalAmountByMobileMoney,
        totalAmountByCash,
      },
    });
  } catch (error) {
    console.error("Error in /revenue endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Client
router.put("/update-client/:username", async (req, res) => {
  const { username } = req.params;
  const { value, fullname, gender, email, hostel, room } = req.body;

  if (!value || !fullname || !gender) {
    return res
      .status(400)
      .json({ error: "Password, fullname, and gender are required" });
  }

  try {
    await ensureAccountingArchiveSchema();
    const query = `
      UPDATE radcheck_client
      SET value = ?, fullname = ?, gender = ?, email = ?, hostel = ?, room = ?
      WHERE username = ?
    `;
    const [error] = await runQuery(query, [
      value,
      fullname,
      gender,
      email,
      hostel,
      room,
      username,
    ]);

    if (error) {
      console.error("Error updating client:", error);
      return res.status(500).json({ error: "Failed to update client" });
    }

    await runQuery("UPDATE radcheck SET fullname = ? WHERE username = ?", [fullname, username]);
    await runQuery("UPDATE radcheck_subs SET fullname = ? WHERE username = ?", [fullname, username]);

    res.status(200).json({ message: "Client updated successfully" });
  } catch (error) {
    console.error("Error in /update-client endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
