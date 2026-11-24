# Gemini Project Configuration (Server)

This file helps Gemini understand the server-side of your project's specific conventions and configurations.
Lets stick with post request method

## Project Overview

This is the Node.js and Express.js backend for the KayFi wifi management application. It handles API requests from the client, interacts with a MySQL database to manage data for subscribers and agents, handles user authentication, and provides real-time updates using WebSockets (Socket.IO).

## Conventions & Style

- **Framework:** The server is built with Express.js.
- **Database Interaction:** All database queries are performed using the `mysql2/promise` library. A central `runQuery` utility (`server/runQuery.js`) is used to execute all SQL queries. This function uses `async/await` and returns results in a `[error, rows]` tuple format.
- **API Design:**
  - Routes are modularized and located in the `server/Routes/` directory.
  - Responses are consistently structured as JSON objects, including a `code` (1 for success, 2 for failure) and a `message` string. Data is typically returned under a `data` key.
- **Asynchronous Code:** `async/await` is used for all asynchronous operations, especially for database interactions.
- **Real-time Functionality:** Socket.IO is used for real-time communication with the client (e.g., live vote casting). The setup is in `server/Routes/General/live_socket.js`.
- **Dependencies:** Key libraries include `express`, `mysql2`, `cors`, `body-parser`, `jsonwebtoken`, and `socket.io`.

### Common Database Interaction Patterns

Here are examples of common database interaction patterns used in this project:

#### 1. Search and Pagination

This pattern is used to fetch a subset of data based on search criteria and pagination parameters.

**Example (`server/Routes/General/admins.js` - `/get_admin_students`):**

```javascript
router.post("/get_admin_students", async (req, res) => {
  const { search = "", page = 1, rowsPerPage = 20 } = req.body;
  const offset = (page - 1) * rowsPerPage;

  let where = "WHERE s.admin = 1";
  const params = [];

  if (search) {
    where += ` AND (
      s.index_number LIKE ? OR
      s.fullname LIKE ? OR
      s.program LIKE ?
    )`;
    const likeSearch = `%${search}%`;
    params.push(likeSearch, likeSearch, likeSearch);
  }

  // Get data
  const [err1, rows] = await runQuery(
    `SELECT s.*, CONCAT_WS(' ', s.first_name, s.surname, s.other_name) AS names
     FROM vt_students AS s
     ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, rowsPerPage, offset],
  );

  if (err1) return res.json({ code: 2, message: "Failed to fetch students" });

  // Get count
  const [err2, countRows] = await runQuery(
    `SELECT COUNT(*) AS total FROM vt_students AS s ${where}`,
    params,
  );

  if (err2) return res.json({ code: 2, message: "Failed to fetch count" });

  return res.json({
    code: 1,
    data: rows,
    total: countRows[0]?.total || 0,
  });
});
```

#### 2. Sending a List to Dropdowns

This pattern fetches a list of items, often transforming them into a `label`/`value` (or `id`/`label`) format suitable for client-side dropdowns or select components.

**Example (`server/Routes/General/admins.js` - `/programs_list`):**

```javascript
router.post("/programs_list", async (req, res) => {
  const [err, rows] = await runQuery(
    `SELECT * FROM vt_programs ORDER BY prog_name ASC`,
    [],
  );
  if (err) return res.json({ code: 2, message: err.message });
  const list = rows.map((row) => ({
    id: row.id,
    label: row.prog_name,
    prog_code: row.prog_code,
  }));
  return res.json(list);
});
```

#### 3. Insert Operation

Adding new records to the database.

**Example (`server/Routes/General/admins.js` - `/add_admins_program`):**

```javascript
router.post("/add_admins_program", async (req, res) => {
  const { admin_id, prog_code } = req.body;
  const [err] = await runQuery(
    "INSERT INTO `vt_admins_programs` (`admin_id`, `prog_code`) VALUES (?, ?)",
    [admin_id, prog_code],
  );
  if (err) return res.json({ code: 2, message: err.message });
  res.json({ code: 1, message: "Program added" });
});
```

#### 4. Update Operation

Modifying existing records in the database.

**Example (`server/Routes/General/admins.js` - `/update_student_admin`):**

```javascript
router.post("/update_student_admin", async (req, res) => {
  const { index_number, password, roles, category } = req.body;
  const roleCodes = Array.isArray(roles)
    ? roles.map((r) => r.role_code).join(",")
    : "";
  const categoryCodes = Array.isArray(category)
    ? category.map((r) => r.cat_code).join(",")
    : "";

  const [err] = await runQuery(
    `UPDATE vt_students
     SET admin = 1,
         password = ?,
         roles = ?,
         category = ?
     WHERE index_number = ?`,
    [password, roleCodes, categoryCodes, index_number],
  );
  if (err) return res.json({ code: 2, message: err.message });
  res.json({ code: 1, message: "Student admin settings updated" });
});
```

#### 5. Delete Operation

Removing records from the database.

**Example (`server/Routes/General/admins.js` - `/delete_admins_program`):**

```javascript
router.post("/delete_admins_program", async (req, res) => {
  const { idx } = req.body;
  const [err] = await runQuery(`DELETE FROM vt_admins_programs WHERE id = ?`, [
    idx,
  ]);
  if (err) return res.json({ code: 2, message: err.message });
  res.json({ code: 1, message: "Program removed" });
});
```

#### 6. Transaction Pattern

While not explicitly used with `BEGIN`/`COMMIT`/`ROLLBACK` in the provided routes, the `mysql2/promise` library supports transactions for atomic operations. This is crucial when multiple database operations must succeed or fail together.

**Hypothetical Example (using `db_new` from `server/db.js`):**

```javascript
const { db_new } = require("../../db"); // Assuming this is how you'd import db_new

