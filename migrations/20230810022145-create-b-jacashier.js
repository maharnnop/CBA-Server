'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jacashiers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      billadvisorno: {
        type: Sequelize.STRING
      },
      cashierreceiveno: {
        type: Sequelize.STRING
      },
      cashierdate: {
        type: Sequelize.STRING
      },
      dfrpreferno: {
        type: Sequelize.STRING
      },
      transactiontype: {
        type: Sequelize.STRING
      },
      insurercode: {
        type: Sequelize.STRING
      },
      advisorcode: {
        type: Sequelize.STRING
      },
      customerid: {
        type: Sequelize.INTEGER
      },
      receivefrom : {
        type: Sequelize.STRING
      },
      receivename : {
        type: Sequelize.STRING
      },
      receivetype: {
        type: Sequelize.STRING
      },
      partnerBank: {
        type: Sequelize.STRING
      },
      partnerBankbranch: {
        type: Sequelize.STRING
      },
      partnerAccountno: {
        type: Sequelize.STRING
      },
      amityBank: {
        type: Sequelize.STRING
      },
      amityBankbranch: {
        type: Sequelize.STRING
      },
      amityAccountno: {
        type: Sequelize.STRING
      },
      amt: {
        type: Sequelize.FLOAT
      },
      createusercode: {
        type: Sequelize.STRING
      },
      refno: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING
      },
      updateusercode: {
        type: Sequelize.STRING
      },
      cancelusercode: {
        type: Sequelize.STRING
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
      canceledAt: {
        type: Sequelize.DATE
      },
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('b_jacashiers',{ schema: 'static_data'});
  }
};