//import Model 
const Policy = require("../models").Policy;
const Transaction = require("../models").Transaction;
const Insuree = require("../models").Insuree;
const InsureType  =  require("../models").InsureType;
const Insurer = require("../models").Insurer;
const Entity = require("../models").Entity;
const Location = require("../models").Location;
const Fleet =  require("../models").Fleet;

const { throws } = require("assert");
const config = require("../config.json");
const process = require('process');
const {getRunNo,getCurrentDate,getCurrentYYMM, getCurrentYY} = require("./lib/runningno");
const account =require('./lib/runningaccount')
const {decode} = require('jsonwebtoken'); // jwt-decode
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize } = require("sequelize");
const { logger } = require("express-winston");
const { loggers } = require("winston");
// const { insures } = require("../routes");
const { required } = require("joi");

const tax =config.tax
const wht = config.wht
const withheld = config.withheld

// Replace 'your_database', 'your_username', 'your_password', and 'your_host' with your database credentials
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

const newFleetCode =  async (req, res) => {
  //create entity 
  const t = await sequelize.transaction();
  try {
    const entity = await Entity.create(req.body.entity,{transaction: t })
    console.log(entity);
    req.body.location.entityID = entity.id
    req.body.fleet.entityID = entity.id
    await Fleet.create(req.body.fleet,{transaction: t })
    await Location.create(req.body.location,{transaction: t })
    await  t.commit()
    await res.json({ status: 'success', fleetCode :req.body.fleetCode})
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json(error);
    
  }
};

const findFleetCode =  async (req, res) => {
try {
    

  //insert to deteil of jatw 
  let cond = ''
  if (req.body.fleetCode !== '' && req.body.fleetCode !== null) {
    cond = cond + ` and f."fleetCode" like '%${req.body.fleetCode}%' `
  }
  if (req.body.firstname !== ''  && req.body.firstname !== null) {
    cond = cond + ` and (e."t_firstName" like '%${req.body.firstname}%' or e."t_ogName" like '%${req.body.firstname}%') `
  }
  if (req.body.lastname !== ''  && req.body.lastname !== null) {
    cond = cond + ` and e."t_lastName"  like '%${req.body.lastname}%' `
  }
    const fleets = await sequelize.query(
      ` select f."fleetCode" ,
      (case when e."personType" = 'O' then t."TITLETHAIBEGIN"||' '||e."t_ogName" || COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t."TITLETHAIEND" else t."TITLETHAIBEGIN"||' '||e."t_firstName"||' '||e."t_lastName"  end) as "fullName" ,
      f."fleetType" as "fleetType"
      from static_data."Fleets" f
      join static_data."Entities" e on f."entityID"  = e.id 
      join static_data."Titles" t on t."TITLEID"  = e."titleID" 
      where f.lastversion = 'Y'
      ${cond} `,
      {
        replacements: {
          fleetCode : req.body.fleetCode,
          firstname : req.body.firstname,
          lastname : req.body.lastname,
        },
        type: QueryTypes.SELECT,
      }
      
    ); 
   
    await res.json(fleets);
  } catch (error) {
    console.error(error)
    await res.status(500).json({ status : 'error', describe : error});
  }
};

