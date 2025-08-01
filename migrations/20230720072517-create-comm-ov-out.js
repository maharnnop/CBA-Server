'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CommOVOuts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      insurerCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      agentCode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      insureID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      // for MT
      voluntaryCode: { 
        type: Sequelize.STRING // 110, 220, 330
      },
      brandID: {
        type: Sequelize.INTEGER
      },
      modelID: {
        type: Sequelize.INTEGER
      },
      //for FR
      riskGruop: {
        type: Sequelize.STRING // hight, medium, low
      },
      //for PA
      planCode: {
        type: Sequelize.STRING
      },
      rateComOut: {
        type: Sequelize.FLOAT
      },
      // amountComOut: {
      //   type: Sequelize.FLOAT
      // },
      rateOVOut_1: {
        type: Sequelize.FLOAT
      },
      // amountOVOut_1: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVOut_2: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVOut_2: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVOut_3: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVOut_3: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVOut_4: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVOut_4: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVOut_5: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVOut_5: {
      //   type: Sequelize.FLOAT
      // },
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
    await queryInterface.dropTable('CommOVOuts',{ schema: 'static_data'});
  }
};