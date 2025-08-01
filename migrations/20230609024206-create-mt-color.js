'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MT_Colors', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      COLORCODE: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      COLORNAMETH: {
        allowNull: false,
        type: Sequelize.STRING
      },
      COLORNAMEENG: {
        allowNull: false,
        type: Sequelize.STRING
      },
      FLAGDELETE: {
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
    await queryInterface.dropTable('MT_Colors',{ schema: 'static_data'});
  }
};