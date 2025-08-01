'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_juepms', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      polid: {
        type: Sequelize.INTEGER
      },
      diffnetgrossprem: {
        type: Sequelize.FLOAT
      },
      diffduty: {
        type: Sequelize.FLOAT
      },
      difftax: {
        type: Sequelize.FLOAT
      },
      difftotalprem: {
        type: Sequelize.FLOAT
      },
      discinamt: {
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
    await queryInterface.dropTable('b_juepms',{ schema: 'static_data'});
  }
};