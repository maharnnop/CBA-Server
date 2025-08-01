'use strict';
const excelToJson = require('convert-excel-to-json');


const result = excelToJson({
	sourceFile: './rawdata/tambon.xlsx'
});
// console.log(result);
const arr = []
result.distict.forEach(ele => { 
    arr.push({  tambonid:ele.A,
        t_tambonname: ele.B,
        e_tambonname: ele.C,
        amphurid:ele.D,
        postcodeall:ele.E})

  
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
    await queryInterface.bulkInsert({ tableName: "Tambons", schema: 'static_data' },arr,{});
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete({ tableName: "Tambons", schema: 'static_data' },null,{});
  }
};
