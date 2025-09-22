'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Insuree extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Insuree.init({
    insureeCode: DataTypes.STRING,
    entityID:  DataTypes.INTEGER,
    // เดี่ยว กลุ่ม ภายใต้กลุ่ม
    insureeType:  DataTypes.CHAR,
    // ระดับความเสี่ยง สูง กลาง ต่ำ
    blackList:  DataTypes.CHAR,
    blacklistDesp: DataTypes.STRING,
    lastversion: DataTypes.STRING,
    version:  DataTypes.INTEGER,
    
  }, {
    sequelize,
    modelName: 'Insuree',
    schema: 'static_data'
  });
  return Insuree;
};