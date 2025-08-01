'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jaaraps', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      billadvisorno: {
        type: Sequelize.STRING
      },
      cashierreceiveno: {
        type: Sequelize.STRING
      },
      cashieramt: {
        type: Sequelize.FLOAT
      },
      transactiontype: {
        type: Sequelize.STRING
      },
      actualvalue: {
        type: Sequelize.FLOAT
      },
      diffamt: {
        type: Sequelize.FLOAT
      },
      status: {
        type: Sequelize.STRING
      },
      createusercode:{
        type :Sequelize.STRING
      },
      updateusercode:{
        type:Sequelize.STRING
      },
      insurerno: {
        type: Sequelize.INTEGER
      },
      advisorno: {
        type: Sequelize.INTEGER
      },
      dfrpreferno:{
        type:Sequelize.STRING
      },
      rprefdate:{
        type:Sequelize.DATEONLY
      },
      netprem:{
        type:Sequelize.FLOAT
      },
      commin:{
        type:Sequelize.FLOAT
      },
      vatcommin:{
        type:Sequelize.FLOAT
      },
      ovin:{
        type:Sequelize.FLOAT
      },
      vatovin:{
        type:Sequelize.FLOAT
      },
      whtcommout:{
        type:Sequelize.FLOAT
      },
      whtovout:{
        type:Sequelize.FLOAT
      },
      type: {
        type: Sequelize.STRING
      },
      whtcommin:{
        type:Sequelize.FLOAT
      },
      whtovin:{
        type:Sequelize.FLOAT
      },
      commout:{
        type:Sequelize.FLOAT
      },
      ovout:{
        type:Sequelize.FLOAT
      },
      insurerCode: {
        type: Sequelize.STRING
      },
      agentCode: {
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
    await queryInterface.dropTable('b_jaaraps',{ schema: 'static_data'});
  }
};