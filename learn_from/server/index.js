require("dotenv").config();
const express = require("express");
//const app = express();

const http = require("http");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json({
  verify: (req, res, buffer) => {
    // Meta signs the raw bytes, not the parsed JSON representation.
    if (req.originalUrl.split("?")[0] === "/api/v1/whatsapp/webhook") {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(bodyParser.urlencoded({ extended: true }));

const logins = require("./Routes/logins");
const wifi = require("./Routes/wifi");
const agents = require("./Routes/General/agents");
const admin = require("./Routes/General/admins");
const captiveLogin = require("./Routes/captiveLogin");
const whatsapp = require("./Routes/whatsapp");
const ussd = require("./Routes/ussd");

app.use(express.static("images"));
app.use(express.static(path.join(__dirname, "..", "captive_portal")));

app.use("/login", logins);
app.use("/captive-login", captiveLogin);
app.use("/api/wifi", wifi);
app.use("/api/agents", agents);
app.use("/api/admins", admin);
app.use("/api/v1/whatsapp", whatsapp);
app.use("/api", ussd);

io.on("connection", agents);

// Initialize and start the scheduler
require("./scheduler");

server.listen(3005, () => {
  console.log("Server is Online");
});
