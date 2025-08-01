'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class b_tagla extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  b_tagla.init({
    glaccountcode: DataTypes.STRING,
    description: DataTypes.STRING,
    glclass: DataTypes.STRING,
    glsubclass: DataTypes.STRING,
    
  }, {
    sequelize,
    modelName: 'b_tagla',
    schema: 'static_data'
  });
  return b_tagla;
};