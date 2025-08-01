'use strict';



/** @type {import('sequelize-cli').Migration} */
const rawdata  = require('../rawdata/title.json')
const data = rawdata.value.map(function(item) {
  return {
    "TITLEID": item.TITLEID,
    "TITLETYPE": item.TITLETYPE,
    "TITLETHAIBEGIN": item.TITLETHAIBEGIN,
    "TITLETHAIEND": item.TITLETHAIEND,
    "GENDER": item.GENDER
  };
});
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

        await   queryInterface.bulkInsert({ tableName: "Titles", schema: 'static_data' },data,{});
    
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete({ tableName: "Titles", schema: 'static_data' },null,{});
  }
};
