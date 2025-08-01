const Entity = require("../models").Entity; //imported fruits array
const Insuree = require("../models").Insuree;
const Insurer = require("../models").Insurer;
const Agent = require("../models").Agent;
const User = require("../models").User;
const Location = require("../models").Location;
const AgentGroup = require("../models").AgentGroup;
const CommOVIn = require("../models").CommOVIn;
const CommOVOut = require("../models").CommOVOut;
const process = require('process');
require('dotenv').config();

const { Op, QueryTypes, Sequelize } = require("sequelize");
const { saveAPCommOut } = require("./ARAP");

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
//dont use currently
const newEntity = (req, res) => {
  Entity.create(req.body).then((entity) => {
    res.json(entity);
  });
};
const getEntityByid = (req, res) => {
  Entity.findOne({
    where: {
      id: req.params.id
    }
  }).then((entity) => {
    res.json(entity);
  });
};

const getInsureeByid = (req, res) => {
  Insuree.findOne({
    where: {
      insureeCode: req.params.id
    }
  }).then((insuree) => {
    res.json(insuree);
  });
};

const newInsuree = (req, res) => {
  Entity.create(req.body.entity).then((entity) => {
    req.body.insuree.entityID = entity.id
    req.body.location.entityID = entity.id
    Insuree.create(req.body.insuree).then((insuree) => {
      Location.create(req.body.location).then((location) => {
        res.json({ ...insuree, ...entity, ...location });
      });

      // res.json(location);
    });
    // res.json({});
  });
};

const getInsurerByid = (req, res) => {
  Insurer.findOne({
    where: {
      insurerCode: req.params.id
    }
  }).then((insuree) => {
    res.json(insuree);
  });
};

const getAgentGroupByid = (req, res) => {
  AgentGruop.findOne({
    where: {
      agentGroup: req.params.id
    }
  }).then((agentGroup) => {
    res.json(agentGroup);
  });
};

const newAgentGroup = (req, res) => {
  AgentGruop.create(req.body).then((agentGroup) => {
    res.json(agentGroup);
  });
};

//need modify
const getUserByid = (req, res) => {
  User.findOne({
    where: {
      id: req.params.id
    }
  }).then((user) => {
    res.json(user);
  });
};
//need modify
const newUser = (req, res) => {
  User.create(req.body).then((user) => {
    res.json(user);
  });
};


// get insurerall
const getInsurerAll = (req, res) => {
  sequelize.query(
    `select *,(t."TITLETHAIBEGIN" ||' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) ||' '||t."TITLETHAIEND") as fullname , ins.id as id
    FROM static_data."Insurers" ins
     JOIN static_data."Entities" e ON ins."entityID" = e."id"
     join static_data."Titles" t on e."titleID" = t."TITLEID" 
     where ins.lastversion ='Y' order by ins."insurerCode" ;`,
    { type: QueryTypes.SELECT }).then((insurer) => {
      res.json(insurer);
    });
};

