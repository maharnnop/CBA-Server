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
const excelJS = require("exceljs");
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

console.log("+++++ [method] : newInsurer ++++++");
    req.body.entity.id = null;
    req.body.contactPerson.id = null;
    req.body.insurer.id =null;    
    req.body.location.id =null;

    const entity = await Entity.create(req.body.entity, { transaction: t })
    req.body.insurer.entityID = entity.id
    req.body.location.entityID = entity.id
    const location = await Location.create(req.body.location, { transaction: t })
  
   console.log(`>>> gen entity id : ${entity.id} ,location id : ${location.id}  finished`);
    // contact person 
 
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.insurer.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
  
    console.log(`>>> gen contact id : ${contact.id}, locationContact id : ${locationContact.id} finished`);
    const insurer = await Insurer.create(req.body.insurer, { transaction: t })

    console.log(`+++++ [finished] created insurer : ${req.body.insurer.insurerCode} success!!`);

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
//use create Insurer by CSV file dump
const newInsurerBulk = async (req, res) => {
  
  let resultx = {success : [], error : []}
  try{
      for (let i = 0; i < req.body.length; i++) {
        const ele =   req.body[i]
        const t = await sequelize.transaction();
    try {
        console.log("+++++ [method] : newInsurerBulk ++++++");
        const entity = await Entity.create(ele.entity, { transaction: t }) //entity agent
        ele.insurer.entityID = entity.id
        ele.location.entityID = entity.id
        
      console.log(`>>> gen entity id : ${entity.id} finished`);
        if (ele.location.provinceID != null ) {
          const location = await Location.create(ele.location, { transaction: t }) // location agent
          console.log(`>>> gen location id : ${location.id}  finished`);
        }
        
        // contact person when agent is organization
        if (ele.entity.personType === 'O') { 
        const contact = await Entity.create(ele.contactPerson.entity, { transaction: t }) //entity contact person
        ele.insurer.contactPersonID = contact.id
        ele.contactPerson.location.entityID = contact.id
        const locationContact = await Location.create(ele.contactPerson.location, { transaction: t }) // location contact person
        
        console.log(`>>> gen contact id : ${contact.id}, locationContact id : ${locationContact.id} finished`);
      } 
     
        const insurer = await Insurer.create(ele.insurer, { transaction: t })
        

        console.log(`+++++ [finished] created agent : ${ele.insurer.insurerCode} success!!`);
        await t.commit();
        resultx.success.push({insurerCode : ele.insurer.insurerCode})
          } 
          catch (error) {
            console.log(ele.insurer.insurerCode);
            resultx.error.push({insurerCode : ele.insurer.insurerCode , desp :error.message})
            await t.rollback();
            
            
  }

    };

    const workbook = new excelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sheet1");
      if (!worksheet) {
        
        throw new Error('Worksheet not found');
      }
      let row = 3;
      worksheet.getCell(row ,1).value = "InsurerCode";
        worksheet.getCell(row ,2).value = "Error describe";
      resultx.error.forEach(ele => {
        row = row  +1
        worksheet.getCell(row ,1).value = ele.insurerCode;
        worksheet.getCell(row ,2).value = ele.desp;
     });
     
    
      const excelBuffer = await workbook.xlsx.writeBuffer();
    
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=modified_invoice.xlsx");
      
       
        await res.send(excelBuffer);
} catch (err) {
    console.error(err);
    res.status(500).send({
      status: "error",
      message: err.message,
    });
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
    
console.log("+++++ [method] : updateInsurer ++++++");
    //update insurer
    console.log(`>>> update insurer  : ${req.body.insurer.insurerCode}`);
    //update agent
    req.body.entity.id = null
    await Insurer.update({lastversion: 'N'}, {
      where: {
        id : req.body.insurer.id,
      },
      transaction: t
    });
     req.body.insurer.id = null
    //update entity insurer
     const entity = await Entity.create(req.body.entity, { transaction: t })
    req.body.insurer.entityID = entity.id
    req.body.location.entityID = entity.id
    
    req.body.location.id = null
    const location = await Location.create(req.body.location, { transaction: t })
  
   console.log(`>>> gen entity id : ${entity.id} ,location id : ${location.id}  finished`);
    // contact person 
    req.body.contactPerson.id = null
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.insurer.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
  
    console.log(`>>> gen contact id : ${contact.id}, locationContact id : ${locationContact.id} finished`);
    const insurer = await Insurer.create(req.body.insurer, { transaction: t })
    
    console.log(`+++++ [finished] updated insurer : ${req.body.insurer.insurerCode} success!!`);

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
const getAgentAll = async (req, res) => {
  try{
  const agents = await sequelize.query(
    `select *,
    (case when e."personType" = 'O' then t."TITLETHAIBEGIN"||' '||e."t_ogName" || COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t."TITLETHAIEND" else t."TITLETHAIBEGIN"||' '||e."t_firstName"||' '||e."t_lastName"  end) as "fullName" ,
    agt.id as id
    FROM static_data."Agents" agt
     JOIN static_data."Entities" e ON agt."entityID" = e."id"
     join static_data."Titles" t on e."titleID" = t."TITLEID" 
     where agt.lastversion ='Y' order by agt."agentCode" ;`,
    { type: QueryTypes.SELECT })
  
    await res.json(agents);
  } catch (error) {
    console.error(error)
    await res.status(500).json(error);
  
    // await res.status(500).json({ msg: "internal server error" });
  }
};

//use create agent
const newAgent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("+++++ [method] : newAgent ++++++");
    const entity = await Entity.create(req.body.entity, { transaction: t }) //entity agent
    req.body.agent.entityID = entity.id
    req.body.location.entityID = entity.id
    
   console.log(`>>> gen entity id : ${entity.id} finished`);
    if (req.body.entity.ignoreLocation ) {
      const location = await Location.create(req.body.location, { transaction: t }) // location agent
      console.log(`>>> gen location id : ${location.id}  finished`);
    }
    
    // contact person when agent is organization
    if (req.body.entity.personType === 'O') { 
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.agent.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
    
    console.log(`>>> gen contact id : ${contact.id}, locationContact id : ${locationContact.id} finished`);
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

    console.log(`+++++ [finished] created agent : ${req.body.agent.agentCode} success!!`);
    await t.commit();
    await res.json({
      msg: `created agent : ${req.body.agent.agentCode} success!!`,
    });
  } catch (error) {
    console.error(error.message)
    await t.rollback();
    await res.status(500).json({message : error.message});
  }
};

//use create agent by CSV file dump
const newAgentBulk = async (req, res) => {
  
  let resultx = {success : [], error : []}
  try{
      for (let i = 0; i < req.body.length; i++) {
        const ele =   req.body[i]
        const t = await sequelize.transaction();
    try {
        console.log("+++++ [method] : newAgentBulk ++++++");
        const entity = await Entity.create(ele.entity, { transaction: t }) //entity agent
        ele.agent.entityID = entity.id
        ele.location.entityID = entity.id
        
      console.log(`>>> gen entity id : ${entity.id} finished`);
        if (ele.location.provinceID != null ) {
          const location = await Location.create(ele.location, { transaction: t }) // location agent
          console.log(`>>> gen location id : ${location.id}  finished`);
        }
        
        // contact person when agent is organization
        if (ele.entity.personType === 'O') { 
        const contact = await Entity.create(ele.contactPerson.entity, { transaction: t }) //entity contact person
        ele.agent.contactPersonID = contact.id
        ele.contactPerson.location.entityID = contact.id
        const locationContact = await Location.create(ele.contactPerson.location, { transaction: t }) // location contact person
        
        console.log(`>>> gen contact id : ${contact.id}, locationContact id : ${locationContact.id} finished`);
      } 
     
        const agent = await Agent.create(ele.agent, { transaction: t })
        

        console.log(`+++++ [finished] created agent : ${ele.agent.agentCode} success!!`);
        await t.commit();
        resultx.success.push({agentCode : ele.agent.agentCode})
          } 
          catch (error) {
            console.log(ele.agent.agentCode);
            resultx.error.push({agentCode : ele.agent.agentCode , desp :error.message})
            await t.rollback();
            
            
  }

    };

    const workbook = new excelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sheet1");
      if (!worksheet) {
        
        throw new Error('Worksheet not found');
      }
      let row = 3;
      worksheet.getCell(row ,1).value = "AgentCode";
        worksheet.getCell(row ,2).value = "Error describe";
      resultx.error.forEach(ele => {
        row = row  +1
        worksheet.getCell(row ,1).value = ele.agentCode;
        worksheet.getCell(row ,2).value = ele.desp;
     });
     
    
      const excelBuffer = await workbook.xlsx.writeBuffer();
    
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=modified_invoice.xlsx");
      
       
        await res.send(excelBuffer);
} catch (err) {
    console.error(err);
    res.status(500).send({
      status: "error",
      message: err.message,
    });
  }
  

};

//use update agent
const updateAgent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("+++++ [method] : updateAgent ++++++");
   
    //update agent
     console.log(`>>> update agent  : ${req.body.agent.agentCode}`);
    await Agent.update({lastversion: 'N'}, {
      where: {
        id : req.body.agent.id,
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
   console.log(`>>> gen entity id : ${entity.id} ,location id : ${location.id} finished`);
    // create new contact person 
    if (req.body.entity.personType === 'O') {
    req.body.contactPerson.id = null
    const contact = await Entity.create(req.body.contactPerson, { transaction: t }) //entity contact person
    req.body.agent.contactPersonID = contact.id
    req.body.contactPerson.entityID = contact.id // for location
    const locationContact = await Location.create(req.body.contactPerson, { transaction: t }) // location contact person
console.log(`>>> gen contact id : ${contact.id}, locationContact id : ${locationContact.id} finished`);
  }
  const agent = await Agent.create(req.body.agent, { transaction: t })

   
    // for (let i = 0; i < req.body.commOVOut.length; i++) {
    //   req.body.commOVOut[i].id = null
    //   req.body.commOVOut[i].agentCode = agent.agentCode
    //   await  CommOVOut.create(req.body.commOVOut[i], { transaction: t })

    // }
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
    await res.status(500).json(error);
  
    // await res.status(500).json({ msg: "internal server error" });
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

  newUser,
  getUserByid,
  
  newInsurer,
  newInsurerBulk,
  updateInsurer,
  getInsurerAll,
  newAgent,
  newAgentBulk,
  updateAgent,
  getAgentAll,
  findAgent,
  findInsuree,
  findAgentInsurer,
  getAgentByAgentCode,
  getInsurerByInsurerCode,
};