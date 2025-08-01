const express = require("express");
const router = express.Router(); //creates a router object
const ctrl = require("../../controllers");

// student.test.js 
const request = require("supertest");
// const app = require("../../index");
it("POST /student/search -> new user", async () => {
    await request(ctrl)
    .post("/api/student/register")
    .send({username : "test" , password : "1234"})
    .expect(200)
    .then((res) => {
      expect(res.body).toEqual({});
     });
});