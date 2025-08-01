'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CommOVIns', {
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
      rateComIn: {
        type: Sequelize.FLOAT
      },
      // amountComIn: {
      //   type: Sequelize.FLOAT
      // },
      rateOVIn_1: {
        type: Sequelize.FLOAT
      },
      // amountOVIn_1: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVIn_2: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVIn_2: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVIn_3: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVIn_3: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVIn_4: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVIn_4: {
      //   type: Sequelize.FLOAT
      // },
      // rateOVIn_5: {
      //   type: Sequelize.FLOAT
      // },
      // amountOVIn_5: {
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
    await queryInterface.dropTable('CommOVIns',{ schema: 'static_data'});
  }
};