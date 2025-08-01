'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_jacashier extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_jacashier.init({
  billadvisorno: DataTypes.STRING,
  cashierreceiveno: DataTypes.STRING,
  cashierdate:  DataTypes.STRING,
  ARNO:DataTypes.STRING,
  transactiontype:DataTypes.STRING,
  insurercode:  DataTypes.STRING,
  advisorcode: DataTypes.STRING,
  customerid: DataTypes.INTEGER,
  receivefrom :DataTypes.STRING,
  receivename :DataTypes.STRING,
  receivetype:  DataTypes.STRING,
  partnerBank: DataTypes.STRING,
  partnerBankbranch:DataTypes.STRING,
  partnerAccountno:DataTypes.STRING,
  amityBank: DataTypes.STRING,
  amityBankBranch: DataTypes.STRING,
  amityAccountno: DataTypes.STRING,
  amt:  DataTypes.FLOAT,
  createusercode:  DataTypes.STRING,
  updateusercode:  DataTypes.STRING,
  cancelusercode:  DataTypes.STRING,
  createdAt:  DataTypes.DATE,
  updatedAt: DataTypes.DATE,
  canceledAt:  DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'b_jacashier',
    schema: 'static_data'
  });
  return b_jacashier;
};