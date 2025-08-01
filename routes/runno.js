const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");



router.post('/', ctrl.runno.testRunno);
// router.delete('/:inderx', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;