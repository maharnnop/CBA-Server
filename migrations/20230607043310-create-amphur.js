'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Amphurs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      amphurid: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      t_amphurname: {
        allowNull: false,
        type: Sequelize.STRING
      },
      e_amphurname: {
        allowNull: false,
        type: Sequelize.STRING
      },
      provinceid: {
        allowNull: false,
        type: Sequelize.INTEGER
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
    }, {
      schema: 'static_data',
  });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Amphurs');
  }
};