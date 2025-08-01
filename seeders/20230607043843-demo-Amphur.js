'use strict';
const excelToJson = require('convert-excel-to-json');
const result = excelToJson({
	sourceFile: './rawdata/amphur.xlsx'
});
// console.log(result);
const arr = []
result.amphur.forEach(ele => { 
    arr.push({  amphurid:ele.A,
            t_amphurname: ele.B,
            e_amphurname: ele.C,
            provinceid:ele.D})

  
});
arr.shift()

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
    await queryInterface.bulkInsert({ tableName: "Amphurs", schema: 'static_data' },arr,{});
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete({ tableName: "Amphurs", schema: 'static_data' }, null, {});
  }
};
