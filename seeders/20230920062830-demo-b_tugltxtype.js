'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     * 
    */

    return queryInterface.bulkInsert({ tableName: "b_tugltxtypes", schema: 'static_data' }, [
      {
      ttype: 'POLICY',
      seqno: '1',
      accountno: '11-02-01-02',
      gltype:'D',
      command: 'jupc.totalprem',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      ttype: 'POLICY',
      seqno: '2',
      accountno: '11-02-01-07',
      gltype:'D',
      command: 'jupc.commin + jupc.vatcommin',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      ttype: 'POLICY',
      seqno: '3',
      accountno: '42-04-00-04',
      gltype:'D',
      command: 'jupc.x1',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      ttype: 'POLICY',
      seqno: '4',
      accountno: '51-03-01-02',
      gltype:'D',
      command: 'jupc.commout',
      createdAt: new Date(),
      updatedAt: new Date()
    },{
      ttype: 'POLICY',
      seqno: '5',
      accountno: '21-02-01-07',
      gltype:'C',
      command: 'jupc.totalprem',
      createdAt: new Date(),
      updatedAt: new Date()
    },{
      ttype: 'POLICY',
      seqno: '6',
      accountno: '41-01-00-03',
      gltype:'C',
      command: 'jupc.commin',
      createdAt: new Date(),
      updatedAt: new Date()
    },{
      ttype: 'POLICY',
      seqno: '7',
      accountno: '21-03-02-06',
      gltype:'C',
      command: 'jupc.vatcommin',
      createdAt: new Date(),
      updatedAt: new Date()
    },{
      ttype: 'POLICY',
      seqno: '8',
      accountno: '21-02-01-30',
      gltype:'C',
      command: 'jupc.x1',
      createdAt: new Date(),
      updatedAt: new Date()
    },{
      ttype: 'POLICY',
      seqno: '9',
      accountno: '21-02-01-12',
      gltype:'C',
      command: 'jupc.commout',
      createdAt: new Date(),
      updatedAt: new Date()
    },{
      ttype: 'POLICY',
      seqno: '10',
      accountno: '11-02-01-11',
      gltype:'D',
      command: 'jupc.ovin + jupc.vatovin',
      createdAt: new Date(),
      updatedAt: new Date()
    },
  
  ], {});
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    return queryInterface.bulkDelete({ tableName: "b_tugltxtypes", schema: 'static_data' }, null, {});
  }
};
