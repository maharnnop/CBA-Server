'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_juepm extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_juepm.init({
    polid: DataTypes.INTEGER,
    diffnetgrossprem: DataTypes.FLOAT,
    diffduty: DataTypes.FLOAT,
    difftax: DataTypes.FLOAT,
    difftotalprem: DataTypes.FLOAT,
    discinamt: DataTypes.FLOAT
  }, {
    sequelize,
    modelName: 'b_juepm',
    schema: 'static_data'
  });
  return b_juepm;
};