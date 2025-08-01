'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MT_Color extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  MT_Color.init({
    COLORCODE: DataTypes.INTEGER,
    COLORNAMETH: DataTypes.STRING,
    COLORNAMEENG: DataTypes.STRING,
    FLAGDELETE: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'MT_Color',
    schema: 'static_data'
  });
  return MT_Color;
};