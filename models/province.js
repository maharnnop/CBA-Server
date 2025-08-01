'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class province extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  province.init({
    provinceid: DataTypes.INTEGER,
    t_provincename: DataTypes.STRING,
    e_provincename: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'province',
    schema: 'static_data'
  });
  return province;
};