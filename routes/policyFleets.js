const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
router.post('/findFleetCode', ctrl.policyFleets.findFleetCode);
router.post('/newFleetCode', ctrl.policyFleets.newFleetCode);
router.post('/policyFleetdraft/STD', ctrl.policyFleets.draftPolicyList);
// router.post('/policyedit/batch', ctrl.policyFleets.editPolicyList);
// router.post('/findpolicy', ctrl.policyFleets.findPolicy);
// router.post('/policygetlist', ctrl.policyFleets.getPolicyList);


// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;