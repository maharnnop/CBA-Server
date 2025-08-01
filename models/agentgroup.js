'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AgentGroup extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  AgentGroup.init({
    agentGroupCode:  DataTypes.STRING,
    agentGroupName: DataTypes.STRING,
    desp:  DataTypes.STRING,
   
  }, {
    sequelize,
    modelName: 'AgentGroup',
    schema: 'static_data'
  });
  return AgentGroup;
};