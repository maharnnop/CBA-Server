'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_juepc extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_juepc.init({
    polid: DataTypes.INTEGER,
    previousid: DataTypes.INTEGER,
    endorseNo: DataTypes.STRING,
    edeffdate: DataTypes.DATE,
    edexpdate: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'b_juepc',
    schema: 'static_data'
  });
  return b_juepc;
};