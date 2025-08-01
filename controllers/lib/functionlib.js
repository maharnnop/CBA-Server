
const process = require('process');
require('dotenv').config();
const { throws } = require("assert");




const isNullorUndef =  (value) => {

  return value === undefined || value === null || value === '';

}

module.exports = {
  isNullorUndef

};