'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Location extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Location.init({
    t_location_1:  DataTypes.STRING,
    t_location_2: DataTypes.STRING,
    t_location_3:  DataTypes.STRING,
    t_location_4:  DataTypes.STRING,
    t_location_5: DataTypes.STRING,
    e_location_1:DataTypes.STRING,
    e_location_2:  DataTypes.STRING,
    e_location_3: DataTypes.STRING,
    e_location_4:DataTypes.STRING,
    e_location_5:  DataTypes.STRING,
    provinceID:  DataTypes.INTEGER,
    districtID:  DataTypes.INTEGER,
    subDistrictID: DataTypes.INTEGER,
    zipcode:  DataTypes.STRING,
    telNum_1: DataTypes.STRING,
    telNum_2: DataTypes.STRING,
    telNum_3: DataTypes.STRING,
    locationType: DataTypes.CHAR,
    entityID:  DataTypes.INTEGER,
    lastversion : DataTypes.STRING,
    // note:  DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Location',
    schema: 'static_data'
  });
  return Location;
};