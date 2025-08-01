'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TURUNT', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      typename: {
        type: Sequelize.STRING
      },
      updateusercode: {
        type: Sequelize.STRING
      },
      PeriodBasis: {
        type: Sequelize.STRING
      },
      RunType: {
        type: Sequelize.STRING
      },
      xlock: {
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
    await queryInterface.dropTable('TURUNT',{ schema: 'static_data'});
  }
};