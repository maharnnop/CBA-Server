'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Entities', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      personType: {
        allowNull: false,
        type: Sequelize.CHAR
      },
      titleID: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      t_ogName: {
        type: Sequelize.STRING
      },
      t_suffixName: {
        type: Sequelize.STRING
      },
      e_ogName: {
        type: Sequelize.STRING
      },
      t_firstName: {
        type: Sequelize.STRING
      },
      t_lastName: {
        type: Sequelize.STRING
      },
      e_firstName: {
        type: Sequelize.STRING
      },
      e_lastName: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      // IDCARD type บัตรปชช หนังสือเดินทาง
      idCardType: {
        type: Sequelize.STRING
      },
      idCardNo: {
        type: Sequelize.STRING
      },
      idCardActDate: {
        type: Sequelize.DATEONLY
      },
      idCardExpDate: {
        type: Sequelize.DATEONLY
      },
      dateOfBirth: {
        type: Sequelize.DATEONLY
      },
      gender: {
        type: Sequelize.STRING
      },
      // ประเภทการประกอบธุรกิจ
      ogType: {
        type: Sequelize.STRING
      },
      // เลขทะเบียนการค้า
      taxNo: {
        type: Sequelize.STRING
      },
      taxActDate: {
        type: Sequelize.DATEONLY
      },
      taxExpDate: {
        type: Sequelize.DATEONLY
      },
      // จดทะเบียน VAT ไหม
      vatRegis: {
        type: Sequelize.BOOLEAN
      },
      // เลขที่ ภพ 20
      pk20:{
        type: Sequelize.STRING
      },
      //ชื่อสาขา กรณี เป็น สาขาย่อย 
      branch:{
        type: Sequelize.STRING
      },
      note:{
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
    await queryInterface.dropTable('Entities',{ schema: 'static_data'});
  }
};