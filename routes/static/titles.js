const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../../controllers");

// router.get("path", fucntion);
router.get('/company/all', ctrl.titles.showAllCompany);
router.get('/company/:para/:value', ctrl.titles.searchByCompany);
router.get('/person/all', ctrl.titles.showAllPerson);
router.get('/person/:para/:value', ctrl.titles.searchByPerson);
router.get('/:index', ctrl.titles.showById);

// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;