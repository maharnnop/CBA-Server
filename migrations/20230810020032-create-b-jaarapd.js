'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jaarapds', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      keyidm: {
        allowNull:false,
        type: Sequelize.INTEGER
      },
      polid: {
        allowNull:false,
        type: Sequelize.INTEGER
      },
      policyNo: {
        allowNull:false,
        type: Sequelize.STRING
      },
      customerid: {
        type: Sequelize.INTEGER
      },
      netflag: {
        type: Sequelize.STRING
      },
      endorseNo: {
        type: Sequelize.STRING
      },
      invoiceNo: {
        type: Sequelize.STRING
      },
      seqNo: {
        type: Sequelize.INTEGER
      },
      netamt: {
        type: Sequelize.FLOAT
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
      }
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('b_jaarapds',{ schema: 'static_data'});
  }
};