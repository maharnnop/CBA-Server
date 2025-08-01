'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Policies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      insureID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      insurerCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      actDate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      actTime: {
        type: Sequelize.STRING
      },
      expDate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      expTime: {
        type: Sequelize.STRING
      },
      policyDate: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
      policyTime: {
        type: Sequelize.STRING
      },
      policyNo: {
        allowNull: false,
        type: Sequelize.STRING
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
      seqNoins: {
        defaultValue : 1,
        type: Sequelize.INTEGER
      },
      seqNoagt: {
        defaultValue : 1,
        type: Sequelize.INTEGER
      },
      insureeCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      //itemList = motorID
      itemList: {
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
      cover_amt: {
        type: Sequelize.FLOAT
      },
      createusercode:{
        type:Sequelize.STRING
      },
      // Y = lastversion N = old version
      lastVersion: {
        defaultValue: 'Y',
        allowNull: false,
        type: Sequelize.CHAR
      },
      endorseseries: {
        defaultValue: 0,
        type: Sequelize.INTEGER
      },
      applicationNo: {
        allowNull: false,
        type: Sequelize.STRING
      },
      insurancestatus: {
        defaultValue: 'AI',
        allowNull: false,
        type: Sequelize.CHAR(2)
      },
      policystatus: {
        type: Sequelize.CHAR(2)
      },
      fleetflag: {
        type: Sequelize.CHAR(1)
      },
      issueDate :{
        type: Sequelize.DATE
      },
      policyType:{
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
    await queryInterface.dropTable('Policies',{ schema: 'static_data'});
  }
};