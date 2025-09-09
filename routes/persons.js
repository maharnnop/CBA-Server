const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../controllers");



// need modify
router.post('/usernew', ctrl.persons.newUser);
router.get('/userget/:id', ctrl.persons.getUserByid);

//current use
router.post('/insurernew', ctrl.persons.newInsurer);
router.post('/insurerupdate', ctrl.persons.updateInsurer);
router.get('/insurerall', ctrl.persons.getInsurerAll);
router.post('/agentnew', ctrl.persons.newAgent);
router.post('/agentupdate', ctrl.persons.updateAgent);
router.get('/agentall', ctrl.persons.getAgentAll);
router.post('/findagent', ctrl.persons.findAgent);
router.post('/findinsuree', ctrl.persons.findInsuree);
router.post('/findagentinsurer', ctrl.persons.findAgentInsurer);
router.post('/getagentbyagentcode', ctrl.persons.getAgentByAgentCode)
router.post('/getinsurerbyinsurercode', ctrl.persons.getInsurerByInsurerCode)


module.exports = router;