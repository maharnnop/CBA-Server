'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CommOVOut extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CommOVOut.init({
    // coOutID: DataTypes.INTEGER,
    insurerCode: DataTypes.STRING,
    agentCode: DataTypes.STRING,
    insureID: DataTypes.INTEGER,
    // for MT
    voluntaryCode: DataTypes.STRING, // 110, 220, 330
    brandID:  DataTypes.INTEGER,
    modelID:  DataTypes.INTEGER,
    //for FR
    riskGruop:DataTypes.STRING, // hight, medium, low
    //for PA
    planCode: DataTypes.STRING,
    rateComOut: DataTypes.FLOAT,
    // amountComOut:  DataTypes.FLOAT,
    rateOVOut_1: DataTypes.FLOAT,
    lastversion : DataTypes.STRING,
    // amountOVOut_1: DataTypes.FLOAT,
    // rateOVOut_2: DataTypes.FLOAT,
    // amountOVOut_2:DataTypes.FLOAT,
    // rateOVOut_3:  DataTypes.FLOAT,
    // amountOVOut_3: DataTypes.FLOAT,
    // rateOVOut_4:  DataTypes.FLOAT,
    // amountOVOut_4:  DataTypes.FLOAT,
    // rateOVOut_5:  DataTypes.FLOAT,
    // amountOVOut_5:  DataTypes.FLOAT,
  }, {
    sequelize,
    modelName: 'CommOVOut',
    schema: 'static_data'
  });
  return CommOVOut;
};