const findPolicy =  async (req, res) => {
  let cond = ``
  
  if(req.body.policyNo !== null && req.body.policyNo !== ''){
    cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
  }
  if(req.body.applicationNo !== null && req.body.applicationNo !== ''){
    cond = `${cond} and pol."applicationNo" like '%${req.body.applicationNo}%'`
  }
  const records = await sequelize.query(
    `select pol.*, ent.*, lo.*, inst.*, mt.*,
    pol."policyNo", pol."applicationNo", pol."insurerCode",pol."agentCode",
     inst.class || '/' || inst."subClass" as classsubclass,
     (select t_provincename from static_data."provinces" where provinceid = lo."provinceID" limit 1) as province,
     (select t_amphurname from static_data."Amphurs" where amphurid = lo."districtID" limit 1) as district,
     (select t_tambonname from static_data."Tambons" where tambonid = lo."subDistrictID" limit 1) as subdistrict,
     (select t_provincename from static_data."provinces" where provinceid = mt."motorprovinceID" limit 1) as "motorprovinceID",
     mt.brand  as brandname, mt.model as modelname
    from static_data."Policies" pol 
    join static_data."InsureTypes" inst on inst.id = pol."insureID"
    join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y' 
    join static_data."Entities" ent on ent.id = ine."entityID"
    join static_data."Locations" lo on lo."entityID" = ent.id
    join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    left join static_data."Motors" mt on mt."id" = pol."itemList"
    where  1 = 1
    and lo.lastversion ='Y' 
    ${cond}
    order by pol."applicationNo" ASC `,
    {
     
      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};

const getPolicyList = async (req, res) => {
  let cond = ` pol.status = '${req.body.status}'`
  if(req.body.insurerCode !== null && req.body.insurerCode !== ''){
    cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
  }
  if(req.body.policyNo !== null && req.body.policyNo !== ''){
    cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
  }
  if(req.body.applicationNo !== null && req.body.applicationNo !== ''){
    cond = `${cond} and pol."applicationNo" like '%${req.body.applicationNo}%'`
  }
  if(req.body.insureID !== null && req.body.insureID !== ''){
    cond = `${cond} and pol."insureID" = ${req.body.insureID}`
  }
  if(req.body.createdate_start !== null && req.body.createdate_start !== ''){
    cond = `${cond} and  TO_CHAR(pol."createdAt", 'YYYY-MM-DD') between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
  }
  if(req.body.effdate_start !== null && req.body.effdate_start !== ''){
    cond = `${cond} and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
  }
  if(req.body.createusercode !== null && req.body.createusercode !== ''){
    cond = `${cond} and pol."createusercode" like '%${req.body.createusercode}%'`
  }
  if(req.body.agentCode !== null && req.body.agentCode !== ''){
    cond = `${cond} and pol."agentCode" like '%${req.body.agentCode}%'`
  }
  if(req.body.carRegisNo !== null && req.body.carRegisNo !== ''){
    cond = `${cond} and mt."licenseNo" like '%${req.body.carRegisNo}%'`
  }
  if(req.body.chassisNo !== null && req.body.chassisNo !== ''){
    cond = `${cond} and mt."chassisNo" like '%${req.body.chassisNo}%'`
  }
  if(req.body.provinceID !== null && req.body.provinceID !== ''){
    cond = `${cond} and mt."motorprovinceID" = ${req.body.provinceID}`
  }
  
  const records = await sequelize.query(
    `select *,
    TO_CHAR(pol."createdAt", 'dd/MM/yyyy HH24:MI:SS') AS "polcreatedAt",
    TO_CHAR(pol."updatedAt", 'dd/MM/yyyy HH24:MI:SS') AS "polupdatedAt",
     inst.class as class, inst."subClass" as "subClass",
    ent."personType" as "insureePT",
    (tt."TITLETHAIBEGIN" ||' '||
    (case when trim(ent."personType") = 'O' then ent."t_ogName"|| COALESCE(' สาขา '|| ent."t_branchName",'' ) else ent."t_firstName" || ' ' || ent."t_lastName" end)
    || '  ' || tt."TITLETHAIEND" ) as "fullName",
    (select t_provincename  from static_data.provinces p where provinceid = mt."motorprovinceID" ) as motorprovince
    from static_data."Policies" pol 
    join static_data."InsureTypes" inst on inst.id = pol."insureID"
    left join static_data."Motors" mt on mt.id = pol."itemList"
    join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y'
    join static_data."Entities" ent on ent.id = ine."entityID"
    join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    where ${cond}
    order by pol."applicationNo" ASC `,
    {
     
      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};

// OK fleet STD.
const draftPolicyList = async (req, res) => {
  console.log(`----------- begin draftPolicyList()  ----------------`);
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    //create entity 
    const t = await sequelize.transaction();
  try {

    // check duplicate entity if idcard type = 'บัตรประชาชน'
    const currentdate = getCurrentDate()
    let entity
    let checkEntity
    req.body[i].version  =  1
    
    if (req.body[i].personType === 'P') {
      
      checkEntity =  await sequelize.query(
        `select * from static_data."Entities" 
        where "personType" = 'P' and "idCardType" = 'บัตรประชาชน' and "idCardNo" = :idCardNo and lastversion = 'Y' order by version DESC` ,
        {
          replacements: {
            idCardNo: req.body[i].idCardNo,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })
        if (checkEntity.length > 0){
          if(checkEntity[0].titleID === req.body[i].titleID && checkEntity[0].t_firstName === req.body[i].t_firstName && checkEntity[0].t_lastName === req.body[i].t_lastName) {
            req.body[i].version = checkEntity[0].version 
          }else{
            req.body[i].version = checkEntity[0].version + 1
            await sequelize.query(
              ` UPDATE static_data."Entities" 
              SET lastversion  ='N'
              where  id = :oldid ` ,
              {
                replacements: {
                  oldid: checkEntity[0].id,
                },
                transaction: t,
                type: QueryTypes.UPDATE
              })
          }
        }


        entity =   await sequelize.query(
            `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
            values (:personType, :titleID, :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
            ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
            {
              replacements: {
                personType: req.body[i].personType,
                titleID: req.body[i].titleID,
                t_firstName: req.body[i].t_firstName,
                t_lastName: req.body[i].t_lastName,
                idCardType: req.body[i].idCardType,
                idCardNo: req.body[i].idCardNo,
                
                version : req.body[i].version,
                email: req.body[i].email,
              },
              transaction: t,
              type: QueryTypes.INSERT
            }
          )
          

        
    
    }else if (req.body[i].personType === 'O'){
      entity = await sequelize.query(
        `insert into static_data."Entities" ("personType","titleID","t_ogName","taxNo",email, branch, "t_branchName","vatRegis") 
        values (:personType, :titleID, :t_ogName,:taxNo,:email, :branch, :t_branchName, true) 
        ON CONFLICT ON CONSTRAINT "taxNo" DO NOTHING  RETURNING "id" `,
        {
          replacements: {
            personType: req.body[i].personType,
            titleID: req.body[i].titleID,
            t_ogName: req.body[i].t_ogName,
            taxNo: req.body[i].taxNo,
            email: req.body[i].email,
            branch: req.body[i].branch,
            t_branchName: req.body[i].t_branchName,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
    }
    
    console.log(`------------- insert entity insuree ----------`);
    
      console.log(entity);
      let insureeCode
      if (entity[1] === 1) {   // entity[1] === 1 when create new entity


        const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode:  entity[0][0].id }, { returning: ['insureeCode'], transaction: t })
      
        insureeCode = insuree['dataValues'].insureeCode
        
        //create location
        await sequelize.query(

          'INSERT INTO static_data."Locations" ("entityID", "t_location_1", "t_location_2", "t_location_3", "t_location_4", "t_location_5", "provinceID", "districtID", "subDistrictID", "zipcode", "telNum_1","locationType") ' +
          'values(:entityID, :t_location_1, :t_location_2,  :t_location_3, :t_location_4, :t_location_5, ' +
          '(select "provinceid" from static_data.provinces where t_provincename = :province limit 1), ' +
          '(select "amphurid" from static_data."Amphurs" where t_amphurname = :district limit 1), ' +
          '(select "tambonid" from static_data."Tambons" where t_tambonname = :tambon limit 1), ' +
          ':zipcode, :tel_1, :locationType) ',
          {
            replacements: {
              entityID: entity[0][0].id,
              t_location_1: req.body[i].t_location_1,
              t_location_2: req.body[i].t_location_2,
              t_location_3: req.body[i].t_location_3,
              t_location_4: req.body[i].t_location_4,
              t_location_5: req.body[i].t_location_5,
              province: req.body[i].province,
              district: req.body[i].district,
              tambon: req.body[i].subdistrict,
              zipcode: req.body[i].zipcode.toString(),
              tel_1: req.body[i].telNum_1,
              locationType: 'A'
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
      } else {
        //select insuree
        let conInsuree = ''
        if (req.body[i].personType === "P") {
          conInsuree = `ent."personType" = 'P' and ent."idCardNo" = :idCardNo 
                        and ent."titleID" = :titleID and ent."t_firstName" = :t_firstName 
                        and ent."t_lastName" = :t_lastName and ent."idCardType" = :idCardType`
        }else[
          conInsuree = `ent."personType" = 'O' and ent."taxNo" = :taxNo 
                        and ent."titleID" = :titleID and ent."t_ogName" = :t_ogName 
                        and ent."branch" = :branch `
        ]
        const insuree = await sequelize.query(
          `select * FROM static_data."Insurees" ins 
           JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
           WHERE ${conInsuree}
           and ins.lastversion = 'Y' `,
          { replacements: { 
                          idCardNo: req.body[i].idCardNo ,
                          taxNo: req.body[i].taxNo ,
                          titleID: req.body[i].titleID ,
                          t_firstName: req.body[i].t_firstName ,
                          t_lastName: req.body[i].t_lastName ,
                          t_ogName: req.body[i].t_ogName ,
                          branch: req.body[i].branch ,
                          idCardType: req.body[i].idCardType ,
          },  transaction: t, type: QueryTypes.SELECT })
          
       insureeCode = insuree[0].insureeCode
        

      }
      console.log(`------------- insert insureeCode ----------`);
      //insert new car list
      let cars = [{id: null}]
      if (req.body[i].class === 'MO') {
        req.body[i].groupCode = await getRunNo('grcode',null,null,'kw',currentdate,t);
        for (let j = 0; j < req.body[i].motorData.length; j++) {
          const ele = req.body[i].motorData[j];
          cars = await sequelize.query(
            `WITH inserted AS ( 
            INSERT INTO static_data."Motors" ("brand", "voluntaryCode", "model", "specname", "licenseNo", "motorprovinceID", "chassisNo", "modelYear",
            "compulsoryCode", "unregisterflag", "engineNo", "cc", "seat", "gvw"  ) 
            VALUES (:brandname, :voluntaryCode , :modelname , :specname, :licenseNo, 
             (select provinceid from static_data.provinces  where t_provincename =  :motorprovince limit 1), :chassisNo, :modelYear,
            :compulsoryCode, :unregisterflag, :engineNo, :cc, :seat, :gvw  ) ON CONFLICT ("chassisNo") DO NOTHING RETURNING * ) 
            SELECT * FROM inserted UNION ALL SELECT * FROM static_data."Motors" WHERE "chassisNo" = :chassisNo `,
            {
              replacements: {
                brandname: ele.brand || null,
                voluntaryCode: ele.voluntaryCode|| '',
                modelname: ele.model || null,
                specname: ele.specname || null,
                licenseNo: ele.licenseNo || null,
                motorprovince: ele.motorprovince,
                chassisNo: ele.chassisNo,
                modelYear: ele.modelYear,
  
                compulsoryCode : ele.compulsoryCode || '',
                unregisterflag : ele.unregisterflag || 'N',
                engineNo : ele.engineNo || '',
                cc : ele.cc || null,
                seat : ele.seat || null,
                gvw : ele.gvw || null,
              },
              transaction: t,
              type: QueryTypes.SELECT
            }
          )

          await sequelize.query(
            `INSERT INTO static_data."FleetGroups" ("fleetCode", "groupCode", "type", "itemID") 
            VALUES (:fleetCode, :groupCode , :type , :itemID) `,
            {
              replacements: {
                // fleetCode: req.body[i].fleetCode,
                fleetCode: null,
                groupCode: req.body[i].groupCode,
                type: "Motors",
                itemID: cars[0].id,
              },
              transaction: t,
              type: QueryTypes.INSERT
            }
          )
        }
        console.log(`------------- insert Motor group ----------`);
      }else {
        req.body[i].groupCode = null
      }
      console.log(cars);

      //set defualt comm ov if null 
      const commov = await sequelize.query(
      `select -- (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode"and lastversion='Y'),
          static_data.getagentpersontype(comout."agentCode") as "personType" , * 
      FROM static_data."CommOVOuts" comout 
      JOIN static_data."CommOVIns" comin 
      ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" 
      where comout."agentCode" = :agentcode 
      and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
      and comout."insurerCode" = :insurerCode 
     	and comout.lastversion = 'Y'
     and comin.lastversion = 'Y'`,
      {
        replacements: {
          agentcode: req.body[i].agentCode,
          class: req.body[i].class,
          subClass: req.body[i].subClass,
          insurerCode: req.body[i].insurerCode,
        },
        transaction: t,
        type: QueryTypes.SELECT
      }
    )
    
    // wht3% commov in
      req.body[i][`commin_taxamt`] = parseFloat((req.body[i][`commin_amt`] *wht).toFixed(2))
      req.body[i][`ovin_taxamt`] =  parseFloat((req.body[i][`ovin_amt`] *wht).toFixed(2))
      

    // // tax comm/ov out 1
    // if (commov[0].vatflag === 'Y') {
    //   req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *tax).toFixed(2))
    //   req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] *tax).toFixed(2))
    // }else{
    //   req.body[i][`commout1_taxamt`] = 0
    //   req.body[i][`ovout1_taxamt`] = 0
    // }

    // wht3% comm/ov out 1
    if (commov[0].personType === 'O') {
      req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *wht).toFixed(2))
      req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] *wht).toFixed(2))
    }else{
      req.body[i][`commout1_taxamt`] = 0
      req.body[i][`ovout1_taxamt`] = 0
    }
   

      //check agentcode2
      if( req.body[i][`agentCode2`] ){
        const commov2 = await sequelize.query(
          `select -- (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode"and lastversion='Y'), 
               static_data.getagentpersontype(comout."agentCode") as "personType" , * 
          FROM static_data."CommOVOuts" comout 
          JOIN static_data."CommOVIns" comin 
          ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" 
          where comout."agentCode" = :agentcode 
          and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
          and comout."insurerCode" = :insurerCode 
           and comout.lastversion = 'Y'
         and comin.lastversion = 'Y'`,
          {
            replacements: {
              agentcode: req.body[i].agentCode2,
              class: req.body[i].class,
              subClass: req.body[i].subClass,
              insurerCode: req.body[i].insurerCode,
            },
            type: QueryTypes.SELECT
          }
        )
       
    //    //tax comm/ov out 2
    // if (commov2[0].vatflag === 'Y') {
    //   req.body[i][`commout2_taxamt`] = parseFloat((req.body[i][`commout2_amt`] *tax).toFixed(2))
    //   req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] *tax).toFixed(2))
    // }else{
    //   req.body[i][`commout2_taxamt`] = 0
    //   req.body[i][`ovout2_taxamt`] = 0
    // }

    //wht3% comm/ov out 2
    if (commov2[0].personType === 'O') {
      req.body[i][`commout2_taxamt`] = parseFloat((req.body[i][`commout2_amt`] *wht).toFixed(2))
      req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] *wht).toFixed(2))
    }else{
      req.body[i][`commout2_taxamt`] = 0
      req.body[i][`ovout2_taxamt`] = 0
    }

      req.body[i][`commout_rate`] = parseFloat(req.body[i][`commout1_rate`]) + parseFloat(req.body[i][`commout2_rate`] )
      req.body[i][`commout_amt`] = parseFloat(req.body[i][`commout1_amt`]) +parseFloat(req.body[i][`commout2_amt`])
      req.body[i][`ovout_rate`] = parseFloat(req.body[i][`ovout1_rate`]) + parseFloat(req.body[i][`ovout2_rate`])
      req.body[i][`ovout_amt`] = parseFloat(req.body[i][`ovout1_amt`]) + parseFloat(req.body[i][`ovout2_amt`])
      req.body[i][`commout_taxamt`] = parseFloat(req.body[i][`commout1_taxamt`]) +parseFloat(req.body[i][`commout2_taxamt`])
      req.body[i][`ovout_taxamt`] = parseFloat(req.body[i][`ovout1_taxamt`]) +parseFloat(req.body[i][`ovout2_taxamt`])
        
      }else{
        req.body[i][`agentCode2`] = null
        req.body[i][`commout2_rate`] = 0
        req.body[i][`commout2_amt`] = 0
        req.body[i][`commout2_taxamt`] = 0
        req.body[i][`ovout2_rate`] = 0
        req.body[i][`ovout2_amt`] = 0
        req.body[i][`ovout2_taxamt`] = 0
        req.body[i][`commout_rate`] = req.body[i][`commout1_rate`] 
        req.body[i][`commout_amt`] = req.body[i][`commout1_amt`]
        req.body[i][`ovout_rate`] = req.body[i][`ovout1_rate`]
        req.body[i][`ovout_amt`] = req.body[i][`ovout1_amt`]
        req.body[i][`commout_taxamt`] = req.body[i][`commout1_taxamt`]
        req.body[i][`ovout_taxamt`] = req.body[i][`ovout1_taxamt`] 
      }

         //cal withheld 1% 
    if (req.body[i].personType.trim() === 'O') {
      req.body[i].withheld = Number(((req.body[i].netgrossprem +req.body[i].duty) * withheld).toFixed(2))
    }else{
      req.body[i].withheld
    }
    
    //get application no
    
    req.body[i].applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app',null,null,'kw',currentdate,t);
    console.log(req.body[i].applicationNo);

      //insert policy
      await sequelize.query(
       ` insert into static_data."Policies" ("applicationNo","insureeCode","insurerCode","agentCode","agentCode2","insureID","actDate", "expDate" ,grossprem, duty, tax, totalprem, 
        commin_rate, commin_amt, ovin_rate, ovin_amt, commin_taxamt, ovin_taxamt, commout_rate, commout_amt, ovout_rate, ovout_amt,
        commout1_taxamt, ovout1_taxamt, commout2_taxamt, ovout2_taxamt, commout_taxamt, ovout_taxamt,
        createusercode, "itemList","insurancestatus" , 
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, netgrossprem, specdiscrate, specdiscamt, cover_amt, withheld,
        duedateinsurer, duedateagent, endorseseries, "fleetflag") 
        -- 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree), '+
        values ( :applicationNo, :insureeCode, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion =\'Y\'), 
        :agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ), 
        :actDate, :expDate, :grossprem, :duty, :tax, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
        :commout1_taxamt, :ovout1_taxamt, :commout2_taxamt, :ovout2_taxamt, :commout_taxamt, :ovout_taxamt,
        :createusercode, :itemList , :insurancestatus, 
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :withheld,
        :dueDateInsurer, :dueDateAgent, :endorseseries, :fleetflag )`
        ,
        {
          replacements: {
            applicationNo: req.body[i].applicationNo,
            endorseseries: -99,
            insurancestatus : 'AI',
            // seqNoins: req.body[i].seqNoins,
            // seqNoagt: req.body[i].seqNoagt,
            // entityInsuree:
            insureeCode: insureeCode,
            insurerCode: req.body[i].insurerCode,
            class: req.body[i].class,
            subClass: req.body[i].subClass,
            agentCode: req.body[i].agentCode,
            agentCode2: req.body[i].agentCode2,
            actDate: req.body[i].actDate,
            expDate: req.body[i].expDate,
            grossprem: req.body[i].grossprem,
            netgrossprem: req.body[i].netgrossprem,
            duty: req.body[i].duty,
            tax: req.body[i].tax,
            totalprem: req.body[i].totalprem,
            specdiscrate: req.body[i][`specdiscrate`],
            specdiscamt: req.body[i][`specdiscamt`],
            commin_rate: req.body[i][`commin_rate`],
            commin_amt: req.body[i][`commin_amt`],
            ovin_rate: req.body[i][`ovin_rate`],
            ovin_amt: req.body[i][`ovin_amt`],
            commin_taxamt: req.body[i][`commin_taxamt`],
            ovin_taxamt: req.body[i][`ovin_taxamt`],
            commout_rate: req.body[i][`commout_rate`],
            commout_amt: req.body[i][`commout_amt`],
            ovout_rate: req.body[i][`ovout_rate`],
            ovout_amt: req.body[i][`ovout_amt`],
            commout1_rate: req.body[i][`commout1_rate`],
            commout1_amt: req.body[i][`commout1_amt`],
            ovout1_rate: req.body[i][`ovout1_rate`],
            ovout1_amt: req.body[i][`ovout1_amt`],
            commout2_rate: req.body[i][`commout2_rate`],
            commout2_amt: req.body[i][`commout2_amt`],
            ovout2_rate: req.body[i][`ovout2_rate`],
            ovout2_amt: req.body[i][`ovout2_amt`],
            cover_amt:req.body[i][`cover_amt`],
            createusercode: usercode,
            withheld: req.body[i].withheld,
            dueDateInsurer:req.body[i].dueDateInsurer,
            dueDateAgent: req.body[i].dueDateAgent,
            commout1_taxamt: req.body[i][`commout1_taxamt`],
            ovout1_taxamt: req.body[i][`ovout1_taxamt`],
            commout2_taxamt: req.body[i][`commout2_taxamt`],
            ovout2_taxamt: req.body[i][`ovout2_taxamt`],
            commout_taxamt: req.body[i][`commout_taxamt`],
            ovout_taxamt: req.body[i][`ovout_taxamt`],
            itemList: req.body[i].groupCode,
            // fleetCode : req.body[i][`fleetCode`],
            fleetflag : 'Y',
            
            
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )


    
    await t.commit();
    appNo.push(req.body[i].applicationNo)
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ status: 'error',describe:error,  appNo: appNo });
    return "fail"
    
  }
  
}

await res.json({ status: 'success', appNo: appNo })


};

// fleet INV.
const draftPolicyExcel = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    //create entity 
    const t = await sequelize.transaction();
  try {

    // check duplicate entity if idcard type = 'บัตรประชาชน'
    const currentdate = getCurrentDate()
    let entity
    let checkEntity
    req.body[i].version  =  1
    if (req.body[i].personType === 'P') {
      const title =  await sequelize.query(
        `SELECT COALESCE(
          (SELECT "TITLEID" 
           FROM static_data."Titles" t 
           WHERE t."TITLETHAIBEGIN" = :title limit 1), 
          (SELECT "TITLEID" 
           FROM static_data."Titles" t 
           WHERE t."TITLETHAIBEGIN" = 'คุณ')
        ) AS result; ` ,
        {
          replacements: {
            title: req.body[i].title,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })
        req.body[i].titleID = title[0].TITLEID
      checkEntity =  await sequelize.query(
        `select * from static_data."Entities" 
        where "personType" = 'P' and "idCardType" = 'บัตรประชาชน' and "idCardNo" = :idCardNo and lastversion = 'Y' order by version DESC` ,
        {
          replacements: {
            idCardNo: req.body[i].idCardNo,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })

        if (checkEntity.length > 0){
          if(checkEntity[0].titleID === req.body[i].titleID && checkEntity[0].t_firstName === req.body[i].t_firstName && checkEntity[0].t_lastName === req.body[i].t_lastName) {
            req.body[i].version = checkEntity[0].version 
          }else{
            req.body[i].version = checkEntity[0].version + 1
            await sequelize.query(
              ` UPDATE static_data."Entities" 
              SET lastversion  ='N'
              where  id = :oldid ` ,
              {
                replacements: {
                  oldid: checkEntity[0].id,
                },
                transaction: t,
                type: QueryTypes.UPDATE
              })
          }
        }


        entity =   await sequelize.query(
            `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
            values (:personType, :titleID, :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
            ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
            {
              replacements: {
                personType: req.body[i].personType,
                titleID: req.body[i].titleID,
                t_firstName: req.body[i].t_firstName,
                t_lastName: req.body[i].t_lastName,
                idCardType: req.body[i].idCardType,
                idCardNo: req.body[i].idCardNo,
                
                version : req.body[i].version,
                email: req.body[i].email,
              },
              transaction: t,
              type: QueryTypes.INSERT
            }
          )
          

        
    
    }else if (req.body[i].personType === 'O'){
  
        const title =  await sequelize.query(
          `SELECT COALESCE(
            (SELECT "TITLEID" 
             FROM static_data."Titles" t 
             WHERE t."TITLETHAIBEGIN" = :title limit 1), 
            (SELECT "TITLEID" 
             FROM static_data."Titles" t 
             WHERE t."TITLETHAIBEGIN" = 'บริษัท' limit 1)
          ) AS result; ` ,
          {
            replacements: {
              title: req.body[i].title,
            },
            transaction: t,
            type: QueryTypes.SELECT
          })
          req.body[i].titleID = title[0].TITLEID

      entity = await sequelize.query(
        `insert into static_data."Entities" ("personType","titleID","t_ogName","taxNo",email, branch, "t_branchName","vatRegis") 
        values (:personType, :titleID, :t_ogName,:taxNo,:email, :branch, :t_branchName, true) 
        ON CONFLICT ON CONSTRAINT "taxNo" DO NOTHING  RETURNING "id" `,
        {
          replacements: {
            personType: req.body[i].personType,
            titleID: req.body[i].titleID,
            t_ogName: req.body[i].t_ogName,
            taxNo: req.body[i].taxNo,
            email: req.body[i].email,
            branch: req.body[i].branch,
            t_branchName: req.body[i].t_branchName,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
    }
    

    
      console.log(entity);
      let insureeCode
      if (entity[1] === 1) {   // entity[1] === 1 when create new entity


        const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode:  entity[0][0].id }, { returning: ['insureeCode'], transaction: t })
      
        insureeCode = insuree['dataValues'].insureeCode
        
        //create location
        await sequelize.query(

          'INSERT INTO static_data."Locations" ("entityID", "t_location_1", "t_location_2", "t_location_3", "t_location_4", "t_location_5", "provinceID", "districtID", "subDistrictID", "zipcode", "telNum_1","locationType") ' +
          'values(:entityID, :t_location_1, :t_location_2,  :t_location_3, :t_location_4, :t_location_5, ' +
          '(select "provinceid" from static_data.provinces where t_provincename = :province limit 1), ' +
          '(select "amphurid" from static_data."Amphurs" where t_amphurname = :district limit 1), ' +
          '(select "tambonid" from static_data."Tambons" where t_tambonname = :tambon limit 1), ' +
          ':zipcode, :tel_1, :locationType) ',
          {
            replacements: {
              entityID: entity[0][0].id,
              t_location_1: req.body[i].t_location_1,
              t_location_2: req.body[i].t_location_2,
              t_location_3: req.body[i].t_location_3,
              t_location_4: req.body[i].t_location_4,
              t_location_5: req.body[i].t_location_5,
              province: req.body[i].province,
              district: req.body[i].district,
              tambon: req.body[i].subdistrict,
              zipcode: req.body[i].zipcode.toString(),
              tel_1: req.body[i].telNum_1,
              locationType: 'A'
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
      } else {
        //select insuree
        let conInsuree = ''
        if (req.body[i].personType === "P") {
          conInsuree = `ent."personType" = 'P' and ent."idCardNo" = :idCardNo 
                        and ent."titleID" = :titleID and ent."t_firstName" = :t_firstName 
                        and ent."t_lastName" = :t_lastName and ent."idCardType" = :idCardType`
        }else[
          conInsuree = `ent."personType" = 'O' and ent."taxNo" = :taxNo 
                        and ent."titleID" = :titleID and ent."t_ogName" = :t_ogName 
                        and ent."branch" = :branch `
        ]
        const insuree = await sequelize.query(
          `select * FROM static_data."Insurees" ins 
           JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
           WHERE ${conInsuree}
           and ins.lastversion = 'Y' `,
          { replacements: { 
                          idCardNo: req.body[i].idCardNo ,
                          taxNo: req.body[i].taxNo ,
                          titleID: req.body[i].titleID ,
                          t_firstName: req.body[i].t_firstName ,
                          t_lastName: req.body[i].t_lastName ,
                          t_ogName: req.body[i].t_ogName ,
                          branch: req.body[i].branch ,
                          idCardType: req.body[i].idCardType ,
          },  transaction: t, type: QueryTypes.SELECT })
          
       insureeCode = insuree[0].insureeCode
        

      }

      //insert new car list
      let cars = [{id: null}]
      if (req.body[i].class === 'MO') {
        req.body[i].groupCode = await getRunNo('grcode',null,null,'kw',currentdate,t);
        for (let j = 0; j < req.body[i].motorData.length; j++) {
          const ele = req.body[i].motorData[j];
          cars = await sequelize.query(
            `WITH inserted AS ( 
            INSERT INTO static_data."Motors" ("brand", "voluntaryCode", "model", "specname", "licenseNo", "motorprovinceID", "chassisNo", "modelYear",
            "compulsoryCode", "unregisterflag", "engineNo", "cc", "seat", "gvw"  ) 
            VALUES (:brandname, :voluntaryCode , :modelname , :specname, :licenseNo, 
             (select provinceid from static_data.provinces  where t_provincename =  :motorprovince limit 1), :chassisNo, :modelYear,
            :compulsoryCode, :unregisterflag, :engineNo, :cc, :seat, :gvw  ) ON CONFLICT ("chassisNo") DO NOTHING RETURNING * ) 
            SELECT * FROM inserted UNION ALL SELECT * FROM static_data."Motors" WHERE "chassisNo" = :chassisNo `,
            {
              replacements: {
                brandname: ele.brand || null,
                voluntaryCode: ele.voluntaryCode|| '',
                modelname: ele.model || null,
                specname: ele.spec || null,
                licenseNo: ele.licenseNo || null,
                motorprovince: ele.motorprovince,
                chassisNo: ele.chassisNo,
                modelYear: ele.modelYear,
  
                compulsoryCode : ele.compulsoryCode || '',
                unregisterflag : ele.unregisterflag || 'N',
                engineNo : ele.engineNo || '',
                cc : ele.cc || null,
                seat : ele.seat || null,
                gvw : ele.gvw || null,
              },
              transaction: t,
              type: QueryTypes.SELECT
            }
          )

          await sequelize.query(
            `INSERT INTO static_data."FleetGroups" ("fleetCode", "groupCode", "type", "itemID") 
            VALUES (:fleetCode, :groupCode , :type , :itemID) `,
            {
              replacements: {
                fleetCode: req.body[i].fleetCode,
                groupCode: req.body[i].groupCode,
                type: "Motors",
                itemID: cars[0].id,
              },
              transaction: t,
              type: QueryTypes.INSERT
            }
          )
        }
       
      }
      console.log(cars);

      //set defualt comm ov if null 
      const commov = await sequelize.query(
      `select (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode"and lastversion='Y'), * 
      FROM static_data."CommOVOuts" comout 
      JOIN static_data."CommOVIns" comin 
      ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" 
      where comout."agentCode" = :agentcode 
      and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
      and comout."insurerCode" = :insurerCode 
     	and comout.lastversion = 'Y'
     and comin.lastversion = 'Y'`,
      {
        replacements: {
          agentcode: req.body[i].agentCode,
          class: req.body[i].class,
          subClass: req.body[i].subClass,
          insurerCode: req.body[i].insurerCode,
        },
        transaction: t,
        type: QueryTypes.SELECT
      }
    )
    //set commov in
    req.body[i][`commin_rate`] = parseFloat(commov[0].rateComIn)
    req.body[i][`ovin_rate`] = parseFloat(commov[0].rateOVIn_1)
    req.body[i][`commin_amt`] = parseFloat((commov[0].rateComIn * req.body[i]['netgrossprem']).toFixed(2))
    req.body[i][`ovin_amt`] = parseFloat((commov[0].rateOVIn_1 * req.body[i]['netgrossprem']).toFixed(2))
    
    // tax commov in
      req.body[i][`commin_taxamt`] = parseFloat((req.body[i][`commin_amt`] *tax).toFixed(2))
      req.body[i][`ovin_taxamt`] =  parseFloat((req.body[i][`ovin_amt`] *tax).toFixed(2))
      
      req.body[i][`commout1_rate`] = parseFloat(commov[0].rateComOut)
      req.body[i][`ovout1_rate`] = parseFloat(commov[0].rateOVOut_1)
      req.body[i][`commout1_amt`] = parseFloat((commov[0].rateComOut * req.body[i]['netgrossprem']).toFixed(2))
      req.body[i][`ovout1_amt`] = parseFloat((commov[0].rateOVOut_1 * req.body[i]['netgrossprem']).toFixed(2))

      req.body[i][`commout2_rate`] = 0
      req.body[i][`ovout2_rate`] = 0
      req.body[i][`commout2_amt`] = 0
      req.body[i][`ovout2_amt`] = 0
      

    //tax comm/ov out 1
    if (commov[0].vatflag === 'Y') {
      req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *tax).toFixed(2))
      req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] *tax).toFixed(2))
    }else{
      req.body[i][`commout1_taxamt`] = 0
      req.body[i][`ovout1_taxamt`] = 0
    }
      req.body[i][`commout2_taxamt`] = 0
      req.body[i][`ovout2_taxamt`] = 0
   

      //check agentcode2
      if( req.body[i][`agentCode2`] ){
        const commov2 = await sequelize.query(
          `select (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode"and lastversion='Y'), * 
          FROM static_data."CommOVOuts" comout 
          JOIN static_data."CommOVIns" comin 
          ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" 
          where comout."agentCode" = :agentcode 
          and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
          and comout."insurerCode" = :insurerCode 
           and comout.lastversion = 'Y'
         and comin.lastversion = 'Y'`,
          {
            replacements: {
              agentcode: req.body[i].agentCode2,
              class: req.body[i].class,
              subClass: req.body[i].subClass,
              insurerCode: req.body[i].insurerCode,
            },
            type: QueryTypes.SELECT
          }
        )
        req.body[i][`commout2_rate`] = parseFloat(commov2[0].rateComOut)
        req.body[i][`ovout2_rate`] = parseFloat(commov2[0].rateOVOut_1)
        req.body[i][`commout2_amt`] = parseFloat((commov2[0].rateComOut * req.body[i]['netgrossprem']).toFixed(2))
        req.body[i][`ovout2_amt`] = parseFloat((commov2[0].rateOVOut_1 * req.body[i]['netgrossprem']).toFixed(2))

       //tax comm/ov out 2
    if (commov2[0].vatflag === 'Y') {
      req.body[i][`commout2_taxamt`] = parseFloat((req.body[i][`commout2_amt`] *tax).toFixed(2))
      req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] *tax).toFixed(2))
    }
     
      }else{
        req.body[i][`agentCode2`] = null
        // req.body[i][`commout2_rate`] = 0
        // req.body[i][`commout2_amt`] = 0
        // req.body[i][`commout2_taxamt`] = 0
        // req.body[i][`ovout2_rate`] = 0
        // req.body[i][`ovout2_amt`] = 0
        // req.body[i][`ovout2_taxamt`] = 0
        // req.body[i][`commout_rate`] = req.body[i][`commout1_rate`] 
        // req.body[i][`commout_amt`] = req.body[i][`commout1_amt`]
        // req.body[i][`ovout_rate`] = req.body[i][`ovout1_rate`]
        // req.body[i][`ovout_amt`] = req.body[i][`ovout1_amt`]
        // req.body[i][`commout_taxamt`] = req.body[i][`commout1_taxamt`]
        // req.body[i][`ovout_taxamt`] = req.body[i][`ovout1_taxamt`] 
      }
      req.body[i][`commout_rate`] = parseFloat(req.body[i][`commout1_rate`]) + parseFloat(req.body[i][`commout2_rate`])
      req.body[i][`commout_amt`] = parseFloat(req.body[i][`commout1_amt`]) +parseFloat(req.body[i][`commout2_amt`])
      req.body[i][`ovout_rate`] = parseFloat(req.body[i][`ovout1_rate`]) + parseFloat(req.body[i][`ovout2_rate`])
      req.body[i][`ovout_amt`] = parseFloat(req.body[i][`ovout1_amt`]) + parseFloat(req.body[i][`ovout2_amt`])
      req.body[i][`commout_taxamt`] = parseFloat(req.body[i][`commout1_taxamt`]) +parseFloat(req.body[i][`commout2_taxamt`])
      req.body[i][`ovout_taxamt`] = parseFloat(req.body[i][`ovout1_taxamt`]) +parseFloat(req.body[i][`ovout2_taxamt`])
        

         //cal withheld 1% 
    if (req.body[i].personType.trim() === 'O') {
      req.body[i].withheld = parseFloat(((req.body[i].netgrossprem +req.body[i].duty) * withheld).toFixed(2))
    }else{
      req.body[i].withheld = 0
    }
    
    //get application no
    
    req.body[i].applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app',null,null,'kw',currentdate,t);
    console.log(req.body[i].applicationNo);

      //insert policy
      await sequelize.query(
       ` insert into static_data."Policies" ("applicationNo","insureeCode","insurerCode","agentCode","agentCode2","insureID","actDate", "expDate" ,grossprem, duty, tax, totalprem, 
        commin_rate, commin_amt, ovin_rate, ovin_amt, commin_taxamt, ovin_taxamt, commout_rate, commout_amt, ovout_rate, ovout_amt,
        commout1_taxamt, ovout1_taxamt, commout2_taxamt, ovout2_taxamt, commout_taxamt, ovout_taxamt,
        createusercode, "itemList","status", 
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, netgrossprem, specdiscrate, specdiscamt, cover_amt, withheld,
        duedateinsurer, duedateagent,"fleetCode") 
        -- 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree), '+
        values ( :applicationNo, :insureeCode, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion =\'Y\'), 
        :agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ), 
        :actDate, :expDate, :grossprem, :duty, :tax, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
        :commout1_taxamt, :ovout1_taxamt, :commout2_taxamt, :ovout2_taxamt, :commout_taxamt, :ovout_taxamt,
        :createusercode, :itemList ,\'I\', 
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :withheld,
        :dueDateInsurer, :dueDateAgent, :fleetCode )`
        ,
        {
          replacements: {
            applicationNo: req.body[i].applicationNo,
            // seqNoins: req.body[i].seqNoins,
            // seqNoagt: req.body[i].seqNoagt,
            // entityInsuree:
            insureeCode: insureeCode,
            insurerCode: req.body[i].insurerCode,
            class: req.body[i].class,
            subClass: req.body[i].subClass,
            agentCode: req.body[i].agentCode,
            agentCode2: req.body[i].agentCode2,
            actDate: req.body[i].actDate,
            expDate: req.body[i].expDate,
            grossprem: req.body[i].grossprem,
            netgrossprem: req.body[i].netgrossprem,
            duty: req.body[i].duty,
            tax: req.body[i].tax,
            totalprem: req.body[i].totalprem,
            specdiscrate: req.body[i][`specdiscrate`],
            specdiscamt: req.body[i][`specdiscamt`],
            commin_rate: req.body[i][`commin_rate`],
            commin_amt: req.body[i][`commin_amt`],
            ovin_rate: req.body[i][`ovin_rate`],
            ovin_amt: req.body[i][`ovin_amt`],
            commin_taxamt: req.body[i][`commin_taxamt`],
            ovin_taxamt: req.body[i][`ovin_taxamt`],
            commout_rate: req.body[i][`commout_rate`],
            commout_amt: req.body[i][`commout_amt`],
            ovout_rate: req.body[i][`ovout_rate`],
            ovout_amt: req.body[i][`ovout_amt`],
            commout1_rate: req.body[i][`commout1_rate`],
            commout1_amt: req.body[i][`commout1_amt`],
            ovout1_rate: req.body[i][`ovout1_rate`],
            ovout1_amt: req.body[i][`ovout1_amt`],
            commout2_rate: req.body[i][`commout2_rate`],
            commout2_amt: req.body[i][`commout2_amt`],
            ovout2_rate: req.body[i][`ovout2_rate`],
            ovout2_amt: req.body[i][`ovout2_amt`],
            cover_amt:req.body[i][`cover_amt`],
            createusercode: usercode,
            withheld: req.body[i].withheld,
            dueDateInsurer:req.body[i].dueDateInsurer,
            dueDateAgent: req.body[i].dueDateAgent,
            commout1_taxamt: req.body[i][`commout1_taxamt`],
            ovout1_taxamt: req.body[i][`ovout1_taxamt`],
            commout2_taxamt: req.body[i][`commout2_taxamt`],
            ovout2_taxamt: req.body[i][`ovout2_taxamt`],
            commout_taxamt: req.body[i][`commout_taxamt`],
            ovout_taxamt: req.body[i][`ovout_taxamt`],
            itemList: req.body[i].groupCode,
            fleetCode : req.body[i][`fleetCode`],
            
            
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )


    
    await t.commit();
    appNo.push(req.body[i].applicationNo)
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ status: 'error',describe:error,  appNo: appNo });
    return "fail"
    
  }
  
}

await res.json({ status: 'success', appNo: appNo })


};

const editPolicyList = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    const t = await sequelize.transaction();

    try {
    if (!req.body[i].installment) {
      req.body[i].policyType = 'F'
    }else{

     if(req.body[i].installment.advisor.length === 1 &&  req.body[i].installment.insurer.length === 1)
     {
      req.body[i].policyType = 'F'
     }else{req.body[i].policyType = 'S'}
    }

     //cal withheld 1% 
     const insuree = await sequelize.query(
      `select * from static_data."Entities" e 
      join static_data."Insurees" i on i."entityID" = e.id
      where i."insureeCode" = :insureeCode
      and i.lastversion = 'Y' `,
      {
        replacements: {
          insureeCode: req.body[i].insureeCode,
        },
        transaction: t ,
        type: QueryTypes.SELECT
      }
    )
    req.body[i].personType = insuree[0].personType.trim()
     if (req.body[i].personType === 'O') {
      req.body[i].withheld = Number(((req.body[i].netgrossprem +req.body[i].duty) * withheld).toFixed(2))
    }else{
      req.body[i].withheld
    }

      //update policy
      const policy = await sequelize.query(
       `update static_data."Policies" 
       SET "policyNo" = :policyNo,  grossprem = :grossprem,  netgrossprem = :netgrossprem, specdiscrate = :specdiscrate, specdiscamt = :specdiscamt, duty = :duty, tax = :tax, totalprem = :totalprem, 
       commin_rate = :commin_rate, commin_amt = :commin_amt, ovin_rate = :ovin_rate, ovin_amt = :ovin_amt, commin_taxamt = :commin_taxamt, 
       ovin_taxamt = :ovin_taxamt, commout_rate = :commout_rate, commout_amt = :commout_amt, ovout_rate = :ovout_rate, ovout_amt = :ovout_amt, 
      "policyDate" = :policyDate, "status" = 'A', commout1_rate = :commout1_rate, commout1_amt = :commout1_amt, ovout1_rate = :ovout1_rate, 
      ovout1_amt = :ovout1_amt, commout2_rate = :commout2_rate, commout2_amt = :commout2_amt, ovout2_rate = :ovout2_rate, ovout2_amt = :ovout2_amt,
      "seqNoins" = :seqNoins, "seqNoagt" = :seqNoagt, "issueDate" = :issueDate , "policyType" = :policyType, "cover_amt" = :cover_amt, "withheld" = :withheld,
       "invoiceNo" = :invoiceNo, "taxInvoiceNo" = :taxInvoiceNo
      WHERE "applicationNo" = :applicationNo and "status" = 'I' Returning id`,
        {
          replacements: {
            policyNo: req.body[i].policyNo,
            applicationNo: req.body[i].applicationNo,
            seqNoins: req.body[i].seqNoins,
            seqNoagt: req.body[i].seqNoagt,
            grossprem: req.body[i].grossprem,
            netgrossprem: req.body[i].netgrossprem,
            duty: req.body[i].duty,
            tax: req.body[i].tax,
            totalprem: req.body[i].totalprem,
            specdiscrate: req.body[i][`specdiscrate`],
            specdiscamt: req.body[i][`specdiscamt`],
            commin_rate: req.body[i][`commin_rate`],
            commin_amt: req.body[i][`commin_amt`],
            ovin_rate: req.body[i][`ovin_rate`],
            ovin_amt: req.body[i][`ovin_amt`],
            commin_taxamt: req.body[i][`commin_taxamt`],
            ovin_taxamt: req.body[i][`ovin_taxamt`],
            commout_rate: req.body[i][`commout_rate`],
            commout_amt: req.body[i][`commout_amt`],
            ovout_rate: req.body[i][`ovout_rate`],
            ovout_amt: req.body[i][`ovout_amt`],
            commout1_rate: req.body[i][`commout1_rate`],
            commout1_amt: req.body[i][`commout1_amt`],
            ovout1_rate: req.body[i][`ovout1_rate`],
            ovout1_amt: req.body[i][`ovout1_amt`],
            commout2_rate: req.body[i][`commout2_rate`],
            commout2_amt: req.body[i][`commout2_amt`],
            ovout2_rate: req.body[i][`ovout2_rate`],
            ovout2_amt: req.body[i][`ovout2_amt`],
            issueDate:  req.body[i][`issueDate`],
            policyType:  req.body[i][`policyType`],
            cover_amt: req.body[i][`cover_amt`],
            policyDate:  new Date().toJSON().slice(0, 10),
            withheld : req.body[i]['withheld'],
            invoiceNo : req.body[i]['invoiceNo'],
            taxInvoiceNo : req.body[i]['taxInvoiceNo'],
            
          },
          transaction: t ,
          type: QueryTypes.UPDATE
        }
      )
    console.log(policy[0][0].id);
    //insert jupgr
    req.body[i].polid = policy[0][0].id
//check installment 
if (!req.body[i].installment) {
  req.body[i].installment = {advisor:[], insurer:[]}
}

    await createjupgr(req.body[i],t,usercode)
    
    //insert transaction 
    await createTransection(req.body[i],t)
    // await createTransection(req.body[i],t)

    // insert  jugltx table -> ลงผังบัญชี
    await account.insertjugltx('POLICY',req.body[i].policyNo,t )

    await t.commit();
    // If the execution reaches this line, an error was thrown.
    // We rollback the transaction.
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json(error);
    return
  }
  
}
await res.json({ status: 'success' })
  
};

