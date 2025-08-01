'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_jaarap extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_jaarap.init({
    billadvisorno: DataTypes.STRING,
    cashierreceiveno:DataTypes.STRING,
    cashieramt:  DataTypes.FLOAT,
    insurercode: DataTypes.STRING,
    advisorcode: DataTypes.STRING,
    type:  DataTypes.STRING,
    transactiontype: DataTypes.STRING,
    actualvalue:  DataTypes.FLOAT,
    diffamt:  DataTypes.FLOAT,
    status:  DataTypes.STRING,
    createusercode:DataTypes.STRING,
    updateusercode:DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt:  DataTypes.DATE
  }, {
    sequelize,
    modelName: 'b_jaarap',
    schema: 'static_data'
  });
  return b_jaarap;
};