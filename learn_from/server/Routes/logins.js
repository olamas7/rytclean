const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const cors = require("cors");
const { runQuery } = require("../db");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const { sendSms } = require("../sms");
const crypto = require("crypto");

const PASSWORDLESS_LOGIN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PHONE_NUMBER_PATTERN = /^0\d{9}$/;
const JWT_SECRET = process.env.JWT_SECRET || "kayfi-phone-login-v2-2026";

// Temporary in-memory store for OTPs (In production, use Redis or a database table)
const otpStore = new Map();

router.use(cors());
router.use(express.json());
router.use(bodyParser.urlencoded({ extended: true }));

router.use(
  session({
    key: "userId",
    secret: "subscribes",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: PASSWORDLESS_LOGIN_MAX_AGE_MS,
    },
  }),
);

const verifyJWT = (req, res, next) => {
  const token = req.headers["x-access-token"];

  if (!token) {
    res.send("Send Token To Use Next Time");
  } else {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        res.send({ auth: false, message: "Authentication Failed" });
      } else {
        req.userId = decoded.userId;
        next();
      }
    });
  }
};

router.get("/isUserAuth", verifyJWT, (req, res) => {
  res.send({ user: true });
});

//Getting Login User Session
router.get("/st_logins_ses", (req, res) => {
  if (req.session.user) {
    res.send({ loggedIn: true, user: req.session.user });
  } else {
    res.send({ loggedIn: false });
  }
});

router.post("/auth", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Phone number and password are required.", code: 2 });
  }

  if (!PHONE_NUMBER_PATTERN.test(username)) {
    return res.status(400).json({
      message: "Phone number must start with 0 and be exactly 10 digits.",
      code: 2,
    });
  }

  const sql = `
    SELECT * FROM radcheck_client r    
    WHERE r.username = ? AND r.value = ?
    LIMIT 1
  `;
  const [err, results] = await runQuery(sql, [username, password]);

  if (err) {
    console.error("Database error during login:", err);
    return res.status(500).json({ message: "Server error", code: 2 });
  }

  if (results.length > 0) {
    const user = results[0];
    const token = jwt.sign({ userId: user.username }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      message: "Login successful",
      token,
      expiresInMs: PASSWORDLESS_LOGIN_MAX_AGE_MS,
      username: user.username,
      access: user.role,
      code: 1,
    });
  } else {
    return res.status(401).json({ message: "Invalid credentials", code: 2 });
  }
});

