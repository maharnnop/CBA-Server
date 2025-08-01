'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_tuedt extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_tuedt.init({
    edtypecode: DataTypes.STRING,
    t_title: DataTypes.STRING,
    activeflag: DataTypes.STRING,
    effprem: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'b_tuedt',
    schema: 'static_data'
  });
  return b_tuedt;
};