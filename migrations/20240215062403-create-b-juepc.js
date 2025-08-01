'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_juepcs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      polid: {
        type: Sequelize.INTEGER
      },
      previousid: {
        type: Sequelize.INTEGER
      },
      endorseNo: {
        type: Sequelize.STRING
      },
      edeffdate: {
        type: Sequelize.DATE
      },
      edexpdate: {
        type: Sequelize.DATE
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
    await queryInterface.dropTable('b_juepcs',{ schema: 'static_data'});
  }
};