router.post("/perform_transaction", async (req, res) => {
  let connection;
  try {
    connection = await db_new.getConnection(); // Get a connection from the pool
    await connection.beginTransaction(); // Start the transaction

    // First operation
    const [result1] = await connection.execute(
      "INSERT INTO table1 (col1, col2) VALUES (?, ?)",
      ["value1", "value2"],
    );

    // Second operation (depends on the first)
    const [result2] = await connection.execute(
      "UPDATE table2 SET colA = ? WHERE colB = ?",
      ["newValue", result1.insertId], // Using insertId from first operation
    );

    await connection.commit(); // Commit the transaction if all operations succeed
    res.json({ code: 1, message: "Transaction completed successfully" });
  } catch (error) {
    if (connection) {
      await connection.rollback(); // Rollback if any operation fails
    }
    console.error("Transaction failed:", error);
    res.json({ code: 2, message: "Transaction failed: " + error.message });
  } finally {
    if (connection) {
      connection.release(); // Release the connection back to the pool
    }
  }
});
```

## Important Files

- `server/index.js`: The main server entry point. It initializes the Express app, sets up middleware, and mounts the API routes.
- `server/db.js`: Configures and exports the MySQL database connection pool using `mysql2/promise`.
- `server/runQuery.js`: A crucial utility that provides a consistent, promise-based wrapper for executing all database queries.
- `server/Routes/`: This directory contains all the application's API endpoint definitions, separated by functionality.

## Commands

- **Install Dependencies:** `npm install`
- **Run Server (Development):** `npm run devStart`
- **Run Server (Production):** `npm start`
- **Run Tests:** `npm test` (Note: The test script is currently a placeholder).

## send SMS via SMSOnlineGH

```javascript
const host = "api.smsonlinegh.com";
const endPoint = `http://${host}/v5/message/sms/send`;
const msgData = {
  text: `Your AAMUSTED Vote OTP: ${otp}. Please DO NOT Share This Code With Anyone.`,
  type: 0, // GSM default
  sender: "KayFi Wifi", // or your sender ID
  destinations: [phone],
};

axios
  .request({
    method: "POST",
    url: endPoint,
    data: msgData,
    headers: {
      Host: host,
      "Content-Type": "application/json",
      Accept: "application/json",
      // replace with your real key or env var
      Authorization:
        "key 19788c3c7b9c3497e49ef44815198f37f47a6418ce0e18653305ccbb8c5408b1",
    },
  })
  .then((response) => {
    if (response.status === 200) {
      return res.json({ message: "OTP Sent Successfully", code: 1 });
    }
    console.error("SMS API non-200:", response.status, response.data);
    res.json({ message: "SMS service error", code: 2 });
  })
  .catch((smsErr) => {
    console.error("SMS API error:", smsErr.stack);
    res.json({ message: "Failed to send SMS", code: 2 });
  });
