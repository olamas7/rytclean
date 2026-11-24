const express = require("express");
const router = express.Router();
const { runQuery } = require("../db");
const verifyJWT = require("../middleware/verifyJWT");

router.use(verifyJWT);
router.use(require("./customers"));
router.use(require("./clientCategories"));
router.use(require("./plans"));
router.use(require("./billingSettings"));
router.use(require("./smsSettings"));
router.use((req, res, next) => {
  if (
    req.method !== "GET" &&
    /^\/(zones|routes|drivers|assignments)(\/|$)/.test(req.path) &&
    !["Admin", "Super Admin", "Manager"].includes(req.user?.role)
  )
    return res
      .status(403)
      .json({ code: 2, message: "Manager access is required." });
  if (
    req.method !== "GET" &&
    /^\/users(\/|$)/.test(req.path) &&
    !["Admin", "Super Admin"].includes(req.user?.role)
  )
    return res
      .status(403)
      .json({ code: 2, message: "Administrator access is required." });
  next();
});

const VALID_WORK_TITLES = [
  "admin",
  "driver",
  "supervisor",
  "accountant",
  "support",
  "other",
];

const ROLE_BY_WORK_TITLE = {
  admin: "Admin",
  driver: "Driver",
  supervisor: "Supervisor",
  accountant: "Accountant",
  support: "Support",
  other: "Staff",
};

