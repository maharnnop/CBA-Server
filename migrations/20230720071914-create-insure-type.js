'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('InsureTypes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },      
      // Motor, PA, FR
      
      class: {
        allowNull: false,
        type: Sequelize.STRING
      },
      subClass: {
        allowNull: false,
        type: Sequelize.STRING
      },
      planCode: {
        type: Sequelize.STRING
      },
      insureName: {
        allowNull: false,
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
    await queryInterface.dropTable('InsureTypes',{ schema: 'static_data'});
  }
};