'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PaymentNos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      paymentNo: {
        type: Sequelize.STRING,
        allowNull:false
      },
      type: {
        type: Sequelize.STRING,
        allowNull:false
      },
      refNo: {
        type: Sequelize.STRING,
        allowNull:false
      },
      amount: {
        type: Sequelize.FLOAT,
        allowNull:false
      },
      
      repEntityID: {
        type: Sequelize.INTEGER,
        
      },
      payEntityID: {
        type: Sequelize.INTEGER,
      
      },
      payDate: {
        defaultValue: new Date(),
        allowNull: false,
        type: Sequelize.DATEONLY
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
    await queryInterface.dropTable('PaymentNos',{ schema: 'static_data'});
  }
};