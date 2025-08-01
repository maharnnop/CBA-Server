'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_jaarapd extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_jaarapd.init({
    keyidm:  DataTypes.INTEGER,
    polid: DataTypes.INTEGER,
    customerid: DataTypes.INTEGER,
    netflag:  DataTypes.STRING,
    billpremium: DataTypes.FLOAT,
  }, {
    sequelize,
    modelName: 'b_jaarapd',
    schema: 'static_data'
  });
  return b_jaarapd;
};