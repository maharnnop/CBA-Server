'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_jugltx extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_jugltx.init({ 
  ttype:  DataTypes.STRING,
  seqno:  DataTypes.INTEGER,
  accountno: DataTypes.STRING,
  gltype: DataTypes.STRING,
  class: DataTypes.STRING,
  subclass: DataTypes.STRING,
  policyno: DataTypes.STRING,
  endorseno:  DataTypes.STRING,
  invoiceno:DataTypes.STRING,
  taxinvoiceno: DataTypes.STRING,
  polikeyid: DataTypes.INTEGER,
  amt:  DataTypes.FLOAT,
  createdAt: DataTypes.DATE,
  
  }, {
    sequelize,
    modelName: 'b_jugltx',
    schema: 'static_data'
  });
  return b_jugltx;
};