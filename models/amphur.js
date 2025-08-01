'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Amphur extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Amphur.init({
    amphurid: DataTypes.INTEGER,
    t_amphurname: DataTypes.STRING,
    e_amphurname: DataTypes.STRING,
    provinceid: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Amphur',
    schema: 'static_data'
  });
  return Amphur;
};