```

## Database Table

-- Database: `radius`

## -- Table structure for table `radacct`

CREATE TABLE `radacct` (
`radacctid` bigint(21) NOT NULL,
`acctsessionid` varchar(64) NOT NULL DEFAULT '',
`acctuniqueid` varchar(32) NOT NULL DEFAULT '',
`username` varchar(64) NOT NULL DEFAULT '',
`groupname` varchar(64) NOT NULL DEFAULT '',
`realm` varchar(64) DEFAULT '',
`nasipaddress` varchar(15) NOT NULL DEFAULT '',
`nasportid` varchar(15) DEFAULT NULL,
`nasporttype` varchar(32) DEFAULT NULL,
`acctstarttime` datetime DEFAULT NULL,
`acctstoptime` datetime DEFAULT NULL,
`acctsessiontime` int(12) UNSIGNED DEFAULT NULL,
`acctauthentic` varchar(32) DEFAULT NULL,
`connectinfo_start` varchar(50) DEFAULT NULL,
`connectinfo_stop` varchar(50) DEFAULT NULL,
`acctinputoctets` bigint(20) DEFAULT NULL,
`acctoutputoctets` bigint(20) DEFAULT NULL,
`calledstationid` varchar(50) NOT NULL DEFAULT '',
`callingstationid` varchar(50) NOT NULL DEFAULT '',
`acctterminatecause` varchar(32) NOT NULL DEFAULT '',
`servicetype` varchar(32) DEFAULT NULL,
`framedprotocol` varchar(32) DEFAULT NULL,
`framedipaddress` varchar(15) NOT NULL DEFAULT '',
`acctstartdelay` int(12) UNSIGNED DEFAULT NULL,
`acctstopdelay` int(12) UNSIGNED DEFAULT NULL,
`xascendsessionsvrkey` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

---

--
-- Table structure for table `radcheck`
--

CREATE TABLE `radcheck` (
`id` int UNSIGNED NOT NULL,
`username` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
`attribute` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Cleartext-Password',
`op` char(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT ':=',
`value` varchar(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
`expires_at` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
`time_1` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
`subscribed_data` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
`plan_id` int DEFAULT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

---

--
-- Table structure for table `radcheck_client`
--

CREATE TABLE `radcheck_client` (
`id` int(10) UNSIGNED NOT NULL,
`username` varchar(64) NOT NULL DEFAULT '',
`attribute` varchar(64) NOT NULL DEFAULT 'Cleartext-Password',
`op` char(2) NOT NULL DEFAULT ':=',
`value` varchar(253) NOT NULL DEFAULT '',
`expired` varchar(10) NOT NULL DEFAULT '0',
`fullname` varchar(150) DEFAULT NULL,
`gender` varchar(10) DEFAULT NULL,
`phone` varchar(20) DEFAULT NULL,
`email` varchar(250) DEFAULT NULL,
`hostel` varchar(50) DEFAULT NULL,
`room` varchar(20) DEFAULT NULL,
`time_1` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
`role` varchar(20) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

---

--
-- Table structure for table `radcheck_subs`
--

CREATE TABLE `radcheck_subs` (
`id` int(10) UNSIGNED NOT NULL,
`username` varchar(64) NOT NULL DEFAULT '',
`plan_subs` varchar(253) NOT NULL DEFAULT '',
`plan_amount` double NOT NULL DEFAULT 0,
`start_date` varchar(50) DEFAULT NULL,
`end_date` varchar(50) DEFAULT NULL,
`plan_data` double DEFAULT 0,
`reg_by` varchar(250) DEFAULT NULL,
`amount_paid` double DEFAULT 0,
`pay_status` int(11) DEFAULT 0,
`time_1` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
`mode_of_payment` int(11) NOT NULL DEFAULT 0,
`mode_of_pay` int(11) NOT NULL,
`paid_to` int(11) NOT NULL,
`payment_date` varchar(50) NOT NULL,
`plan_status` int(11) NOT NULL DEFAULT 0,
`recieved` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

---

--
-- Table structure for table `radreply`
--

CREATE TABLE `radreply` (
`id` int(11) UNSIGNED NOT NULL,
`username` varchar(64) NOT NULL DEFAULT '',
`attribute` varchar(64) NOT NULL DEFAULT '',
`op` char(2) NOT NULL DEFAULT '=',
`value` varchar(253) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

---

CREATE TABLE `subscription_plans` (
`id` int(11) NOT NULL,
`plan_name` varchar(220) NOT NULL,
`data_limit` varchar(50) NOT NULL,
`amount` varchar(50) NOT NULL,
`expire_days` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

---

CREATE TABLE `payment_methods` (
`id` int(11) NOT NULL,
`name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

---

--
-- Table structure for table `payment_status`

CREATE TABLE `payment_status` (
`id` int(11) NOT NULL,
`name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
