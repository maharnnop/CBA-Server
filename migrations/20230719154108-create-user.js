'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userName: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING
      },
      password: {
        allowNull: false,
        type: Sequelize.STRING
      },
      empCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      // password expire date
      pwExpDate: {
        
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      passwordOld1: {
        
        type: Sequelize.STRING
      },
      passwordOld2: {
     
        type: Sequelize.STRING
      },

      roleID: {
        defaultValue: 0,
        allowNull: false,
        type: Sequelize.INTEGER
      },
      // Y = lock N = unlock
      lockStatus: {
        defaultValue: 'N',
        allowNull: false,
        type: Sequelize.CHAR
      },
      loginFailCount: {
        defaultValue: 0,
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
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users',{ schema: 'static_data'});
  }
};