const createjupgr = async (policy,t,usercode) => {

  const advisor =  policy.installment.advisor
  const insurer =  policy.installment.insurer 
  const arrIns =[]
  const arrAds = []
  const currentdate = getCurrentDate()
  let dftxno = policy.policyNo
  if (policy.endorseNo) {
    dftxno  = policy.endorseNo
  }
  //console.log(policy);
     // installment advisor 
     const insureInvoiceCode = await InsureType.findOne({
      where: {
        id: req.body.insureID,
      },
      attributes: ['invoiceCode'],
      transaction:t
    })
    const insurerInvoiceCode = await Insurer.findOne({
      where: {
        insurerCode: req.body.insurerCode,
        lastversion: 'Y',
      },
      attributes: ['invoiceCode'],
      transaction:t
    })

if (policy.installment.advisor.length === 0 ) {
  // policy.invoiceNo =  `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + String(await getRunNo('inv',null,null,'kwan',currentdate,t)).padStart(5, '0')
  policy.invoiceNo =  `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + await getRunNo('inv',null,null,'kwan',currentdate,t)
  policy.taxInvoiceNo = `TAXINV-${getCurrentYYMM()}` + await getRunNo('taxinv',null,null,'kwan',currentdate,t);
  const ads = await sequelize.query(
    `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", grossprem, 
    specdiscrate, specdiscamt, netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
    "agentCode", "agentCode2", commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, commout_rate, 
    commout_amt, ovout_rate, ovout_amt, createusercode, polid, withheld)
    values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, :grossprem, :specdiscrate, :specdiscamt, :netgrossprem, 
    :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :commout1_rate, :commout1_amt, 
    :ovout1_rate, :ovout1_amt, :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :createusercode, 
     (select id from static_data."Policies" where "policyNo" = :policyNo and "lastVersion" = 'Y' ), :withheld )`,
    {
      replacements: {
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno : dftxno ,
        invoiceNo: policy.invoiceNo,
        taxInvoiceNo: policy.taxInvoiceNo,
        installmenttype: 'A',
        seqNo: 1,
        grossprem: policy[`grossprem`],
        specdiscrate: policy[`specdiscrate`],
        specdiscamt: policy[`specdiscamt`],
        netgrossprem: policy[`netgrossprem`],
        duty: policy[`duty`],
        tax: policy[`tax`],
        totalprem: policy[`totalprem`],
        commin_rate: policy[`commin_rate`],
        commin_amt: policy[`commin_amt`],
        commin_taxamt: policy[`commin_taxamt`], 
        ovin_rate: policy[`ovin_rate`],
        ovin_amt: policy[`ovin_amt`],
        ovin_taxamt: policy[`ovin_taxamt`],
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        commout1_rate: policy[`commout1_rate`],
        commout1_amt: policy[`commout1_amt`],
        ovout1_rate: policy[`ovout1_rate`],
        ovout1_amt: policy[`ovout1_amt`],
        commout2_rate: policy[`commout2_rate`],
        commout2_amt: policy[`commout2_amt`],
        ovout2_rate: policy[`ovout2_rate`],
        ovout2_amt: policy[`ovout2_amt`],
        commout_rate: policy[`commout_rate`],
       commout_amt: policy[`commout_amt`],
       ovout_rate: policy[`ovout_rate`],
       ovout_amt: policy[`ovout_amt`],
       createusercode: usercode,
       withheld : policy['withheld']
      },
      
      transaction: t ,
      type: QueryTypes.INSERT
    }
  )
  arrAds.push[ads]
}
if (policy.installment.insurer.length === 0 ) {
 const ins = await sequelize.query(
    `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", grossprem, 
    specdiscrate, specdiscamt, netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
    "agentCode", "agentCode2", commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, commout_rate, 
    commout_amt, ovout_rate, ovout_amt, createusercode, polid, withheld)
    values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, :grossprem, :specdiscrate, :specdiscamt, :netgrossprem, 
    :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :commout1_rate, :commout1_amt, 
    :ovout1_rate, :ovout1_amt, :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :createusercode,
    (select id from static_data."Policies" where "policyNo" = :policyNo and "lastVersion" = 'Y' ), :withheld )`,
    {
      replacements: {
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno : dftxno,
        invoiceNo: policy.invoiceNo,
        taxInvoiceNo: policy.taxInvoiceNo,
        installmenttype: 'I',
        seqNo: 1,
        grossprem: policy[`grossprem`],
        specdiscrate: 0,
        specdiscamt: 0,
        netgrossprem: policy[`netgrossprem`],
        duty: policy[`duty`],
        tax: policy[`tax`],
        totalprem: policy[`totalprem`],
        commin_rate: policy[`commin_rate`],
        commin_amt: policy[`commin_amt`],
        commin_taxamt: policy[`commin_taxamt`], 
        ovin_rate: policy[`ovin_rate`],
        ovin_amt: policy[`ovin_amt`],
        ovin_taxamt: policy[`ovin_taxamt`],
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        commout1_rate: policy[`commout1_rate`],
        commout1_amt: policy[`commout1_amt`],
        ovout1_rate: policy[`ovout1_rate`],
        ovout1_amt: policy[`ovout1_amt`],
        commout2_rate: policy[`commout2_rate`],
        commout2_amt: policy[`commout2_amt`],
        ovout2_rate: policy[`ovout2_rate`],
        ovout2_amt: policy[`ovout2_amt`],
        commout_rate: policy[`commout_rate`],
       commout_amt: policy[`commout_amt`],
       ovout_rate: policy[`ovout_rate`],
       ovout_amt: policy[`ovout_amt`],
       createusercode: usercode,
       withheld: policy['withheld']
      },
      
      transaction: t ,
      type: QueryTypes.INSERT
    }
  )
  arrIns.push(ins)
}
    

     for (let i = 0; i < advisor.length; i++) {
      // advisor[i].invoiceNo =  `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + String(await getRunNo('inv',null,null,'kwan',currentdate,t)).padStart(5, '0')
      advisor[i].invoiceNo =  `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + await getRunNo('inv',null,null,'kwan',currentdate,t)
  // policy.taxInvoiceNo = 'tAXINV' + await getRunNo('taxinv',null,null,'kwan',currentdate,t);
      advisor[i].taxInvoiceNo = null
  //cal withheld 1% 
  // if (policy.personType.trim() === 'O') {
  //   advisor[i].withheld = Number(((advisor[i].netgrossprem +advisor[i].duty) * withheld).toFixed(2))
  // }else{
  //   advisor[i].withheld
  // }
     //insert jupgr
    const ads = await sequelize.query(
      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", 
       grossprem, specdiscrate, specdiscamt, 
      netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
      "agentCode", "agentCode2", 
      commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
      commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
      commout_rate, commout_amt, ovout_rate, ovout_amt, 
      commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
      createusercode, polid, withheld)
      values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
     :grossprem, :specdiscrate, :specdiscamt, 
        :netgrossprem, 
      :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt,
      :agentCode, :agentCode2,
      :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt, 
      :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt,  
      :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
      :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt, 
      :createusercode, (select id from static_data."Policies" where "policyNo" = :policyNo and "lastVersion" = 'Y' ),
      :withheld )`,
      {
        replacements: {
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno : dftxno,
          invoiceNo: advisor[i].invoiceNo,
          taxInvoiceNo: advisor[i].taxInvoiceNo,
          installmenttype: 'A',
          seqNo: i +1,
          grossprem: advisor[i].grossprem,
          specdiscrate: policy.specdiscrate,
          specdiscamt: advisor[i].specdiscamt,
          netgrossprem: advisor[i].netgrossprem,
          duty: advisor[i].duty,
          tax: advisor[i].tax,
          totalprem: advisor[i].totalprem,
          commin_rate: policy[`commin_rate`],
          commin_amt: advisor[i][`commin_amt`],
          commin_taxamt: advisor[i][`commin_taxamt`], 
          ovin_rate: policy[`ovin_rate`],
          ovin_amt: advisor[i][`ovin_amt`],
          ovin_taxamt: advisor[i][`ovin_taxamt`],
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          commout1_rate: policy[`commout1_rate`],
          commout1_amt: advisor[i][`commout1_amt`],
          ovout1_rate: policy[`ovout1_rate`],
          ovout1_amt: advisor[i][`ovout1_amt`],

          commout2_rate: policy[`commout2_rate`],
          commout2_amt: advisor[i][`commout2_amt`],
          ovout2_rate: policy[`ovout2_rate`],
          ovout2_amt: advisor[i][`ovout2_amt`],

          commout_rate: policy[`commout_rate`],
          // commout_amt: parseFloat((advisor[i].netgrossprem *policy[`commout_rate`]/100).toFixed(2)),
          commout_amt: advisor[i][`commout_amt`],
          ovout_rate: policy[`ovout_rate`],
          // ovout_amt: parseFloat((advisor[i].netgrossprem *policy[`ovout_rate`]/100).toFixed(2)),
          ovout_amt: advisor[i][`ovout_amt`],
          createusercode: usercode,
          withheld : advisor[i]['withheld'],
          // tax wth3%
          commout1_taxamt: advisor[i][`commout1_taxamt`],
          ovout1_taxamt: advisor[i][`ovout1_taxamt`],
          commout2_taxamt: advisor[i][`commout2_taxamt`],
          ovout2_taxamt: advisor[i][`ovout2_taxamt`],
          commout_taxamt: advisor[i][`commout_taxamt`],
          ovout_taxamt: advisor[i][`ovout_taxamt`],
          
        },
        
        transaction: t ,
        type: QueryTypes.INSERT
      }
    )
    arrAds.push[ads]
     }

     // installment insurer
     for (let i = 0; i < insurer.length; i++) {

      //cal withheld 1% 
      // if (policy.personType.trim() === 'O') {
      //   insurer[i].withheld = Number(((insurer[i].netgrossprem +insurer[i].duty) * withheld).toFixed(2))
      // }else{
      //   insurer[i].withheld
      // }

      //insert jupgr
      const ins =  await sequelize.query(
      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo",
      grossprem, specdiscrate, specdiscamt, 
      netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
      "agentCode", "agentCode2", createusercode, polid, withheld,
      commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
      commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
      commout_rate, commout_amt, ovout_rate, ovout_amt )
      values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
      :grossprem, :specdiscrate, :specdiscamt, 
      :netgrossprem, 
      :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :createusercode, 
      (select id from static_data."Policies" where "policyNo" = :policyNo and "lastVersion" = 'Y' ), :withheld,
      :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,
      :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, 
      :commout_rate, :commout_amt, :ovout_rate, :ovout_amt )`,
       {
         replacements: {
           policyNo: policy.policyNo,
           endorseNo: policy.endorseNo,
           dftxno : dftxno,
           invoiceNo: insurer[i].invoiceNo,
           taxInvoiceNo: insurer[i].taxInvoiceNo,
           installmenttype: 'I',
           seqNo: i +1,
           grossprem: insurer[i].grossprem,
           specdiscrate: policy.specdiscrate,
           specdiscamt: insurer[i].specdiscamt,
           netgrossprem: insurer[i].netgrossprem,
           duty: insurer[i].duty,
           tax: insurer[i].tax,
           totalprem: insurer[i].totalprem,
           commin_rate: policy[`commin_rate`],
           commin_amt: insurer[i][`commin_amt`],
           commin_taxamt: insurer[i][`commin_taxamt`], 
           ovin_rate: policy[`ovin_rate`],
           ovin_amt: insurer[i][`ovin_amt`],
           ovin_taxamt: insurer[i][`ovin_taxamt`],
           agentCode: policy.agentCode,
           agentCode2: policy.agentCode2,
           createusercode: usercode,
           withheld : insurer[i]['withheld'],

           commout1_rate: policy[`commout1_rate`],
           commout1_amt: insurer[i][`commout1_amt`],
           ovout1_rate: policy[`ovout1_rate`],
           ovout1_amt: insurer[i][`ovout1_amt`],
 
           commout2_rate: policy[`commout2_rate`],
           commout2_amt: insurer[i][`commout2_amt`],
           ovout2_rate: policy[`ovout2_rate`],
           ovout2_amt: insurer[i][`ovout2_amt`],
 
           commout_rate: policy[`commout_rate`],
           commout_amt: insurer[i][`commout_amt`],
           ovout_rate: policy[`ovout_rate`],
           ovout_amt: insurer[i][`ovout_amt`],
          
         },
         
         transaction: t ,
         type: QueryTypes.INSERT
       }
     )
     arrIns.push(ins)
      }
      // installment advisor2 
  //  if (policy.agentCode2) {
    
  //   policy.invoiceNo = 'INV' + await getRunNo('inv',null,null,'kwan',currentdate,t);
  //   policy.taxInvoiceNo = 'tAXINV' + await getRunNo('taxinv',null,null,'kwan',currentdate,t);
      
  //    await sequelize.query(
  //      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", grossprem, 
  //      specdiscrate, specdiscamt, netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
  //      "agentCode", "agentCode2", commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, commout_rate, 
  //      commout_amt, ovout_rate, ovout_amt, createusercode, polid, withheld)
  //      values(:policyNo, :endorseNo, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, :grossprem, :specdiscrate, :specdiscamt, :netgrossprem, 
  //      :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :commout1_rate, :commout1_amt, 
  //      :ovout1_rate, :ovout1_amt, :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :createusercode, 
  //      (select id from static_data."Policies" where "policyNo" = :policyNo), :withheld)`,
  //      {
  //        replacements: {
  //          policyNo: policy.policyNo,
  //          endorseNo: policy.endorseNo,
  //          invoiceNo: policy.invoiceNo,
  //          taxInvoiceNo: policy.taxInvoiceNo,
  //          installmenttype: 'A',
  //          seqNo: 1,
  //          grossprem: policy[`grossprem`],
  //          specdiscrate: 0,
  //          specdiscamt: 0,
  //          netgrossprem: policy[`netgrossprem`],
  //          duty: policy[`duty`],
  //          tax: policy[`tax`],
  //          totalprem: policy[`totalprem`],
  //          commin_rate: policy[`commin_rate`],
  //          commin_amt: policy[`commin_amt`],
  //          commin_taxamt: policy[`commin_taxamt`], 
  //          ovin_rate: policy[`ovin_rate`],
  //          ovin_amt: policy[`ovin_amt`],
  //          ovin_taxamt: policy[`ovin_taxamt`],
  //          agentCode: policy.agentCode,
  //          agentCode2: policy.agentCode2,
  //          commout1_rate: policy[`commout1_rate`],
  //          commout1_amt: policy[`commout1_amt`],
  //          ovout1_rate: policy[`ovout1_rate`],
  //          ovout1_amt: policy[`ovout1_amt`],
  //          commout2_rate: policy[`commout2_rate`],
  //          commout2_amt: policy[`commout2_amt`],
  //          ovout2_rate: policy[`ovout2_rate`],
  //          ovout2_amt: policy[`ovout2_amt`],
  //          commout_rate: policy[`commout_rate`],
  //         commout_amt: policy[`commout_amt`],
  //         ovout_rate: policy[`ovout_rate`],
  //         ovout_amt: policy[`ovout_amt`],
  //         createusercode: usercode,
  //         withheld : 0
  //        },
         
  //        transaction: t ,
  //        type: QueryTypes.INSERT
  //      }
  //    )

    
  //   } 


 return {insurer :arrIns , advisor:arrAds}
 
}

