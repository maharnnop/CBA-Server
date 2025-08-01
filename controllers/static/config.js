const Amphur = require("../../models").Amphur; //imported fruits array
const Province =require("../../models").Province;
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize  } = require("sequelize");
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


const showAllidcardtype = (req,res)=>{
 
  sequelize.query(
    `select * from static_data."b_tuinico" where initype = 'IDCARDTYPE' and activeflag = 'Y' order by inicode ASC`,
        {
          type: QueryTypes.SELECT
        }
      ).then((idcradtypes) => {
    res.json(idcradtypes);
  });
}

const showAll_tusource = async (req,res)=>{
  try{
     let cond = ' 1=1 '
     console.log(req.body.activeflag);
     
  if ('activeflag' in req.body  && req.body.activeflag !== ""){
    cond += ` and activeflag = '${req.body.activeflag}'`
  }
  const data = await sequelize.query(
    `select * from static_data."b_tusource" 
    where 
    ${cond}
    order by activeflag desc, description `,
        {
          type: QueryTypes.SELECT
        }
      )
   await res.json(data);
    } catch (error) {

    console.error(error.message)
    await res.status(500).json({ message: error.message });
  }
}
const insert_tusource = async (req,res)=>{
  try{
const data = await sequelize.query(
    `select * from static_data."b_tusource"
    where "sourceCode" = :sourceCode and activeflag = 'Y' ;`,{
          replacements: {
        sourceCode: req.body.sourceCode,
        description: req.body.description

      },
          type: QueryTypes.SELECT
        }
      )
    
if(data.length > 0){
  throw new Error(`พบแหล่งงาน ${req.body.sourceCode} ซ้ำกันในระบบ `);
  
}
  const insert = await sequelize.query(
    `INSERT INTO static_data.b_tusource
("sourceCode", description, activeflag, "createdAt")
VALUES(:sourceCode, :description, 'Y', now()) returning id;`,{
          replacements: {
        sourceCode: req.body.sourceCode,
        description: req.body.description

      },
          type: QueryTypes.INSERT
        }
      )
      const keyidm = insert[0][0].id


   await res.json({ id : keyidm, message : `เพิ่มแหล่งงาน  : ${req.body.description} สำเร็จ!!!`});
    } catch (error) {

    console.error(error.message)
    await res.status(500).json({ message: error.message });
  }

}

const update_tusource = async (req,res)=>{
  try{
const data = await sequelize.query(
    `select * from static_data."b_tusource"
    where "sourceCode" = :sourceCode 
    and activeflag = 'Y' 
    and id != :sourceid;`,{
          replacements: {
        sourceCode: req.body.sourceCode,
        description: req.body.description,
        sourceid : req.body.sourceid

      },
          type: QueryTypes.SELECT
        }
      )
if(data.length > 0 && req.body.activeflag == 'Y'){
  throw new Error(`พบแหล่งงาน ${req.body.sourceCode} ซ้ำกันในระบบ `);
  
}
  const insert = await sequelize.query(
    `UPDATE static_data.b_tusource
SET "sourceCode"= :sourceCode
, description = :description
, activeflag = :activeflag
, "updatedAt"= now()
where id = :sourceid ;`,{
          replacements: {
        sourceCode: req.body.sourceCode,
        description: req.body.description,
        activeflag: req.body.activeflag,
        sourceid: req.body.sourceid,

      },
          type: QueryTypes.UPDATE
        }
      )

   await res.json({  message : `อัพเดทข้อมูล ${req.body.sourceCode} สำเร็จ`});
    } catch (error) {

    console.error(error.message)
    await res.status(500).json({ message: error.message });
  }

}



module.exports = {
  showAllidcardtype,
  showAll_tusource,
  insert_tusource,
  update_tusource,
  // postCar,
  // removeCar,
  // editCar,
};