'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('b_jabilladvisors', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      old_keyid: {
        type: Sequelize.INTEGER
      },
      insurerno: {
        type: Sequelize.INTEGER
      },
      advisorno: {
        type: Sequelize.INTEGER
      },
      billadvisorno: {
        type: Sequelize.STRING
      },
      billdate: {
        type: Sequelize.DATEONLY
      },
      createusercode: {
        type: Sequelize.STRING
      },
      amt: {
        type: Sequelize.FLOAT
      },
      cashierreceiptno: {
        type: Sequelize.STRING
      },
      active: {
        type: Sequelize.STRING
      },
      inactivedate: {
        type: Sequelize.DATEONLY
      },
      inactiveusercode: {
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
      },
      withheld: {
        type: Sequelize.FLOAT
      },
      totalprem: {
        type: Sequelize.FLOAT
      },
      commout_amt: {
        type: Sequelize.FLOAT
      },
      commout_taxamt: {
        type: Sequelize.FLOAT
      },
      // commout_whtamt: {
      //   type: Sequelize.FLOAT
      // },
      ovout_amt: {
        type: Sequelize.FLOAT
      },
      ovout_taxamt: {
        type: Sequelize.FLOAT
      },
      // ovout_whtamt: {
      //   type: Sequelize.FLOAT
      // },
      specdiscamt: {
        type: Sequelize.FLOAT
      },
      insurerCode: {
        type: Sequelize.STRING
      },
      agentCode: {
        type: Sequelize.STRING
      },
    },{ schema: 'static_data'});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('b_jabilladvisors',{ schema: 'static_data'});
  }
};