router.get("/users", async (req, res) => {
  const workTitle = String(req.query.workTitle || "").toLowerCase();
  const withoutDriver = String(req.query.withoutDriver || "") === "1";

  if (workTitle && !VALID_WORK_TITLES.includes(workTitle)) {
    return res.json({ code: 2, message: "Invalid work title filter." });
  }

  const whereParts = [];
  const params = [];

  if (workTitle) {
    if (workTitle === "driver")
      whereParts.push("u.work_title IN ('driver','supervisor')");
    else {
      whereParts.push("u.work_title = ?");
      params.push(workTitle);
    }
  }

  if (withoutDriver) {
    whereParts.push("d.id IS NULL");
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [err, rows] = await runQuery(
    `
      SELECT
        u.id,
        u.fullname,
        u.username,
        u.role,
        u.work_title AS workTitle,
        u.status,
        u.created_at,
        u.updated_at,
        d.driver_code AS driverCode,
        d.phone,
        d.vehicle_number AS vehicleNumber,
        d.zone_id AS zoneId,
        z.zone_code AS zoneCode,
        z.name AS zoneName,
        d.status AS driverStatus
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      LEFT JOIN zones z ON z.id = d.zone_id
      ${where}
      ORDER BY u.created_at DESC
    `,
    params,
  );

  if (err) {
    return res.status(500).json({ code: 2, message: "Unable to load users." });
  }

  return res.json({ code: 1, data: rows, message: "Users loaded." });
});

router.post("/users", async (req, res) => {
  const { fullname, username, password, workTitle, status = 1 } = req.body;

  const normalizedWorkTitle =
    String(workTitle || "").toLowerCase() === "supervisor"
      ? "driver"
      : String(workTitle || "").toLowerCase();
  const normalizedStatus = Number(status) ? 1 : 0;

  if (!fullname || !username || !password || !normalizedWorkTitle) {
    return res.json({
      code: 2,
      message: "Full name, username, password, and work title are required.",
    });
  }

  if (!VALID_WORK_TITLES.includes(normalizedWorkTitle)) {
    return res.json({ code: 2, message: "Invalid work title selected." });
  }

  const [insertUserErr, userResult] = await runQuery(
    `
      INSERT INTO users (fullname, username, password, role, work_title, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      fullname.trim(),
      username.trim(),
      password,
      ROLE_BY_WORK_TITLE[normalizedWorkTitle],
      normalizedWorkTitle,
      normalizedStatus,
    ],
  );

  if (insertUserErr) {
    if (insertUserErr.code === "ER_DUP_ENTRY") {
      return res.json({ code: 2, message: "Username already exists." });
    }
    return res.status(500).json({ code: 2, message: "Unable to create user." });
  }

  return res.json({
    code: 1,
    data: { id: userResult.insertId },
    message: "User created successfully.",
  });
});

router.patch("/users/:id", async (req, res) => {
  const userId = Number(req.params.id);
  const { fullname, username, workTitle, status } = req.body;
  const normalizedWorkTitle =
    String(workTitle || "").toLowerCase() === "supervisor"
      ? "driver"
      : String(workTitle || "").toLowerCase();
  const normalizedStatus = Number(status) ? 1 : 0;

  if (!userId) {
    return res.json({ code: 2, message: "Invalid user selected." });
  }

  if (!fullname || !username || !normalizedWorkTitle) {
    return res.json({
      code: 2,
      message: "Full name, username, and work title are required.",
    });
  }

  if (!VALID_WORK_TITLES.includes(normalizedWorkTitle)) {
    return res.json({ code: 2, message: "Invalid work title selected." });
  }

  const [existingErr, existingRows] = await runQuery(
    `
      SELECT u.id, u.work_title, d.id AS driverProfileId
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (existingErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate user." });
  }
  if (!existingRows.length) {
    return res.json({ code: 2, message: "Selected user does not exist." });
  }

  const existing = existingRows[0];
  if (
    existing.driverProfileId &&
    ["driver", "supervisor"].includes(existing.work_title) &&
    normalizedWorkTitle !== "driver"
  ) {
    return res.json({
      code: 2,
      message:
        "This user has a driver profile. Update/remove driver profile before changing work title.",
    });
  }

  const [updateErr] = await runQuery(
    `
      UPDATE users
      SET fullname = ?, username = ?, role = ?, work_title = ?, status = ?
      WHERE id = ?
    `,
    [
      fullname.trim(),
      username.trim(),
      ROLE_BY_WORK_TITLE[normalizedWorkTitle],
      normalizedWorkTitle,
      normalizedStatus,
      userId,
    ],
  );

  if (updateErr) {
    if (updateErr.code === "ER_DUP_ENTRY") {
      return res.json({ code: 2, message: "Username already exists." });
    }
    return res.status(500).json({ code: 2, message: "Unable to update user." });
  }

  return res.json({
    code: 1,
    data: null,
    message: "User updated successfully.",
  });
});

router.get("/zones", async (req, res) => {
  const [err, rows] = await runQuery(
    `
      SELECT id, zone_code, name, city, coverage_area, status, boundary_geojson, center_lat, center_lng, created_at, updated_at
      FROM zones
      ORDER BY created_at DESC
    `,
  );

  if (err) {
    return res.status(500).json({ code: 2, message: "Unable to load zones." });
  }

  return res.json({ code: 1, data: rows, message: "Zones loaded." });
});

router.post("/zones", async (req, res) => {
  const {
    zoneCode,
    name,
    city,
    coverageArea = "",
    status = "active",
    boundaryGeoJson = null,
  } = req.body;

  if (!zoneCode || !name || !city) {
    return res.json({
      code: 2,
      message: "Zone code, name, and city are required.",
    });
  }

  if (
    !boundaryGeoJson ||
    boundaryGeoJson.type !== "Polygon" ||
    !Array.isArray(boundaryGeoJson.coordinates)
  ) {
    return res.json({ code: 2, message: "Zone boundary polygon is required." });
  }

  const ring = boundaryGeoJson.coordinates[0] || [];
  if (!Array.isArray(ring) || ring.length < 4) {
    return res.json({
      code: 2,
      message: "Zone boundary must have at least 3 points.",
    });
  }

  const points = ring.slice(0, -1);
  if (points.length < 3) {
    return res.json({
      code: 2,
      message: "Zone boundary must have at least 3 unique points.",
    });
  }

  const center = points.reduce(
    (acc, point) => {
      const [lng, lat] = point;
      return {
        lat: acc.lat + Number(lat),
        lng: acc.lng + Number(lng),
      };
    },
    { lat: 0, lng: 0 },
  );
  const centerLat = center.lat / points.length;
  const centerLng = center.lng / points.length;

  if (!["active", "inactive"].includes(String(status).toLowerCase())) {
    return res.json({
      code: 2,
      message: "Zone status must be active or inactive.",
    });
  }

  const [insertErr] = await runQuery(
    `
      INSERT INTO zones (zone_code, name, city, coverage_area, status, boundary_geojson, center_lat, center_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      zoneCode.trim(),
      name.trim(),
      city.trim(),
      coverageArea.trim(),
      status.toLowerCase(),
      JSON.stringify(boundaryGeoJson),
      centerLat,
      centerLng,
    ],
  );

  if (insertErr) {
    if (insertErr.code === "ER_DUP_ENTRY") {
      return res.json({ code: 2, message: "Zone code already exists." });
    }
    return res.status(500).json({ code: 2, message: "Unable to create zone." });
  }

  return res.json({
    code: 1,
    data: null,
    message: "Zone created successfully.",
  });
});

router.get("/routes", async (req, res) => {
  const [err, rows] = await runQuery(
    `
      SELECT
        cr.id,
        cr.route_code,
        cr.route_name,
        cr.zone_id,
        z.zone_code,
        z.name AS zone_name,
        cr.start_point,
        cr.end_point,
        cr.estimated_duration_mins,
        cr.status,
        cr.route_geojson,
        cr.start_lat,
        cr.start_lng,
        cr.end_lat,
        cr.end_lng,
        cr.created_at,
        cr.updated_at
      FROM collection_routes cr
      JOIN zones z ON z.id = cr.zone_id
      ORDER BY cr.created_at DESC
    `,
  );

  if (err) {
    return res.status(500).json({ code: 2, message: "Unable to load routes." });
  }

  return res.json({ code: 1, data: rows, message: "Routes loaded." });
});

router.post("/routes", async (req, res) => {
  const {
    routeCode,
    routeName,
    zoneId,
    startPoint,
    endPoint,
    estimatedDurationMins,
    status = "active",
    notes = "",
    routeGeoJson = null,
  } = req.body;

  if (
    !routeCode ||
    !routeName ||
    !zoneId ||
    !startPoint ||
    !endPoint ||
    !estimatedDurationMins
  ) {
    return res.json({
      code: 2,
      message:
        "Route code, name, zone, start/end points, and duration are required.",
    });
  }

  if (!["active", "inactive", "draft"].includes(String(status).toLowerCase())) {
    return res.json({
      code: 2,
      message: "Route status must be active, inactive, or draft.",
    });
  }

  const duration = Number(estimatedDurationMins);
  if (!Number.isFinite(duration) || duration <= 0) {
    return res.json({
      code: 2,
      message: "Estimated duration must be a positive number.",
    });
  }

  if (
    !routeGeoJson ||
    routeGeoJson.type !== "LineString" ||
    !Array.isArray(routeGeoJson.coordinates) ||
    routeGeoJson.coordinates.length < 2
  ) {
    return res.json({
      code: 2,
      message: "Route path line with at least 2 points is required.",
    });
  }

  const [startLng, startLat] = routeGeoJson.coordinates[0];
  const [endLng, endLat] =
    routeGeoJson.coordinates[routeGeoJson.coordinates.length - 1];

  const [zoneErr, zoneRows] = await runQuery(
    "SELECT id FROM zones WHERE id = ?",
    [zoneId],
  );
  if (zoneErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate zone." });
  }
  if (!zoneRows.length) {
    return res.json({ code: 2, message: "Selected zone does not exist." });
  }

  const [insertErr] = await runQuery(
    `
      INSERT INTO collection_routes
      (route_code, route_name, zone_id, start_point, end_point, estimated_duration_mins, status, notes, route_geojson, start_lat, start_lng, end_lat, end_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      routeCode.trim(),
      routeName.trim(),
      zoneId,
      startPoint.trim(),
      endPoint.trim(),
      duration,
      status.toLowerCase(),
      notes.trim(),
      JSON.stringify(routeGeoJson),
      Number(startLat),
      Number(startLng),
      Number(endLat),
      Number(endLng),
    ],
  );

  if (insertErr) {
    if (insertErr.code === "ER_DUP_ENTRY") {
      return res.json({ code: 2, message: "Route code already exists." });
    }
    return res
      .status(500)
      .json({ code: 2, message: "Unable to create route." });
  }

  return res.json({
    code: 1,
    data: null,
    message: "Route created successfully.",
  });
});

router.get("/drivers", async (req, res) => {
  const [err, rows] = await runQuery(
    `
      SELECT
        d.id AS dbId,
        d.driver_code AS id,
        d.user_id AS userId,
        d.full_name AS fullName,
        d.phone,
        d.vehicle_number AS vehicleNumber,
        d.zone_id AS zoneId,
        z.zone_code AS zoneCode,
        z.name AS zoneName,
        d.status,
        d.completion_rate AS completionRate,
        u.status AS userStatus,
        d.created_at,
        d.updated_at
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN zones z ON z.id = d.zone_id
      WHERE u.work_title IN ('driver','supervisor')
      ORDER BY d.created_at DESC
    `,
  );

  if (err) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to load drivers." });
  }

  return res.json({ code: 1, data: rows, message: "Drivers loaded." });
});

router.post("/drivers", async (req, res) => {
  const {
    userId,
    driverCode,
    phone,
    vehicleNumber = "",
    zoneId,
    status = "available",
  } = req.body;

  if (!userId || !driverCode || !phone || !zoneId) {
    return res.json({
      code: 2,
      message:
        "Driver user, driver code, phone, and zone are required. Vehicles are assigned per route.",
    });
  }

  if (
    !/^\d{10}$/.test(String(phone)) ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(String(driverCode))
  )
    return res
      .status(400)
      .json({
        code: 2,
        message:
          "Use a ten-digit phone and driver code of up to 40 letters, numbers, hyphens or underscores.",
      });

  if (
    !["available", "on-route", "off-duty", "inactive"].includes(
      String(status).toLowerCase(),
    )
  ) {
    return res.json({
      code: 2,
      message:
        "Driver status must be available, on-route, off-duty, or inactive.",
    });
  }

  const [userErr, userRows] = await runQuery(
    `
      SELECT id, fullname, work_title, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  if (userErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate driver user." });
  }
  if (!userRows.length) {
    return res.json({ code: 2, message: "Selected user does not exist." });
  }

  const user = userRows[0];
  if (!["driver", "supervisor"].includes(user.work_title)) {
    return res.json({
      code: 2,
      message: "Selected user is not a driver user.",
    });
  }
  if (Number(user.status) !== 1) {
    return res.json({ code: 2, message: "Selected user is inactive." });
  }

  const [existingDriverErr, existingDriverRows] = await runQuery(
    "SELECT id FROM drivers WHERE user_id = ? LIMIT 1",
    [userId],
  );
  if (existingDriverErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate driver profile." });
  }
  if (existingDriverRows.length) {
    return res.json({
      code: 2,
      message: "Selected user already has a driver profile.",
    });
  }

  const [zoneErr, zoneRows] = await runQuery(
    "SELECT id FROM zones WHERE id = ?",
    [zoneId],
  );
  if (zoneErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate zone." });
  }
  if (!zoneRows.length) {
    return res.json({ code: 2, message: "Selected zone does not exist." });
  }

  const [insertErr] = await runQuery(
    `
      INSERT INTO drivers (user_id, driver_code, full_name, phone, vehicle_number, zone_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(userId),
      driverCode.trim(),
      user.fullname,
      phone.trim(),
      vehicleNumber.trim(),
      Number(zoneId),
      String(status).toLowerCase(),
    ],
  );

  if (insertErr) {
    if (insertErr.code === "ER_DUP_ENTRY") {
      return res.json({ code: 2, message: "Driver code already exists." });
    }
    return res
      .status(500)
      .json({ code: 2, message: "Unable to create driver." });
  }

  return res.json({
    code: 1,
    data: null,
    message: "Driver created successfully.",
  });
});

router.get("/pickups", async (req, res) => {
  const [err, rows] = await runQuery(
    `
      SELECT
        pr.id AS dbId,
        pr.pickup_code AS id,
        pr.customer_code AS customerId,
        d.driver_code AS driverId,
        pr.zone_id AS zoneDbId,
        z.zone_code AS zoneId,
        z.name AS zoneName,
        pr.waste_type AS wasteType,
        DATE_FORMAT(pr.pickup_date, '%Y-%m-%d') AS pickupDate,
        TIME_FORMAT(pr.pickup_time, '%H:%i') AS pickupTime,
        pr.status,
        pr.emergency,
        pr.extra_bin AS extraBin,
        pr.address,
        pr.created_at,
        pr.updated_at
      FROM pickup_requests pr
      JOIN zones z ON z.id = pr.zone_id
      LEFT JOIN drivers d ON d.id = pr.driver_id
      ORDER BY pr.pickup_date ASC, pr.pickup_time ASC
    `,
  );

  if (err) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to load pickups." });
  }

  return res.json({ code: 1, data: rows, message: "Pickups loaded." });
});

