'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_jabilladvisordetail extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_jabilladvisordetail.init({
  //(เก็บ keyid ของแม่) 
  keyidm:  DataTypes.INTEGER,
  //(เก็บ keyind ของ b_jupc)
  polid: DataTypes.INTEGER,
  customerid: DataTypes.INTEGER,
  motorid: DataTypes.INTEGER,
  grossprem:  DataTypes.FLOAT,
  duty: DataTypes.FLOAT,
  tax:  DataTypes.FLOAT,
  totalprem:  DataTypes.FLOAT,
  "comm-out%":  DataTypes.FLOAT,
  "comm-out-amt":  DataTypes.FLOAT,
  "ov-out%":  DataTypes.FLOAT,
  "ov-out-amt":  DataTypes.FLOAT,
  netflag:  DataTypes.STRING,
  billpremium:  DataTypes.FLOAT,
  updateusercode:  DataTypes.STRING,
  motorid: DataTypes.INTEGER,
  seqno: DataTypes.INTEGER,
  createdAt:  DataTypes.DATE,
  updatedAt:  DataTypes.DATE,
  withheld:  DataTypes.FLOAT,
  policyNo:  DataTypes.STRING,
  dftxno: DataTypes.STRING,
  specdiscamt:  DataTypes.FLOAT,
   
  }, {
    sequelize,
    modelName: 'b_jabilladvisordetail',
    schema: 'static_data'
  });
  return b_jabilladvisordetail;
};