// Get User Profile
router.get("/user-profile/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const query = `SELECT username, fullname, gender, phone, email, hostel, room FROM radcheck_client WHERE username = ?`;
    const [error, result] = await runQuery(query, [username]);

    if (error) {
      console.error("Error fetching user profile:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result[0]);
  } catch (error) {
    console.error("Error in /user-profile endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Change Password
router.post("/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Phone number, old password, and new password are required" });
  }

  try {
    // Verify old password
    const verifyQuery = `SELECT value FROM radcheck_client WHERE username = ?`;
    const [verifyError, verifyResult] = await runQuery(verifyQuery, [username]);

    if (verifyError) {
      console.error("Error verifying old password:", verifyError);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (verifyResult.length === 0 || verifyResult[0].value !== oldPassword) {
      return res.status(401).json({ error: "Invalid old password" });
    }

    // Update password in radcheck_client
    const updateClientQuery = `UPDATE radcheck_client SET value = ? WHERE username = ?`;
    const [updateClientError] = await runQuery(updateClientQuery, [
      newPassword,
      username,
    ]);

    if (updateClientError) {
      console.error(
        "Error updating password in radcheck_client:",
        updateClientError,
      );
      return res
        .status(500)
        .json({ error: "Failed to change password in client table" });
    }

    // Update password in radcheck table for Cleartext-Password attribute
    const updateRadcheckQuery = `UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'`;
    const [updateRadcheckError] = await runQuery(updateRadcheckQuery, [
      newPassword,
      username,
    ]);

    if (updateRadcheckError) {
      console.error(
        "Error updating password in radcheck:",
        updateRadcheckError,
      );
      return res
        .status(500)
        .json({ error: "Failed to change password in radcheck table" });
    }

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error in /change-password endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update User Profile
router.put("/update-profile/:username", async (req, res) => {
  const { username } = req.params;
  const { fullname, gender, email, hostel, room } = req.body;

  if (!fullname || !gender || !email || !hostel) {
    return res.status(400).json({
      error: "Full name, gender, email, and hostel are required",
    });
  }

  try {
    const query = `
      UPDATE radcheck_client
      SET fullname = ?, gender = ?, email = ?, hostel = ?, room = ?
      WHERE username = ?
    `;
    const [error] = await runQuery(query, [
      fullname,
      gender,
      email,
      hostel,
      room,
      username,
    ]);

    if (error) {
      console.error("Error updating user profile:", error);
      return res.status(500).json({ error: "Failed to update user profile" });
    }

    await runQuery("UPDATE radcheck SET fullname = ? WHERE username = ?", [fullname, username]);
    await runQuery("UPDATE radcheck_subs SET fullname = ? WHERE username = ?", [fullname, username]);

    res.status(200).json({ message: "Profile updated successfully", username });
  } catch (error) {
    console.error("Error in /update-profile endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  const { password, fullname, gender, phone, email, hostel, room } = req.body;
  const username = phone?.trim();

  if (
    !password ||
    !fullname ||
    !gender ||
    !phone ||
    !email ||
    !hostel
  ) {
    return res
      .status(400)
      .json({ message: "All required fields must be filled.", code: 2 });
  }

  if (!PHONE_NUMBER_PATTERN.test(username)) {
    return res.status(400).json({
      message: "Phone number must start with 0 and be exactly 10 digits.",
      code: 2,
    });
  }

  // Check if user already exists
  const [userExistError, userExist] = await runQuery(
    "SELECT username FROM radcheck_client WHERE username = ? OR phone = ? LIMIT 1",
    [username, username],
  );

  if (userExistError) {
    console.error("Database error during user check:", userExistError);
    return res
      .status(500)
      .json({ message: "Server error checking user.", code: 2 });
  }

  if (userExist.length > 0) {
    return res.status(409).json({
      message: "Phone number already exists. Please use a different one.",
      code: 2,
    });
  }

  const sql = `
    INSERT INTO radcheck_client (username, value, fullname, gender, phone, email, hostel, room, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '0')
  `;
  const [err, results] = await runQuery(sql, [
    username,
    password,
    fullname,
    gender,
    username,
    email,
    hostel,
    room,
  ]);

  if (err) {
    console.error("Database error during registration:", err);
    return res
      .status(500)
      .json({ message: "Server error during registration.", code: 2 });
  }

  res
    .status(201)
    .json({ message: "Registration successful! You can now log in.", code: 1 });
});

router.get("/hostels", async (req, res) => {
  const [err, rows] = await runQuery(
    "SELECT `id`, `name` FROM `hostel_list` ORDER by name ASC",
  );
  if (err) {
    console.error("Error fetching hostels:", err);
    return res.status(500).json({ code: 2, message: "Error fetching hostels" });
  }
  res.json({ code: 1, data: rows });
});

// --- PASSWORD RESET ENDPOINTS ---

// 1. Request OTP
router.post("/forgot-password", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ code: 2, message: "Phone number is required." });
  }

  try {
    // Check if user exists and get their phone number
    const [err, results] = await runQuery(
      "SELECT phone, fullname FROM radcheck_client WHERE username = ?",
      [username],
    );

    if (err) throw err;
    if (results.length === 0) {
      return res.status(404).json({ code: 2, message: "User not found." });
    }

    const { phone, fullname } = results[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    // Store OTP
    otpStore.set(username, { otp, expires });

    // Send SMS
    const message = `Hello ${fullname}, your OTP for password reset is: ${otp}. It expires in 10 minutes. KayFi Wifi.`;
    await sendSms(phone, message);

    res.json({ code: 1, message: "OTP sent to your registered phone number." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ code: 2, message: "Failed to process request." });
  }
});

// 2. Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { username, otp } = req.body;

  if (!username || !otp) {
    return res.status(400).json({ code: 2, message: "Phone number and OTP are required." });
  }

  const storedData = otpStore.get(username);

  if (!storedData) {
    return res.status(400).json({ code: 2, message: "No OTP request found for this user." });
  }

  if (Date.now() > storedData.expires) {
    otpStore.delete(username);
    return res.status(400).json({ code: 2, message: "OTP has expired." });
  }

  if (storedData.otp !== otp) {
    return res.status(400).json({ code: 2, message: "Invalid OTP code." });
  }

  // OTP is valid. Flag it as verified (in a real app, you might use a signed token for next step)
  otpStore.set(username, { ...storedData, verified: true });

  res.json({ code: 1, message: "OTP verified successfully." });
});

// 3. Reset Password
router.post("/reset-password", async (req, res) => {
  const { username, otp, newPassword } = req.body;

  if (!username || !otp || !newPassword) {
    return res.status(400).json({ code: 2, message: "All fields are required." });
  }

  const storedData = otpStore.get(username);

  if (!storedData || storedData.otp !== otp || !storedData.verified) {
    return res.status(400).json({ code: 2, message: "Session invalid or OTP not verified." });
  }

  try {
    // 1. Update radcheck_client
    const [err1] = await runQuery(
      "UPDATE radcheck_client SET value = ? WHERE username = ?",
      [newPassword, username]
    );
    if (err1) throw err1;

    // 2. Update radcheck (RADIUS)
    const [err2] = await runQuery(
      "UPDATE radcheck SET value = ? WHERE username = ? AND attribute = 'Cleartext-Password'",
      [newPassword, username]
    );
    if (err2) {
      console.warn("Note: radcheck table update failed (may not exist for this user yet).", err2.message);
    }

    // Clean up
    otpStore.delete(username);

    res.json({ code: 1, message: "Password reset successfully. You can now login." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ code: 2, message: "Failed to reset password." });
  }
});

module.exports = router;
