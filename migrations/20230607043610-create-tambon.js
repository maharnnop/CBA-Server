'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Tambons', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tambonid: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      t_tambonname: {
        allowNull: false,
        type: Sequelize.STRING
      },
      e_tambonname: {
        allowNull: false,
        type: Sequelize.STRING
      },
      amphurid: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      postcodeall: {
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
    }, {
      schema: 'static_data',
  });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Tambons');
  }
};