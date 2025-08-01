'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Insurees', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      insureeCode: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING
      },
      entityID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      // เดี่ยว กลุ่ม ภายใต้กลุ่ม
      insureeType: {
        type: Sequelize.CHAR
      },
      // ระดับความเสี่ยง สูง กลาง ต่ำ
      blackList: {
        type: Sequelize.CHAR
      },
      blacklistDesp: {
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
    await queryInterface.dropTable('Insurees',{ schema: 'static_data'});
  }
};