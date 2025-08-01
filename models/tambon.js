'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Tambon extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Tambon.init({
    tambonid: DataTypes.INTEGER,
    t_tambonname: DataTypes.STRING,
    e_tambonname: DataTypes.STRING,
    amphurid: DataTypes.INTEGER,
    postcodeall: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Tambon',
    schema: 'static_data'
  });
  return Tambon;
};