const jwt = require("jsonwebtoken");

const verifyJWT = async (req, res, next) => {
  const token = req.headers["x-access-token"];

  if (!token) {
    return res
      .status(401)
      .json({ auth: false, message: "A token is required for authentication" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "jwt17@3SeCts");

    // Optional: Revocation Check (can be enabled if you have this column)
    // const [err, userRows] = await runQuery(
    //   "SELECT tokens_valid_from FROM user WHERE id = ?",
    //   [decoded.userid]
    // );
    // if (err) {
    //   return res.status(500).json({
    //     auth: false,
    //     message: "Database error during token verification.",
    //   });
    // }
    // if (userRows.length > 0) {
    //   const user = userRows[0];
    //   if (user.tokens_valid_from) {
    //     const tokenIssuedAt = decoded.iat * 1000;
    //     const tokensValidFrom = new Date(user.tokens_valid_from).getTime();
    //     if (tokenIssuedAt < tokensValidFrom) {
    //       return res.status(401).json({
    //         auth: false,
    //         message: "Your session has been revoked. Please log in again.",
    //       });
    //     }
    //   }
    // }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ auth: false, message: "Invalid Token" });
  }
};

module.exports = verifyJWT;
