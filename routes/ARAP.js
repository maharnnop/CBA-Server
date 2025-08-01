const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
router.post('/getbilldata', ctrl.arap.getbilldata);
router.post('/getcashierdata', ctrl.arap.getcashierdata);
router.post('/savearpremin', ctrl.arap.saveARPremin);
router.post('/submitarpremin', ctrl.arap.submitARPremin);

router.post('/getartrans', ctrl.arap.getARtrans);
router.post('/getartransdirect', ctrl.arap.findARPremInDirect);
router.post('/savearpremindirect', ctrl.arap.saveARPreminDirect);
router.post('/submitarpremindirect', ctrl.arap.submitARPreminDirect);

router.post('/findappremout', ctrl.arap.findAPPremOut);
router.post('/saveappremout', ctrl.arap.saveAPPremOut);
router.post('/submitappremout', ctrl.arap.submitAPPremOut);
router.post('/getarpremindata', ctrl.arap.getARPremindata);

router.post('/getarcommin', ctrl.arap.findARCommIn);
router.post('/savearcommin', ctrl.arap.saveARCommIn);
router.post('/submitarcommin', ctrl.arap.submitARCommIn);
router.post('/getapcommout', ctrl.arap.findAPCommOut);
router.post('/saveapcommout', ctrl.arap.saveAPCommOut);
router.post('/submitapcommout', ctrl.arap.submitAPCommOut);
router.post('/getaraptransall', ctrl.arap.getARAPtransAll);
// สลักหลังลดเบี้ย
router.post('/getappremoutreturn', ctrl.arap.findPremOutReturn);
router.post('/submitappremoutreturn', ctrl.arap.submitAPPremOutReturn);



//minor
router.post('/getarpremin/minor', ctrl.arap.findARPremInMinor);

router.post('/submitarpremin/minor', ctrl.arap.submitARPreminMinor); //deprecated
router.post('/submitarpremin/minor_V2', ctrl.arap.submitARPreminMinor_V2);
router.post('/submitarpremin/minorpol', ctrl.arap.submitARPreminMinorPol);

router.post('/suspense/getlist', ctrl.arap.getSuspenseList); // ดึงรายการบัญชีคงค้าง
router.post('/suspense/approve', ctrl.arap.approveSuspense); // เคลียบัญชีคงค้าง



module.exports = router;