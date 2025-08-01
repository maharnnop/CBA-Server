const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);

router.post('/policydraft/minor', ctrl.policies.draftPolicyMinor); // สร้าง AI งาน minor ( inhouse)


router.post('/policyedit/batch', ctrl.policies.editPolicyList); // AI -> AA fleet inv/std
router.post('/policyedit/minor', ctrl.policies.editPolicyMinor); // AI -> AA minor
router.post('/findpolicy', ctrl.policies.findPolicy);  // serach policy for copy 

router.post('/policygetlist', ctrl.policies.getPolicyList);//ค้นหากรมทั้งหมด
router.post('/policygetlist/changestatus', ctrl.policies.getPolicyListChangestatus);// ค้นหากรมทั้งหมด แต่แยก fleet inv ตาม fleetcode
router.post('/policydraft/edit/:type', ctrl.policies.editApplication); // แก้ไขใบคำขอ type = ['minor', 'fleet']

// router.post('/policy/edit/:type', ctrl.policies.editPolicyDetail); // แก้ไขกรมธรรม type = ['minor', 'fleet']

//fleet INV
router.post('/policydraft/excel', ctrl.policies.draftPolicyExcel);// สร้าง AI งาน excel lot(fleet inv )

//external
router.post('/external', ctrl.policies.externalPolicy);
// ยกเลิกใบตำขอ
router.post('/policydraft/cancel', ctrl.policies.cancelAppNo )


// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;