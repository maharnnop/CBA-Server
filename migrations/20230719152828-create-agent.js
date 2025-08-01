'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Agents', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      agentCode: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING
      },
      agentGroupCode: {
        defaultValue: 'Amity',
        type: Sequelize.STRING
      },
      // พนงประจำ พนงขาย พนงอิสระ
      EMPType: {
        type: Sequelize.CHAR
      },
      // ใบอนุญาติ
      licentNo: {
        allowNull: false,
        type: Sequelize.STRING
      },
      licentExp: {
        allowNull: false,
        type: Sequelize.DATEONLY
      },
        // ใบอนุญาติชีวิต
      licentLifeNo: {
        type: Sequelize.STRING
      },
      licentLifeExp: {
        type: Sequelize.DATEONLY
      },
      premCreditT: {
        type: Sequelize.INTEGER
      },
      commovCreditT: {
        type: Sequelize.INTEGER
      },
      // A = active I = inactive
      status: {
        defaultValue: 'A',
        allowNull: false,
        type: Sequelize.CHAR
      },
      entityID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      stamentType: {
        defaultValue:"Gross",
        type: Sequelize.STRING
      },
      vatflag: {
        defaultValue:"N",
        type: Sequelize.STRING
      },
      deducttaxrate: {
        type: Sequelize.INTEGER
      },
      taxno: {
        type: Sequelize.STRING
      },
      contactPersonID: {
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
    await queryInterface.dropTable('Agents',{ schema: 'static_data'});
  }
};