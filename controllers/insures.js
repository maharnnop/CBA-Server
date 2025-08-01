const CommOVIn = require("../models").CommOVIn; //imported fruits array
const InsureType = require("../models").InsureType;
const CommOVOut = require("../models").CommOVOut;
const process = require('process');
require('dotenv').config();

const { Op, QueryTypes, Sequelize, where } = require("sequelize");
//handle index request

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



const getInsureTypeByid = (req, res) => {
    InsureType.findOne ({
    where: {
        id: req.params.id
    }
  }).then((insureType) => {
    res.json(insureType);
  }).catch(err=>{
      
    console.error(err.parent.detail)
    res.status(500).json(err.parent.detail)
  });
};


const getInsureTypeAll = (req, res) => {
  InsureType.findAll ({order:[['class',  'DESC'],
  ['subClass',  'DESC'],
 ]
}).then((insureType) => {
  res.json(insureType);
}).catch(err=>{
      
  console.error(err.parent.detail)
  res.status(500).json(err.parent.detail)
});
};

const getInsureByInsurer = async (req, res) => {
  
    sequelize.query(
      `select it.* from static_data."InsureTypes" it 
    join (select * from static_data."CommOVIns" comin where comin."insurerCode" = :insurerCode and comin.lastversion = 'Y' ) co on co."insureID" = it.id; 
      `,
      {
        replacements: {
          insurerCode:req.body.insurerCode
        },
        type: QueryTypes.SELECT
      }
    ).then((insureType) => {
      res.json(insureType);
    })
    .catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
      

};

const getInsureByClass =(req, res) => {
  if (req.body.class ==='' ) {
     InsureType.findAll ().then(async (insureType) =>   {
     res.json(insureType);
    }) .catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
  }else{

    InsureType.findAll(
      {where:{
        class : req.body.class
      }}
      ).then((insureType) => {
   res.json(insureType);
    }).catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
  }
};



const newInsureType = (req, res) => {
    InsureType.create(req.body.insure).then((insureType) => {
      res.json(insureType);
    }).catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
  };

const editInsureType = (req, res) => {
  InsureType.update(req.body.insure, {
    where: {
        id: req.body.insure.id
    }
  }).then((insureType) => {
    res.json(insureType);
  }).catch(err=>{
      
    console.error(err.parent.detail)
    res.status(500).json(err.parent.detail)
  });
};
  
const getCommOVOutByid = (req, res) => {
    CommOVOut.findOne ({
    where: {
        id: req.params.id
    }
  }).then((commovOut) => {
    res.json(commovOut);
  }).catch(err=>{
      
    console.error(err.parent.detail)
    res.status(500).json(err.parent.detail)
  });
};

const newCommOVOut = (req, res) => {
    CommOVOut.create(req.body).then((commovOut) => {
      res.json(commovOut);
    }).catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
  };

  const getCommOVInByid = (req, res) => {
    CommOVIn.findOne ({
    where: {
        id: req.params.id
    }
  }).then((commovIn) => {
    res.json(commovIn);
  }).catch(err=>{
      
    console.error(err.parent.detail)
    res.status(500).json(err.parent.detail)
  });
};

