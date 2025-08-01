const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
router.post('/test', ctrl.sendmail.textMail);

// router.post('/', ctrl.cars.postCar);
// router.delete('/:inderx', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.expots = router;