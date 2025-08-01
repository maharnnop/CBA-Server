'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PaymentNo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PaymentNo.init({
    paymentNo: DataTypes.STRING,
   type: DataTypes.STRING,
    refNo:  DataTypes.STRING,
    amount:  DataTypes.FLOAT,
    repEntityID: DataTypes.INTEGER,
    payEntityID: DataTypes.INTEGER,
    payDate:  DataTypes.DATEONLY
    
  }, {
    sequelize,
    modelName: 'PaymentNo',
    schema: 'static_data'
  });
  return PaymentNo;
};