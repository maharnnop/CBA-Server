'use strict';

const { flush } = require('elastic-apm-node');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Endorses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      endorseNo: {
        unique:true,
        type: Sequelize.STRING
      },
      edeffdate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      edefftime: {
        type: Sequelize.STRING
      },
      edexpdate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      edexptime: {
        type: Sequelize.STRING
      },
      edtype: {
        allowNull:false,
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
    await queryInterface.dropTable('Endorses',{ schema: 'static_data'});
  }
};