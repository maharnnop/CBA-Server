'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jabilladvisordetails', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      //(เก็บ keyid ของแม่) 
      keyidm: {
        type: Sequelize.INTEGER
      },
      //(เก็บ keyind ของ b_jupc)
      polid: {
        type: Sequelize.INTEGER
      },
      
      
      customerid: {
        type: Sequelize.INTEGER
      },
      grossprem: {
        type: Sequelize.FLOAT
      },
      
      
      duty: {
        type: Sequelize.FLOAT
      },
      tax: {
        type: Sequelize.FLOAT
      },
      totalprem: {
        type: Sequelize.FLOAT
      },
      "comm-out%": {
        type: Sequelize.FLOAT
      },
      "comm-out-amt": {
        type: Sequelize.FLOAT
      },
      "ov-out%": {
        type: Sequelize.FLOAT
      },
      "ov-out-amt": {
        type: Sequelize.FLOAT
      },
      netflag: {
        type: Sequelize.STRING
      },
      billpremium: {
        type: Sequelize.FLOAT
      },
      updateusercode: {
        type: Sequelize.STRING
      },
      motorid: {
        type: Sequelize.INTEGER
      },
      seqno: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        defaultValue: new Date(),
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        defaultValue: new Date(),
        allowNull: false,
        type: Sequelize.DATE
      },
      withheld: {
        type: Sequelize.FLOAT
      },
      policyNo: {
        type: Sequelize.STRING
      },
      dftxno: {
        type: Sequelize.STRING
      },
      specdiscamt: {
        type: Sequelize.FLOAT
      },
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('b_jabilladvisordetails',{ schema: 'static_data'});
  }
};