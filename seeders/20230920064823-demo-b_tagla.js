"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    return queryInterface.bulkInsert(
      { tableName: "b_taglas", schema: "static_data" },
      [
        {
          glaccountcode: "11-02-01-02",
          description: "ลูกหนี้-ค่าเบี้ยประกัน-รถยนต์-สมัครใจ",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "11-02-01-07",
          description: "รายได้ค่านายหน้าค้างรับ-รถยนต์-สมัครใจ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "42-04-00-04",
          description: "ส่วนลดจ่าย-สมัครใจ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "51-03-01-02",
          description: "ค่านายหน้าจ่าย-รถยนต์-สมัครใจ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "21-02-01-07",
          description: "เจ้าหนี้-ค่าเบี้ยประกัน-รถยนต์-สมัครใจ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "41-01-00-03",
          description: "รายได้ค่านายหน้าประกัน-รถยนต์-สมัครใจ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "21-03-02-06",
          description: "ภาษีขาย-รอเรียกเก็บ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "21-02-01-30",
          description: "ส่วนลดจ่่าย-ค้างจ่าย",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "21-02-01-12",
          description: "ค่านายหน้าค้างจ่าย-รถยนต์-สมัครใจ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          glaccountcode: "11-02-01-11",
          description: "รายได้ค่าบริหารการตลาด-ค้างรับ",

          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    return queryInterface.bulkDelete(
      { tableName: "b_taglas", schema: "static_data" },
      null,
      {}
    );
  },
};
