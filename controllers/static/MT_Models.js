// const Amphur = require("../../models").Amphur; //imported fruits array
const MT_Model = require("../../models").MT_Model
const { Op, QueryTypes, Sequelize } = require("sequelize");
//handle index request

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT,
  port: process.env.DB_PORT,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
  },
});

const showAll = (req,res) =>{
    MT_Model.findAll({
      attributes: ['MODELCODE','BRANDCODE','MODELNAMETH','MODELNAME'],
      order:[['MODELNAME',  'ASC']],
      where: {
        'activeflag' : 'Y'
      }
    }).then((models)=>{
        res.json(models);
    })
}

const showAllinBrand = (req, res) => {

  sequelize.query(
    `select * from static_data."MT_Models" m  
    where m."BRANDCODE" =(select "BRANDCODE" from static_data."MT_Brands" b where b."BRANDNAME" = :brandname and b.activeflag ='Y' )
    and m.activeflag ='Y'
    and m."MODELNAMETH" is not null
    and m."MODELNAME" is not null
    order by m."MODELNAMETH" ASC`,
    {
          replacements: {
            brandname:req.body.brandname,
          },
          type: QueryTypes.SELECT
        }
      ).then((tambon) => {
    res.json(tambon);
  });
   
};

const searchByinModel = (req,res)=>{
  if (req.params.para === 'EN') {
    MT_Model.findAll({
      attributes: ['MODELCODE','BRANDCODE','MODELNAMETH','MODELNAME'],
      where: {
        MODELNAME :{
          [Op.like]:'%'+ req.params.value +'%'
        }
      }
    }).then((models) => {
      res.json(models);
    });
  } else if (req.params.para === 'TH') {
    MT_Brand.findAll({
      attributes: ['MODELCODE','BRANDCODE','MODELNAMETH','MODELNAME'],
      where: {
        MODELNAMETH :{
          [Op.like]:'%'+ req.params.value +'%'
        }
      }
    }).then((models) => {
      res.json(models);
    });
  }
  
}
const showAllSpecinModel = (req, res) => {

  sequelize.query(
    `select * from static_data."MT_Specs" s
    where s."MODELCODE"  =(select "MODELCODE"  from static_data."MT_Models" m  where m."MODELNAME"  = :modelname and m.activeflag ='Y' limit 1)
    and s.activeflag ='Y'
    and s."SPECNAMETH"  is not null
    and s."SPECNAME"  is not null
    order by s."SPECNAMETH"  asc `,
    {
          replacements: {
            modelname:req.body.modelname,
          },
          type: QueryTypes.SELECT
        }
      ).then((tambon) => {
    res.json(tambon);
  });
   
};

const findMotorData = (req, res) => {

   let cond = ''
   if (req.body.chassisNo !== '') {
     cond = cond + ` and m."chassisNo" like '%${req.body.chassisNo}%' `
   }
   if (req.body.licenseNo !== '') {
     cond = cond + ` and m."licenseNo" like '%${req.body.licenseNo}%'  `
   }
   if (req.body.motorprovince !== '') {
     cond = cond + ` and p.t_provincename  like '%${req.body.motorprovince}%' `
   }

  sequelize.query(
    `select m."chassisNo" ,m."licenseNo" ,p.t_provincename as "motorprovinceID",
    m."engineNo", m."voluntaryCode" , m."compulsoryCode" , m.brand as brandname,
    m.model as modelname, m.specname , m.cc, m.seat , m.gvw ,m."modelYear" ,m.unregisterflag  from static_data."Motors" m 
    join static_data.provinces p on p.provinceid  = m."motorprovinceID" 
    where 1=1
     ${cond}`,
    {
          replacements: {
          
          },
          type: QueryTypes.SELECT
        }
      ).then((motor) => {
    res.json(motor);
  });
   
};


const findMotorFleet = (req, res) => {



 sequelize.query(
   `select m.id, m."chassisNo" ,m."licenseNo" ,p.t_provincename as "motorprovince",
   m."engineNo", m."voluntaryCode" , m."compulsoryCode" , m.brand as brand,
   m.model as model, m.specname , m.cc, m.seat , m.gvw ,m."modelYear" ,m.unregisterflag ,m."addition_access"
   from  static_data."FleetGroups" fg 
   join static_data."Motors" m on m.id = fg."itemID" 
   left join static_data.provinces p on p.provinceid  = m."motorprovinceID" 
   where 1=1
   and fg."type" = 'Motors'
   -- and fg."fleetCode" =  :fleetCode
   and fg."groupCode" = :itemList `,
   {
         replacements: {
          itemList : req.body.itemList,
          fleetCode : req.body.fleetCode
         },
         type: QueryTypes.SELECT
       }
     ).then((motor) => {
   res.json(motor);
 });
  
};

module.exports = {
  showAll,
  searchByinModel,
  showAllinBrand,
  showAllSpecinModel,
  findMotorData,
  findMotorFleet
  // postCar,
  // removeCar,
  // editCar,
};