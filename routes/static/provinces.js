const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../../controllers");

// router.get("path", fucntion);
router.get('/all', ctrl.provinces.showAll);
router.get('/search/:para/:value', ctrl.provinces.searchBy);
router.get('/:index', ctrl.provinces.showOne);
// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;