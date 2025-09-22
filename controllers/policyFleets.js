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
const {upsertEntityInsuree} = require("./policies");

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
// check duplicate entity if idcard type = 'บัตรประชาชน'
      let entity
      let checkEntity
      let entityType = 'new' // new ลูกค้าใหม่ old ลูกค้าเดิม  update ลูกค้าเดิมแต่ชื่อเปลี่ยน
      req.body[i].version = 1
      console.log('>>> check dup upsertEntityInsuree()');
      const upsert = await upsertEntityInsuree(req.body[i] ,t)
      console.log('>>> finished check dup ');
      // console.log(JSON.stringify(upsert));
     entity = upsert.entity
     checkEntity = upsert.checkEntity
     entityType = upsert.entityType
        
      console.log(">>>> entity insuree");
      console.log(JSON.stringify(entity));
      let insureeCode
      let insureeVersion
      if (entity[1] === 1) {   // entity[1] === 1 when create new entity

        if(entityType === 'update'){
          console.log('>>> case entity update ');
          console.log(JSON.stringify({ entityID: entity[0][0].id, insureeCode: checkEntity[0].insureeCode, version: checkEntity[0].ins_version+1, }))
          const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode: checkEntity[0].insureeCode, version: checkEntity[0].ins_version+1, }, { returning: ['insureeCode','version'], transaction: t })
          console.log('>>> update insuree obj ');
          console.log(JSON.stringify(insuree));
          insureeCode = insuree['dataValues'].insureeCode
          insureeVersion = insuree['dataValues'].version
           await sequelize.query(
              ` UPDATE static_data."Insurees" 
              SET lastversion  ='N'
              where  id = :oldid ` ,
              {
                replacements: {
                  oldid: checkEntity[0].ins_id,
                },
                transaction: t,
                type: QueryTypes.UPDATE
              })
        }else if(entityType === 'new') {

          console.log('>>> case entity new ');
          console.log(JSON.stringify({ entityID: entity[0][0].id, insureeCode:  entity[0][0].id, version: req.body[i].version, }))
          const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode:  entity[0][0].id, version: req.body[i].version, }, { returning: ['insureeCode', 'version'], transaction: t })
          console.log('>>> new insuree obj ');
          console.log(JSON.stringify(insuree));
          insureeCode = insuree['dataValues'].insureeCode
          insureeVersion  = insuree['dataValues'].version
        }



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
        } else[
          conInsuree = `ent."personType" = 'O' and ent."taxNo" = :taxNo 
                        and ent."titleID" = :titleID and ent."t_ogName" = :t_ogName 
                        and ent."branch" = :branch `
        ]
        const insuree = await sequelize.query(
          `select ins.version as ins_ver ,* FROM static_data."Insurees" ins JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
           WHERE ${conInsuree}
           and ins.lastversion = 'Y' `,
          {
            replacements: {
              idCardNo: req.body[i].idCardNo,
              taxNo: req.body[i].taxNo,
              titleID: req.body[i].titleID,
              t_firstName: req.body[i].t_firstName,
              t_lastName: req.body[i].t_lastName,
              t_ogName: req.body[i].t_ogName,
              branch: req.body[i].branch,
              idCardType: req.body[i].idCardType,
            }, transaction: t, type: QueryTypes.SELECT
          })

        insureeCode = insuree[0].insureeCode
        insureeVersion  = insuree[0].ins_ver


      }

      console.log(`>> insureeCode : ${insureeCode} , insureeVersion : ${insureeVersion}`);
      
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
        duedateinsurer, duedateagent, endorseseries, "fleetflag" ,  source, previouspolicy) 
        -- 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree), '+
        values ( :applicationNo, :insureeCode, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion =\'Y\'), 
        :agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ), 
        :actDate, :expDate, :grossprem, :duty, :tax, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
        :commout1_taxamt, :ovout1_taxamt, :commout2_taxamt, :ovout2_taxamt, :commout_taxamt, :ovout_taxamt,
        :createusercode, :itemList , :insurancestatus, 
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :withheld,
        :dueDateInsurer, :dueDateAgent, :endorseseries, :fleetflag , :source, :previouspolicy)`
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
            
          source : req.body[i].source,
          previouspolicy : req.body[i].previouspolicy,
            
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )


    
    await t.commit();
    appNo.push(req.body[i].applicationNo)
  } catch (error) {
    console.log(`----------- Error draftPolicyList()  ----------------`);
    console.error(error)
    await t.rollback();
    await res.status(500).json({ status: 'error',message:error.message,  appNo: appNo });
    return "fail"
    
  }
  
}
console.log(`----------- End draftPolicyList()  ----------------`);
await res.json({ status: 'success', appNo: appNo })


};





module.exports = {

  newFleetCode,
  findFleetCode,
  draftPolicyList, //create policy status I from excel
  // findPolicy,
  // getPolicyList,
  // editPolicyList, // change status I ->A and add ARAP
};