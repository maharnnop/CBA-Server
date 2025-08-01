'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_juedt extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_juedt.init({
    polid: DataTypes.INTEGER,
    edtypecode: DataTypes.STRING,
    detail: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'b_juedt',
    schema: 'static_data'
  });
  return b_juedt;
};