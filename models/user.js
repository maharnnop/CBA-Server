'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init({
    userName:  DataTypes.STRING,
    password:  DataTypes.STRING,
    empCode: DataTypes.STRING,
    // password expire date
    pwExpDate:  DataTypes.DATEONLY,
    passwordOld1:DataTypes.STRING,
    passwordOld2: DataTypes.STRING,
    roleID:  DataTypes.INTEGER,
    // Y = lock N = unlock
    role : DataTypes.STRING,
    lockStatus: DataTypes.CHAR,
    loginFailCount: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'User',
    schema: 'static_data'
  });
  return User;
};