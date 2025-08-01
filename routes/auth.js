const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");

// router.get("path", fucntion);
router.get('/usergetall', ctrl.auth.showAll);
router.post('/usergetbyname', ctrl.auth.showByUsername);
router.post('/signup', ctrl.auth.signup);
router.post('/login', ctrl.auth.login);

// KC USERMM
router.post('/signupKC', ctrl.auth.signupKC);
router.post('/loginKC', ctrl.auth.loginKC);
router.post('/checkOTPKC', ctrl.auth.checkOTPKC);
router.post('/resetpwKC', ctrl.auth.resetpwKC);

router.get('/getSubordinateUser',ctrl.auth.getSubordinateUser)
// router.post('/', ctrl.cars.postCar);
// router.delete('/:index', ctrl.cars.removeCar);
// router.put('/:index', ctrl.cars.editCar);

module.exports = router;