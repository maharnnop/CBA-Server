const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../../controllers");

// router.get("path", fucntion);
router.get('/all', ctrl.tambons.showAll);
router.post('/search', ctrl.tambons.showAllinAmphurname);
router.get('/zip/:index', ctrl.tambons.showZipinTambon);
router.get('/:index', ctrl.tambons.showAllinAmphur);

// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;