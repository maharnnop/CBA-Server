'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jatws', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      keyidm: {
        type: Sequelize.INTEGER
      },
      "commout_amt": {
        type: Sequelize.FLOAT
      },
      whtrate: {
        type: Sequelize.FLOAT
      },
      "whtcommout_amt": {
        type: Sequelize.FLOAT
      },
      "ovout_amt": {
        type: Sequelize.FLOAT
      },
      "whtovout_amt": {
        type: Sequelize.FLOAT
      },
      taxid: {
        type: Sequelize.STRING
      },
      advisorcode: {
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
      }
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('b_jatws',{ schema: 'static_data'});
  }
};