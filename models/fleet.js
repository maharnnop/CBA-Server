'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Fleet extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Fleet.init({
    fleetCode: DataTypes.STRING,
    entityID: DataTypes.INTEGER,
    fleetType: DataTypes.STRING,
    lastversion: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Fleet',
    schema: 'static_data'
  });
  return Fleet;
};