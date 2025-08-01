const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
router.post('/insuretypenew', ctrl.insures.newInsureType);
router.post('/editinsuretype', ctrl.insures.editInsureType);

router.get('/insuretypeall', ctrl.insures.getInsureTypeAll);
router.post('/insuretypebyinsurer', ctrl.insures.getInsureByInsurer);
router.get('/insuretypeget/:id', ctrl.insures.getInsureTypeByid);
router.post('/commovinnew', ctrl.insures.newCommOVIn);
router.get('/commovinget/:id', ctrl.insures.getCommOVInByid);
router.post('/commovoutnew', ctrl.insures.newCommOVOut);
router.get('/commovoutget/:id', ctrl.insures.getCommOVOutByid);
router.post('/commovnew', ctrl.insures.newCommOV);
router.post('/getcommov', ctrl.insures.getCommOVOut);
router.post('/getcommovin', ctrl.insures.getCommOVIn);

router.post('/getcommovin/all', ctrl.insures.getCommOVInAll);
router.post('/editcommovin/all', ctrl.insures.editCommOVInAll);

router.post('/getcommovout/all', ctrl.insures.getCommOVOutAll);
router.post('/editcommovout/all', ctrl.insures.editCommOVOutAll);

router.post('/getinsurebyclass', ctrl.insures.getInsureByClass);

// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;