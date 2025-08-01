const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
// request/approve/reject สลักหลังภายใน
router.post('/requesttlist', ctrl.internalendorses.getRequestList);
router.post('/getdetailrequest', ctrl.internalendorses.getDetailRequestList);
router.post('/rejectrequest', ctrl.internalendorses.rejectRequest); 
router.post('/approverequest', ctrl.internalendorses.approveRequest); 
router.post('/requestedtpoldetail', ctrl.internalendorses.requestEdtPolicyDetail);


//สลักหลังให้ส่วนลด
router.post('/policygetlist/endorse/Discin', ctrl.internalendorses.getPolicyListForEndorseDiscin);
router.post('/requestspecdisc', ctrl.internalendorses.requestEdtDisc);


//สลักหลังเปลี่ยนงวด
router.post('/getpolicytrans/changeinv', ctrl.internalendorses.getPolicyTransChangeinv);
router.post('/policygetlist/endorse/Changeinv', ctrl.internalendorses.getPolicyListForEndorseChangeinv);
router.post('/changeinv', ctrl.internalendorses.endorseChangeinv);

//สลักหลังเปลี่ยนคอมมิชชั่น
router.post('/policygetlist/endorse/Comov', ctrl.internalendorses.getPolicyListForEndorseComov);
router.post('/requestcommov', ctrl.internalendorses.requestEdtCommOV);
// router.post('/Comov', ctrl.internalendorses.endorseComov);

router.post('/policygetlist/endorse/all', ctrl.internalendorses.getPolicyListForEndorseAll);
router.post('/all', ctrl.internalendorses.endorseAll);
router.post('/changestatus', ctrl.internalendorses.ConfirmEndorseAll);
router.post('/findpolicy', ctrl.internalendorses.findPolicy);


router.get('/getEdTypeCodeAll',ctrl.internalendorses.getEdTypeCodeAll);
// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;