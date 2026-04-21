const express = require("express");
const router = express.Router();
const { runQuery, logActivity } = require("../db");
const jwt = require("jsonwebtoken");
const verifyJWT = require("../middleware/verifyJWT");

router.get("/isUserAuth", verifyJWT, (req, res) => {
  res.json({ code: 1, user: true });
});

router.post("/", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({
      code: 2,
      message: "Username and password are required.",
    });
  }

  try {
    const [err, userRows] = await runQuery(
      "SELECT * FROM users WHERE username = ? AND status = 1",
      [username]
    );

    if (err) {
      return res.json({ message: "Server error", code: 2 });
    }

    if (userRows.length === 0) {
      return res.json({ message: "Invalid Username or password.", code: 2 });
    }

    const user = userRows[0];

    if (user.password !== password) {
      return res.json({ message: "Invalid Username or password.", code: 2 });
    }

    const userPayload = {
      user_id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role, 
    };

    const token = jwt.sign(
      userPayload,
      process.env.JWT_SECRET || "jwt17@3SeCts",
      {
        expiresIn: "24h",
      }
    );

    delete user.password;

    await logActivity(user.id, "LOGIN", "Logged into system", req.ip);

    return res.json({
      message: "Login successful",
      token,
      user,
      code: 1,
    });
  } catch (error) {
    res.status(500).json({ message: "An unexpected error occurred", code: 2 });
  }
});

router.get("/my-permissions", verifyJWT, (req, res) => {
  if (req.user) {
    let permissions = [];
    
    if (req.user.role === 'Super Admin' || req.user.role === 'Admin') {
      permissions = ['admin', 'dashboard-home'];
    } else {
      permissions = ['dashboard-home'];
    }
    
    res.json({
      code: 1,
      permissions: permissions, 
      user_id: req.user.user_id,
      role: req.user.role,
      fullname: req.user.fullname
    });
  } else {
    res.status(401).json({ code: 2, message: "Authentication error." });
  }
});

module.exports = router;
