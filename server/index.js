require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const logins = require("./Routes/logins");
const adminSetup = require("./Routes/adminSetup");

const apiRoutes = express.Router();

apiRoutes.use(express.static("images"));

apiRoutes.use("/login", logins);
apiRoutes.use("/admin", adminSetup);

app.use("/api", apiRoutes);

server.listen(3101, () => {
  console.log("Server is Online on port 3101");
});