const newCommOVIn = (req, res) => {
    CommOVIn.create(req.body).then((commovIn) => {
      res.json(commovIn);
    }).catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
  };

  const newCommOV = (req, res) => {
    CommOVIn.create({...req.body.commIn, ...req.body.insure}).then((commovIn) => {
      // res.json(commovIn);
      CommOVOut.create({...req.body.commOut, ...req.body.insure}).then((commovIn) => {
        res.json(commovIn);
      });
    }).catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
   
  };
  const getCommOVOut = async (req, res) => {
     sequelize.query(
      `select comout.*, comin.* ,
      a."premCreditT" as  "creditTAgent", a."premCreditUnit" as  "creditUAgent" ,
      i."premCreditT" as  "creditTInsurer", i."premCreditUnit" as  "creditUInsurer" 
      FROM static_data."CommOVOuts" comout 
      JOIN static_data."CommOVIns" comin ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID"
      left join static_data."Insurers" i on i."insurerCode" = comout."insurerCode" and i.lastversion = 'Y'
      left join static_data."Agents" a on a."agentCode" = comout."agentCode" and a.lastversion = 'Y'
      where comout."agentCode" = :agentcode 
      and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
      and comout."insurerCode" = :insurerCode 
      and comout.lastversion = 'Y'
      and comin.lastversion = 'Y'
      
      `,
      {
        replacements: {
          agentcode: req.body.agentCode,
          class: req.body.class,
          subClass: req.body.subClass,
          insurerCode:req.body.insurerCode
        },
        type: QueryTypes.SELECT
      }
    ).then(records =>{
      res.json(records);
    }).catch(err=>{
      
      console.error(err.parent.detail)
      res.status(500).json(err.parent.detail)
    });
    
      
};
const getCommOVIn = async (req, res) => {
  sequelize.query(
    `select  comin.* ,
    i."premCreditT" as  "creditTInsurer", i."premCreditUnit" as  "creditUInsurer" 
    FROM static_data."CommOVIns" comin 
    left join static_data."Insurers" i on i."insurerCode" = comin."insurerCode" and i.lastversion = 'Y'
    where comin."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
    and comin."insurerCode" = :insurerCode 
    and comin.lastversion = 'Y'
    `,
    {
      replacements: {
        class: req.body.class,
        subClass: req.body.subClass,
        insurerCode:req.body.insurerCode
      },
      type: QueryTypes.SELECT
    }
  ).then(records =>{
    res.json(records);
  }).catch(err=>{
    
    console.error(err.parent.detail)
    res.status(500).json(err.parent.detail)
  });

    
};
const getCommOVInAll = async (req, res) => {
 
  if (!req.body.insurerCode ) {
    req.body.insurerCode = null
  }
  console.log(`----------------  insurerCode ${req.body.insurerCode} -------------`);
  sequelize.query(
    `select it.id as insureID, class, "subClass" ,"insureName" , co.id as comminid ,co."insurerCode" ,co."rateComIn" ,co."rateOVIn_1"  from static_data."InsureTypes" it 
    left join static_data."CommOVIns" co on co."insureID" =it.id and co."insurerCode" =:insurerCode and co.lastversion ='Y' ;
    `,
    {
      replacements: {
        insurerCode:req.body.insurerCode
      },
      type: QueryTypes.SELECT
    }
  ).then(records =>{
    res.json(records);
  }).catch(err=>{
    
    console.error(err.parent.detail)
    res.status(500).json(err.parent.detail)
  });
    
};
const editCommOVInAll = async (req, res) => {
  console.log(`-------------- editCommOVInAll -------------`);
  const t = await sequelize.transaction();
  const commovin = req.body.commov
  console.log(`-------------- commovin length ${commovin.length} -------------`);
  try {
    for (let i = 0; i < commovin.length ; i++) {
      if (!commovin[i].rateComIn) {
        commovin[i].rateComIn = 0
      }
      if (!commovin[i].rateOVIn_1) {
        commovin[i].rateOVIn_1 = 0
      }
      console.log(`------------- commin id : ${commovin[i].comminid} ------------------`);
      if (commovin[i].comminid) {
        await sequelize.query(
          `update static_data."CommOVIns" 
            set "rateComIn" = :rateComIn ,
            "rateOVIn_1" = :rateOVIn_1 
            where id = :comminid  
              -- and lastversion = 'Y'
              -- and "insurerCode" = :insurerCode
              -- and "insureID" = :insureID `,
              {replacements:{
                comminid: commovin[i].comminid,
                rateComIn: commovin[i].rateComIn,
                rateOVIn_1: commovin[i].rateOVIn_1,
              },
              transaction: t,
              type: QueryTypes.UPDATE,
            })

      }else{
        await sequelize.query(
          `insert into static_data."CommOVIns" 
           ("rateComIn" , "rateOVIn_1", "insurerCode", "insureID") values ( :rateComIn , :rateOVIn_1, :insurerCode, :insureID )
              -- where id = :comminid  
              -- and lastversion = 'Y'
              -- and "insurerCode" = :insurerCode
              -- and "insureID" = :insureID `,
              {replacements:{
                // comminid: commovin[i].comminid,
                insurerCode:req.body.insurerCode,
                rateComIn: commovin[i].rateComIn,
                rateOVIn_1: commovin[i].rateOVIn_1,
                insureID : commovin[i].insureid
              },
              transaction: t,
              type: QueryTypes.INSERT,
            })
      }
      
    }
  const records = await sequelize.query(
    `select it.id as insureID, class, "subClass" ,"insureName" ,co.id as commInId,co."insurerCode" ,co."rateComIn" ,co."rateOVIn_1"  from static_data."InsureTypes" it 
    left join static_data."CommOVIns" co on co."insureID" =it.id and co."insurerCode" =:insurerCode and co.lastversion ='Y' ;
    `,
    {
      replacements: {
        insurerCode:req.body.insurerCode
      },
      type: QueryTypes.SELECT
    }
    
  )
 
  // res.json(records);
  await t.commit();
  await res.json({
    msg: `update CommOv In : ${req.body.insurerCode } success!!`,
    commovin : records
  });
} catch (error) {
  console.error(error)
  await t.rollback();
  await res.status(500).json({ msg: "internal server error" });
}

};

