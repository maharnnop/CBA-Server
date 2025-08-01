const express = require("express");
const router = express.Router();
const ctrl = require("../controllers");


router.get("/health/live",ctrl.system.livenessProbe);
router.get("/health/ready",ctrl.system.readinessProbe);
router.get("/health/startup",ctrl.system.startupProbe);


module.exports = router;