'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createSchema("static_data");
    await queryInterface.createTable('provinces', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      provinceid: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      t_provincename: {
        allowNull: false,
        type: Sequelize.STRING
      },
      e_provincename: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        defaultValue: new Date(),
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        defaultValue: new Date(),
        type: Sequelize.DATE
      }
    }, {
      schema: 'static_data',
  });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('provinces');
  }
};