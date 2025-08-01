const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../../controllers");

// router.get("path", fucntion);
router.get('/showall/idcardtype', ctrl.config.showAllidcardtype);

router.post('/showall/tusource', ctrl.config.showAll_tusource);
router.post('/insert/tusource', ctrl.config.insert_tusource);
router.post('/update/tusource', ctrl.config.update_tusource);


// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;