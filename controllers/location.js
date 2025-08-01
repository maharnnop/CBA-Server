const Location = require("../models").Location; //imported fruits array
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op } = require("sequelize");


const getByid = (req, res) => {
  Location.findOne ({
    where: {
        locationID: req.params.id,
        lastversion : 'Y'
    }
  }).then((location) => {
    res.json(location);
  });
};

const newLocation = (req, res) => {
    Location.create (req).then((location) => {
      res.json(location);
    });
  };


module.exports = {

  getByid,
  newLocation
  // postCar,
  // removeCar,
  // editCar,
};