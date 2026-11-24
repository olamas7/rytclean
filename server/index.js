require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);

app.use(cors());
// Signature verification must see the exact request bytes, before JSON parsing.
app.post('/api/customer-payments/webhook', express.raw({ type: 'application/json', limit: '256kb' }), require('./Routes/customerPayments').webhook);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const logins = require("./Routes/logins");
const adminSetup = require("./Routes/adminSetup");
const verifyJWT = require('./middleware/verifyJWT');
const billing = require('./Routes/billing');
const { startBillingScheduler } = require('./services/billingAccounts');
const { startSmsScheduler } = require('./services/smsNotifications');

const apiRoutes = express.Router();

apiRoutes.use(express.static("images"));

apiRoutes.use("/login", logins);
apiRoutes.use("/admin", adminSetup);
apiRoutes.use('/billing', verifyJWT, billing);
apiRoutes.use('/sms', verifyJWT, require('./Routes/smsNotifications'));
apiRoutes.use('/fleet', verifyJWT, require('./Routes/fleet'));
apiRoutes.use('/customer-payments', require('./Routes/customerPayments'));

app.use("/api", apiRoutes);
startBillingScheduler();
startSmsScheduler();
require('./services/customerPayments').startPaymentScheduler();

server.listen(3101, () => {
  console.log("Server is Online on port 3101");
});
