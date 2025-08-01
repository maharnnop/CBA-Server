'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jupgrs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      policyNo: {
        allowNull: false,
        type: Sequelize.STRING
      },
      dftxno: {
        type: Sequelize.STRING
      },
      polid: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      endorseNo: {
        type: Sequelize.STRING
      },
      invoiceNo: {
        type: Sequelize.STRING
      },
      taxInvoiceNo: {
        type: Sequelize.STRING
      },
      // 'I' = insurer , 'A' = advisor 
      installmenttype:{
        allowNull: false,
        type: Sequelize.STRING
      },
      seqNo :{
        defaultValue : 1,
        type: Sequelize.INTEGER
      },
      grossprem: {
        allowNull: false,
        type: Sequelize.FLOAT
      },
      specdiscrate: {
        defaultValue:0,
        type: Sequelize.FLOAT
      },
      specdiscamt: {
        defaultValue:0,
        type: Sequelize.FLOAT
      },
      netgrossprem: {
        allowNull: false,
        type: Sequelize.FLOAT
      },
      tax: {
        allowNull: false,
        type: Sequelize.FLOAT
      },
      duty: {
        allowNull: false,
        type: Sequelize.FLOAT
      },
      totalprem: {
        allowNull: false,
        type: Sequelize.FLOAT
      },
      commin_rate: {
        type: Sequelize.FLOAT
      },
      commin_amt: {
        type: Sequelize.FLOAT
      },
      ovin_rate: {
        type: Sequelize.FLOAT
      },
      ovin_amt: {
        type: Sequelize.FLOAT
      },
      commin_taxamt: {
        type: Sequelize.FLOAT
      },
      ovin_taxamt: {
        type: Sequelize.FLOAT
      },
      agentCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      agentCode2: {
        type: Sequelize.STRING
      },
      commout1_rate: {
        type: Sequelize.FLOAT
      },
      commout1_amt: {
        type: Sequelize.FLOAT
      },
      ovout1_rate: {
        type: Sequelize.FLOAT
      },
      ovout1_amt: {
        type: Sequelize.FLOAT
      },
      
      commout2_amt: {
        type: Sequelize.FLOAT
      },
      ovout2_rate: {
        type: Sequelize.FLOAT
      },
      ovout2_amt: {
        type: Sequelize.FLOAT
      },
      commout2_rate: {
        type: Sequelize.FLOAT
      },
      commout_rate: {
        type: Sequelize.FLOAT
      },
      commout_amt: {
        type: Sequelize.FLOAT
      },
      ovout_rate: {
        type: Sequelize.FLOAT
      },
      ovout_amt: {
        type: Sequelize.FLOAT
      },
      
      createusercode:{
        type:Sequelize.STRING
      },
      lastprintdate: {
        type: Sequelize.DATEONLY
      },
      lastprintuser:{
        type:Sequelize.STRING
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
    await queryInterface.dropTable('b_jupgrs',{ schema: 'static_data'});
  }
};