//use create insurer
const newInsurer = async (req, res) => {
  const t = await sequelize.transaction();
  try {


    const entity = await Entity.create(req.body.entity, { transaction: t })
    req.body.insurer.entityID = entity.id
    req.body.location.entityID = entity.id
   
    const location = await Location.create(req.body.location, { transaction: t })
  
    // contact person 
 
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.insurer.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
  
  const insurer = await Insurer.create(req.body.insurer, { transaction: t })

    // for (let i = 0; i < req.body.commOVIn.length; i++) {
    //   req.body.commOVIn[i].insurerCode = req.body.insurer.insurerCode
    //   await  CommOVIn.create(req.body.commOVIn[i], { transaction: t })

    // }

    // res.json({ ...insurer, ...entity, ...location });
    await t.commit();
    await res.json({
      msg: `created insurer : ${req.body.insurer.insurerCode} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json(error);
  }
};
//#region use update insurer old
// const updateInsurer = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     //update entity insurer
    
    
//     await Entity.update({lastversion: 'N'}, {
//       where: {
//         id : req.body.entity.id,
//       },
//       transaction: t
//     });
//     req.body.entity.id = null

//     //update insurer
//     await Insurer.update({lastversion: 'N'}, {
//       where: {
//         id : req.body.insurer.id,
//       },
//       transaction: t
//     });
//     req.body.insurer.id = null
//     //create new entity insurer
//     const entity = await Entity.create(req.body.entity, { transaction: t })

//     req.body.insurer.entityID = entity.id
//     req.body.location.entityID = entity.id
//    //create new location insurer
//     req.body.location.id = null
//     const location = await Location.create(req.body.location, { transaction: t })
  
//     // create new contact person 
//     req.body.contactPerson.id = null
//     const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
//     req.body.insurer.contactPersonID = contact.id
//     req.body.contactPerson.entityID = contact.id // for location
//     const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
    
//   const insurer = await Insurer.create(req.body.insurer, { transaction: t })

//     //update insurer
//     await CommOVIn.update({lastversion: 'N'}, {
//       where: {
//         insurerCode : insurer.insurerCode,
//       },
//       transaction: t
//     });
//     for (let i = 0; i < req.body.commOVIn.length; i++) {
//       req.body.commOVIn[i].id = null
//       req.body.commOVIn[i].insurerCode = insurer.insurerCode
//       await  CommOVIn.create(req.body.commOVIn[i], { transaction: t })

//     }
//     // res.json({ ...insurer, ...entity, ...location });
//     await t.commit();
//     await res.json({
//       msg: `updated insurer : ${req.body.insurer.insurerCode} success!!`,
//     });
//   } catch (error) {
//     console.log(error);
//     await t.rollback();
//     await res.status(500).json(error);
//   }
// };
//#endregion


//use update insurer revise
const updateInsurer = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    
    //update insurer
    console.log(`----------------- update insurer  -----------`);
     await Insurer.update(req.body.insurer, {
      where: {
        id : req.body.insurer.id,
      },
      transaction: t
    });
    
    //update entity insurer
    console.log(`----------------- update insurer entity -----------`);
    await Entity.update(req.body.entity, {
      where: {
        id : req.body.entity.id,
      },
      transaction: t
    });
  
    //update location insurer
    console.log(`----------------- update insurer location -----------`);
    await Location.update(req.body.location, {
      where: {
        id : req.body.location.id,
      },
      transaction: t
    });
    
    
     //update entity insurer
     console.log(`----------------- update contactPerson entity -----------`);
     delete req.body.contactPerson.id 
     
     await Entity.update(req.body.contactPerson, {
       where: {
         id : req.body.contactPerson.entityID,
       },
       transaction: t
     });

    console.log(`----------------- update contactPerson location -----------`);
    await Location.update(req.body.contactPerson, {
      where: {
        id :  req.body.contactPerson.locationid,
      },
      transaction: t
    });
    // const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    // req.body.insurer.contactPersonID = contact.id
    // req.body.contactPerson.entityID = contact.id // for location
    // const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
    
  // const insurer = await Insurer.create(req.body.insurer, { transaction: t })

    //update insurer
   
    // res.json({ ...insurer, ...entity, ...location });
    await t.commit();
    await res.json({
      msg: `updated insurer : ${req.body.insurer.insurerCode} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json(error);
  }
};

//get agent all
const getAgentAll = (req, res) => {
  sequelize.query(
    `select *,
    (case when e."personType" = 'O' then t."TITLETHAIBEGIN"||' '||e."t_ogName" || COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t."TITLETHAIEND" else t."TITLETHAIBEGIN"||' '||e."t_firstName"||' '||e."t_lastName"  end) as "fullName" ,
    agt.id as id
    FROM static_data."Agents" agt
     JOIN static_data."Entities" e ON agt."entityID" = e."id"
     join static_data."Titles" t on e."titleID" = t."TITLEID" 
     where agt.lastversion ='Y' order by agt."agentCode" ;`,
    { type: QueryTypes.SELECT }).then((agent) => {
      res.json(agent);
    });
  
};

//use create agent
const newAgent = async (req, res) => {
  const t = await sequelize.transaction();
  try {

    const entity = await Entity.create(req.body.entity, { transaction: t }) //entity agent
    req.body.agent.entityID = entity.id
    req.body.location.entityID = entity.id
    if (req.body.entity.ignoreLocation ) {
      const location = await Location.create(req.body.location, { transaction: t }) // location agent
      
    }
    
    // contact person when agent is organization
    if (req.body.entity.personType === 'O') { 
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.agent.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
  } 
  if (req.body.entity.vatRegis) {
    req.body.agent.vatflag = 'Y'
  }
    const agent = await Agent.create(req.body.agent, { transaction: t })
    
    // for (let i = 0; i < req.body.commOVOut.length; i++) {
    //   req.body.commOVOut[i].agentCode = req.body.agent.agentCode
    //   await  CommOVOut.create(req.body.commOVOut[i], { transaction: t })

    // }
    // res.json({...agent, ...entity,...location});
    await t.commit();
    await res.json({
      msg: `created agent : ${req.body.agent.agentCode} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json(error);
  }
};
//use update agent
const updateAgent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    //update entity agent
    await Entity.update({lastversion: 'N'}, {
      where: {
        id : req.body.entity.id,
      },
      transaction: t
    });
    req.body.entity.id = null
    //update agent
    await Agent.update({lastversion: 'N'}, {
      where: {
        id : req.body.agent.id,
      },
      transaction: t
    });
     //update commovouts
     await CommOVOut.update({lastversion: 'N'}, {
      where: {
        agentCode : req.body.agent.agentCode
      },
      transaction: t
    });
    req.body.agent.id = null
    //create new entity agent
    const entity = await Entity.create(req.body.entity, { transaction: t })

    req.body.agent.entityID = entity.id
    req.body.location.entityID = entity.id
   //create new location agent
    req.body.location.id = null
    const location = await Location.create(req.body.location, { transaction: t })
  
    // create new contact person 
    if (req.body.entity.personType === 'O') {
    req.body.contactPerson.id = null
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.agent.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id // for location
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
  }
  const agent = await Agent.create(req.body.agent, { transaction: t })

   
    for (let i = 0; i < req.body.commOVOut.length; i++) {
      req.body.commOVOut[i].id = null
      req.body.commOVOut[i].agentCode = agent.agentCode
      await  CommOVOut.create(req.body.commOVOut[i], { transaction: t })

    }
    // res.json({ ...insurer, ...entity, ...location });
    await t.commit();
    await res.json({
      msg: `updated agent : ${req.body.agent.agentCode} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json(error);
  }
};
//use find agent policyscreen
const findAgent = async (req, res) =>{
  try {
    

  //insert to deteil of jatw 
  let cond = ''
  if (req.body.agentCode !== '') {
    cond = cond + ` and a."agentCode" like '%${req.body.agentCode}%' `
  }
  if (req.body.firstname !== '') {
    cond = cond + ` and (e."t_firstName" like '%${req.body.firstname}%' or e."t_ogName" like '%${req.body.firstname}%') `
  }
  if (req.body.lastname !== '') {
    cond = cond + ` and e."t_lastName"  like '%${req.body.lastname}%' `
  }
    const agents = await sequelize.query(
      ` select a."agentCode" ,
      (case when e."personType" = 'O' then t."TITLETHAIBEGIN"||' '||e."t_ogName" || COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t."TITLETHAIEND" else t."TITLETHAIBEGIN"||' '||e."t_firstName"||' '||e."t_lastName"  end) as "fullName" ,
      e."personType",co."rateComOut", co."rateOVOut_1" , ci."rateComIn", ci."rateOVIn_1",
      a."premCreditT" as  "creditTAgent", a."premCreditUnit" as  "creditUAgent" ,
      ins."premCreditT" as  "creditTInsurer", ins."premCreditUnit" as  "creditUInsurer" 
      from static_data."Agents" a 
      join static_data."Entities" e on a."entityID"  = e.id 
      join static_data."Titles" t on t."TITLEID"  = e."titleID" 
      join static_data."CommOVOuts" co on a."agentCode" = co."agentCode"
      join static_data."CommOVIns" ci on ci."insurerCode" = co."insurerCode" and ci."insureID" = co."insureID"
      left join static_data."Insurers" ins on ins."insurerCode" = co."insurerCode"
      where co."insurerCode" = :insurerCode
      and co."insureID" = (select id from static_data."InsureTypes" it where it."class" = :class and it."subClass" = :subClass )
      and co.lastversion  = 'Y'
      and ci.lastversion  ='Y'
      and a.lastversion = 'Y'
      and ins.lastversion = 'Y'
      ${cond} `,
      {
        replacements: {
          insurerCode : req.body.insurerCode,
          class : req.body.class,
          subClass : req.body.subClass,
        },
        type: QueryTypes.SELECT,
      }
      
    ); 
   
    await res.json(agents);
  } catch (error) {
    console.error(error)
    await res.status(500).json({ msg: "internal server error" });
  }

}

//use find insuree policyscreen
const findInsuree = async (req, res) =>{
  try {
    

  //insert to deteil of jatw 
  let cond = ''
  if (req.body.insureeCode !== '') {
    cond = cond + ` and i."insureeCode" like '%${req.body.insureeCode}%' `
  }
  if (req.body.firstname !== '') {
    cond = cond + ` and (e."t_firstName" like '%${req.body.firstname}%' or e."t_ogName" like '%${req.body.firstname}%') `
  }
  if (req.body.lastname !== '') {
    cond = cond + ` and e."t_lastName"  like '%${req.body.lastname}%' `
  }
    const agents = await sequelize.query(
      ` select i."insureeCode",
      (case when e."personType" = 'O' then t."TITLETHAIBEGIN"||' '||e."t_ogName" || COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t."TITLETHAIEND" else t."TITLETHAIBEGIN"||' '||e."t_firstName"||' '||e."t_lastName"  end) as "fullName" ,
      e."t_firstName" ,e."t_lastName" ,e."t_ogName" ,e.branch ,e."t_branchName" ,
      l."provinceID" ,l."districtID" , l."subDistrictID"  , l.zipcode,
      e."personType", e."idCardType" ,e."titleID" ,e."idCardNo" ,e."taxNo" ,l.t_location_1, l.t_location_2, l.t_location_3, l.t_location_4, l.t_location_5,
      p.t_provincename as province ,a.t_amphurname as district, t2.t_tambonname as subdistrict
      from static_data."Insurees" i 
      join static_data."Entities" e on i."entityID"  = e.id 
      join static_data."Titles" t on t."TITLEID"  = e."titleID" 
      left join static_data."Locations" l on l."entityID" =e.id
      join static_data."Tambons" t2  on t2.tambonid =l."subDistrictID" 
      join static_data."Amphurs" a on a.amphurid =l."districtID" 
      join static_data.provinces p on p.provinceid = l."provinceID" 
      where e.lastversion  = 'Y'
      and l."locationType" = 'A'
      and l."lastversion" = 'Y'
      and i.lastversion = 'Y'
      ${cond} `,
      {
        replacements: { },
        type: QueryTypes.SELECT,
      }
      
    ); 
   
    await res.json(agents);
  } catch (error) {
    console.error(error)
    await res.status(500).json({ msg: "internal server error" });
  }

}


// หน้าค้นหา บริษัทประกัน /ผู้แนะนำ findperson page
const findAgentInsurer = async (req,res) =>{
  try {
    let jointable = ''
    let cond = ''
    if(req.body.type === 'insurer'){
      jointable = ' JOIN static_data."Insurers" a ON e.id = a."entityID"  '
      if (req.body.insurerCode !== '' && req.body.insurerCode !== null ) {
        cond = cond + ` and a."insurerCode" like '%${req.body.insurerCode}%' `
      }
    }else{
      jointable = ' JOIN static_data."Agents" a ON e.id = a."entityID"  '
      if (req.body.agentCode !== '' && req.body.agentCode !== null ) {
        cond = cond + ` and a."agentCode" like '%${req.body.agentCode}%' `
      }
    }

    
    
   

    if (req.body.firstname !== '' && req.body.personType === 'P') {
      cond = cond + ` and e."t_firstName" like '%${req.body.firstname}%' `
    }
    if (req.body.lastname !== '' && req.body.personType === 'P') {
      cond = cond + ` and  e."t_lastName"  like '%${req.body.lastname}%' `
    }
    if (req.body.ogname !== '' && req.body.personType === 'O') {
      cond = cond + ` and e."t_ogName"  like '%${req.body.ogname}%' `
    }
      const persons = await sequelize.query(
        `select 
        '${req.body.type}' as type,
        e."personType",
        (case when e."personType" = 'O' then  t."TITLETHAIBEGIN" ||' '|| e."t_ogName" || COALESCE(' สาขา '|| e."t_branchName",'' ) || ' ' ||  t."TITLETHAIEND" 
        else t."TITLETHAIBEGIN" ||' '|| e."t_firstName"|| ' ' || e."t_lastName"  || ' ' ||  t."TITLETHAIEND"  end) as fullname,
        a."stamentType",
        a."premCreditT"|| ' ' || a."premCreditUnit" as premCredit ,
        a."commovCreditT" || ' ' || a."commovCreditUnit" as commCredit ,
        e."vatRegis" ,
        e.branch ,
       * from static_data."Entities" e 
       ${jointable}
       join static_data."Titles" t on t."TITLEID" = e."titleID" 
       where a.lastversion ='Y'
       ${cond}`,
        {
          
          type: QueryTypes.SELECT,
        }
        
      ); 
     
      await res.json(persons);
    } catch (error) {
      console.error(error)
      await res.status(500).json({ msg: "internal server error" });
    }
  
  } 



//get agent data by agentCode
const getAgentByAgentCode = async (req,res) =>{
  try{
  const agent = await Agent.findOne({
    where: {
      agentCode: req.body.agentCode,
      lastversion : 'Y'
    }
  })

  if (agent === null ) {
    return  await res.json({});
  }

  const entity = await  sequelize.query(
    `select trim("personType") as persontype,* from static_data."Entities"  e
    join static_data."Titles" t on e."titleID" = t."TITLEID"
    where e.id =  '${agent.entityID}'
    and lastversion ='Y' `
    , { type: QueryTypes.SELECT });

  const location = await Location.findOne({
    where: {
      entityID: agent.entityID,
      lastversion : 'Y'
    }
  })
  // get contact data if personType = O
let contact = [null]
  if ( entity[0].persontype === 'O') {
    contact = await sequelize.query(
      `select e.*, l.*, false as "checkLocation" from static_data."Agents" a 
      join static_data."Entities" e on e.id = a."contactPersonID" 
      join static_data."Locations" l on l."entityID"  = a."contactPersonID" and l.lastversion = 'Y'
      where a."agentCode" = '${req.body.agentCode}'
      and a.lastversion ='Y'`
      , { type: QueryTypes.SELECT })
  }

  //get comm ov out
  const commovouts = await CommOVOut.findAll({
    where: {
      agentCode: req.body.agentCode,
      lastversion :'Y'
    }
  })

  await res.json(
    {agent :agent,
     entity: entity[0],
     location: location,
     contact : contact[0],
     commovouts : commovouts
  });
} catch (error) {
  console.error(error)
  await res.status(500).json({ msg: "internal server error" });
}
  } 

// get insurer data by insurerCode
const getInsurerByInsurerCode = async (req,res) =>{
  try{
  const insurer = await Insurer.findOne({
    where: {
      insurerCode: req.body.insurerCode,
      lastversion : 'Y'
    }
  })
  if (insurer === null ) {
    return  await res.json({});
  }
  const entity = await  sequelize.query(
    `select trim("personType") as persontype, e.*, t."TITLEID", t."TITLETHAIBEGIN", t."TITLETHAIEND"
    from static_data."Entities"  e
    join static_data."Titles" t on e."titleID" = t."TITLEID"
    where e.id =  '${insurer.entityID}'
    and lastversion ='Y' `
    , { type: QueryTypes.SELECT });

  const location = await Location.findOne({
    where: {
      entityID: insurer.entityID,
      lastversion : 'Y'
    }
  })

  // get contact person data 
   const  contact = await sequelize.query(
      `select e.*, l.*, false as "checkLocation" , l.id as locationid from static_data."Insurers" i 
      join static_data."Entities" e on e.id = i."contactPersonID" 
      join static_data."Locations" l on l."entityID"  = i."contactPersonID" and l.lastversion = 'Y'
      where i."insurerCode" = '${req.body.insurerCode}'
      and i.lastversion = 'Y'`
      , { type: QueryTypes.SELECT })
  

  //get comm ov out
  const commovins = await CommOVIn.findAll({
    where: {
      insurerCode: req.body.insurerCode,
      lastversion: 'Y'
    }
  })

  await res.json(
    {insurer :insurer,
     entity: entity[0],
     location: location,
     contact : contact[0],
     commovins : commovins
  });
} catch (error) {
  console.error(error)
  await res.status(500).json({ msg: "internal server error" });
}
  } 

module.exports = {
  //   showAll,
  getEntityByid,
  newEntity,
  getInsureeByid,
  newInsuree,
  getInsurerByid,
  newInsurer,
  getAgentAll,
  newAgent,
  getUserByid,
  newUser,
  getAgentGroupByid,
  newAgentGroup,
  getInsurerAll,
  findAgent,
  findAgentInsurer,
  getAgentByAgentCode,
  getInsurerByInsurerCode,
  updateInsurer,
  updateAgent,
  findInsuree,
};