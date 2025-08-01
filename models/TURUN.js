'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TURUN extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TURUN.init({
    RunID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    BrCode: DataTypes.STRING,
    RunType: DataTypes.STRING,
    Class: DataTypes.STRING,
    SubClass: DataTypes.STRING,
    EffectiveDate: DataTypes.DATE,
    LastNo: DataTypes.INTEGER,
    UpdateDate: DataTypes.DATE,
    UpdateUserCode: DataTypes.STRING,
    UpdateBrCode: DataTypes.STRING,
    Outlet: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'TURUN',
    schema: 'static_data'
  });
  return TURUN;
};