'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Endorse extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Endorse.init({
    endorseNo:  DataTypes.STRING,
    edeffdate: DataTypes.DATEONLY,
    edefftime:  DataTypes.STRING,
    edexpdate:DataTypes.DATEONLY,
    edexptime: DataTypes.STRING,
    edtype: DataTypes.STRING,
    createdAt:  DataTypes.DATE,
    updatedAt:  DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Endorse',
    schema: 'static_data'
  });
  return Endorse;
};