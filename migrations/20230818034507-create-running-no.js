'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TURUN', {
      RunID: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      BrCode: {
        type: Sequelize.STRING
      },
      RunType: {
        type: Sequelize.STRING
      },
      Class: {
        type: Sequelize.STRING
      },
      SubClass: {
        type: Sequelize.STRING
      },
      EffectiveDate: {
        type: Sequelize.DATEONLY
      },
      LastNo: {
        type: Sequelize.INTEGER
      },
      UpdateDate: {
        type: Sequelize.DATEONLY
      },
      UpdateUserCode: {
        type: Sequelize.STRING
      },
      UpdateBrCode: {
        type: Sequelize.STRING
      },
      Outlet: {
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
    await queryInterface.dropTable('TURUN',{ schema: 'static_data'});
  }
};