router.post("/assignments", async (req, res) => {
  const { pickupId, driverId } = req.body;

  if (!pickupId || !driverId) {
    return res.json({
      code: 2,
      message: "Pickup and driver are required for assignment.",
    });
  }

  const [pickupErr, pickupRows] = await runQuery(
    `
      SELECT id, zone_id, driver_id, status
      FROM pickup_requests
      WHERE pickup_code = ?
      LIMIT 1
    `,
    [pickupId],
  );
  if (pickupErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate pickup." });
  }
  if (!pickupRows.length) {
    return res.json({ code: 2, message: "Selected pickup does not exist." });
  }

  const [driverErr, driverRows] = await runQuery(
    `
      SELECT id, zone_id, status
      FROM drivers
      WHERE driver_code = ?
      LIMIT 1
    `,
    [driverId],
  );
  if (driverErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to validate driver." });
  }
  if (!driverRows.length) {
    return res.json({ code: 2, message: "Selected driver does not exist." });
  }

  const pickup = pickupRows[0];
  const driver = driverRows[0];

  if (pickup.status === "completed") {
    return res.json({
      code: 2,
      message: "Completed pickup cannot be reassigned.",
    });
  }

  if (driver.status !== "available") {
    return res.json({
      code: 2,
      message: "Only available drivers can be assigned.",
    });
  }

  if (Number(driver.zone_id) !== Number(pickup.zone_id)) {
    return res.json({
      code: 2,
      message: "Driver zone does not match pickup zone.",
    });
  }

  const [closeExistingErr] = await runQuery(
    `
      UPDATE driver_assignments
      SET status = 'reassigned', unassigned_at = CURRENT_TIMESTAMP
      WHERE pickup_request_id = ? AND status = 'active'
    `,
    [pickup.id],
  );
  if (closeExistingErr) {
    return res.status(500).json({
      code: 2,
      message: "Unable to prepare existing assignments.",
    });
  }

  const [insertErr] = await runQuery(
    `
      INSERT INTO driver_assignments (pickup_request_id, driver_id, assigned_by_user_id, status)
      VALUES (?, ?, ?, 'active')
    `,
    [pickup.id, driver.id, req.user.user_id || null],
  );
  if (insertErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to save assignment." });
  }

  const [updatePickupErr] = await runQuery(
    `
      UPDATE pickup_requests
      SET driver_id = ?, status = 'assigned'
      WHERE id = ?
    `,
    [driver.id, pickup.id],
  );
  if (updatePickupErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to update pickup assignment." });
  }

  const [updateDriverErr] = await runQuery(
    `
      UPDATE drivers
      SET status = 'on-route'
      WHERE id = ? AND status = 'available'
    `,
    [driver.id],
  );
  if (updateDriverErr) {
    return res
      .status(500)
      .json({ code: 2, message: "Unable to update driver status." });
  }

  if (pickup.driver_id && Number(pickup.driver_id) !== Number(driver.id)) {
    const [releaseDriverErr] = await runQuery(
      `
        UPDATE drivers
        SET status = 'available'
        WHERE id = ?
      `,
      [pickup.driver_id],
    );
    if (releaseDriverErr) {
      return res
        .status(500)
        .json({ code: 2, message: "Unable to release previous driver." });
    }
  }

  return res.json({
    code: 1,
    data: null,
    message: "Driver assigned successfully.",
  });
});

module.exports = router;