const createTransection = async (policy,t) => {
     const jupgr = policy.installment
  //find credit term 
     const insurer = await sequelize.query(
      'select * FROM static_data."Insurers" where "insurerCode" = :insurerCode',
      {
        replacements: {
          insurerCode: policy.insurerCode,
          
        },
        transaction: t ,
        type: QueryTypes.SELECT
      }
    )
    const agent = await sequelize.query(
      'select * FROM static_data."Agents" ' +
      'where "agentCode" = :agentcode',
      {
        replacements: {
          agentcode: policy.agentCode,
        },
        transaction: t ,
        type: QueryTypes.SELECT
      }
    )
    if (!policy.insureID) {
      const insureType = await sequelize.query(
        `select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
        and comout."insurerCode" = :insurerCode `,
        {
          replacements: {
            class: policy.class,
            subClass: policy.subClass,
            insurerCode: policy.insurerCode,
          },
          transaction: t ,
          type: QueryTypes.SELECT
        }
      )
      policy.insureID = insureType[0].id
    }
   
    
    // find comm ov defualt
    const commov1 = await sequelize.query(
      'select * FROM static_data."CommOVOuts" comout ' +
      'JOIN static_data."CommOVIns" comin ' +
      'ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" ' +
      'where comout."agentCode" = :agentcode ' +
      'and comout."insureID" = :insureID '+
      'and comout."insurerCode" = :insurerCode',
      {
        replacements: {
          agentcode: policy.agentCode,
          insureID: policy.insureID,
          // subClass: policy.subClass,
          insurerCode: policy.insurerCode,
        },
        transaction: t ,
        type: QueryTypes.SELECT
      }
    )

    if (jupgr.insurer.length === 0 ) {
      jupgr.insurer.push(policy)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + insurer[0].premCreditT);
      jupgr.insurer[0].dueDate = dueDate
    }

    if (jupgr.advisor.length === 0 ) {
      jupgr.advisor.push(policy)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + agent[0].premCreditT);
      jupgr.advisor[0].dueDate = dueDate
    }


     // amity -> insurer (prem-out) && insurer -> amity (comm/ov-in)
     // seqnoins >1
     let date = new Date()
    //  for (let i = 1; i <= policy.seqNoins; i++) {
      for (let i = 0; i < jupgr.insurer.length; i++) {
      //prem-out
      //cal withheld 1% 
     if (policy.personType.trim() === 'O') {
      jupgr.insurer[i].withheld = Number(((jupgr.insurer[i].netgrossprem +jupgr.insurer[i].duty) * withheld).toFixed(2))
    }else{
      jupgr.insurer[i].withheld
    }

          //let totalamt = policy.totalprem/ policy.seqNoins
          //const dueDate = new Date()
          //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

          await sequelize.query(
            `INSERT INTO static_data."Transactions" 
            ("transType", "subType", "insurerCode","agentCode", "policyNo", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo",  mainaccountcode, withheld ) 
            VALUES (:type, :subType, 
            (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = \'Y\'), 
            :agentCode, :policyNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode, :withheld )` ,
           
            {
              replacements: {
                polid: policy.polid,
                type: 'PREM-OUT',
                subType: 0,
                insurerCode: policy.insurerCode,
                agentCode: policy.agentCode,
                // agentCode2: policy.agentCode2,
                policyNo: policy.policyNo,
                // totalamt: totalamt,
                totalamt: jupgr.insurer[i].totalprem,
                // duedate: dueDate,
                duedate: jupgr.insurer[i].dueDate,
                netgrossprem: policy.netgrossprem,
                duty: policy.duty,
                tax: policy.tax,
                totalprem: policy.totalprem,
                netgrossprem: jupgr.insurer[i].netgrossprem,
                duty: jupgr.insurer[i].duty,
                tax: jupgr.insurer[i].tax,
                totalprem: jupgr.insurer[i].totalprem,
                txtype2 :1,
                //seqno:i,
                seqno:i +1,
                mainaccountcode: policy.insurerCode,
                withheld : jupgr.insurer[i].withheld,
    
              },
              transaction: t ,
              type: QueryTypes.INSERT
            }
          );
      
      //comm-in
      //totalamt = policy.commin_amt/ policy.seqNoins
      //dueDate.setDate(dueDate.getDate() + insurer[0].commovCreditT);
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, withheld ) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = \'Y\'), 
        :agentCode, :policyNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode ,:withheld ) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'COMM-IN',
            subType: 1,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            policyNo: policy.policyNo,
            // commamt: policy.commin_amt,
            // commtaxamt: policy.commin_taxamt,
            // totalamt: totalamt,
            // duedate: dueDate,
            // netgrossprem: policy.netgrossprem,
            // duty: policy.duty,
            // tax: policy.tax,
            // totalprem: policy.totalprem,
            commamt: jupgr.insurer[i].commin_amt,
            commtaxamt: jupgr.insurer[i].commin_taxamt,
            totalamt: jupgr.insurer[i].commin_amt,
            duedate: jupgr.insurer[i].dueDate,
            netgrossprem: jupgr.insurer[i].netgrossprem,
            duty: jupgr.insurer[i].duty,
            tax: jupgr.insurer[i].tax,
            totalprem: jupgr.insurer[i].totalprem,
            txtype2 :1,
            // seqno:i,
            seqno:i +1 ,
            mainaccountcode: 'Amity',
            withheld : jupgr.insurer[i].withheld,

          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );
        //ov-in
        //totalamt = policy.ovin_amt/ policy.seqNoins
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = \'Y\' ), 
        :agentCode, :policyNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'OV-IN',
            subType: 1,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            policyNo: policy.policyNo,
            // ovamt: policy.ovin_amt,
            // ovtaxamt: policy.ovin_taxamt,
            // totalamt: totalamt,
            // duedate: dueDate,
            // netgrossprem: policy.netgrossprem,
            // duty: policy.duty,
            // tax: policy.tax,
            // totalprem: policy.totalprem,
            ovamt: jupgr.insurer[i].ovin_amt,
            ovtaxamt: jupgr.insurer[i].ovin_taxamt,
            totalamt: jupgr.insurer[i].ovin_amt,
            duedate: jupgr.insurer[i].dueDate,
            netgrossprem: jupgr.insurer[i].netgrossprem,
            duty: jupgr.insurer[i].duty,
            tax: jupgr.insurer[i].tax,
            totalprem: jupgr.insurer[i].totalprem,
            txtype2 :1,
            // seqno:i,
            seqno:i +1 ,
            mainaccountcode: 'Amity',
            withheld : jupgr.insurer[i].withheld,
    
          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );
     }

     // amity -> advisor1 (comm/ov-out) &&  advisor1  -> amity (prem-in)
     // seqnoagt >1
     date = new Date()
    //  for (let i = 1; i <= policy.seqNoagt; i++) {
      for (let i = 0; i < jupgr.advisor.length; i++) {
      //prem-in
      //cal withheld 1% 
     
     if (policy.personType.trim() === 'O') {
      jupgr.advisor[i].withheld = Number(((jupgr.advisor[i].netgrossprem +jupgr.advisor[i].duty) * withheld).toFixed(2))
    }else{
      jupgr.advisor[i].withheld
    }
    
          //let totalamt = policy.totalprem/ policy.seqNoagt
          //const dueDate = new Date()
          //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);
          await sequelize.query(
            `INSERT INTO static_data."Transactions" 
            ("transType", "subType", "insurerCode","agentCode", "policyNo", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
            VALUES (:type, :subType, 
            (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = \'Y\'), 
            :agentCode, :policyNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
            {
              replacements: {
                polid: policy.polid,
                type: 'PREM-IN',
                subType: 1,
                insurerCode: policy.insurerCode,
                agentCode: policy.agentCode,
                policyNo: policy.policyNo,
                // totalamt: totalamt,
                // duedate: dueDate,
                // netgrossprem: policy.netgrossprem,
                // duty: policy.duty,
                // tax: policy.tax,
                // totalprem: policy.totalprem,
                totalamt: jupgr.advisor[i].totalprem,
                duedate: jupgr.advisor[i].dueDate,
                netgrossprem: jupgr.advisor[i].netgrossprem,
                duty: jupgr.advisor[i].duty,
                tax: jupgr.advisor[i].tax,
                totalprem: jupgr.advisor[i].totalprem,
                txtype2 :1,
                // seqno:i,
                seqno:i +1 ,
                mainaccountcode:policy.agentCode,
                withheld : jupgr.advisor[i].withheld,

    
              },
              transaction: t ,
              type: QueryTypes.INSERT
            }
          );
      
      //comm-out
      // totalamt = policy.commout1_amt/ policy.seqNoagt
      // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
      /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), 
        :agentCode, :policyNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'COMM-OUT',
            subType: 0,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            policyNo: policy.policyNo,
            // commamt: policy.commout_amt,
            // commtaxamt: null,
            // totalamt: totalamt,
            // duedate: dueDate,
            // netgrossprem: policy.netgrossprem,
            // duty: policy.duty,
            // tax: policy.tax,
            // totalprem: policy.totalprem,
            commamt: jupgr.advisor[i].commout1_amt,
            commtaxamt: null,
            totalamt: jupgr.advisor[i].commout1_amt,
            duedate: jupgr.advisor[i].dueDate,
            netgrossprem: jupgr.advisor[i].netgrossprem,
            duty: jupgr.advisor[i].duty,
            tax: jupgr.advisor[i].tax,
            totalprem: jupgr.advisor[i].totalprem,
            txtype2 :1,
            // seqno:i,
            seqno:i +1 ,
            mainaccountcode: policy.agentCode,
            withheld : jupgr.advisor[i].withheld,
    

          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );
      
        //ov-out
        //totalamt = policy.ovout1_amt/ policy.seqNoagt
      await sequelize.query(
       ` INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), 
        :agentCode, :policyNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'OV-OUT',
            subType: 0,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            policyNo: policy.policyNo,
            // ovamt: policy.ovout_amt,
            // ovtaxamt: null,
            // totalamt: totalamt,
            // duedate: dueDate,
            // netgrossprem: policy.netgrossprem,
            // duty: policy.duty,
            // tax: policy.tax,
            // totalprem: policy.totalprem,
            ovamt: jupgr.advisor[i].ovout1_amt,
            ovtaxamt: null,
            totalamt: jupgr.advisor[i].ovout1_amt,
            duedate: jupgr.advisor[i].dueDate,
            netgrossprem: jupgr.advisor[i].netgrossprem,
            duty: jupgr.advisor[i].duty,
            tax: jupgr.advisor[i].tax,
            totalprem: jupgr.advisor[i].totalprem,
            txtype2 :1,
            // seqno:i,
            seqno:i +1 ,
            mainaccountcode: policy.agentCode,
            withheld:jupgr.advisor[i].withheld,
    
          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );

      // case 2 advisor amity -> advisor2 (comm/ov-out)
     
     if (policy.agentCode2 ) {
      date = new Date()
       const agent2 = await sequelize.query(
         'select * FROM static_data."Agents" ' +
         'where "agentCode" = :agentcode',
         {
           replacements: {
             agentcode: policy.agentCode2,
           },
           transaction: t ,
           type: QueryTypes.SELECT
         }
       )
       //comm-out
      let totalamt = policy.commout2_amt/ policy.seqNoagt
      const dueDate = new Date()
      dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
      await sequelize.query(
       ` INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), 
        :agentCode, :policyNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'COMM-OUT',
            subType: 0,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            agentCode2: policy.agentCode2,
            policyNo: policy.policyNo,
            commamt: jupgr.advisor[i].commout2_amt,
            commtaxamt: null,
            totalamt: jupgr.advisor[i].commout2_amt,
            duedate: jupgr.advisor[i].dueDate,
            netgrossprem: jupgr.advisor[i].netgrossprem,
            duty: jupgr.advisor[i].duty,
            tax: jupgr.advisor[i].tax,
            totalprem: policy.totalprem,
            txtype2 :1,
            seqno:i +1 ,
            mainaccountcode: policy.agentCode2,
            withheld : jupgr.advisor[i].withheld,

          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );
        //ov-out
        totalamt = policy.ovout2_amt/ policy.seqNoagt
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
         netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y' ), 
        :agentCode, :policyNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
        :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'OV-OUT',
            subType: 0,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            agentCode2: policy.agentCode2,
            policyNo: policy.policyNo,
            ovamt: jupgr.advisor[i].ovout2_amt,
            ovtaxamt: null,
            totalamt: jupgr.advisor[i].ovout2_amt,
            duedate: jupgr.advisor[i].dueDate,
            netgrossprem: jupgr.advisor[i].netgrossprem,
            duty: jupgr.advisor[i].duty,
            tax: jupgr.advisor[i].tax,
            totalprem: jupgr.advisor[i].totalprem,
            txtype2 :1,
            seqno:i +1 ,
            mainaccountcode: policy.agentCode2,
            withheld:jupgr.advisor[i].withheld,
    
          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );
      
     }

     }

     
   


}


module.exports = {

  newFleetCode,
  findFleetCode,
  draftPolicyList, //create policy status I from excel
  // findPolicy,
  // getPolicyList,
  // editPolicyList, // change status I ->A and add ARAP
};