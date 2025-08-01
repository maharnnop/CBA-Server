const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
//สลักหลังให้ส่วนลด
router.post('/policygetlist/endorse/Discin', ctrl.endorses.getPolicyListForEndorseDiscin);
router.post('/requestspecdisc', ctrl.endorses.requestEdtDisc);
//สลักหลังเปลี่ยนงวด
router.post('/policygetlist/endorse/Changeinv', ctrl.endorses.getPolicyListForEndorseChangeinv);
router.post('/getpolicytrans/changeinv', ctrl.endorses.getPolicyTransChangeinv);
router.post('/changeinv', ctrl.endorses.endorseChangeinv);
//สลักหลังเปลี่ยนคอมมิชชั่น
router.post('/policygetlist/endorse/Comov', ctrl.endorses.getPolicyListForEndorseComov);
router.post('/Comov', ctrl.endorses.endorseComov);

router.post('/policygetlist/endorse/all', ctrl.endorses.getPolicyListForEndorseAll);
router.post('/all', ctrl.endorses.endorseAll);
router.post('/changestatus', ctrl.endorses.ConfirmEndorseAll);
router.post('/findpolicy', ctrl.endorses.findPolicy);


router.get('/getEdTypeCodeAll',ctrl.endorses.getEdTypeCodeAll);
// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;