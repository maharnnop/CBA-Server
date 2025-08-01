'use strict';
const { NOW } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FleetGroups', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fleetCode: {
        type: Sequelize.STRING
      },
      groupCode: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.STRING
      },
      itemID: {
        type: Sequelize.STRING
      },
      createdAt: {
        defaultValue: NOW,
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        defaultValue: NOW,
        allowNull: false,
        type: Sequelize.DATE
      }
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('FleetGroups',{ schema: 'static_data'});
  }
};