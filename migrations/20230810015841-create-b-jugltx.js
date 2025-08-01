'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jugltxes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ttype: {
        type: Sequelize.STRING
      },
      seqno: {
        type: Sequelize.INTEGER
      },
      accountno: {
        type: Sequelize.STRING
      },
      gltype: {
        type: Sequelize.STRING
      },
      class: {
        type: Sequelize.STRING
      },
      subclass: {
        type: Sequelize.STRING
      },
      policyno: {
        type: Sequelize.STRING
      },
      endorseno: {
        type: Sequelize.STRING
      },
      invoiceno: {
        type: Sequelize.STRING
      },
      taxinvoiceno: {
        type: Sequelize.STRING
      },
      polikeyid: {
        type: Sequelize.INTEGER
      },
      amt: {
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
    await queryInterface.dropTable('b_jugltxes',{ schema: 'static_data'});
  }
};