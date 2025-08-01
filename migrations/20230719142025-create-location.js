'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Locations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      t_location_1: {
        type: Sequelize.STRING
      },
      t_location_2: {
        type: Sequelize.STRING
      },
      t_location_3: {
        type: Sequelize.STRING
      },
      t_location_4: {
        type: Sequelize.STRING
      },
      t_location_5: {
        type: Sequelize.STRING
      },
      e_location_1: {
        type: Sequelize.STRING
      },
      e_location_2: {
        type: Sequelize.STRING
      },
      e_location_3: {
        type: Sequelize.STRING
      },
      e_location_4: {
        type: Sequelize.STRING
      },
      e_location_5: {
        type: Sequelize.STRING
      },
      provinceID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      districtID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      subDistrictID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      zipcode: {
        allowNull: false,
        type: Sequelize.STRING
      },
      telNum_1: {
    
        type: Sequelize.STRING
      },
      telNum_2: {
      
        type: Sequelize.STRING
      },
      telNum_3: {
       
        type: Sequelize.STRING
      },
      locationType: {
        allowNull: false,
        type: Sequelize.CHAR
      },
      entityID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      lasrversion: {
        defaultValue: 'Y',
        type: Sequelize.CHAR
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
    await queryInterface.dropTable('Locations',{ schema: 'static_data'});
  }
};