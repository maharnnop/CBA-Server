'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_jatw extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_jatw.init({
    keyidm: DataTypes.INTEGER,
    "comm-outamt": DataTypes.FLOAT,
    whtrate:  DataTypes.FLOAT,
    "whtcomm-outamt":  DataTypes.FLOAT,
    "ov-outamt":  DataTypes.FLOAT,
    "whtov-outamt":  DataTypes.FLOAT,
    taxid:  DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'b_jatw',
    schema: 'static_data'
  });
  return b_jatw;
};