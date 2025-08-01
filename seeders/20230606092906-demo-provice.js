'use strict';
const excelToJson = require('convert-excel-to-json');


const result = excelToJson({
	sourceFile: './rawdata/provice.xlsx'
});
// // console.log(result.provice.length);
const arr = []
result.provice.forEach(ele => { 
    arr.push({  provinceid:ele.A,
                t_provincename: ele.B,
                e_provincename: ele.C})

  
});
arr.shift()
// console.log(arr)
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    await queryInterface.bulkInsert(
      { tableName: 'provinces', schema: 'static_data' },arr,{}
      );

  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      { tableName: 'provinces', schema: 'static_data' },arr,{}
      );
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
