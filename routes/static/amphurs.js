const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../../controllers");

//#region achieve
// router.get('/all', ctrl.amphurs.showAll);
//#endregion 

router.post('/search', ctrl.amphurs.showAllinProvincename);
router.get('/:index', ctrl.amphurs.showAllinProvince);


module.exports = router;