const getCommOVOutAll = async (req, res) => {
 
  if (!req.body.agentCode) {
    req.body.agentCode = null
  }
  console.log(`----------------  agentCode ${req.body.agentCode} -------------`);
  const records = await sequelize.query(
    `select ci."insureID" as insureID , class, "subClass" ,"insureName"  , co.id as commoutid,  ci."insurerCode" , :agentCode as "agentCode" ,co."rateComOut" , co."rateOVOut_1" 
    from static_data."InsureTypes" it 
     join static_data."CommOVIns" ci on ci."insureID" =it.id  and ci.lastversion ='Y' 
    left outer join static_data."CommOVOuts" co on "agentCode" = :agentCode and ci."insureID" = co."insureID" and co.lastversion ='Y' and co."insurerCode" = ci."insurerCode"
    order by ci."insurerCode" ;
    `,
    {
      replacements: {
        agentCode:req.body.agentCode
      },
      type: QueryTypes.SELECT
    }
  )

  const insurer = await sequelize.query(
    `select distinct  (co."insurerCode" )  from static_data."InsureTypes" it 
    join static_data."CommOVIns" co on co."insureID" =it.id  and co.lastversion ='Y' order by co."insurerCode" ;
    `,
    {
      replacements: {
        agentCode:req.body.agentCode
      },
      type: QueryTypes.SELECT
    }
  )
  const result = {}
for (let i = insurer.length -1 ; i >= 0; i--) {
  const array = []
  for (let j = records.length-1 ; j >= 0; j--) {
    if (insurer[i].insurerCode === records[j].insurerCode) {
      array.push(records[j])
      records.pop()
    }
  }

  console.log(`------------------ insurerCode  ${insurer[i].insurerCode} ----------------`);
  result[insurer[i].insurerCode] = array
  
}
 
  res.json(result );
    
};

const editCommOVOutAll = async (req, res) => {
  console.log(`-------------- editCommOVOutAll -------------`);
  const t = await sequelize.transaction();
  const commovout = req.body.commov
  console.log(`-------------- commovout length ${commovout.length} -------------`);
  try {
    for (let i = 0; i < commovout.length ; i++) {
      if (!commovout[i].rateComOut) {
        commovout[i].rateComOut = 0
      }
      if (!commovout[i].rateOVOut_1) {
        commovout[i].rateOVOut_1 = 0
      }
      console.log(`------------- commovout id : ${commovout[i].commoutid} ------------------`);
      if (commovout[i].commoutid) {
        await sequelize.query(
          `update static_data."CommOVOuts" 
            set "rateComOut" = :rateComOut ,
            "rateOVOut_1" = :rateOVOut_1 
            where id = :commoutid  
              -- and lastversion = 'Y'
              -- and "insurerCode" = :insurerCode
              -- and "insureID" = :insureID `,
              {replacements:{
                commoutid: commovout[i].commoutid,
                rateComOut: commovout[i].rateComOut,
                rateOVOut_1: commovout[i].rateOVOut_1,
              },
              transaction: t,
              type: QueryTypes.UPDATE,
            })

      }else{
        await sequelize.query(
          `insert into static_data."CommOVOuts" 
           ("rateComOut" , "rateOVOut_1", "insurerCode", "insureID","agentCode") values ( :rateComOut , :rateOVOut_1, :insurerCode, :insureID , :agentCode)
              -- where id = :comminid  
              -- and lastversion = 'Y'
              -- and "insurerCode" = :insurerCode
              -- and "insureID" = :insureID `,
              {replacements:{
                // comminid: commovin[i].comminid,
                insurerCode:commovout[i].insurerCode,
                agentCode:req.body.agentCode,
                rateComOut: commovout[i].rateComOut,
                rateOVOut_1: commovout[i].rateOVOut_1,
                insureID : commovout[i].insureid
              },
              transaction: t,
              type: QueryTypes.INSERT,
            })
      }
      
    }

  // const records = await sequelize.query(
  //   `select it.id as insureID, class, "subClass" ,"insureName" ,co.id as commInId,co."insurerCode" ,co."rateComIn" ,co."rateOVIn_1"  from static_data."InsureTypes" it 
  //   left join static_data."CommOVIns" co on co."insureID" =it.id and co."insurerCode" =:insurerCode and co.lastversion ='Y' ;
  //   `,
  //   {
  //     replacements: {
  //       insurerCode:req.body.insurerCode
  //     },
  //     type: QueryTypes.SELECT
  //   }
    
  // )
 
  // res.json(records);
  await t.commit();
  await res.json({
    msg: `update CommOv Out : ${req.body.agentCode } success!!`,
    // commovin : records
  });
} catch (error) {
  console.error(error)
  await t.rollback();
  await res.status(500).json({ msg: "internal server error" });
}

};
module.exports = {
//   showAll,
  getInsureTypeAll,
  getInsureByInsurer,
  getInsureTypeByid,
  newInsureType,
  editInsureType,

  getCommOVOutByid,
  newCommOVOut,
  getCommOVInByid,
  newCommOVIn,  
  newCommOV,
  getCommOVOut,
  getCommOVIn,
  getInsureByClass,
  getCommOVInAll,
  editCommOVInAll,

  getCommOVOutAll,
  editCommOVOutAll,


  // removeCar,AgentditCar,
};