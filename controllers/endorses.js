const Policy = require("../models").Policy;
const Transaction = require("../models").Transaction;
const CommOVIn = require("../models").CommOVIn; //imported fruits array
const CommOVOut = require("../models").CommOVOut;
const Insuree = require("../models").Insuree;
const b_tuedt = require("../models").b_tuedt;
const InsureType = require("../models").InsureType;
const Insurer = require("../models").Insurer;
const { throws } = require("assert");
const config = require("../config.json");
const process = require('process');
const { getRunNo, getCurrentDate, getCurrentYYMM, getCurrentYY } = require("./lib/runningno");
const account = require('./lib/runningaccount')
const { decode } = require('jsonwebtoken');
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize } = require("sequelize");
const { newPolicy, createjupgrMinor } = require("./policies");
const { log } = require("winston");
const { inflate } = require("zlib");
//handle index request
// const showAll = (req,res) =>{
//     Location.findAll({
//     }).then((locations)=>{
//         res.json(locations);
//     })
// }
const tax = config.tax
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

//find policydata ในหน้า แก้ไขกรมธรรม+ใบคำขอ (policyScreen)
const findPolicy =  async (req, res) => {
  let cond = ``
  
  if(req.body.policyNo !== null && req.body.policyNo !== ''){
    cond = `${cond} and pol."policyNo" = '${req.body.policyNo}'`
  }
  if(req.body.applicationNo !== null && req.body.applicationNo !== ''){
    cond = `${cond} and pol."applicationNo" = '${req.body.applicationNo}'`
  }
  const records = await sequelize.query(
    `select pol.xlock, pol.id as polid ,pol.*, ent.*, lo.*, inst.*, mt.*,
    edt.edtypecode as edtype, (ine.version + 1 )as "InsureeVersion",
    (case when (select count(*) from static_data.b_juepms where polid = pol.id) > 0 then 'Y' else 'N' end) as edprem,
    (case when pol."fleetflag" = 'Y' then 'fleet' else 'minor' end) as "insuranceType" , 
    pol."policyNo", pol."applicationNo", pol."insurerCode",pol."agentCode",
    lo.id as "locationid",
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
    left join static_data."Motors" mt on mt."id" = pol."itemList" and pol.fleetflag = 'N'
    left join static_data.b_juedts edt on edt.polid = pol.id
    left join static_data."Fleets" ft on ft."fleetCode" = pol."fleetCode"
    where   pol."lastVersion" = 'Y'
    and lo."lastversion" = 'Y'
    and insurancestatus != 'CC'
    ${cond}
    order by pol."applicationNo" ASC `,
    {
     
      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};

const getEdTypeCodeAll = (req, res) => {
  b_tuedt.findAll({
    where: {
      activeflag: 'Y'
    },
    order: [['edtypecode', 'DESC'],
    ]
  }).then((edtypecode) => {
    res.json(edtypecode);
  });
};
const getPolicyListForEndorseDiscin = async (req, res) => {
  let cond = ` pol.insurancestatus = '${req.body.insurancestatus}'`
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.policyNo !== null && req.body.policyNo !== '') {
    cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
  }
  if (req.body.createdate_start !== null && req.body.createdate_start !== '') {
    cond = `${cond} and   DATE(pol."createdAt") between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
  }
  if (req.body.effdate_start !== null && req.body.effdate_start !== '') {
    cond = `${cond} and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = `${cond} and pol."agentCode" like '%${req.body.agentCode}%'`
  }
  if (req.body.policyNoStart !== null && req.body.policyNoStart !== '') {
    cond = `${cond} and pol."policyNo" >= '${req.body.policyNoStart}'`
  }
  if (req.body.policyNoEnd !== null && req.body.policyNoEnd !== '') {
    cond = `${cond} and pol."policyNo" <= '${req.body.policyNoEnd}'`
  }


  const records = await sequelize.query(
    `select pol.*,inst.*,mt.*,ine.*,ent.*,
    pol.id as previousid, t."dftxno",
    TO_CHAR(pol."createdAt", 'dd/MM/yyyy HH24:MI:SS') AS "polcreatedAt",
    TO_CHAR(pol."updatedAt", 'dd/MM/yyyy HH24:MI:SS') AS "polupdatedAt",
     inst.class as class, inst."subClass" as "subClass",
    ent."personType" as "insureePT",
    (tt."TITLETHAIBEGIN" ||' '||
    (case when trim(ent."personType") = 'O' then ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  else ent."t_firstName" || ' ' || ent."t_lastName" end)
    || '  ' || tt."TITLETHAIEND" ) as "fullName",
    (select t_provincename  from static_data.provinces p where provinceid = mt."motorprovinceID" ) as motorprovince
    from static_data."Policies" pol 
    join static_data."InsureTypes" inst on inst.id = pol."insureID"
    left join static_data."Motors" mt on mt.id = pol."itemList"
    join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y'
    join static_data."Entities" ent on ent.id = ine."entityID"
    join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    left join static_data."b_jupgrs" bj on bj.polid = pol.id 
    left join  static_data."Transactions" t on t."policyNo" = bj."policyNo" and t."dftxno" = bj."dftxno" and t."seqNo" = bj."seqNo"  and t.status ='N'
     left join static_data.b_juedts juedt on juedt.polid = pol.id
    where ${cond}
    and pol."lastVersion" ='Y'
    and pol.policystatus = 'PC'
    and bj.installmenttype ='A'
    and t."transType" ='PREM-IN' 
    and t."seqNo" = 1 
    and t.txtype2 = 1
    and t.status ='N'
    and t.dfrpreferno is null
    and pol."fleetCode" is null
    and pol.fleetflag = 'N'
and COALESCE(juedt.edtypecode, 'MT') like 'MT%'
    order by pol."applicationNo" ASC `,
    {

      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};
// MT81
const requestEdtDisc = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []

  const t = await sequelize.transaction();

  const currentdate = getCurrentDate()
  try {
     
    const policy = req.body
     const oldPolicy = await sequelize.query(
      `select "seqNoagt" ,specdiscamt, "endorseNo"  from static_data."Policies" 
     WHERE id = :polid ;`,
       {
         replacements: {
            polid: policy.previousid},
           transaction: t ,
           type: QueryTypes.SELECT
          })
     const oldInstallAdvisor = await sequelize.query(
      `select 	bj.netgrossprem as netgrossprem  ,bj.netgrossprem  as grossprem ,bj.specdiscamt 
		,bj.withheld  , bj.duty ,bj.tax 
		,bj.totalprem  , TO_CHAR(bj.totalprem, 'FM99,999,999.00') as totalpremstr
		,bj.totalprem - COALESCE(bj.withheld,0) - COALESCE(bj.specdiscamt,0) as totalamt
		,bj.commin_amt ,bj.commin_taxamt ,bj.ovin_amt ,bj.ovin_taxamt 
		,bj.commout1_amt ,bj.commout1_taxamt ,bj.ovout1_amt ,bj.ovout1_taxamt 
		,bj.commout2_amt ,bj.commout2_taxamt ,bj.ovout2_amt ,bj.ovout2_taxamt 
		,bj.commout_amt ,bj.commout_taxamt ,bj.ovout_amt ,bj.ovout_taxamt 
		,t."dueDate"  as duedate
		from static_data.b_jupgrs bj 
join static_data."Transactions" t on t."policyNo" =bj."policyNo" and t.dftxno =bj.dftxno and t."seqNo" =bj."seqNo" 
where bj.polid  = :polid
and t."transType" ='PREM-IN' and bj.installmenttype ='A' 
and t.status = 'N' order by bj."seqNo" ;`,
       {
         replacements: {
            polid: policy.previousid},
           transaction: t ,
           type: QueryTypes.SELECT
          })      
   
    //#region update policy status ='C'

    // await sequelize.query(
    //   `update static_data."Policies" 
    //          SET "policystatus" = 'ED', "lastVersion" = 'N'
    //         WHERE  id = :polid  `,
    //   {
    //     replacements: {
    //       // policyNo: req.body.policyNo
    //       polid: policyData.previousid

    //     },
    //     transaction: t,
    //     type: QueryTypes.UPDATE
    //   }
    // )

    //#endregion 

    //#region update transaction status = C
    
  //   console.log("--------------- done update transaction status = C -----------------");

  //   await sequelize.query(
  //     `update static_data."Transactions" 
  //   SET "status" = 'C'
  //  WHERE 
  //  txtype2 = 1
  //  and dftxno = :dftxno
  //  and "policyNo" = :policyNo
  //  and "transType" in ('PREM-IN', 'DISC-IN', 'DISC-OUT') 
  //  and dfrpreferno is null `,
  //     {
  //       replacements: {
  //         dftxno : policyData.dftxno,
  //         policyNo: policyData.policyNo,
  //         // endorseNo: req.body.endorseNo,

  //       },
  //       transaction: t,
  //       type: QueryTypes.UPDATE
  //     }
  //   )
   //#endregion 


    //gen new app no
    // const applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);
     const endorseNo = `EN-${getCurrentYY()}` + await getRunNo('ends', null, null, 'kw', currentdate, t);
    console.log("endorseNo : " +endorseNo);
    //#region insert b_juiedts
   const b_juiedts = await sequelize.query(
      `INSERT INTO static_data.b_juiedts
(polid, previousid, request_no,category, status, request_from, update_by, note, request_date  )
VALUES(null, :previousid, :endorseNo, 'N',:category,  :usercode, null, null, now() ) returning id;`,
      {
        replacements: {
          // polid: policy.polid,
          previousid: policy.previousid,
          category : 'Discount',
          endorseNo: endorseNo,
          usercode: usercode,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    //#endregion
    console.log("b_juiedts : " + JSON.stringify(b_juiedts));
    
    const keyidm = b_juiedts[0][0].id
    //#region insert b_juiedts
    // policy
   let value = { "seqNoagt" : policy.seqNoagt ,specdiscamt : policy.specdiscamt, endorseNo : endorseNo }
   let old_value = oldPolicy[0]
  await sequelize.query(
      `INSERT INTO static_data.b_juiedtds
(keyidm, category, field, value, old_value, "table", keyid
, "tableM1", "keyidM1", "tableM2", "keyidM2", "tableM3", "keyidM3")
VALUES(:keyidm, :category, null, :value, :old_value, :table, :keyid
, null, null, null, null, null, null);`,
      {
        replacements: {
          keyidm : keyidm,
          category: 'Discount',
          value:  JSON.stringify(value),
          old_value: JSON.stringify(old_value),
          table : 'static_data."Policies"',
          keyid : policy.previousid
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    //b_jupgrs
    value = policy.installment
    old_value = { advisor :oldInstallAdvisor}
  await sequelize.query(
      `INSERT INTO static_data.b_juiedtds
(keyidm, category, field, value, old_value, "table", keyid
, "tableM1", "keyidM1", "tableM2", "keyidM2", "tableM3", "keyidM3")
VALUES(:keyidm, :category, null, :value, :old_value, :table, null
, :tableM1, :keyidM1, null, null, null, null);`,
      {
        replacements: {
          keyidm : keyidm,
          category: 'Discount',
          value:  JSON.stringify(value),
          old_value: JSON.stringify(old_value),
          table : 'static_data.b_jupgrs',
          // keyid : policy.previousid
          tableM1 : 'static_data."Policies"',
          keyidM1 :  policy.previousid
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    //#endregion

     //#region for juepc
    // req.body.previousid = req.body.id
  //   policyData.createusercode = usercode
  //   policyData.endorseNo = endorseNo
  //   policyData.applicationNo = applicationNo
  //   policyData.id = null

  //  policyData.insurancestatus = 'AI'
  //  policyData.policystatus = null
  //   policyData.createdAt = null
  //  policyData.updatedAt = null

  //   //update endorseseries
  //   // if (req.body.endorseNo === null) {
  //   //   req.body.endorseseries = 0
  //   // } else {
  //   //   req.body.endorseseries = parseInt(req.body.endorseseries) + 1
  //   // }
  //   req.body.endorseseries = parseInt(req.body.endorseseries) + 1
  //#endregion

    //#region insert new policy
    // const newPolicy = await Policy.create(req.body, { transaction: t })
    // console.log(newPolicy.id);
    // req.body.polid = newPolicy.id
    //#endregion

    //#region insert juepc juedt juepm
   
    // await sequelize.query(
    //   `insert into static_data."b_juepcs" 
    //          ("polid", previousid, "endorseNo", edeffdate, edexpdate) values
    //         (:polid, :previousid, :endorseNo, :edeffdate, :edexpdate)`,
    //   {
    //     replacements: {
    //       polid: req.body.polid,
    //       previousid: req.body.previousid,
    //       endorseNo: req.body.endorseNo,
    //       edeffdate: req.body.actDate,
    //       edexpdate: req.body.expDate,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // )
    // await sequelize.query(
    //   `insert into static_data."b_juedts" 
    //   ("polid", edtypecode, "detail") values
    //   (:polid, :edtypecode, :detail)`,
    //   {
    //     replacements: {
    //       polid: req.body.polid,
    //       edtypecode: "MT81",
    //       detail: `DISC-IN ${req.body.specdiscamt}`,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // )
    // await sequelize.query(
    //   `insert into static_data."b_juepms" 
    //   ("polid", diffnetgrossprem, "diffduty", difftax, difftotalprem, discinamt) values
    //   (:polid, :diffnetgrossprem, :diffduty, :difftax, :difftotalprem, :discinamt)`,
    //   {
    //     replacements: {
    //       polid: req.body.polid,
    //       diffnetgrossprem: 0,
    //       diffduty: 0,
    //       difftax: 0,
    //       difftotalprem: 0,
    //       discinamt: req.body.specdiscamt,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // )
//#endregion
    

    //#region insert jupgr
    // const jupgr = {}
    // // const installmentEdit = req.body.installment.advisor.filter(ele => !ele.editflag)
    // jupgr.advisor = req.body.installment.advisor
    // await createjupgrChangeinv(req.body, t, usercode)
    // console.log("---------------- done insert b_jupgr --------------");
    //#endregion

    //#region insert transaction
    // let dftxno = policy.dftxno
    // console.log(jupgr.advisor.length);
    // // if (jupgr.advisor.length >1) {
    // if (jupgr.advisor[0].specdiscamt > 0) {
    //   await sequelize.query(
    //     //DISC-IN
    //     `INSERT INTO static_data."Transactions" 
    //           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt,remainamt,"dueDate", netgrossprem, duty, tax, totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax, :totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'DISC-IN',
    //         subType: 0,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo: policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: jupgr.advisor[0].invoiceNo,
    //         // totalamt: totalamt,
    //         // duedate: dueDate,
    //         commamt: policy.commout1_amt,
    //         commtaxamt: policy.commout1_taxamt,
    //         totalamt: jupgr.advisor[0].specdiscamt,
    //         duedate: jupgr.advisor[0].dueDate,
    //         netgrossprem: policy.netgrossprem,
    //         duty: policy.duty,
    //         tax: policy.tax,
    //         totalprem: policy.totalprem,
    //         txtype2: 1,
    //         // seqno:i,
    //         // seqno: jupgr.advisor[0].seqno,
    //         seqno: 1,
    //         mainaccountcode: policy.insureeCode,
    //         withheld: policy.withheld,


    //       },
    //       transaction: t,
    //       type: QueryTypes.INSERT
    //     }
    //   );
    //   await sequelize.query(
    //     `INSERT INTO static_data."Transactions" 
    //     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,
    //     "dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld ) 
    //     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, 
    //       (select "dueDate" from static_data."Transactions" where "policyNo" = :policyNo and dftxno = :dftxno and mainaccountcode = :mainaccountcode and "transType" = 'COMM-OUT' and "seqNo" = 1 and status ='N'),
    //        :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld   ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'DISC-OUT',
    //         subType: 1,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo : policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: policy.invoiceNo,
    //         commamt: policy.commout1_amt,
    //         commtaxamt: policy.commout1_taxamt,
    //         totalamt: jupgr.advisor[0].specdiscamt,
    //         duedate: jupgr.advisor[0].dueDate,
           
    //         // duedate: policy.duedateagent,
    //         // duedate: dueDateCommout,
    //         netgrossprem: policy.netgrossprem,
    //         duty: policy.duty,
    //         tax: policy.tax,
    //         totalprem: policy.totalprem,
    //        //  commamt: jupgr.advisor[i].commout1_amt,
    //        //  commtaxamt: null,
    //        //  totalamt: jupgr.advisor[i].commout1_amt,
    //        //  duedate: jupgr.advisor[i].dueDate,
    //        //  netgrossprem: jupgr.advisor[i].netgrossprem,
    //        //  duty: jupgr.advisor[i].duty,
    //        //  tax: jupgr.advisor[i].tax,
    //        //  totalprem: jupgr.advisor[i].totalprem,
    //         txtype2 :1,
    //         // seqno:i,
    //         seqno:1 ,
    //         mainaccountcode: policy.agentCode,
    //         withheld : policy.withheld,
      
      
    //       },
    //       transaction: t ,
    //       type: QueryTypes.INSERT
    //     }
    //   );

    // }
    // console.log("---------------- done insert transaction discin/discout --------------");
    // for (let i = 0; i < jupgr.advisor.length; i++) {
    //   //prem-in

    //   totalamt = parseFloat(jupgr.advisor[i].totalprem) - parseFloat(jupgr.advisor[i].withheld)
    //   //const dueDate = new Date()
    //   //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);
    //   await sequelize.query(
    //     `INSERT INTO static_data."Transactions" 
    //             ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",
    //             netgrossprem, duty , tax, totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //             VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,
    //             :netgrossprem, :duty , :tax, :totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'PREM-IN',
    //         subType: 1,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo: policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: jupgr.advisor[i].invoiceNo,
    //         // totalamt: totalamt,
    //         // duedate: dueDate,
    //         // netgrossprem: policy.netgrossprem,
    //         // duty: policy.duty,
    //         // tax: policy.tax,
    //         // totalprem: policy.totalprem,
    //         totalamt: totalamt,
    //         duedate: jupgr.advisor[i].dueDate,
    //          netgrossprem: jupgr.advisor[i].netgrossprem,
    //          duty: jupgr.advisor[i].duty,
    //          tax: jupgr.advisor[i].tax,
    //         totalprem: jupgr.advisor[i].totalprem,
    //         txtype2: 1,
    //         // seqno:i,
    //         seqno: i+1,
    //         mainaccountcode: policy.agentCode,
    //         withheld: jupgr.advisor[i].withheld,


    //       },
    //       transaction: t,
    //       type: QueryTypes.INSERT
    //     }
    //   );

    // }

    //#endregion
    
    await t.commit()
    await res.json({ requestNo: endorseNo })
  } catch (error) {
    await t.rollback();
    console.error(error.message)
    await res.status(500).json({message : error.message});
  }

};

const getPolicyListForEndorseChangeinv = async (req, res) => {
  let cond = ` pol.insurancestatus = '${req.body.insurancestatus}'`
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.policyNo !== null && req.body.policyNo !== '') {
    cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
  }
  if (req.body.createdate_start !== null && req.body.createdate_start !== '') {
    cond = `${cond} and   DATE(pol."createdAt") between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
  }
  if (req.body.effdate_start !== null && req.body.effdate_start !== '') {
    cond = `${cond} and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = `${cond} and pol."agentCode" like '%${req.body.agentCode}%'`
  }

  if (req.body.policyNoStart !== null && req.body.policyNoStart !== '') {
    cond = `${cond} and pol."policyNo" >= '${req.body.policyNoStart}'`
  }
  if (req.body.policyNoEnd !== null && req.body.policyNoEnd !== '') {
    cond = `${cond} and pol."policyNo" <= '${req.body.policyNoEnd}'`
  }


  const records = await sequelize.query(
    `select pol.*,inst.*,mt.*,ine.*,ent.*,
    pol.id as previousid, t.dftxno ,
    TO_CHAR(pol."createdAt", 'dd/MM/yyyy HH24:MI:SS') AS "polcreatedAt",
    TO_CHAR(pol."updatedAt", 'dd/MM/yyyy HH24:MI:SS') AS "polupdatedAt",
     inst.class as class, inst."subClass" as "subClass",
    ent."personType" as "insureePT",
    (tt."TITLETHAIBEGIN" ||' '||
    (case when trim(ent."personType") = 'O' then ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  else ent."t_firstName" || ' ' || ent."t_lastName" end)
    || '  ' || tt."TITLETHAIEND" ) as "fullName",
    (select t_provincename  from static_data.provinces p where provinceid = mt."motorprovinceID" ) as motorprovince
    from static_data."Policies" pol 
    join static_data."InsureTypes" inst on inst.id = pol."insureID"
    left join static_data."Motors" mt on mt.id = pol."itemList"
    join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y'
    join static_data."Entities" ent on ent.id = ine."entityID"
    join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    left join static_data."b_jupgrs" bj on bj.polid = pol.id 
    left join  static_data."Transactions" t on t."policyNo" =bj."policyNo" and t.dftxno = bj.dftxno and t."seqNo" = bj."seqNo" and t."transType" ='PREM-IN'  and t.status ='N'
     left join static_data.b_juedts juedt on juedt.polid = pol.id
    where ${cond}
    and t."seqNo" = pol."seqNoagt"
    and bj.installmenttype ='A'
    and pol.policystatus = 'PC'
    and pol."lastVersion" ='Y'
    and t.dfrpreferno is null
    and pol."fleetCode" is null
    and pol.fleetflag = 'N'
        and COALESCE(juedt.edtypecode, 'MT') like 'MT%'
    order by pol."applicationNo" ASC `,
    {

      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};

const getPolicyTransChangeinv = async (req, res) => {

  //ดึง รายการตั้งหนี้ PREM-IN มาแสดงทั้งหมด ตาม เลขกรม endorse ช่างมันเพราะมีสลักเปลี่ยนใบแจ้งหนี้ได้หลายรอบ ของเก่าจะไม่มาถ้าทำงั้น
  const records = await sequelize.query(
    `select t.netgrossprem, t.duty, t.tax, t.totalprem, t.withheld, 
    jupgr.specdiscamt, t."seqNo" as "seqno",
    (t.totalprem - t.withheld -  jupgr.specdiscamt ) as totalamt,
     (case when t.dfrpreferno is null then false else true end ) as "editflag",
     t."dueDate",  jupgr."invoiceNo"
     from   static_data."Transactions" t 
    left join static_data."b_jupgrs" jupgr  on jupgr."policyNo" = t."policyNo" and t.dftxno = jupgr.dftxno and jupgr."seqNo" = t."seqNo"
    left join static_data."Policies" p on p.id = jupgr.polid
    where t."policyNo" = :policyNo 
    and p."lastVersion" = 'Y'
    and t."transType" = 'PREM-IN'
    and t.status = 'N'
    -- and t.dfrpreferno is null
    and jupgr.installmenttype = 'A' 
    order by t."seqNo" `,
    {
      replacements: {
        // previousid: req.body.previousid,
        policyNo: req.body.policyNo,

      },
      type: QueryTypes.SELECT
    }
  )
  records.map(ele => {

  })
  res.json(records)

};

// MT82
const endorseChangeinv = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []

  const t = await sequelize.transaction();

  const currentdate = getCurrentDate()
  try {
    //update policy status ='C'

    await sequelize.query(
      `update static_data."Policies" 
             SET "policystatus" = 'ED', "lastVersion" = 'N'
            WHERE 
            -- "policyNo" = :policyNo
            -- and "lastVersion" = 'Y'
            id = :polid `,
      {
        replacements: {
          // policyNo: req.body.policyNo,
          polid: req.body.previousid

        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )
console.log("--------------- done update policy status = C -----------------");
    // // update transaction status = C
    // let cond = `and "endorseNo" = :endorseNo`
    // if (req.body.endorseNo === null) {
    //   cond = `and "endorseNo" is null`
    // }

    await sequelize.query(
      `update static_data."Transactions" 
    SET "status" = 'C'
   WHERE "policyNo" = :policyNo
   and dftxno = :dftxno
   -- and "transType" in ('PREM-IN', 'DISC-IN') 
   and "transType" = 'PREM-IN'
   and dfrpreferno is null 
   `,
      {
        replacements: {
          dftxno : req.body.dftxno,
          policyNo: req.body.policyNo,
          // endorseNo: req.body.endorseNo,

        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )
    //gen new endores no
    const endorseNo = `EN-${getCurrentYY()}` + await getRunNo('ends', null, null, 'kw', currentdate, t);
    //gen new app no
    const applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);
    console.log(endorseNo);
    // for juepc
    // req.body.previousid = req.body.id
    req.body.createusercode = usercode
    req.body.endorseNo = endorseNo
    req.body.applicationNo = applicationNo
    req.body.id = null

    req.body.insurancestatus = 'AA'
    req.body.policystatus = 'PC'
    req.body.createdAt = null
    req.body.updatedAt = null

    //update endorseseries
    // if (req.body.endorseNo === null) {
    //   req.body.endorseseries = 0
    // } else {
    //   console.log('no');
    //   req.body.endorseseries = parseInt(req.body.endorseseries) + 1
    // }
    req.body.endorseseries = parseInt(req.body.endorseseries) + 1

    //insert new policy
    const newPolicy = await Policy.create(req.body, { transaction: t })
    console.log(newPolicy.id);
    req.body.polid = newPolicy.id
    //insert juepc juedt juepm
    await sequelize.query(
      `insert into static_data."b_juepcs" 
             ("polid", previousid, "endorseNo", edeffdate, edexpdate) values
            (:polid, :previousid, :endorseNo, :edeffdate, :edexpdate)`,
      {
        replacements: {
          polid: req.body.polid,
          previousid: req.body.previousid,
          endorseNo: req.body.endorseNo,
          edeffdate: req.body.actDate,
          edexpdate: req.body.expDate,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    await sequelize.query(
      `insert into static_data."b_juedts" 
      ("polid", edtypecode, "detail") values
      (:polid, :edtypecode, :detail)`,
      {
        replacements: {
          polid: req.body.polid,
          edtypecode: "MT82",
          detail: `Change Invoice `,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )


    // await sequelize.query(
    //   `insert into static_data."b_juepms" 
    //     ("polid", diffnetgrossprem, "diffduty", difftax, difftotalprem, discinamt) values
    //     (:polid, :diffnetgrossprem, :diffduty, :difftax, :difftotalprem, :discinamt)`,
    //   {
    //     replacements: {
    //       polid: req.body.polid,
    //       diffnetgrossprem: 0,
    //       diffduty: 0,
    //       difftax: 0,
    //       difftotalprem: 0,
    //       discinamt: 0,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // )


    // const installmentEdit = req.body.installment.advisor.filter(ele => ele.editflag)
    // const jupgr = installmentEdit.installment
    const jupgr = {}
    const policy = req.body
    const installmentEdit = req.body.installment.advisor.filter(ele => !ele.editflag)
    jupgr.advisor = installmentEdit

    await createjupgrChangeinv(req.body, t, usercode)
    console.log("---------------- done insert b_jupgr--------------------");
    // let dftxno = policy.endorseNo
    let dftxno = policy.dftxno
    console.log(jupgr.advisor.length);
    // if (jupgr.advisor.length >1) {
    // if (jupgr.advisor[0].specdiscamt > 0) {
    //   await sequelize.query(
    //     `INSERT INTO static_data."Transactions" 
    //           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'DISC-IN',
    //         subType: -1,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo: policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: jupgr.advisor[0].invoiceNo,
    //         // totalamt: totalamt,
    //         // duedate: dueDate,
    //         // netgrossprem: policy.netgrossprem,
    //         // duty: policy.duty,
    //         // tax: policy.tax,
    //         // totalprem: policy.totalprem,
    //         totalamt: jupgr.advisor[0].specdiscamt,
    //         duedate: jupgr.advisor[0].dueDate,
    //         netgrossprem: policy.netgrossprem,
    //         duty: policy.duty,
    //         tax: policy.tax,
    //         totalprem: policy.totalprem,
    //         txtype2: 1,
    //         // seqno:i,
    //         seqno: jupgr.advisor[0].seqno,
    //         mainaccountcode: policy.insureeCode,
    //         withheld: jupgr.advisor[0].withheld,


    //       },
    //       transaction: t,
    //       type: QueryTypes.INSERT
    //     }
    //   );

    // }

    for (let i = 0; i < jupgr.advisor.length; i++) {
      //prem-in

      totalamt = parseFloat(jupgr.advisor[i].totalprem) - parseFloat(jupgr.advisor[i].withheld)
      //const dueDate = new Date()
      //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
                ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
                VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
        {
          replacements: {
            polid: policy.polid,
            type: 'PREM-IN',
            subType: 1,
            insurerCode: policy.insurerCode,
            agentCode: policy.agentCode,
            policyNo: policy.policyNo,
            endorseNo: policy.endorseNo,
            dftxno: dftxno,
            invoiceNo: jupgr.advisor[i].invoiceNo,
            // totalamt: totalamt,
            // duedate: dueDate,
            // netgrossprem: policy.netgrossprem,
            // duty: policy.duty,
            // tax: policy.tax,
            // totalprem: policy.totalprem,
            totalamt: totalamt,
            duedate: jupgr.advisor[i].dueDate,
             netgrossprem: jupgr.advisor[i].netgrossprem,
             duty: jupgr.advisor[i].duty,
             tax: jupgr.advisor[i].tax,
            totalprem: jupgr.advisor[i].totalprem,
            txtype2: 1,
            // seqno:i,
            seqno: jupgr.advisor[i].seqno,
            mainaccountcode: policy.agentCode,
            withheld: jupgr.advisor[i].withheld,


          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      );

    }

    // }else{

    //   await sequelize.query(
    //     `INSERT INTO static_data."Transactions" 
    //     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'PREM-IN',
    //         subType: 1,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo : policy.endorseNo,
    //         // totalamt: totalamt,
    //         // duedate: dueDate,
    //         // netgrossprem: policy.netgrossprem,
    //         // duty: policy.duty,
    //         // tax: policy.tax,
    //         // totalprem: policy.totalprem,
    //         totalamt: totalamt,
    //         // duedate: policy.duedateagent,
    //         duedate: jupgr.advisor[0].dueDate,
    //        //  netgrossprem: jupgr.advisor[i].netgrossprem,
    //        //  duty: jupgr.advisor[i].duty,
    //        //  tax: jupgr.advisor[i].tax,
    //         totalprem: policy.totalprem,
    //         txtype2 :1,
    //         // seqno:i,
    //         seqno:1 ,
    //         mainaccountcode:policy.agentCode,
    //         withheld : policy.withheld,


    //       },
    //       transaction: t ,
    //       type: QueryTypes.INSERT
    //     }
    //   );

    //   }



    await t.commit()
    await res.json({ endorseNo: endorseNo })
  } catch (error) {
    await t.rollback();
    console.error(error)
    await res.status(500).json(error);
  }

};


const getPolicyListForEndorseComov = async (req, res) => {
  let cond = ` pol.insurancestatus = '${req.body.insurancestatus}'`
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.policyNo !== null && req.body.policyNo !== '') {
    cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
  }
  if (req.body.createdate_start !== null && req.body.createdate_start !== '') {
    cond = `${cond} and   DATE(pol."createdAt") between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
  }
  if (req.body.effdate_start !== null && req.body.effdate_start !== '') {
    cond = `${cond} and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = `${cond} and pol."agentCode" like '%${req.body.agentCode}%'`
  }
  if (req.body.policyNoStart !== null && req.body.policyNoStart !== '') {
    cond = `${cond} and pol."policyNo" >= '${req.body.policyNoStart}'`
  }
  if (req.body.policyNoEnd !== null && req.body.policyNoEnd !== '') {
    cond = `${cond} and pol."policyNo" <= '${req.body.policyNoEnd}'`
  }


  const records = await sequelize.query(
    `select pol.*,inst.*,mt.*,ine.*,ent.*,
    pol.id as previousid, t."dftxno",
    TO_CHAR(pol."createdAt", 'dd/MM/yyyy HH24:MI:SS') AS "polcreatedAt",
    TO_CHAR(pol."updatedAt", 'dd/MM/yyyy HH24:MI:SS') AS "polupdatedAt",
     inst.class as class, inst."subClass" as "subClass",
    ent."personType" as "insureePT",
    (tt."TITLETHAIBEGIN" ||' '||
    (case when trim(ent."personType") = 'O' then ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  else ent."t_firstName" || ' ' || ent."t_lastName" end)
    || '  ' || tt."TITLETHAIEND" ) as "fullName",
    (select t_provincename  from static_data.provinces p where provinceid = mt."motorprovinceID" ) as motorprovince,
    juedt.edtypecode as edtypecode
    from static_data."Policies" pol 
    join static_data."InsureTypes" inst on inst.id = pol."insureID"
    left join static_data."Motors" mt on mt.id = pol."itemList"
    join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y'
    join static_data."Entities" ent on ent.id = ine."entityID"
    join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    left join static_data."b_jupgrs" bj on bj.polid = pol.id 
    left join  static_data."Transactions" t on t."policyNo" = bj."policyNo" and t."dftxno" = bj."dftxno" and t."seqNo" = bj."seqNo"  and t.status ='N'
    left join static_data.b_juedts juedt on juedt.polid = pol.id
    where ${cond}
    and pol."lastVersion" ='Y'
    and pol.policystatus = 'PC'
    and bj.installmenttype ='A'
    and t."transType" ='PREM-IN' 
    and t."seqNo" = 1 
    and t.txtype2 = 1
    and t.status ='N'
    and t.dfrpreferno is null
    and pol."fleetCode" is null
    and pol.fleetflag = 'N'
    and COALESCE(juedt.edtypecode, 'MT') like 'MT%'

    order by pol."applicationNo" ASC `,
    {

      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};
// MT83
const endorseComov = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;


  const t = await sequelize.transaction();

  const currentdate = getCurrentDate()
  try {
    //update policy status ='C'

    await sequelize.query(
      `update static_data."Policies" 
             SET "policystatus" = 'ED', "lastVersion" = 'N'
            WHERE 
            -- "policyNo" = :policyNo
            -- and "lastVersion" = 'Y'
            id = :polid `,
      {
        replacements: {
          // policyNo: req.body.policyNo,
          polid: req.body.previousid

        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )
console.log("--------------- done update policy status = C -----------------");
    

    //gen new endores no
    const endorseNo = `EN-${getCurrentYY()}` + await getRunNo('ends', null, null, 'kw', currentdate, t);
    //gen new app no
    const applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);
    console.log(endorseNo);

    // for juepc

    req.body.createusercode = usercode
    req.body.endorseNo = endorseNo
    req.body.applicationNo = applicationNo
    req.body.id = null

    req.body.insurancestatus = 'AA'
    req.body.policystatus = 'PC'
    req.body.createdAt = null
    req.body.updatedAt = null

    //update endorseseries
    
    req.body.endorseseries = parseInt(req.body.endorseseries) + 1

    //insert new policy
    const newPolicy = await Policy.create(req.body, { transaction: t })
    console.log(newPolicy.id);
    req.body.polid = newPolicy.id
    //insert juepc juedt
    await sequelize.query(
      `insert into static_data."b_juepcs" 
             ("polid", previousid, "endorseNo", edeffdate, edexpdate) values
            (:polid, :previousid, :endorseNo, :edeffdate, :edexpdate)`,
      {
        replacements: {
          polid: req.body.polid,
          previousid: req.body.previousid,
          endorseNo: req.body.endorseNo,
          edeffdate: req.body.actDate,
          edexpdate: req.body.expDate,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    await sequelize.query(
      `insert into static_data."b_juedts" 
      ("polid", edtypecode, "detail") values
      (:polid, :edtypecode, :detail)`,
      {
        replacements: {
          polid: req.body.polid,
          edtypecode: "MT83",
          detail: `Change Commission `,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )

    //  ค่าเบี้ยเท่าเดิมเลยไม่บันทึกลง b_juepms

    // await sequelize.query(
    //   `insert into static_data."b_juepms" 
    //     ("polid", diffnetgrossprem, "diffduty", difftax, difftotalprem, discinamt) values
    //     (:polid, :diffnetgrossprem, :diffduty, :difftax, :difftotalprem, :discinamt)`,
    //   {
    //     replacements: {
    //       polid: req.body.polid,
    //       diffnetgrossprem: 0,
    //       diffduty: 0,
    //       difftax: 0,
    //       difftotalprem: 0,
    //       discinamt: 0,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // )

    const jupgr = {}
    const policy = req.body
    jupgr.advisor = req.body.installment.advisor

    await createjupgrChangeinv(req.body, t, usercode)
    console.log("---------------- done insert b_jupgr--------------------");
   
    let dftxno = policy.dftxno
    console.log(jupgr.advisor.length);

 //#region  amity -> insurer (prem-out) && insurer -> amity (comm/ov-in) 
  
  //  // transaction PREM-OUT 
  // let totalamt = parseFloat(policy.totalprem) - parseFloat(policy.withheld)
  // //const dueDate = new Date()
  // //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

  // await sequelize.query(
  //   `INSERT INTO static_data."Transactions" 
  //        ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo",  mainaccountcode, withheld ) 
  //        VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode, :withheld )` ,

  //   {
  //     replacements: {
  //       polid: policy.polid,
  //       type: 'PREM-OUT',
  //       subType: 0,
  //       insurerCode: policy.insurerCode,
  //       agentCode: policy.agentCode,
  //       // agentCode2: policy.agentCode2,
  //       policyNo: policy.policyNo,
  //       endorseNo: policy.endorseNo,
  //       dftxno: dftxno,
  //       invoiceNo: policy.invoiceNo,
  //       // totalamt: totalamt,
  //       totalamt: totalamt,
  //       // duedate: dueDate,
  //       duedate: policy.duedateinsurer,
  //       netgrossprem: policy.netgrossprem,
  //       duty: policy.duty,
  //       tax: policy.tax,
  //       totalprem: policy.totalprem,
  //       netgrossprem: policy.netgrossprem,
  //       duty: policy.duty,
  //       tax: policy.tax,
  //       totalprem: policy.totalprem,
  //       txtype2: 1,
  //       //seqno:i,
  //       seqno: 1,
  //       mainaccountcode: policy.insurerCode,
  //       withheld: policy.withheld,

  //     },
  //     transaction: t,
  //     type: QueryTypes.INSERT
  //   }
  // );
  // console.log("------------- done create Transection Prem-Out -------------");
   // transaction COMM-IN 
  // totalamt = policy.commin_amt
  // const dueDateCommin = new Date(policy.duedateinsurer)
  // if (insurer[0].commovCreditUnit.trim() === 'D') {
  //   dueDateCommin.setDate(dueDateCommin.getDate() + insurer[0].commovCreditT);
  // } else if (insurer[0].commovCreditUnit.trim() === 'M') {
  //   dueDateCommin.setMonth(dueDateCommin.getMonth() + insurer[0].commovCreditT);
  // }

  // await sequelize.query(
  //   `INSERT INTO static_data."Transactions" 
  //    ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, withheld ) 
  //    VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode ,:withheld ) `,
  //   {
  //     replacements: {
  //       polid: policy.polid,
  //       type: 'COMM-IN',
  //       subType: 1,
  //       insurerCode: policy.insurerCode,
  //       agentCode: policy.agentCode,
  //       policyNo: policy.policyNo,
  //       endorseNo: policy.endorseNo,
  //       dftxno: dftxno,
  //       invoiceNo: policy.invoiceNo,
  //       netgrossprem: policy.netgrossprem,
  //       duty: policy.duty,
  //       tax: policy.tax,
  //       totalprem: policy.totalprem,
  //       commamt: policy.commin_amt,
  //       commtaxamt: policy.commin_taxamt,
  //       totalamt: totalamt,
  //       //  duedate: policy.duedateinsurer,
  //       duedate: dueDateCommin,
  //       //  netgrossprem: jupgr.insurer[i].netgrossprem,
  //       //  duty: jupgr.insurer[i].duty,
  //       //  tax: jupgr.insurer[i].tax,
  //       //  totalprem: jupgr.insurer[i].totalprem,
  //       txtype2: 1,
  //       // seqno:i,
  //       seqno: 1,
  //       mainaccountcode: 'Amity',
  //       withheld: policy.withheld,

  //     },
  //     transaction: t,
  //     type: QueryTypes.INSERT
  //   }
  // );
  // console.log("------------- done create Transection Comm-In -------------");
  //   // transaction OV-IN 
  // totalamt = policy.ovin_amt
  // await sequelize.query(
  //   `INSERT INTO static_data."Transactions" 
  //    ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",  ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld) 
  //    VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
  //   {
  //     replacements: {
  //       polid: policy.polid,
  //       type: 'OV-IN',
  //       subType: 1,
  //       insurerCode: policy.insurerCode,
  //       agentCode: policy.agentCode,
  //       policyNo: policy.policyNo,
  //       endorseNo: policy.endorseNo,
  //       dftxno: dftxno,
  //       invoiceNo: policy.invoiceNo,
  //       ovamt: policy.ovin_amt,
  //       ovtaxamt: policy.ovin_taxamt,
  //       totalamt: totalamt,
  //       //  duedate: policy.duedateinsurer,
  //       duedate: dueDateCommin,
  //       netgrossprem: policy.netgrossprem,
  //       duty: policy.duty,
  //       tax: policy.tax,
  //       totalprem: policy.totalprem,
  //       //  ovamt: jupgr.insurer[i].ovin_amt,
  //       //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
  //       //  totalamt: jupgr.insurer[i].ovin_amt,
  //       //  duedate: jupgr.insurer[i].dueDate,
  //       //  netgrossprem: jupgr.insurer[i].netgrossprem,
  //       //  duty: jupgr.insurer[i].duty,
  //       //  tax: jupgr.insurer[i].tax,
  //       //  totalprem: jupgr.insurer[i].totalprem,
  //       txtype2: 1,
  //       // seqno:i,
  //       seqno: 1,
  //       mainaccountcode: 'Amity',
  //       withheld: policy.withheld,

  //     },
  //     transaction: t,
  //     type: QueryTypes.INSERT
  //   }
  // );
  // console.log("------------- done create Transection Ov-In -------------");

//#endregion

//#region  amity -> advisor1 (comm/ov-out) &&  advisor1  -> amity (prem-in/DISC-IN)

    // // transaction DISC-IN DISC-OUT
    // if (jupgr.advisor[0].specdiscamt > 0) {
    //   await sequelize.query(
    //     //DISC-IN
    //     `INSERT INTO static_data."Transactions" 
    //           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt,remainamt,"dueDate", netgrossprem, duty, tax, totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax, :totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'DISC-IN',
    //         subType: 0,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo: policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: jupgr.advisor[0].invoiceNo,
    //         // totalamt: totalamt,
    //         // duedate: dueDate,
    //         commamt: policy.commout1_amt,
    //         commtaxamt: policy.commout1_taxamt,
    //         totalamt: jupgr.advisor[0].specdiscamt,
    //         duedate: jupgr.advisor[0].dueDate,
    //         netgrossprem: policy.netgrossprem,
    //         duty: policy.duty,
    //         tax: policy.tax,
    //         totalprem: policy.totalprem,
    //         txtype2: 1,
    //         // seqno:i,
    //         // seqno: jupgr.advisor[0].seqno,
    //         seqno: 1,
    //         mainaccountcode: policy.insureeCode,
    //         withheld: policy.withheld,


    //       },
    //       transaction: t,
    //       type: QueryTypes.INSERT
    //     }
    //   );
    //   await sequelize.query(
    //     `INSERT INTO static_data."Transactions" 
    //     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,
    //     "dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld ) 
    //     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, 
    //       (select "dueDate" from static_data."Transactions" where "policyNo" = :policyNo and dftxno = :dftxno and mainaccountcode = :mainaccountcode and "transType" = 'COMM-OUT' and "seqNo" = 1 and status ='N'),
    //        :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld   ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'DISC-OUT',
    //         subType: 1,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo : policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: policy.invoiceNo,
    //         commamt: policy.commout1_amt,
    //         commtaxamt: policy.commout1_taxamt,
    //         totalamt: jupgr.advisor[0].specdiscamt,
    //         duedate: jupgr.advisor[0].dueDate,
           
    //         // duedate: policy.duedateagent,
    //         // duedate: dueDateCommout,
    //         netgrossprem: policy.netgrossprem,
    //         duty: policy.duty,
    //         tax: policy.tax,
    //         totalprem: policy.totalprem,
    //        //  commamt: jupgr.advisor[i].commout1_amt,
    //        //  commtaxamt: null,
    //        //  totalamt: jupgr.advisor[i].commout1_amt,
    //        //  duedate: jupgr.advisor[i].dueDate,
    //        //  netgrossprem: jupgr.advisor[i].netgrossprem,
    //        //  duty: jupgr.advisor[i].duty,
    //        //  tax: jupgr.advisor[i].tax,
    //        //  totalprem: jupgr.advisor[i].totalprem,
    //         txtype2 :1,
    //         // seqno:i,
    //         seqno:1 ,
    //         mainaccountcode: policy.agentCode,
    //         withheld : policy.withheld,
      
      
    //       },
    //       transaction: t ,
    //       type: QueryTypes.INSERT
    //     }
    //   );

    // }
    // console.log("---------------- done insert transaction discin/discout --------------");

    // transaction PREM-IN
    // for (let i = 0; i < jupgr.advisor.length; i++) {
    //   //prem-in

    //   // totalamt = parseFloat(jupgr.advisor[i].totalprem) - parseFloat(jupgr.advisor[i].withheld)
    //   // //const dueDate = new Date()
    //   // //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);
    //   // await sequelize.query(
    //   //   `INSERT INTO static_data."Transactions" 
    //   //           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //   //           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //   //   {
    //   //     replacements: {
    //   //       polid: policy.polid,
    //   //       type: 'PREM-IN',
    //   //       subType: 1,
    //   //       insurerCode: policy.insurerCode,
    //   //       agentCode: policy.agentCode,
    //   //       policyNo: policy.policyNo,
    //   //       endorseNo: policy.endorseNo,
    //   //       dftxno: dftxno,
    //   //       invoiceNo: jupgr.advisor[i].invoiceNo,
    //   //       // totalamt: totalamt,
    //   //       // duedate: dueDate,
    //   //       // netgrossprem: policy.netgrossprem,
    //   //       // duty: policy.duty,
    //   //       // tax: policy.tax,
    //   //       // totalprem: policy.totalprem,
    //   //       totalamt: totalamt,
    //   //       duedate: jupgr.advisor[i].dueDate,
    //   //        netgrossprem: jupgr.advisor[i].netgrossprem,
    //   //        duty: jupgr.advisor[i].duty,
    //   //        tax: jupgr.advisor[i].tax,
    //   //       totalprem: jupgr.advisor[i].totalprem,
    //   //       txtype2: 1,
    //   //       // seqno:i,
    //   //       seqno: jupgr.advisor[i].seqno,
    //   //       mainaccountcode: policy.agentCode,
    //   //       withheld: jupgr.advisor[i].withheld,


    //   //     },
    //   //     transaction: t,
    //   //     type: QueryTypes.INSERT
    //   //   }
    //   // );

    //   //comm-out
    //   totalamt = jupgr.advisor[i].commout1_amt
    //   // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
    //   /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
    //   await sequelize.query(
    //     `INSERT INTO static_data."Transactions" 
    //     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
    //     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'COMM-OUT',
    //         subType: 0,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo: policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: jupgr.advisor[i].invoiceNo,
    //         commamt: jupgr.advisor[i].commout1_amt,
    //         commtaxamt: jupgr.advisor[i].commout1_taxamt,
    //         totalamt: totalamt,
    //         //  duedate: policy.duedateagent,
    //         duedate: dueDateCommout,
    //         netgrossprem: jupgr.advisor[i].netgrossprem,
    //         duty: jupgr.advisor[i].duty,
    //         tax: jupgr.advisor[i].tax,
    //         totalprem: jupgr.advisor[i].totalprem,
    //         //  commamt: jupgr.advisor[i].commout1_amt,
    //         //  commtaxamt: null,
    //         //  totalamt: jupgr.advisor[i].commout1_amt,
    //         //  duedate: jupgr.advisor[i].dueDate,
    //         //  netgrossprem: jupgr.advisor[i].netgrossprem,
    //         //  duty: jupgr.advisor[i].duty,
    //         //  tax: jupgr.advisor[i].tax,
    //         //  totalprem: jupgr.advisor[i].totalprem,
    //         txtype2: 1,
    //         // seqno:i,
    //         seqno: i + 1,
    //         mainaccountcode: policy.agentCode,
    //         withheld: jupgr.advisor[i].withheld,


    //       },
    //       transaction: t,
    //       type: QueryTypes.INSERT
    //     }
    //   );

    //   console.log(`------------- done create Transection Comm-Out1 seqno ${i + 1} -------------`);
    //   //ov-out
    //   totalamt = jupgr.advisor[i].ovout1_amt,
    //   await sequelize.query(
    //     ` INSERT INTO static_data."Transactions" 
    //     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
    //     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    //     {
    //       replacements: {
    //         polid: policy.polid,
    //         type: 'OV-OUT',
    //         subType: 0,
    //         insurerCode: policy.insurerCode,
    //         agentCode: policy.agentCode,
    //         policyNo: policy.policyNo,
    //         endorseNo: policy.endorseNo,
    //         dftxno: dftxno,
    //         invoiceNo: jupgr.advisor[i].invoiceNo,
    //         ovamt: jupgr.advisor[i].ovout1_amt,
    //         ovtaxamt: jupgr.advisor[i].ovout1_taxamt,
    //         totalamt: totalamt,
    //         //  duedate: policy.duedateagent,
    //         duedate: dueDateCommout,
    //         netgrossprem: jupgr.advisor[i].netgrossprem,
    //         duty: jupgr.advisor[i].duty,
    //         tax: jupgr.advisor[i].tax,
    //         totalprem: jupgr.advisor[i].totalprem,
    //         //  ovamt: jupgr.advisor[i].ovout1_amt,
    //         //  ovtaxamt: null,
    //         //  totalamt: jupgr.advisor[i].ovout1_amt,
    //         //  duedate: jupgr.advisor[i].dueDate,
    //         //  netgrossprem: jupgr.advisor[i].netgrossprem,
    //         //  duty: jupgr.advisor[i].duty,
    //         //  tax: jupgr.advisor[i].tax,
    //         //  totalprem: jupgr.advisor[i].totalprem,
    //         txtype2: 1,
    //         // seqno:i,
    //         seqno: i + 1,
    //         mainaccountcode: policy.agentCode,
    //         withheld:  jupgr.advisor[i].withheld,

    //       },
    //       transaction: t,
    //       type: QueryTypes.INSERT
    //     }
    //   );
    //   console.log(`------------- done create Transection OV-Out1 seqno ${i + 1} -------------`);
    //     }

    //     // case 2 advisor amity -> advisor2 (comm/ov-out)
    //     if (policy.agentCode2) {
    //       date = new Date()
    //       const agent2 = await sequelize.query(
    //         'select * FROM static_data."Agents" ' +
    //         'where "agentCode" = :agentcode',
    //         {
    //           replacements: {
    //             agentcode: policy.agentCode2,
    //           },
    //           transaction: t,
    //           type: QueryTypes.SELECT
    //         }
    //       )
    //       //comm-out
    //       let totalamt = jupgr.advisor[i].commout2_amt
    //       const dueDate = new Date()
    //       dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
    //       await sequelize.query(
    //         ` INSERT INTO static_data."Transactions" 
    //       ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
    //       VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
    //         {
    //           replacements: {
    //             polid: policy.polid,
    //             type: 'COMM-OUT',
    //             subType: 0,
    //             insurerCode: policy.insurerCode,
    //             agentCode: policy.agentCode,
    //             agentCode2: policy.agentCode2,
    //             policyNo: policy.policyNo,
    //             endorseNo: policy.endorseNo,
    //             dftxno: dftxno,
    //             invoiceNo: jupgr.advisor[i].invoiceNo,
    //             commamt: jupgr.advisor[i].commout2_amt,
    //             commtaxamt: jupgr.advisor[i].commout2_taxamt,
    //             totalamt: totalamt,
    //             //  duedate: dueDate,
    //             duedate: dueDateCommout,
    //             netgrossprem: jupgr.advisor[i].netgrossprem,
    //             duty: jupgr.advisor[i].duty,
    //             tax: jupgr.advisor[i].tax,
    //             totalprem: jupgr.advisor[i].totalprem,
    //             txtype2: 1,
    //             seqno: 1,
    //             mainaccountcode: policy.agentCode2,
    //             withheld: jupgr.advisor[i].withheld,

    //           },
    //           transaction: t,
    //           type: QueryTypes.INSERT
    //         }
    //       );
    //       console.log(`------------- done create Transection Comm-Out2 seqno ${i + 1} -------------`);
    //       //ov-out
    //       totalamt = jupgr.advisor[i].ovout2_amt
    //       await sequelize.query(
    //         `INSERT INTO static_data."Transactions" 
    //       ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
    //         netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
    //       VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
    //       :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
    //         {
    //           replacements: {
    //             polid: policy.polid,
    //             type: 'OV-OUT',
    //             subType: 0,
    //             insurerCode: policy.insurerCode,
    //             agentCode: policy.agentCode,
    //             agentCode2: policy.agentCode2,
    //             policyNo: policy.policyNo,
    //             endorseNo: policy.endorseNo,
    //             dftxno: dftxno,
    //             invoiceNo: jupgr.advisor[i].invoiceNo,
    //             ovamt: jupgr.advisor[i].ovout2_amt,
    //             ovtaxamt: jupgr.advisor[i].ovout2_taxamt,
    //             totalamt: totalamt,
    //             //  duedate: dueDate,
    //             duedate: dueDateCommout,
    //             netgrossprem: jupgr.advisor[i].netgrossprem,
    //             duty: jupgr.advisor[i].duty,
    //             tax: jupgr.advisor[i].tax,
    //             totalprem: jupgr.advisor[i].totalprem,
    //             txtype2: 1,
    //             seqno: 1,
    //             mainaccountcode: policy.agentCode2,
    //             withheld: jupgr.advisor[i].withheld,

    //           },
    //           transaction: t,
    //           type: QueryTypes.INSERT
    //         }
    //       );
    //       console.log(`------------- done create Transection OV-Out2 seqno ${i + 1} -------------`);
    //     }
        
      //#endregion


// clone Transaction มาแก้ endorseNo comovamt

 //check wht ของ agent1/agent2
 let whtagent1 = wht ;
 let whtagent2 = wht ;
 if(policy.commout1_taxamt == 0){ whtagent1 = 0}
 if(policy.commout2_taxamt == 0){ whtagent2 = 0}
// COMM-IN
await sequelize.query(
  `DO $$ 
  Begin
  -- Select data from the Transaction type ='COMM-IN'
  CREATE TEMPORARY TABLE temp_commov AS
  SELECT  "transType", "subType", "insurerCode","agentCode","agentCode2", "policyNo"
          ,"endorseNo", "dftxno", "documentno", commamt,commtaxamt , ovamt,ovtaxamt ,totalamt,remainamt
          ,"dueDate",netgrossprem,duty,tax,totalprem,txtype2
          , polid, "seqNo", mainaccountcode, withheld 
  FROM static_data."Transactions"  
  WHERE dftxno = '${policy.dftxno}' and "policyNo" = '${policy.policyNo}'
  and "transType" in ('COMM-IN', 'OV-IN', 'COMM-OUT', 'OV-OUT')  and status ='N' and dfrpreferno is null ; -- Add your condition to filter the rows as needed
  
  -- Update the selected data
  UPDATE temp_commov
  SET polid = ${policy.polid},
      "endorseNo" = '${policy.endorseNo}',
      "totalamt"      = ROUND(CAST(${policy.commin_rate/100} * netgrossprem AS numeric) , 2)     , "remainamt"      = ROUND(CAST(${policy.commin_rate/100} * netgrossprem AS numeric) , 2),
      "commamt"       = ROUND(CAST(${policy.commin_rate/100} * netgrossprem AS numeric) , 2)    , "commtaxamt"      = ROUND(CAST(${policy.commin_rate/100*wht} * netgrossprem AS numeric) , 2)
      WHERE "transType" = 'COMM-IN' ; -- Add your condition to filter the rows as needed
  UPDATE temp_commov
  SET polid = ${policy.polid},
      "endorseNo" = '${policy.endorseNo}',
      "totalamt"      = ROUND(CAST(${policy.ovin_rate/100} * netgrossprem AS numeric) , 2)     , "remainamt"      = ROUND(CAST(${policy.ovin_rate/100} * netgrossprem AS numeric) , 2),
      "ovamt"         = ROUND(CAST(${policy.ovin_rate/100} * netgrossprem AS numeric) , 2)   ,   "ovtaxamt"       = ROUND(CAST(${policy.ovin_rate/100*wht} * netgrossprem AS numeric) , 2)
      WHERE "transType" = 'OV-IN' ; -- Add your condition to filter the rows as needed
  UPDATE temp_commov
  SET polid = ${policy.polid},
      "endorseNo" = '${policy.endorseNo}',
      "totalamt"      = ROUND(CAST(${policy.commout1_rate/100} * netgrossprem AS numeric) , 2)     , "remainamt"      = ROUND(CAST(${policy.commout1_rate/100} * netgrossprem AS numeric) , 2),
      "commamt" = ROUND(CAST(${policy.commout1_rate/100} * netgrossprem AS numeric) , 2), "commtaxamt"  = ROUND(CAST(${policy.commout1_rate/100*whtagent1} * netgrossprem AS numeric) , 2)
      WHERE "transType" = 'COMM-OUT' and mainaccountcode = '${policy.agentCode}'; -- Add your condition to filter the rows as needed
 
  UPDATE temp_commov
  SET polid = ${policy.polid},
      "endorseNo" = '${policy.endorseNo}',
      "totalamt"      = ROUND(CAST(${policy.commout2_rate/100} * netgrossprem AS numeric) , 2)     , "remainamt"      = ROUND(CAST(${policy.commout2_rate/100} * netgrossprem AS numeric) , 2),
      "commamt" = ROUND(CAST(${policy.commout2_rate/100} * netgrossprem AS numeric) , 2), "commtaxamt"  = ROUND(CAST(${policy.commout2_rate/100*whtagent2} * netgrossprem AS numeric) , 2)
      WHERE "transType" = 'COMM-OUT' and mainaccountcode = '${policy.agentCode2}'; -- Add your condition to filter the rows as needed
  UPDATE temp_commov
  SET polid = ${policy.polid},
      "endorseNo" = '${policy.endorseNo}',
      "totalamt"      = ROUND(CAST(${policy.ovout1_rate/100} * netgrossprem AS numeric) , 2)     , "remainamt"      = ROUND(CAST(${policy.ovout1_rate/100} * netgrossprem AS numeric) , 2),
      "ovamt"         = ROUND(CAST(${policy.ovout1_rate/100} * netgrossprem AS numeric) , 2)   ,   "ovtaxamt"       = ROUND(CAST(${policy.ovout1_rate/100*whtagent1} * netgrossprem AS numeric) , 2)
      WHERE "transType" = 'OV-OUT' and mainaccountcode = '${policy.agentCode}'; -- Add your condition to filter the rows as needed
  UPDATE temp_commov
  SET polid = ${policy.polid},
      "endorseNo" = '${policy.endorseNo}',
      "totalamt"      = ROUND(CAST(${policy.ovout2_rate/100} * netgrossprem AS numeric) , 2)     , "remainamt"      = ROUND(CAST(${policy.ovout2_rate/100} * netgrossprem AS numeric) , 2),
      "ovamt"         = ROUND(CAST(${policy.ovout2_rate/100} * netgrossprem AS numeric) , 2)   ,   "ovtaxamt"       = ROUND(CAST(${policy.ovout2_rate/100*whtagent2} * netgrossprem AS numeric) , 2)
      WHERE "transType" = 'OV-OUT' and mainaccountcode = '${policy.agentCode2}'; -- Add your condition to filter the rows as needed  

  -- Insert the updated data into the destination table
  INSERT INTO static_data."Transactions"    ("transType", "subType", "insurerCode","agentCode","agentCode2", "policyNo"
          ,"endorseNo", "dftxno", "documentno", commamt,commtaxamt, ovamt,ovtaxamt,totalamt,remainamt
          ,"dueDate",netgrossprem,duty,tax,totalprem,txtype2
          , polid, "seqNo", mainaccountcode, withheld)
  SELECT "transType", "subType", "insurerCode","agentCode","agentCode2", "policyNo"
          ,"endorseNo", "dftxno", "documentno", commamt,commtaxamt, ovamt,ovtaxamt,totalamt,remainamt
          ,"dueDate",netgrossprem,duty,tax,totalprem,txtype2
          , polid, "seqNo", mainaccountcode, withheld 
  FROM temp_commov;

  END $$;`, {
  transaction: t,
  raw: true
})
// update transaction status = C  'COMM-IN', 'OV-IN', 'COMM-OUT', 'OV-OUT' ตอนนี้เปิดให้เปลี่ยนค่าคอมเฉพาะกรมธรรมที่ไม่เคยตัดหนี้กับสลักหลัง ตาม policyNo,dftxno แต่ถ้ามีสลักหลังต้องทำเรื่องค่าคอมวุ่นว่ายไปเช็คของเก่า
await sequelize.query(
  `update static_data."Transactions" 
SET "status" = 'C'
WHERE "policyNo" = :policyNo
and dftxno = :dftxno
and polid != :polid
and "transType" in ('COMM-IN', 'OV-IN', 'COMM-OUT', 'OV-OUT') 
-- and "transType" = 'PREM-IN'
and dfrpreferno is null 
`,
  {
    replacements: {
      dftxno : req.body.dftxno,
      policyNo: req.body.policyNo,
      polid : policy.polid
     

    },
    transaction: t,
    type: QueryTypes.UPDATE
  }
)
    await t.commit()
    await res.json({ endorseNo: endorseNo })
  } catch (error) {
    await t.rollback();
    console.error(error)
    await res.status(500).json(error.msg);
  }

};

const getPolicyListForEndorseAll = async (req, res) => {
  let cond = ` pol.insurancestatus = '${req.body.insurancestatus}'`
  if(req.body.insurancestatus === 'AI' ){
    cond = ` pol.insurancestatus = '${req.body.insurancestatus}' and  pol.policystatus is null `
  }else if(req.body.insurancestatus === 'AA' ){
    cond = ` pol.insurancestatus = '${req.body.insurancestatus}' and  pol.policystatus = 'PC' `
  }
  if(req.body.insurerCode !== null && req.body.insurerCode !== ''){
    cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
  }
  if(req.body.policyNoStart !== null && req.body.policyNoStart !== ''){
    cond = `${cond} and pol."policyNo" >= '${req.body.policyNoStart}'`
  }
  if(req.body.policyNoEnd !== null && req.body.policyNoEnd !== ''){
    cond = `${cond} and pol."policyNo" <= '${req.body.policyNoEnd}'`
  }
  if(req.body.applicationNo !== null && req.body.applicationNo !== ''){
    cond = `${cond} and pol."applicationNo" like '%${req.body.applicationNo}%'`
  }
  if(req.body.insureID !== null && req.body.insureID !== ''){
    cond = `${cond} and pol."insureID" = ${req.body.insureID}`
  }
  if(req.body.createdate_start !== null && req.body.createdate_start !== ''){
    cond = `${cond} and  DATE(pol."createdAt") between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
  }
  if(req.body.effdate_start !== null && req.body.effdate_start !== ''){
    cond = `${cond} 
    and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
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
    `select *, pol.id as previousid,
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
    and pol."lastVersion" = 'Y'
    order by pol."applicationNo" ASC `,
    {
     
      type: QueryTypes.SELECT
    }
  )
  res.json(records)
};

// #region OG endorseAll
// const endorseAll = async (req, res) => {
//   const jwt = req.headers.authorization.split(' ')[1];
//   const usercode = decode(jwt).USERNAME;
//   const appNo = []

//   const t = await sequelize.transaction();

//   const currentdate = getCurrentDate()
//   try {
//     const edData = req.body.endorseData
//     const edtype = edData.edtype
//     const edprem = edData.edprem
//     const policyData = req.body.policyData[0]

//     //gen new endores no
//     const endorseNo = 'EN-' + await getRunNo('ends', null, null, 'kw', currentdate, t);
//     console.log(endorseNo);
//     //endorse change insuree data
//     if (edtype.includes("ID")) {
//       const oldInsuree = await sequelize.query(
//         `update static_data."Insurees" 
//                SET  "lastversion" = 'N'
//               WHERE "insureeCode" = :insureeCode returning version`,
//         {
//           replacements: {
//             // policyNo: req.body.policyNo,
//             insureeCode: policyData.insureeCode

//           },
//           transaction: t,
//           type: QueryTypes.UPDATE
//         }
//       )

//       console.log("oldInsuree : " + oldInsuree);

//       const newEntity = await sequelize.query(
//         `insert into static_data."Entities"  
//         ("personType" , "titleID" , "t_ogName", "t_firstName", "t_lastName",
//         "email", "idCardType", "idCardNo", "taxNo", "branch", "t_branchName") 
//         values (:personType , :titleID , :t_ogName, :t_firstName, :t_lastName,
//         :email, :idCardType, :idCardNo, :taxNo, :branch, :t_branchName ) returning id; `,
//         {
//           replacements: {
//             personType: policyData.personType,
//             titleID: policyData.titleID,
//             t_ogName: policyData.t_ogName,
//             t_firstName: policyData.t_firstName,
//             t_lastName: policyData.t_lastName,
//             email: policyData.email,
//             idCardType: policyData.idCardType,
//             idCardNo: policyData.idCardNo,
//             taxNo: policyData.taxNo,
//             branch: policyData.branch,
//             t_branchName: policyData.t_branchName,

//           },
//           transaction: t,
//           type: QueryTypes.INSERT
//         }
//       )

//       console.log("newEntity : " + newEntity);

//       const newInsuree = await sequelize.query(
//         `insert into static_data."Insurees" ("insureeCode", "entityID", "version") values ( :insureeCode, :entityID, :version ) returning id; `,
//         {
//           replacements: {
//             version: policyData.InsureeVersion,
//             entityID: policyData.entityID,
//             insureeCode: policyData.insureeCode,

//           },
//           transaction: t,
//           type: QueryTypes.INSERT
//         }
//       )

//       console.log("newInsuree : " + newInsuree);


//     }

//     //endorse change insuree location
//     if (edtype.includes("IL")) {

//       await sequelize.query(
//         `update static_data."Locations" 
//                SET  "lastversion" = 'N'
//               WHERE id = :locationid `,
//         {
//           replacements: {
//             // policyNo: req.body.policyNo,
//             locationid: policyData.locationid

//           },
//           transaction: t,
//           type: QueryTypes.UPDATE
//         }
//       )

//       const newLocation = await sequelize.query(
//         `insert into static_data."Locations" 
//         (t_location_1, t_location_2, t_location_3, t_location_4, t_location_5, 
//         "provinceID", "districtID", "subDistrictID", zipcode, "locationType", 
//         "telNum_1", "telNum_2", "telNum_3", "entityID" , "lastversion")
//         values(:t_location_1, :t_location_2, :t_location_3, :t_location_4, :t_location_5, 
//         :provinceID, :districtID, :subDistrictID, :zipcode, 'A', 
//         :telNum_1, :telNum_2, :telNum_3, :entityID , 'Y') returning id; `,
//         {
//           replacements: {
//             t_location_1: policyData.t_location_1,
//             t_location_2: policyData.t_location_2,
//             t_location_3: policyData.t_location_3,
//             t_location_4: policyData.t_location_4,
//             t_location_5: policyData.t_location_5,
//             provinceID: policyData.provinceID,
//             districtID: policyData.districtID,
//             subDistrictID: policyData.subDistrictID,
//             zipcode: policyData.zipcode,
//             telNum_1: policyData.telNum_1,
//             telNum_2: policyData.telNum_2,
//             telNum_3: policyData.telNum_3,
//             entityID: policyData.entityID,

//           },
//           transaction: t,
//           type: QueryTypes.INSERT
//         }
//       )


//     }

//     //endorse change motor data
//     if (edtype.includes("MD")) {
//       const newmotor = await sequelize.query(
//         `update static_data."Motors" 
//         set brand = :brand , model = :model ,
//         specname = :specname , "motorprovinceID" = (select provinceid from static_data.provinces where t_provincename = :motorprovinceID ),
//         "chassisNo" = :chassisNo , "licenseNo" = :licenseNo , 
//         "modelYear" = :modelYear , "voluntaryCode" = :voluntaryCode,
//         "compulsoryCode" = :compulsoryCode , unregisterflag = :unregisterflag,
//         "engineNo" = :engineNo , cc = :cc , seat = :seat , gvw = :gvw 
//         where id = :itemList `,
//         {
//           replacements: {
//             // policyNo: policyData.policyNo,
//             brand: policyData.brand,
//             model: policyData.model,
//             specname: policyData.specname,
//             motorprovinceID: policyData.motorprovinceID,
//             chassisNo: policyData.chassisNo,
//             licenseNo: policyData.licenseNo,
//             modelYear: policyData.modelYear,
//             voluntaryCode: policyData.voluntaryCode,
//             compulsoryCode: policyData.compulsoryCode,
//             unregisterflag: policyData.unregisterflag,
//             engineNo: policyData.engineNo,
//             cc: policyData.cc,
//             seat: policyData.seat,
//             gvw: policyData.gvw,
//             itemList: policyData.itemList,

//           },
//           transaction: t,
//           type: QueryTypes.UPDATE
//         }
//       )
//  console.log('------------- update motor done -------------');
//     }

//     //update policy status ='C'

//     await sequelize.query(
//       `update static_data."Policies" 
//              SET "policystatus" = 'ED', "lastVersion" = 'N'
//             WHERE id = :polid `,
//       {
//         replacements: {
//           // policyNo: req.body.policyNo,
//           polid: policyData.polid

//         },
//         transaction: t,
//         type: QueryTypes.UPDATE
//       }
//     )

//     console.log("--------------- policy policystatus = ED success --------------");



//     //gen new app no
//     const applicationNo = 'APP' + await getRunNo('app', null, null, 'kw', currentdate, t);

//     // for juepc
//     policyData.previousid = policyData.polid
//     policyData.createusercode = usercode
//     policyData.endorseNo = endorseNo
//     policyData.applicationNo = applicationNo
//     policyData.id = null

//     policyData.insurancestatus = 'AA'
//     policyData.policystatus = 'PC'
//     if (edtype.includes("CS")) {
//       policyData.policystatus = 'CS'
//     }else if (edtype.includes("TL")) {
//       policyData.policystatus = 'TL'
//     }else if (edtype.includes("WD")) {
//       policyData.policystatus = 'WD'
//     }
//     policyData.createdAt = null
//     policyData.updatedAt = null

//     //update endorseseries
//     // if (policyData.endorseNo === null) {
//     //   policyData.endorseseries = 0
//     // } else {
//     //   console.log('no');
//     //   policyData.endorseseries = parseInt(policyData.endorseseries) + 1
//     // }
//     policyData.endorseseries = -99

//     if (edprem === 'Y') {
//       if (edData.netgrossprem < 0 ) {
//         edData.discinamt = parseFloat((edData.netgrossprem / policyData.netgrossprem * policyData.specdiscamt ).toFixed(2))
//       }else {
//         edData.discinamt = 0
//       }

//       policyData.grossprem =  policyData.grossprem + edData.netgrossprem
//       policyData.netgrossprem =  policyData.netgrossprem + edData.netgrossprem
//       policyData.tax =  policyData.tax + edData.tax
//       policyData.duty =  policyData.duty + edData.duty
//       policyData.totalprem =  policyData.totalprem + edData.totalprem

//       policyData.commin_amt = parseFloat((policyData.commin_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.ovin_amt = parseFloat((policyData.ovin_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.commin_taxamt = parseFloat((policyData.commin_amt * tax).toFixed(2))
//       policyData.ovin_taxamt = parseFloat((policyData.ovin_amt * tax).toFixed(2))
//       policyData.commout1_amt = parseFloat((policyData.commout1_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.ovout1_amt = parseFloat((policyData.ovout1_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.commout2_amt = parseFloat((policyData.commout2_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.ovout2_amt = parseFloat((policyData.ovout2_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.commout_amt = parseFloat((policyData.commout_rate * policyData.netgrossprem / 100).toFixed(2))
//       policyData.ovout_amt = parseFloat((policyData.ovout_rate * policyData.netgrossprem / 100).toFixed(2))

//       policyData.specdiscamt =  policyData.specdiscamt - edData.discinamt 
//       console.log(`------------- policy withhled  : ${policyData.withheld} ---------------`);
//       if (policyData.withheld > 0) {
//         policyData.withheld = parseFloat(((policyData.netgrossprem + policyData.duty) * withheld).toFixed(2))
//       } 

//     }

//     const newPolicy = await Policy.create(policyData, { transaction: t })
//     console.log(`----------------- new polid : ${newPolicy.id} ------------------`);
//     policyData.polid = newPolicy.id
//     //insert juepc juedt juepm
//     await sequelize.query(
//       `insert into static_data."b_juepcs" 
//              ("polid", previousid, "endorseNo", edeffdate, edexpdate) values
//             (:polid, :previousid, :endorseNo, :edeffdate, :edexpdate)`,
//       {
//         replacements: {
//           polid: policyData.polid,
//           previousid: policyData.previousid,
//           endorseNo: policyData.endorseNo,
//           edeffdate: edData.edeffdate,
//           edexpdate: policyData.expDate,
//         },
//         transaction: t,
//         type: QueryTypes.INSERT
//       }
//     )
//     console.log(`------------- done insert b_juepcs ---------------`);
//     await sequelize.query(
//       `insert into static_data."b_juedts" 
//       ("polid", edtypecode, "detail") values
//       (:polid, :edtypecode, :detail)`,
//       {
//         replacements: {
//           polid: policyData.polid,
//           edtypecode: edtype,
//           detail: `endorse all`,
//         },
//         transaction: t,
//         type: QueryTypes.INSERT
//       }
//     )
//     console.log(`------------- done insert b_juedts ---------------`);
//     console.log(`
//       polid: ${policyData.polid},
//       diffnetgrossprem: ${edData.netgrossprem},
//       diffduty: ${edData.duty},
//       difftax: ${edData.tax},
//       difftotalprem: ${edData.totalprem},
//       discinamt: ${edData.discinamt},
//   `);
//     if (edprem === 'Y') {

//       await sequelize.query(
//         `insert into static_data."b_juepms" 
//           ("polid", diffnetgrossprem, "diffduty", difftax, difftotalprem, discinamt) values
//           (:polid, :diffnetgrossprem, :diffduty, :difftax, :difftotalprem, :discinamt)`,
//         {
//           replacements: {
//             polid: policyData.polid,
//             diffnetgrossprem: edData.netgrossprem,
//             diffduty: edData.duty,
//             difftax: edData.tax,
//             difftotalprem: edData.totalprem,
//             discinamt: edData.discinamt,
//             // discinamt: 0,
//           },
//           transaction: t,
//           type: QueryTypes.INSERT
//         }
//       )
//       console.log(`------------- done insert b_juepms ---------------`);
//     }

//     // const installmentEdit = policyData.installment.advisor.filter(ele => ele.editflag)
//     // const jupgr = installmentEdit.installment
//     // const jupgr = { advisor: [], insurer: [] }

//     // policy.netgrossprem = edData.netgrossprem
//     // policy.duty = edData.duty
//     // policy.tax = edData.tax
//     // policy.totalprem = edData.totalprem
//     // policy.commin_amt = parseFloat((policy.commin_rate * edData.netgrossprem).toFixed(2))
//     // policy.ovin_amt = parseFloat((policy.ovin_rate * edData.netgrossprem).toFixed(2))
//     // policy.commout1_amt = parseFloat((policy.commout1_rate * edData.netgrossprem).toFixed(2))
//     // policy.ovout1_amt = parseFloat((policy.ovout1_rate * edData.netgrossprem).toFixed(2))
//     // policy.commout2_amt = parseFloat((policy.commout2_rate * edData.netgrossprem).toFixed(2))
//     // policy.ovout2_amt = parseFloat((policy.ovout2_rate * edData.netgrossprem).toFixed(2))
//     // policy.commout_amt = parseFloat((policy.commout_rate * edData.netgrossprem).toFixed(2))
//     // policy.ovout_amt = parseFloat((policy.ovout_rate * edData.netgrossprem).toFixed(2))
//     // policy.totalprem = edData.totalprem
   
//     // jupgr.advisor = edData
//     // jupgr.insurer = edData


//     console.log("OK before insert jupgr" + usercode);
//     // await createjupgrMinor(policyData, t, usercode)
//     await dupJupgr(policyData.previousid, policyData.polid, endorseNo, usercode, t)
//     console.log("done dup b_jupgr");


//     // policyData.edData = edData
//     if (edprem === 'Y') {

//       edData.commin_amt = parseFloat((policyData.commin_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.ovin_amt = parseFloat((policyData.ovin_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.commin_taxamt = parseFloat((edData.commin_amt * tax).toFixed(2))
//       edData.ovin_taxamt = parseFloat((edData.ovin_amt * tax).toFixed(2))
//       edData.commout1_amt = parseFloat((policyData.commout1_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.ovout1_amt = parseFloat((policyData.ovout1_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.commout2_amt = parseFloat((policyData.commout2_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.ovout2_amt = parseFloat((policyData.ovout2_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.commout_amt = parseFloat((policyData.commout_rate * edData.netgrossprem / 100).toFixed(2))
//       edData.ovout_amt = parseFloat((policyData.ovout_rate * edData.netgrossprem / 100).toFixed(2))
//       console.log(`----------- policy withhled  ${policyData.withheld} -------------`);
//       if (policyData.withheld > 0) {
//         edData.withheld = parseFloat(((edData.netgrossprem + edData.duty) * withheld).toFixed(2))
//       } else {
//         edData.withheld = 0
//       }


//       const seqno_max = await sequelize.query(
//         `select installmenttype , max("seqNo") as seqno from static_data.b_jupgrs bj  
//         where "polid" = :previousid 
//         GROUP BY installmenttype order by installmenttype `,
//         {
//           replacements: {
//             previousid: policyData.previousid
//           },

//           transaction: t,
//           type: QueryTypes.SELECT
//         }
//       )

//       console.log("-------------------- before insert endorse b_jupgr -----------------");
//       // insert into b_jupgr
//       await createjupgrEndorse(policyData, edData, seqno_max, usercode, t)
      
//       if (edData.netgrossprem >= 0) {// สลักหลังกระทบเบี้ยเพิ่ม
//         await createEndorse2Transection(policyData, edData, seqno_max, t)
        
//       }else if (edData.netgrossprem < 0 ){// สลักหลังกระทบเบี้ยลด
//         await createEndorse3Transection(policyData, edData, seqno_max, t)
//       }
//       console.log("ok");
//     }



//     await t.commit()
//     await res.json({ endorseNo: endorseNo })
//   } catch (error) {
//     await t.rollback();
//     await res.status(500).json(error);
//   }

// };
// #endregion



// edAll สร้างใบคำขอ
const endorseAll = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []

  const t = await sequelize.transaction();

  const currentdate = getCurrentDate()
  try {
    const edData = req.body.endorseData
    const edtype = edData.edtype
    const edprem = edData.edprem
    const policyData = req.body.policyData[0]

    //gen new endores no
    // const endorseNo = 'EN-' + await getRunNo('ends', null, null, 'kw', currentdate, t);
    // console.log(endorseNo);

    //endorse change insuree data
    if (edtype.includes("ID")) {
      const oldInsuree = await sequelize.query(
        `update static_data."Insurees" 
               SET  "lastversion" = 'N'
              WHERE "insureeCode" = :insureeCode returning version`,
        {
          replacements: {
            // policyNo: req.body.policyNo,
            insureeCode: policyData.insureeCode

          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )

      console.log("oldInsuree : " + oldInsuree);

      const newEntity = await sequelize.query(
        `insert into static_data."Entities"  
        ("personType" , "titleID" , "t_ogName", "t_firstName", "t_lastName",
        "email", "idCardType", "idCardNo", "taxNo", "branch", "t_branchName") 
        values (:personType , :titleID , :t_ogName, :t_firstName, :t_lastName,
        :email, :idCardType, :idCardNo, :taxNo, :branch, :t_branchName ) returning id; `,
        {
          replacements: {
            personType: policyData.personType,
            titleID: policyData.titleID,
            t_ogName: policyData.t_ogName,
            t_firstName: policyData.t_firstName,
            t_lastName: policyData.t_lastName,
            email: policyData.email,
            idCardType: policyData.idCardType,
            idCardNo: policyData.idCardNo,
            taxNo: policyData.taxNo,
            branch: policyData.branch,
            t_branchName: policyData.t_branchName,

          },
          transaction: t,
          type: QueryTypes.INSERT
        }

      )

      console.log("newEntity id: " + newEntity[0][0].id);

      const newInsuree = await sequelize.query(
        `insert into static_data."Insurees" ("insureeCode", "entityID", "version") values ( :insureeCode, :entityID, :version ) returning id; `,
        {
          replacements: {
            version: policyData.InsureeVersion,
            entityID: newEntity[0][0].id,
            insureeCode: policyData.insureeCode,

          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )

      // console.log("newInsuree : " + newInsuree);

       console.log('------------- update Insuree Data done -------------');
    }

    //endorse change insuree location
    if (edtype.includes("IL")) {

      await sequelize.query(
        `update static_data."Locations" 
               SET  "lastversion" = 'N'
              WHERE id = :locationid `,
        {
          replacements: {
            // policyNo: req.body.policyNo,
            locationid: policyData.locationid

          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )

      const newLocation = await sequelize.query(
        `insert into static_data."Locations" 
        (t_location_1, t_location_2, t_location_3, t_location_4, t_location_5, 
        "provinceID", "districtID", "subDistrictID", zipcode, "locationType", 
        "telNum_1", "telNum_2", "telNum_3", "entityID" , "lastversion")
        values(:t_location_1, :t_location_2, :t_location_3, :t_location_4, :t_location_5, 
          (select "provinceid" from static_data.provinces where t_provincename = :province limit 1),
          (select "amphurid" from static_data."Amphurs" where t_amphurname = :district limit 1),
          (select "tambonid" from static_data."Tambons" where t_tambonname = :subdistrict limit 1), :zipcode, 'A', 
        :telNum_1, :telNum_2, :telNum_3, :entityID , 'Y') returning id; `,
        {
          replacements: {
            t_location_1: policyData.t_location_1,
            t_location_2: policyData.t_location_2,
            t_location_3: policyData.t_location_3,
            t_location_4: policyData.t_location_4,
            t_location_5: policyData.t_location_5,
            province: policyData.province,
            district: policyData.district,
            subdistrict: policyData.subdistrict,
            zipcode: policyData.zipcode,
            telNum_1: policyData.telNum_1,
            telNum_2: policyData.telNum_2,
            telNum_3: policyData.telNum_3,
            entityID: policyData.entityID,

          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )

      console.log('------------- update Insuree Location done -------------');
    }

    //endorse change motor data
    if (edtype.includes("MD")) {

      if (req.params.type === 'fleet') {
        for (let j = 0; j < policyData.motorData.length; j++) {
          const motorData = policyData.motorData[j]
          //update motor
       cars = await sequelize.query(
        `DO $$ 
            DECLARE
              temp_motor_id INTEGER;
              inserted_motor_id INTEGER;
            begin

              Delete from static_data."FleetGroups" where "groupCode" = ${policyData.itemList} ;  

              SELECT id INTO temp_motor_id
              FROM static_data."Motors"
              WHERE "chassisNo" = '${motorData.chassisNo}';
                    
            IF temp_motor_id is not null
                THEN
                  update static_data."Motors" set 
                    "brand" = '${motorData.brand}', 
                    "voluntaryCode" = '${motorData.voluntaryCode}', 
                    "model" = '${motorData.model}', 
                    "specname" = '${motorData.specname}', 
                    "licenseNo" = '${motorData.licenseNo}', 
                    "motorprovinceID" = (select provinceid from static_data.provinces  where t_provincename =  '${motorData.motorprovince}' limit 1), 
                    "modelYear" = '${motorData.modelYear}',
                    "compulsoryCode" = '${motorData.compulsoryCode}', 
                    "unregisterflag" = '${motorData.unregisterflag}', 
                    "engineNo" = '${motorData.engineNo}', 
                    "cc" = ${motorData.cc}, 
                    "seat" = ${motorData.seat}, 
                    "gvw" = ${motorData.gvw} ,
                    "addition_access" = '${motorData.addition_access}'
                    where "chassisNo" = '${motorData.chassisNo}' RETURNING id INTO inserted_motor_id ;

                    insert into static_data."FleetGroups" ("groupCode", "type", "itemID") values(${policyData.itemList} , 'Motors', inserted_motor_id ) ;
                    
                else 
                  insert into static_data."Motors" ( "brand", "voluntaryCode", "model", "specname"
                  ,"licenseNo", "motorprovinceID", "chassisNo", "modelYear", "compulsoryCode", "unregisterflag"
                  , "engineNo", "cc", "seat", "gvw", "addition_access", "chassisNo")
                  values ('${motorData.brand}', '${motorData.voluntaryCode}', '${motorData.model}', '${motorData.specname}', '${motorData.licenseNo}'
                  , (select provinceid from static_data.provinces  where t_provincename =  '${motorData.motorprovince}' limit 1)
                  , '${motorData.chassisNo}', ${motorData.modelYear}, '${motorData.compulsoryCode}', '${motorData.unregisterflag}', '${motorData.engineNo}', ${motorData.cc}
                  , ${motorData.seat}, ${motorData.gvw}, '${motorData.addition_access}', '${motorData.chassisNo}') RETURNING id INTO inserted_motor_id ;

                  insert into static_data."FleetGroups" ("groupCode", "type", "itemID") values(${policyData.itemList} , 'Motors', inserted_motor_id ) ;
                END if;

            END $$;`
            ,
        {
          replacements: {
            brandname: motorData.brandname || null,
            voluntaryCode: motorData.voluntaryCode || '',
            modelname: motorData.modelname || null,
            specname: motorData.specname || null,
            licenseNo: motorData.licenseNo || null,
            motorprovince: motorData.motorprovinceID,
            chassisNo: motorData.chassisNo,
            modelYear: motorData.modelYear,
            itemList: motorData.itemList,
            compulsoryCode: motorData.compulsoryCode || '',
            unregisterflag: motorData.unregisterflag || 'N',
            engineNo: motorData.engineNo || '',
            cc: motorData.cc || null,
            seat: motorData.seat || null,
            gvw: motorData.gvw || null,
            itemList : policyData.itemList
          },
          transaction: t,
          raw: true 
        }
      )
        }
      

    }else if(req.params.type === 'minor') {

       //update motor
    cars = await sequelize.query(
      `update static_data."Motors" set 
      "brand" = :brandname, 
      "voluntaryCode" = :voluntaryCode, 
      "model" = :modelname, 
      "specname" = :specname, 
      "licenseNo" = :licenseNo, 
      "motorprovinceID" = (select provinceid from static_data.provinces  where t_provincename =  :motorprovince limit 1), 
      "chassisNo" = :chassisNo, 
      "modelYear" = :modelYear,
      "compulsoryCode" = :compulsoryCode, 
      "unregisterflag" = :unregisterflag, 
      "engineNo" = :engineNo, 
      "cc" = :cc, 
      "seat" = :seat, 
      "gvw" = :gvw 
      where id = :itemList`,
      {
        replacements: {
          brandname: policyData.brandname || null,
          voluntaryCode: policyData.voluntaryCode || '',
          modelname: policyData.modelname || null,
          specname: policyData.specname || null,
          licenseNo: policyData.licenseNo || null,
          motorprovince: policyData.motorprovinceID,
          chassisNo: policyData.chassisNo,
          modelYear: policyData.modelYear,
          itemList: policyData.itemList,
          compulsoryCode: policyData.compulsoryCode || '',
          unregisterflag: policyData.unregisterflag || 'N',
          engineNo: policyData.engineNo || '',
          cc: policyData.cc || null,
          seat: policyData.seat || null,
          gvw: policyData.gvw || null,

        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )

    }


      // const newmotor = await sequelize.query(
      //   `update static_data."Motors" 
      //   set brand = :brand , model = :model ,
      //   specname = :specname , "motorprovinceID" = (select provinceid from static_data.provinces  where t_provincename =  :motorprovinceID limit 1), 
      //   "chassisNo" = :chassisNo , "licenseNo" = :licenseNo , 
      //   "modelYear" = :modelYear , "voluntaryCode" = :voluntaryCode,
      //   "compulsoryCode" = :compulsoryCode , unregisterflag = :unregisterflag,
      //   "engineNo" = :engineNo , cc = :cc , seat = :seat , gvw = :gvw 
      //   where id = :itemList `,
      //   {
      //     replacements: {
      //       // policyNo: policyData.policyNo,
      //       brand: policyData.brandname,
      //       model: policyData.modelname,
      //       specname: policyData.specname,
      //       motorprovinceID: policyData.motorprovinceID,
      //       chassisNo: policyData.chassisNo,
      //       licenseNo: policyData.licenseNo,
      //       modelYear: policyData.modelYear,
      //       voluntaryCode: policyData.voluntaryCode,
      //       compulsoryCode: policyData.compulsoryCode,
      //       unregisterflag: policyData.unregisterflag,
      //       engineNo: policyData.engineNo,
      //       cc: policyData.cc,
      //       seat: policyData.seat,
      //       gvw: policyData.gvw,
      //       itemList: policyData.itemList,

      //     },
      //     transaction: t,
      //     type: QueryTypes.UPDATE
      //   }
      // )

 console.log('------------- update motor done -------------');
    }

    //update policy status ='C' and xlock ='Y'
    console.log("--------------- update data ID IL MD success --------------");
    await sequelize.query(
      `update static_data."Policies" 
             SET "policystatus" = 'ED' , "lastVersion" = 'N' , xlock ='Y'
            WHERE id = :polid `,
      {
        replacements: {
          // policyNo: req.body.policyNo,
          polid: policyData.polid

        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )

    console.log("--------------- policy policystatus = ED success --------------");



    //gen new app no
    const applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);

    // for juepc
    policyData.previousid = policyData.polid
    policyData.createusercode = usercode
    policyData.endorseNo = 'XXXXX'
    policyData.applicationNo = applicationNo
    policyData.id = null

    policyData.insurancestatus = 'AI'
    policyData.policystatus = null
    // policyData.policystatus = 'PC'
    // if (edtype.includes("CS")) {
    //   policyData.policystatus = 'CS'
    // }else if (edtype.includes("TL")) {
    //   policyData.policystatus = 'TL'
    // }else if (edtype.includes("WD")) {
    //   policyData.policystatus = 'WD'
    // }
    policyData.createdAt = null
    policyData.updatedAt = null
    policyData.seqNoins = 1
    policyData.seqNoagt = 1
    
    //update endorseseries
    // if (policyData.endorseNo === null) {
    //   policyData.endorseseries = 0
    // } else {
    //   console.log('no');
    //   policyData.endorseseries = parseInt(policyData.endorseseries) + 1
    // }
    policyData.endorseseries = -99

    // if (edprem === 'Y') {
    //   if (edData.netgrossprem < 0 ) {
    //     edData.discinamt = parseFloat((edData.netgrossprem / policyData.netgrossprem * policyData.specdiscamt ).toFixed(2))
    //   }else {
    //     edData.discinamt = 0
    //   }

    //   policyData.grossprem =  policyData.grossprem + edData.netgrossprem
    //   policyData.netgrossprem =  policyData.netgrossprem + edData.netgrossprem
    //   policyData.tax =  policyData.tax + edData.tax
    //   policyData.duty =  policyData.duty + edData.duty
    //   policyData.totalprem =  policyData.totalprem + edData.totalprem

    //   policyData.commin_amt = parseFloat((policyData.commin_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.ovin_amt = parseFloat((policyData.ovin_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.commin_taxamt = parseFloat((policyData.commin_amt * tax).toFixed(2))
    //   policyData.ovin_taxamt = parseFloat((policyData.ovin_amt * tax).toFixed(2))
    //   policyData.commout1_amt = parseFloat((policyData.commout1_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.ovout1_amt = parseFloat((policyData.ovout1_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.commout2_amt = parseFloat((policyData.commout2_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.ovout2_amt = parseFloat((policyData.ovout2_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.commout_amt = parseFloat((policyData.commout_rate * policyData.netgrossprem / 100).toFixed(2))
    //   policyData.ovout_amt = parseFloat((policyData.ovout_rate * policyData.netgrossprem / 100).toFixed(2))

    //   policyData.specdiscamt =  policyData.specdiscamt - edData.discinamt 
    //   console.log(`------------- policy withhled  : ${policyData.withheld} ---------------`);
    //   if (policyData.withheld > 0) {
    //     policyData.withheld = parseFloat(((policyData.netgrossprem + policyData.duty) * withheld).toFixed(2))
    //   } 

    // }

    const newPolicy = await Policy.create(policyData, { transaction: t })
    console.log(`----------------- new polid : ${newPolicy.id} ------------------`);
    policyData.polid = newPolicy.id
    //insert juepc juedt juepm

    await sequelize.query(
      `insert into static_data."b_juepcs" 
             ("polid", previousid
             -- ,"endorseNo",edeffdate, edexpdate
             ) values
            (:polid, :previousid
              -- ,:endorseNo,:edeffdate, :edexpdate
              )`,
      {
        replacements: {
          polid: policyData.polid,
          previousid: policyData.previousid,
          // endorseNo: policyData.endorseNo,
          // edeffdate: edData.edeffdate,
          // edexpdate: policyData.expDate,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    console.log(`------------- done insert b_juepcs ---------------`);
    await sequelize.query(
      `insert into static_data."b_juedts" 
      ("polid", edtypecode, "detail") values
      (:polid, :edtypecode, :detail)`,
      {
        replacements: {
          polid: policyData.polid,
          edtypecode: edtype,
          detail: `endorse all`,
        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    console.log(`------------- done insert b_juedts ---------------`);
    
    if (edprem === 'Y') {

      await sequelize.query(
        `insert into static_data."b_juepms" 
          ( "polid" ) values
          -- , diffnetgrossprem, "diffduty", difftax, difftotalprem, discinamt
          ( :polid )
            -- , :diffnetgrossprem, :diffduty, :difftax, :difftotalprem, :discinamt `,
        {
          replacements: {
            polid: policyData.polid,
            // diffnetgrossprem: edData.netgrossprem,
            // diffduty: edData.duty,
            // difftax: edData.tax,
            // difftotalprem: edData.totalprem,
            // discinamt: edData.discinamt,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
      console.log(`------------- done insert b_juepms ---------------`);
    }

 

    console.log("------------- Done insert juedt, juepm, juepd ------------------- ");

    await t.commit()
    await res.json({ appNo: [applicationNo] })
  } catch (error) {
    await t.rollback();
    console.error(error)
    await res.status(500).json(error);
  }

};

// edAll AI -> AA
const ConfirmEndorseAll = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;

  const t = await sequelize.transaction();

  const currentdate = getCurrentDate()
  try {

    
    const edData = req.body.edData
    const edtype = edData.edtype
    const edprem = edData.edprem
    const policyData = req.body.policyData
    const  installment = req.body.installment
    const endorseNo = policyData.endorseNo

    // for juepc
    policyData.createusercode = usercode
    policyData.endorseNo = endorseNo
    // policyData.applicationNo = applicationNo
   
    const checkPolicy = await sequelize.query(
      `select * from static_data."Policies" 
     WHERE "policyNo" = :policyNo and "endorseNo" = :endorseNo ;`,
       {
         replacements: {
           policyNo: policyData.policyNo,
           endorseNo : policyData.endorseNo},
           transaction: t ,
           type: QueryTypes.SELECT
          })
console.log(checkPolicy.length > 0)
if ((checkPolicy.length > 0)) {
throw `เลขสลักหลัง : ${policyData.endorseNo} มีอยู่ในระบบอยู่แล้ว`
}
console.log('-------check policy');


    policyData.insurancestatus = 'AA'
    policyData.policystatus = 'PC'
    if (edtype.includes("CS")) {
      policyData.policystatus = 'CS'
    }else if (edtype.includes("TL")) {
      policyData.policystatus = 'TL'
    }else if (edtype.includes("WD")) {
      policyData.policystatus = 'WD'
    }
    if (policyData.seqNoins === 1 && policyData.seqNoagt === 1) {
      policyData.policyType = 'F'
    }else {
      policyData.policyType = 'S'
    }
    //#region update endorseseries
    const oldpolicy = await sequelize.query(
      ` select p.endorseseries, bj.previousid  from static_data.b_juepcs bj 
      join static_data."Policies" p on bj.previousid = p.id where polid = :polid ;`,
      {
        replacements: {
          polid: policyData.polid
        },
    
        transaction: t,
        type: QueryTypes.SELECT
      }
    )

    policyData.endorseseries = oldpolicy[0].endorseseries + 1
    policyData.previousid = oldpolicy[0].previousid 
    //#endregion
    console.log(`------------- policy endorseseries  : ${policyData.endorseseries} ---------------`);

    // #region cal new prem,comm,ov ถ้าเป็น สลักหลังกระทบเบี้ย
    if (edprem === 'Y') {
      // // กรณี ไม่ต้องใส่ส่วนลด mannual
      // if (edData.netgrossprem < 0 ) {
      //   edData.discinamt = parseFloat((edData.netgrossprem / policyData.netgrossprem * policyData.specdiscamt ).toFixed(2))
      // }else {
      //   edData.discinamt = 0
      // }
      policyData.grossprem =  parseFloat(policyData.grossprem) + parseFloat(edData.netgrossprem)
      policyData.netgrossprem =  parseFloat(policyData.netgrossprem) + parseFloat(edData.netgrossprem)
      policyData.tax =  parseFloat(policyData.tax) + parseFloat(edData.tax)
      policyData.duty =  parseFloat(policyData.duty) + parseFloat(edData.duty)
      policyData.totalprem =  parseFloat(policyData.totalprem) + parseFloat(edData.totalprem)
      
      policyData.commin_amt = parseFloat((policyData.commin_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.ovin_amt = parseFloat((policyData.ovin_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.commin_taxamt = parseFloat((policyData.commin_amt * wht).toFixed(2))
      policyData.ovin_taxamt = parseFloat((policyData.ovin_amt * wht).toFixed(2))
      policyData.commout1_amt = parseFloat((policyData.commout1_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.ovout1_amt = parseFloat((policyData.ovout1_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.commout2_amt = parseFloat((policyData.commout2_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.ovout2_amt = parseFloat((policyData.ovout2_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.commout_amt = parseFloat((policyData.commout_rate * policyData.netgrossprem / 100).toFixed(2))
      policyData.ovout_amt = parseFloat((policyData.ovout_rate * policyData.netgrossprem / 100).toFixed(2))
      
      if (policyData.personTypeAgent === 'O') {
        policyData.commout1_taxamt = parseFloat((policyData.commout1_amt * wht).toFixed(2))
        policyData.ovout1_taxamt = parseFloat((policyData.ovout1_amt * wht).toFixed(2))
      }
      if (policyData.personTypeAgent2 === 'O') {
        policyData.commout2_taxamt = parseFloat((policyData.commout2_amt * wht).toFixed(2))
        policyData.ovout2_taxamt = parseFloat((policyData.ovout2_amt * wht).toFixed(2))
      }
      policyData.commout_taxamt = parseFloat(policyData.commout1_taxamt) + parseFloat(policyData.commout2_taxamt) 
      policyData.ovout_taxamt = parseFloat(policyData.ovout1_taxamt) +  parseFloat(policyData.ovout2_taxamt)
      console.log('---------------------- edprem = Y --------------------');
      
      policyData.specdiscamt =  parseFloat(policyData.specdiscamt) + parseFloat(edData.specdiscamt) 
      console.log(`------------- policy withhled  : ${policyData.withheld} ---------------`);
      if (policyData.withheld > 0) {
        policyData.withheld = parseFloat(((policyData.netgrossprem + policyData.duty) * withheld).toFixed(2))
      } 

    }
   
    // #endregion
    console.log(`------------- cal prem for new policy done ---------------`);

    //update policy data
    await sequelize.query(
      `update static_data."Policies" 
             SET "policystatus" = :policystatus, "insurancestatus" = :insurancestatus , endorseseries = :endorseseries, "endorseNo" = :endorseNo
             ,grossprem = :grossprem, netgrossprem = :netgrossprem, tax =:tax,  duty = :duty, totalprem = :totalprem
             ,commin_amt = :commin_amt, ovin_amt = :ovin_amt, commin_taxamt = :commin_taxamt, ovin_taxamt = :ovin_taxamt
             ,commout1_amt = :commout1_amt, ovout1_amt = :ovout1_amt  
             ,commout2_amt = :commout2_amt, ovout2_amt = :ovout2_amt
             ,commout_amt = :commout_amt, ovout_amt = :ovout_amt
             ,commout1_taxamt = :commout1_taxamt, ovout1_taxamt = :ovout1_taxamt  
             ,commout2_taxamt = :commout2_taxamt, ovout2_taxamt = :ovout2_taxamt
             ,commout_taxamt = :commout_taxamt, ovout_taxamt = :ovout_taxamt
             ,specdiscamt = :specdiscamt, "policyType" = :policyType, "seqNoins" = :seqNoins, "seqNoagt" = :seqNoagt
            WHERE id = :polid `,
      {
        replacements: {
          // policyNo: req.body.policyNo,
          polid: policyData.polid,
          policystatus : policyData.policystatus,
          insurancestatus : policyData.insurancestatus,
          endorseseries : policyData.endorseseries,
          endorseNo : endorseNo,
          grossprem : policyData.grossprem,
          netgrossprem : policyData.netgrossprem,
          tax : policyData.tax,
          duty : policyData.duty,
          totalprem : policyData.totalprem,
          commin_amt : policyData.commin_amt,
          ovin_amt : policyData.ovin_amt,
          commin_taxamt : policyData.commin_taxamt,
          ovin_taxamt : policyData.ovin_taxamt,
          commout1_amt : policyData.commout1_amt,
          ovout1_amt : policyData.ovout1_amt,
          commout2_amt : policyData.commout2_amt,
          ovout2_amt : policyData.ovout2_amt,
          commout_amt : policyData.commout_amt,
          ovout_amt : policyData.ovout_amt,
          specdiscamt : policyData.specdiscamt,
          policyType : policyData.policyType,
          seqNoins : policyData.seqNoins,
          seqNoagt : policyData.seqNoagt,
          commout1_taxamt : policyData.commout1_taxamt,
          ovout1_taxamt : policyData.ovout1_taxamt,
          commout2_taxamt : policyData.commout2_taxamt,
          ovout2_taxamt : policyData.ovout2_taxamt,
          commout_taxamt : policyData.commout_taxamt,
          ovout_taxamt : policyData.ovout_taxamt,


        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )

    console.log(`--------------- update policy endorseNo ${endorseNo} --------------`);

    //update juepc juedt juepm
    await sequelize.query(
      `update static_data."b_juepcs" set
        "endorseNo" = :endorseNo, edeffdate = :edeffdate, edexpdate = :edexpdate
        where polid = :polid`,
      {
        replacements: {
          polid: policyData.polid,
          endorseNo: policyData.endorseNo,
          edeffdate: policyData.edeffdate,
          edexpdate: policyData.expDate,
        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )
    console.log(`------------- done update b_juepcs ---------------`);
    
    
    if (edprem === 'Y') {

      await sequelize.query(
        `update static_data."b_juepms"  set
        diffnetgrossprem = :diffnetgrossprem , "diffduty" = :diffduty
        , difftax = :difftax, difftotalprem = :difftotalprem
        , discinamt = :discinamt
        where "polid" = :polid`,
        {
          replacements: {
            polid: policyData.polid,
            diffnetgrossprem: edData.netgrossprem,
            diffduty: edData.duty,
            difftax: edData.tax,
            difftotalprem: edData.totalprem,
            discinamt: edData.specdiscamt,
          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )
      console.log(`------------- done update b_juepms ---------------`);
    }

    // const installmentEdit = policyData.installment.advisor.filter(ele => ele.editflag)
    // const jupgr = installmentEdit.installment
    // const jupgr = { advisor: [], insurer: [] }

    // policy.netgrossprem = edData.netgrossprem
    // policy.duty = edData.duty
    // policy.tax = edData.tax
    // policy.totalprem = edData.totalprem
    // policy.commin_amt = parseFloat((policy.commin_rate * edData.netgrossprem).toFixed(2))
    // policy.ovin_amt = parseFloat((policy.ovin_rate * edData.netgrossprem).toFixed(2))
    // policy.commout1_amt = parseFloat((policy.commout1_rate * edData.netgrossprem).toFixed(2))
    // policy.ovout1_amt = parseFloat((policy.ovout1_rate * edData.netgrossprem).toFixed(2))
    // policy.commout2_amt = parseFloat((policy.commout2_rate * edData.netgrossprem).toFixed(2))
    // policy.ovout2_amt = parseFloat((policy.ovout2_rate * edData.netgrossprem).toFixed(2))
    // policy.commout_amt = parseFloat((policy.commout_rate * edData.netgrossprem).toFixed(2))
    // policy.ovout_amt = parseFloat((policy.ovout_rate * edData.netgrossprem).toFixed(2))
    // policy.totalprem = edData.totalprem
   
    // jupgr.advisor = edData
    // jupgr.insurer = edData


    console.log(`------------------ start insert jupgr by user : ${usercode} ---------------`);
    
    await dupJupgr(policyData.previousid, policyData.polid, endorseNo, usercode, t)
    console.log("------------------ done dup b_jupgr ------------------");


    // policyData.edData = edData
    if (edprem === 'Y') {

      edData.commin_amt = parseFloat((policyData.commin_rate * edData.netgrossprem / 100).toFixed(2))
      edData.ovin_amt = parseFloat((policyData.ovin_rate * edData.netgrossprem / 100).toFixed(2))
      edData.commin_taxamt = parseFloat((edData.commin_amt * tax).toFixed(2))
      edData.ovin_taxamt = parseFloat((edData.ovin_amt * tax).toFixed(2))
      edData.commout1_amt = parseFloat((policyData.commout1_rate * edData.netgrossprem / 100).toFixed(2))
      edData.ovout1_amt = parseFloat((policyData.ovout1_rate * edData.netgrossprem / 100).toFixed(2))
      edData.commout2_amt = parseFloat((policyData.commout2_rate * edData.netgrossprem / 100).toFixed(2))
      edData.ovout2_amt = parseFloat((policyData.ovout2_rate * edData.netgrossprem / 100).toFixed(2))
      edData.commout_amt = parseFloat((policyData.commout_rate * edData.netgrossprem / 100).toFixed(2))
      edData.ovout_amt = parseFloat((policyData.ovout_rate * edData.netgrossprem / 100).toFixed(2))

      console.log(`----------- policy withhled  ${policyData.withheld} -------------`);
      if (policyData.withheld > 0) {
        edData.withheld = parseFloat(((edData.netgrossprem + edData.duty) * withheld).toFixed(2))
      } else {
        edData.withheld = 0
      }



      console.log("-------------------- before insert endorse b_jupgr -----------------");
      // insert into b_jupgr
      await createjupgrEndorseInstall(policyData, installment,  usercode, t)
      
      if (edData.netgrossprem > 0) {// สลักหลังกระทบเบี้ยเพิ่ม
        await createEndorse2InstallTransection(policyData, installment, t)
        
      }else if (edData.netgrossprem < 0 ){// สลักหลังกระทบเบี้ยลด
        await createEndorse3InstallTransection(policyData, installment,edData,  t)
      }
      console.log("ok");
    }



    await t.commit()
    await res.json({ endorseNo: endorseNo })
  } catch (error) {
    await t.rollback();
    console.error(error)
    await res.status(500).json(error);
  }

};


const createEndorse2Transection = async (policy, edData,  t) => {

 
  const seqnoads = 0
  const seqnoinv = 0
  console.log(`seqnoads : ${seqnoads}`);
  //find credit term 
  const insurer = await sequelize.query(
    `select * FROM static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y' `,
    {
      replacements: {
        insurerCode: policy.insurerCode,

      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )
  const agent = await sequelize.query(
    `select * FROM static_data."Agents" 
   where "agentCode" = :agentcode  and lastversion ='Y' `,
    {
      replacements: {
        agentcode: policy.agentCode,
      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )

  //prem-out
  let date = new Date()
  const dueDatePremout = new Date()
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDatePremout.setDate(dueDatePremout.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDatePremout.setMonth(dueDatePremout.getMonth() + insurer[0].commovCreditT);
  }

  // เช็คว่าเป็นเบี้ยเพิ่ม  หรือเบี้ยลด
  let diff = 1
  let txtype2 = 2

  if (edData.netgrossprem < 0) {
    diff = -1
    txtype2 = 3
    edData.netgrossprem = -1 * edData.netgrossprem
    edData.duty = -1 * edData.duty
    edData.tax = -1 * edData.tax
    edData.totalprem = -1 * edData.totalprem
    edData.withheld = -1 * edData.withheld
    edData.commin_amt = -1 * edData.commin_amt
    edData.ovin_amt = -1 * edData.ovin_amt
    edData.commin_taxamt = -1 * edData.commin_taxamt
    edData.ovin_taxamt = -1 * edData.ovin_taxamt
    edData.commout1_amt = -1 * edData.commout1_amt
    edData.ovout1_amt = -1 * edData.ovout1_amt
    edData.commout2_amt = -1 * edData.commout2_amt
    edData.ovout2_amt = -1 * edData.ovout2_amt
    edData.commout_amt = -1 * edData.commout_amt
    edData.ovout_amt = -1 * edData.ovout_amt
  }
  if (edData.edtype === 'WD' || edData.edtype === 'TL') {
    txtype2 = 4
  } else if (edData.edtype === 'CS') {
    txtype2 = 5
  }

  const jupgr = { insurer: edData, advisor: edData }

  let totalamt = parseFloat(jupgr.insurer.totalprem) - parseFloat(jupgr.insurer.withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

  let dftxno = policy.endorseNo

  console.log("before premout");
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
         ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo",  mainaccountcode, withheld ) 
         VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode, :withheld )` ,

    {
      replacements: {
        polid: policy.polid,
        type: 'PREM-OUT',
        subType: 0 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        // agentCode2: policy.agentCode2,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer.invoiceNo,
        // totalamt: totalamt,
        totalamt: totalamt,
        // duedate: dueDate,
        duedate: dueDatePremout,
        netgrossprem: jupgr.insurer.netgrossprem,
        duty: jupgr.insurer.duty,
        tax: jupgr.insurer.tax,
        totalprem: jupgr.insurer.totalprem,
        //  netgrossprem: jupgr.insurernetgrossprem,
        //  duty: policy.duty,
        //  tax: policy.tax,
        //  totalprem: policy.totalprem,
        txtype2: txtype2,
        //seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: policy.insurerCode,
        withheld: jupgr.insurer.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  //comm-in
  totalamt = jupgr.insurer.commin_amt
  const dueDateCommin = new Date(dueDatePremout)
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDateCommin.setDate(dueDateCommin.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommin.setMonth(dueDateCommin.getMonth() + insurer[0].commovCreditT);
  }
  console.log("before commin");
  //dueDate.setDate(dueDate.getDate() + insurer[0].commovCreditT);
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, withheld ) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode ,:withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'COMM-IN',
        subType: 1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer.invoiceNo,
        netgrossprem: jupgr.insurer.netgrossprem,
        duty: jupgr.insurer.duty,
        tax: jupgr.insurer.tax,
        totalprem: jupgr.insurer.totalprem,
        commamt: jupgr.insurer.commin_amt,
        commtaxamt: jupgr.insurer.commin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommin,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: 'Amity',
        withheld: jupgr.insurer.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  //ov-in
  totalamt = jupgr.insurer.ovin_amt
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-IN',
        subType: 1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer.invoiceNo,
        ovamt: jupgr.insurer.ovin_amt,
        ovtaxamt: jupgr.insurer.ovin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommin,
        netgrossprem: jupgr.insurer.netgrossprem,
        duty: jupgr.insurer.duty,
        tax: jupgr.insurer.tax,
        totalprem: jupgr.insurer.totalprem,
        //  ovamt: jupgr.insurer[i].ovin_amt,
        //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
        //  totalamt: jupgr.insurer[i].ovin_amt,
        //  duedate: jupgr.insurer[i].dueDate,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: 'Amity',
        withheld: jupgr.insurer.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  //prem-in

  const dueDatePremin = new Date()
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDatePremin.setDate(dueDatePremin.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDatePremin.setMonth(dueDatePremin.getMonth() + insurer[0].commovCreditT);
  }
  totalamt = parseFloat(jupgr.advisor.totalprem) - parseFloat(jupgr.advisor.withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);

  console.log("before premin");
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
          ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
          VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'PREM-IN',
        subType: 1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor.invoiceNo,
        // totalamt: totalamt,
        // duedate: dueDate,
        // netgrossprem: policy.netgrossprem,
        // duty: policy.duty,
        // tax: policy.tax,
        // totalprem: policy.totalprem,
        totalamt: totalamt,
        duedate: dueDatePremin,
        netgrossprem: jupgr.advisor.netgrossprem,
        duty: jupgr.advisor.duty,
        tax: jupgr.advisor.tax,
        totalprem: jupgr.advisor.totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoads + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor.withheld,


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );


  const dueDateCommout = new Date(dueDatePremin)
  if (agent[0].commovCreditUnit.trim() === 'D') {
    dueDateCommout.setDate(dueDateCommout.getDate() + agent[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommout.setMonth(dueDateCommout.getMonth() + agent[0].commovCreditT);
  }
  if (diff < 0) {
    //DISC-IN
    console.log("before discin");
    totalamt = jupgr.advisor.specdiscamt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
    VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'DISC-IN',
          subType: -1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          commamt: jupgr.advisor.commout1_amt,
          commtaxamt: null,
          totalamt: totalamt,
          // duedate: policy.duedateagent,
          duedate: dueDatePremin,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          // seqno:i,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.insureeCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    //DISC-OUT
    console.log("before discout");
    totalamt = jupgr.advisor.specdiscamt
    // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
    /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
  ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
  VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'DISC-OUT',
          subType: 1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          endorseNo: policy.endorseNo,
          commamt: jupgr.advisor.commout1_amt,
          commtaxamt: null,
          totalamt: totalamt,
          // duedate: policy.duedateagent,
          duedate: dueDateCommout,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          // seqno:i,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.agentCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
  }
  console.log("before commout");
  //comm-out
  totalamt = jupgr.advisor.commout1_amt
  // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
  /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'COMM-OUT',
        subType: -1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor.invoiceNo,
        commamt: jupgr.advisor.commout1_amt,
        commtaxamt: null,
        totalamt: totalamt,
        //  duedate: policy.duedateagent,
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor.netgrossprem,
        duty: jupgr.advisor.duty,
        tax: jupgr.advisor.tax,
        totalprem: jupgr.advisor.totalprem,
        //  commamt: jupgr.advisor[i].commout1_amt,
        //  commtaxamt: null,
        //  totalamt: jupgr.advisor[i].commout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor.withheld,


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  //ov-out
  totalamt = policy.ovout1_amt
  await sequelize.query(
    ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-OUT',
        subType: -1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor.invoiceNo,
        ovamt: jupgr.advisor.ovout1_amt,
        ovtaxamt: null,
        totalamt: totalamt,
        //  duedate: policy.duedateagent,
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor.netgrossprem,
        duty: jupgr.advisor.duty,
        tax: jupgr.advisor.tax,
        totalprem: jupgr.advisor.totalprem,
        //  ovamt: jupgr.advisor[i].ovout1_amt,
        //  ovtaxamt: null,
        //  totalamt: jupgr.advisor[i].ovout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  // case 2 advisor amity -> advisor2 (comm/ov-out)

  if (policy.agentCode2) {
    date = new Date()
    const agent2 = await sequelize.query(
      'select * FROM static_data."Agents" ' +
      'where "agentCode" = :agentcode',
      {
        replacements: {
          agentcode: policy.agentCode2,
        },
        transaction: t,
        type: QueryTypes.SELECT
      }
    )
    //comm-out
    let totalamt = jupgr.advisor.commout2_amt
    //  const dueDate = new Date()
    //  dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
    console.log("before commout2");
    await sequelize.query(
      ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'COMM-OUT',
          subType: -1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          commamt: jupgr.advisor.commout2_amt,
          commtaxamt: null,
          totalamt: totalamt,
          //  duedate: dueDate,
          duedate: dueDateCommout,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          txtype2: txtype2,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.agentCode2,
          withheld: jupgr.advisor.withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    //ov-out
    console.log("before ovout2");
    totalamt = jupgr.advisor.ovout2_amt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
      netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
     :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'OV-OUT',
          subType: -1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          ovamt: jupgr.advisor.ovout2_amt,
          ovtaxamt: null,
          totalamt: totalamt,
          //  duedate: dueDate,
          duedate: dueDateCommout,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          txtype2: txtype2,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.agentCode2,
          withheld: jupgr.advisor.withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );

  }


}

const createEndorse2InstallTransection = async (policy, installment,  t) => {
  console.log("----------------------- START createEndorse2InstallTransection -------------- ");
 
  const seqnoads = policy.seqNoagt
  const seqnoinv = policy.seqNoins

  // #region find credit term 
  const insurer = await sequelize.query(
    `select * FROM static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y' `,
    {
      replacements: {
        insurerCode: policy.insurerCode,

      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )
  const agent = await sequelize.query(
    `select * FROM static_data."Agents" 
   where "agentCode" = :agentcode  and lastversion ='Y' `,
    {
      replacements: {
        agentcode: policy.agentCode,
      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )
 // #endregion 
// เช็คว่าเป็นเบี้ยเพิ่ม  หรือเบี้ยลด
let diff = 1
let txtype2 = 2

const jupgr = installment
let dftxno = policy.endorseNo

for (let i = 0; i < seqnoinv; i++) {


  //#region prem-out 

  // const dueDatePremout = new Date()
  // if (insurer[0].commovCreditUnit.trim() === 'D') {
  //   dueDatePremout.setDate(dueDatePremout.getDate() + insurer[0].commovCreditT);
  // } else if (insurer[0].commovCreditUnit.trim() === 'M') {
  //   dueDatePremout.setMonth(dueDatePremout.getMonth() + insurer[0].commovCreditT);
  // }


  let totalamt = parseFloat(jupgr.insurer[i].totalprem) - parseFloat(jupgr.insurer[i].withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

  

  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
         ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",
          totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid,
           "seqNo",  mainaccountcode, withheld ) 
         VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo,
           :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid,
            :seqno ,:mainaccountcode, :withheld )` ,

    {
      replacements: {
        polid: policy.polid,
        type: 'PREM-OUT',
        subType: 0,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        // agentCode2: policy.agentCode2,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer[i].invoiceNo,
        // totalamt: totalamt,
        totalamt: totalamt,
        
        // duedate: dueDatePremout,
        duedate: jupgr.insurer[i].dueDate,
        netgrossprem: jupgr.insurer[i].netgrossprem,
        duty: jupgr.insurer[i].duty,
        tax: jupgr.insurer[i].tax,
        totalprem: jupgr.insurer[i].totalprem,
        //  netgrossprem: jupgr.insurernetgrossprem,
        //  duty: policy.duty,
        //  tax: policy.tax,
        //  totalprem: policy.totalprem,
        txtype2: txtype2,
        //seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.insurerCode,
        withheld: jupgr.insurer[i].withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("---------------------- done premout ins ------------------");
  //#endregion

  //#region comm-in/ ov-in
  totalamt = jupgr.insurer[i].commin_amt
  // const dueDateCommin = new Date(dueDatePremout)
  // if (insurer[0].commovCreditUnit.trim() === 'D') {
  //   dueDateCommin.setDate(dueDateCommin.getDate() + insurer[0].commovCreditT);
  // } else if (insurer[0].commovCreditUnit.trim() === 'M') {
  //   dueDateCommin.setMonth(dueDateCommin.getMonth() + insurer[0].commovCreditT);
  // }
 
  //dueDate.setDate(dueDate.getDate() + insurer[0].commovCreditT);
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",
      commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid,
       "seqNo", mainaccountcode, withheld ) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, 
      :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid 
      ,:seqno ,:mainaccountcode ,:withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'COMM-IN',
        subType: 1 ,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer[i].invoiceNo,
        netgrossprem: jupgr.insurer[i].netgrossprem,
        duty: jupgr.insurer[i].duty,
        tax: jupgr.insurer[i].tax,
        totalprem: jupgr.insurer[i].totalprem,
        commamt: jupgr.insurer[i].commin_amt,
        commtaxamt: jupgr.insurer[i].commin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,

        // duedate: dueDateCommin,
        duedate: jupgr.insurer[i].dueDate,

        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: 'Amity',
        withheld: jupgr.insurer[i].withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  //ov-in
  totalamt = jupgr.insurer[i].ovin_amt
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",
      ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid,
       "seqNo" ,mainaccountcode , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo,
       :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid 
       ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-IN',
        subType: 1 ,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer[i].invoiceNo,
        ovamt: jupgr.insurer[i].ovin_amt,
        ovtaxamt: jupgr.insurer[i].ovin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        // duedate: dueDateCommin,
        duedate: jupgr.insurer[i].dueDate,

        netgrossprem: jupgr.insurer[i].netgrossprem,
        duty: jupgr.insurer[i].duty,
        tax: jupgr.insurer[i].tax,
        totalprem: jupgr.insurer[i].totalprem,
        //  ovamt: jupgr.insurer[i].ovin_amt,
        //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
        //  totalamt: jupgr.insurer[i].ovin_amt,
        //  duedate: jupgr.insurer[i].dueDate,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: 'Amity',
        withheld: jupgr.insurer[i].withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("------------------------- done comm/ov-in -----------------------");
//#endregion
}

for (let i = 0; i < seqnoads; i++) {


//#region prem-in agt1

  // const dueDatePremin = new Date()
  // if (insurer[0].commovCreditUnit.trim() === 'D') {
  //   dueDatePremin.setDate(dueDatePremin.getDate() + insurer[0].commovCreditT);
  // } else if (insurer[0].commovCreditUnit.trim() === 'M') {
  //   dueDatePremin.setMonth(dueDatePremin.getMonth() + insurer[0].commovCreditT);
  // }

  totalamt = parseFloat(jupgr.advisor[i].totalprem) - parseFloat(jupgr.advisor[i].withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);

 
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
          ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
          VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'PREM-IN',
        subType: 1 ,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor[i].invoiceNo,
        // totalamt: totalamt,
        // duedate: dueDate,
        // netgrossprem: policy.netgrossprem,
        // duty: policy.duty,
        // tax: policy.tax,
        // totalprem: policy.totalprem,
        totalamt: totalamt,
        // duedate: dueDatePremin,
        duedate: jupgr.advisor[i].dueDate,
        netgrossprem: jupgr.advisor[i].netgrossprem,
        duty: jupgr.advisor[i].duty,
        tax: jupgr.advisor[i].tax,
        totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor[i].withheld,


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  
//#endregion
console.log("----------------- done premin agt1 ---------------");

  // const dueDateCommout = new Date(dueDatePremin)
  const dueDateCommout = new Date(  jupgr.advisor[i].dueDate)

  if (agent[0].commovCreditUnit.trim() === 'D') {
    dueDateCommout.setDate(dueDateCommout.getDate() + agent[0].commovCreditT);
  } else if (agent[0].commovCreditUnit.trim() === 'M') {
    dueDateCommout.setMonth(dueDateCommout.getMonth() + agent[0].commovCreditT);
  }

   //#region comm-out / ov-out agt1
  totalamt = jupgr.advisor[i].commout1_amt
  // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
  /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'COMM-OUT',
        subType: 0,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor[i].invoiceNo,
        commamt: jupgr.advisor[i].commout1_amt,
        commtaxamt: jupgr.advisor[i].commout1_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateagent,
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor[i].netgrossprem,
        duty: jupgr.advisor[i].duty,
        tax: jupgr.advisor[i].tax,
        totalprem: jupgr.advisor[i].totalprem,
        //  commamt: jupgr.advisor[i].commout1_amt,
        //  commtaxamt: null,
        //  totalamt: jupgr.advisor[i].commout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor[i].withheld,


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

 
  totalamt = jupgr.advisor[i].ovout1_amt
  await sequelize.query(
    ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-OUT',
        subType: 0,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor[i].invoiceNo,
        ovamt: jupgr.advisor[i].ovout1_amt,
        ovtaxamt: jupgr.advisor[i].ovout1_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateagent,
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor[i].netgrossprem,
        duty: jupgr.advisor[i].duty,
        tax: jupgr.advisor[i].tax,
        totalprem: jupgr.advisor[i].totalprem,
        //  ovamt: jupgr.advisor[i].ovout1_amt,
        //  ovtaxamt: null,
        //  totalamt: jupgr.advisor[i].ovout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor[i].withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
   //#endregion 
  console.log("----------------- done comm/ov-out agt1 ----------------");
  // case 2 advisor amity -> advisor2 (comm/ov-out)

  if (policy.agentCode2) {
    date = new Date()
    const agent2 = await sequelize.query(
      `select * FROM static_data."Agents" 
      where "agentCode" = :agentcode
      and lastversion ='Y'`,
      {
        replacements: {
          agentcode: policy.agentCode2,
        },
        transaction: t,
        type: QueryTypes.SELECT
      }
    )

    const dueDateCommout2 = new Date(  jupgr.advisor[i].dueDate)

  if (agent2[0].commovCreditUnit.trim() === 'D') {
    dueDateCommout2.setDate(dueDateCommout2.getDate() + agent2[0].commovCreditT);
  } else if (agent2[0].commovCreditUnit.trim() === 'M') {
    dueDateCommout2.setMonth(dueDateCommout2.getMonth() + agent2[0].commovCreditT);
  }
 
    // #region comm-out /ov-out agt2
    let totalamt = jupgr.advisor[i].commout2_amt
    //  const dueDate = new Date()
    //  dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
    console.log("------------------- before commout agt2 --------------------------");
    await sequelize.query(
      ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'COMM-OUT',
          subType: 0,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[i].invoiceNo,
          commamt: jupgr.advisor[i].commout2_amt,
          commtaxamt: jupgr.advisor[i].commout2_taxamt,
          totalamt: totalamt,
          //  duedate: dueDate,
          duedate: dueDateCommout2,
          netgrossprem: jupgr.advisor[i].netgrossprem,
          duty: jupgr.advisor[i].duty,
          tax: jupgr.advisor[i].tax,
          totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          seqno: i + 1,
          mainaccountcode: policy.agentCode2,
          withheld: jupgr.advisor[i].withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    //ov-out
    console.log("------------------------ before ovout agt2 ---------------------------");
    totalamt = jupgr.advisor[i].ovout2_amt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
      netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
     :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'OV-OUT',
          subType:0,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[i].invoiceNo,
          ovamt: jupgr.advisor[i].ovout2_amt,
          ovtaxamt: jupgr.advisor[i].ovout2_taxamt,
          totalamt: totalamt,
          //  duedate: dueDate,
          duedate: dueDateCommout2,
          netgrossprem: jupgr.advisor[i].netgrossprem,
          duty: jupgr.advisor[i].duty,
          tax: jupgr.advisor[i].tax,
          totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          seqno: i + 1,
          mainaccountcode: policy.agentCode2,
          withheld: jupgr.advisor[i].withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
  // #endregion
console.log("----------------- done comm/ov-out agt2 ----------------");
  }
}

}

const createEndorse3Transection = async (policy, edData,  t) => {

  const seqnoads = 0
  const seqnoinv = 0
  console.log(`seqnoads : ${seqnoads}`);
  //find credit term 
  const insurer = await sequelize.query(
    `select * FROM static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y' `,
    {
      replacements: {
        insurerCode: policy.insurerCode,

      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )
  const agent = await sequelize.query(
    `select * FROM static_data."Agents" 
   where "agentCode" = :agentcode  and lastversion ='Y' `,
    {
      replacements: {
        agentcode: policy.agentCode,
      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )

  //prem-out
  let date = new Date()
  const dueDatePremout = new Date()
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDatePremout.setDate(dueDatePremout.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDatePremout.setMonth(dueDatePremout.getMonth() + insurer[0].commovCreditT);
  }

  // เช็คว่าเป็นเบี้ยเพิ่ม  หรือเบี้ยลด
  let diff = 1
  let txtype2 = 2

  if (edData.netgrossprem < 0) {
    diff = -1
    txtype2 = 3
    edData.netgrossprem = -1 * edData.netgrossprem
    edData.duty = -1 * edData.duty
    edData.tax = -1 * edData.tax
    edData.totalprem = -1 * edData.totalprem
    edData.withheld = -1 * edData.withheld
    edData.commin_amt = -1 * edData.commin_amt
    edData.ovin_amt = -1 * edData.ovin_amt
    edData.commin_taxamt = -1 * edData.commin_taxamt
    edData.ovin_taxamt = -1 * edData.ovin_taxamt
    edData.commout1_amt = -1 * edData.commout1_amt
    edData.ovout1_amt = -1 * edData.ovout1_amt
    edData.commout2_amt = -1 * edData.commout2_amt
    edData.ovout2_amt = -1 * edData.ovout2_amt
    edData.commout_amt = -1 * edData.commout_amt
    edData.ovout_amt = -1 * edData.ovout_amt
  }
  if (edData.edtype === 'WD' ) {
    txtype2 = 4
  } else if (edData.edtype === 'CS') {
    txtype2 = 5
  }

  const jupgr = { insurer: edData, advisor: edData }

  let totalamt = parseFloat(jupgr.insurer.totalprem) - parseFloat(jupgr.insurer.withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

  let dftxno = policy.endorseNo
  //prem-in บ.ประกัน
  console.log("before premin");
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
         ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo",  mainaccountcode, withheld ) 
         VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode, :withheld )` ,

    {
      replacements: {
        polid: policy.polid,
        // type: 'PREM-OUT',
        type: 'PREM-IN',
        subType: -1 * diff, // 1
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        // agentCode2: policy.agentCode2,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer.invoiceNo,
        // totalamt: totalamt,
        totalamt: totalamt,
        // duedate: dueDate,
        duedate: dueDatePremout,
        netgrossprem: jupgr.insurer.netgrossprem,
        duty: jupgr.insurer.duty,
        tax: jupgr.insurer.tax,
        totalprem: jupgr.insurer.totalprem,
        //  netgrossprem: jupgr.insurernetgrossprem,
        //  duty: policy.duty,
        //  tax: policy.tax,
        //  totalprem: policy.totalprem,
        txtype2: txtype2,
        //seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: policy.insurerCode,
        withheld: jupgr.insurer.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  //comm-out บ.ประกัน
  totalamt = jupgr.insurer.commin_amt
  const dueDateCommin = new Date(dueDatePremout)
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDateCommin.setDate(dueDateCommin.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommin.setMonth(dueDateCommin.getMonth() + insurer[0].commovCreditT);
  }
  console.log("before commout");
  //dueDate.setDate(dueDate.getDate() + insurer[0].commovCreditT);
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, withheld ) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode ,:withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        // type: 'COMM-IN',
        type: 'COMM-OUT',
        subType: 1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer.invoiceNo,
        netgrossprem: jupgr.insurer.netgrossprem,
        duty: jupgr.insurer.duty,
        tax: jupgr.insurer.tax,
        totalprem: jupgr.insurer.totalprem,
        commamt: jupgr.insurer.commin_amt,
        commtaxamt: jupgr.insurer.commin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommin,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        // mainaccountcode: 'Amity',
        mainaccountcode: policy.insurerCode,
        withheld: jupgr.insurer.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  //ov-out บ.ประกัน
  totalamt = jupgr.insurer.ovin_amt
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        // type: 'OV-IN',
        type: 'OV-OUT',
        subType: 1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer.invoiceNo,
        ovamt: jupgr.insurer.ovin_amt,
        ovtaxamt: jupgr.insurer.ovin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommin,
        netgrossprem: jupgr.insurer.netgrossprem,
        duty: jupgr.insurer.duty,
        tax: jupgr.insurer.tax,
        totalprem: jupgr.insurer.totalprem,
        //  ovamt: jupgr.insurer[i].ovin_amt,
        //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
        //  totalamt: jupgr.insurer[i].ovin_amt,
        //  duedate: jupgr.insurer[i].dueDate,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        // mainaccountcode: 'Amity',
        mainaccountcode: policy.insurerCode,
        withheld: jupgr.insurer.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  //prem-out agent

  const dueDatePremin = new Date()
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDatePremin.setDate(dueDatePremin.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDatePremin.setMonth(dueDatePremin.getMonth() + insurer[0].commovCreditT);
  }
  totalamt = parseFloat(jupgr.advisor.totalprem) - parseFloat(jupgr.advisor.withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);

  console.log("before premin");
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
          ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
          VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        // type: 'PREM-IN',
        type: 'PREM-OUT',
        subType: 1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor.invoiceNo,
        // totalamt: totalamt,
        // duedate: dueDate,
        // netgrossprem: policy.netgrossprem,
        // duty: policy.duty,
        // tax: policy.tax,
        // totalprem: policy.totalprem,
        totalamt: totalamt,
        duedate: dueDatePremin,
        netgrossprem: jupgr.advisor.netgrossprem,
        duty: jupgr.advisor.duty,
        tax: jupgr.advisor.tax,
        totalprem: jupgr.advisor.totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoads + 1,
        mainaccountcode: policy.agentCode,
        withheld: jupgr.advisor.withheld,


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );


  const dueDateCommout = new Date(dueDatePremin)
  if (agent[0].commovCreditUnit.trim() === 'D') {
    dueDateCommout.setDate(dueDateCommout.getDate() + agent[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommout.setMonth(dueDateCommout.getMonth() + agent[0].commovCreditT);
  }
  if (jupgr.advisor.discinamt >  0) {
    //DISC-out agent
    console.log("before discin");
    totalamt = jupgr.advisor.specdiscamt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
    VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          // type: 'DISC-IN',
          type: 'DISC-OUT',
          subType: -1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          commamt: jupgr.advisor.commout1_amt,
          commtaxamt: null,
          totalamt: totalamt,
          // duedate: policy.duedateagent,
          duedate: dueDatePremin,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          // seqno:i,
          seqno: seqnoinv + 1,
          // mainaccountcode: policy.insureeCode,
          mainaccountcode: policy.agentCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    //DISC-OUT
    console.log("before discout");
    totalamt = jupgr.advisor.specdiscamt
    // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
    /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
  ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
  VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          // type: 'DISC-OUT',
          type: 'DISC-IN',
          subType: 1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          endorseNo: policy.endorseNo,
          commamt: jupgr.advisor.commout1_amt,
          commtaxamt: null,
          totalamt: totalamt,
          // duedate: policy.duedateagent,
          duedate: dueDateCommout,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          // seqno:i,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.agentCode,
          // mainaccountcode: policy.insureeCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
  }
  console.log("before commout");
  //comm-in agent
  totalamt = jupgr.advisor.commout1_amt
  // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
  /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        // type: 'COMM-OUT',
        type: 'COMM-IN',
        subType: -1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor.invoiceNo,
        commamt: jupgr.advisor.commout1_amt,
        commtaxamt: null,
        totalamt: totalamt,
        //  duedate: policy.duedateagent,
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor.netgrossprem,
        duty: jupgr.advisor.duty,
        tax: jupgr.advisor.tax,
        totalprem: jupgr.advisor.totalprem,
        //  commamt: jupgr.advisor[i].commout1_amt,
        //  commtaxamt: null,
        //  totalamt: jupgr.advisor[i].commout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: policy.agentCode,
        // mainaccountcode: 'Amity',
        withheld: jupgr.advisor.withheld,


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  //ov-in agent
  totalamt = policy.ovout1_amt
  await sequelize.query(
    ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        // type: 'OV-OUT',
        type: 'OV-IN',
        subType: -1 * diff,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor.invoiceNo,
        ovamt: jupgr.advisor.ovout1_amt,
        ovtaxamt: null,
        totalamt: totalamt,
        //  duedate: policy.duedateagent,
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor.netgrossprem,
        duty: jupgr.advisor.duty,
        tax: jupgr.advisor.tax,
        totalprem: jupgr.advisor.totalprem,
        //  ovamt: jupgr.advisor[i].ovout1_amt,
        //  ovtaxamt: null,
        //  totalamt: jupgr.advisor[i].ovout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: seqnoinv + 1,
        mainaccountcode: policy.agentCode,
        // mainaccountcode: 'Amity',

        withheld: jupgr.advisor.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );

  // case 2 advisor amity -> advisor2 (comm/ov-out)

  if (policy.agentCode2) {
    date = new Date()
    const agent2 = await sequelize.query(
      'select * FROM static_data."Agents" ' +
      'where "agentCode" = :agentcode',
      {
        replacements: {
          agentcode: policy.agentCode2,
        },
        transaction: t,
        type: QueryTypes.SELECT
      }
    )
    //comm-in agent2
    let totalamt = jupgr.advisor.commout2_amt
    //  const dueDate = new Date()
    //  dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
    console.log("before commout2");
    await sequelize.query(
      ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          // type: 'COMM-OUT',
          type: 'COMM-IN',
          subType: -1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          commamt: jupgr.advisor.commout2_amt,
          commtaxamt: null,
          totalamt: totalamt,
          //  duedate: dueDate,
          duedate: dueDateCommout,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          txtype2: txtype2,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.agentCode2,
          withheld: jupgr.advisor.withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    //ov-in agent2
    console.log("before ovout2");
    totalamt = jupgr.advisor.ovout2_amt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
      netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
     :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          // type: 'OV-OUT',
          type: 'OV-IN',
          subType: -1 * diff,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor.invoiceNo,
          ovamt: jupgr.advisor.ovout2_amt,
          ovtaxamt: null,
          totalamt: totalamt,
          //  duedate: dueDate,
          duedate: dueDateCommout,
          netgrossprem: jupgr.advisor.netgrossprem,
          duty: jupgr.advisor.duty,
          tax: jupgr.advisor.tax,
          totalprem: jupgr.advisor.totalprem,
          txtype2: txtype2,
          seqno: seqnoinv + 1,
          mainaccountcode: policy.agentCode2,
          withheld: jupgr.advisor.withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );

  }


}

const createEndorse3InstallTransection = async (policy, installment,edData,  t) => {
  console.log("----------------------- START createEndorse3InstallTransection -------------- ");
  const seqnoads = policy.seqNoagt
  const seqnoinv = policy.seqNoins
  //let diff = -1
  let txtype2 = 3
  let dftxno = policy.endorseNo
  const jupgr = installment

  // const jupgr = { insurer: edData, advisor: edData }

  // if (edData.netgrossprem < 0) {
  //   diff = -1
  //   txtype2 = 3
  //   edData.netgrossprem = -1 * edData.netgrossprem
  //   edData.duty = -1 * edData.duty
  //   edData.tax = -1 * edData.tax
  //   edData.totalprem = -1 * edData.totalprem
  //   edData.withheld = -1 * edData.withheld
  //   edData.commin_amt = -1 * edData.commin_amt
  //   edData.ovin_amt = -1 * edData.ovin_amt
  //   edData.commin_taxamt = -1 * edData.commin_taxamt
  //   edData.ovin_taxamt = -1 * edData.ovin_taxamt
  //   edData.commout1_amt = -1 * edData.commout1_amt
  //   edData.ovout1_amt = -1 * edData.ovout1_amt
  //   edData.commout2_amt = -1 * edData.commout2_amt
  //   edData.ovout2_amt = -1 * edData.ovout2_amt
  //   edData.commout_amt = -1 * edData.commout_amt
  //   edData.ovout_amt = -1 * edData.ovout_amt
  // }
  if (edData.edtype === 'WD' ) {
    txtype2 = 4
  } else if (edData.edtype === 'CS') {
    txtype2 = 5
  }

   // #region find credit term
  const insurer = await sequelize.query(
    `select * FROM static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y' `,
    {
      replacements: {
        insurerCode: policy.insurerCode,

      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )
  const agent = await sequelize.query(
    `select * FROM static_data."Agents" 
   where "agentCode" = :agentcode  and lastversion ='Y' `,
    {
      replacements: {
        agentcode: policy.agentCode,
      },
      transaction: t,
      type: QueryTypes.SELECT
    }
  )
// #endregion 


for (let i = 0; i < seqnoinv; i++) {

  

  //#region prem-in บ.ประกัน

  // let date = new Date()
  // const dueDatePremout = new Date()
  // if (insurer[0].commovCreditUnit.trim() === 'D') {
  //   dueDatePremout.setDate(dueDatePremout.getDate() + insurer[0].commovCreditT);
  // } else if (insurer[0].commovCreditUnit.trim() === 'M') {
  //   dueDatePremout.setMonth(dueDatePremout.getMonth() + insurer[0].commovCreditT);
  // }

  let totalamt = parseFloat(jupgr.insurer[i].totalprem) - parseFloat(jupgr.insurer[i].withheld)
  
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
         ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo",  mainaccountcode, withheld ) 
         VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode, :withheld )` ,

    {
      replacements: {
        polid: policy.polid,
        type: 'PREM-OUT',
        //type: 'PREM-IN',
        //subType: -1 * diff, // 1
        subType: 1,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        // agentCode2: policy.agentCode2,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer[i].invoiceNo,
        // duedate: dueDatePremout,
        duedate: jupgr.insurer[i].dueDate,
        totalamt: Math.abs(totalamt),
        netgrossprem: Math.abs(jupgr.insurer[i].netgrossprem),
        duty: Math.abs(jupgr.insurer[i].duty),
        tax: Math.abs(jupgr.insurer[i].tax),
        totalprem: Math.abs(jupgr.insurer[i].totalprem),
        //  netgrossprem: jupgr.insurernetgrossprem,
        //  duty: policy.duty,
        //  tax: policy.tax,
        //  totalprem: policy.totalprem,
        txtype2: txtype2,
        //seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.insurerCode,
        withheld: Math.abs(jupgr.insurer[i].withheld),

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  //#endregion
  console.log("----------------------- done premin insurer -------------- ");

  //#region comm-out/ov-out บ.ประกัน
  totalamt = jupgr.insurer[i].commin_amt
  const dueDateCommout = new Date(jupgr.insurer[i].dueDate,)
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDateCommout.setDate(dueDateCommout.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommout.setMonth(dueDateCommout.getMonth() + insurer[0].commovCreditT);
  }
  
  //dueDate.setDate(dueDate.getDate() + insurer[0].commovCreditT);
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, withheld ) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode ,:withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'COMM-IN',
        //type: 'COMM-OUT',
        // subType: 1 * diff, // -1
        subType: 0 ,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer[i].invoiceNo,
        netgrossprem: Math.abs(jupgr.insurer[i].netgrossprem),
        duty: Math.abs(jupgr.insurer[i].duty),
        tax:  Math.abs(jupgr.insurer[i].tax),
        totalprem:  Math.abs(jupgr.insurer[i].totalprem),
        commamt:  Math.abs(jupgr.insurer[i].commin_amt),
        commtaxamt:  Math.abs(jupgr.insurer[i].commin_taxamt),
        totalamt:  Math.abs(totalamt),
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommout,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        // mainaccountcode: 'Amity',
        mainaccountcode: policy.insurerCode,
        withheld:  Math.abs(jupgr.insurer[i].withheld),

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  //ov-out บ.ประกัน
  totalamt = jupgr.insurer[i].ovin_amt
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-IN',
        //type: 'OV-OUT',
        //subType: 1 * diff, //-1
        subType: 0 ,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.insurer[i].invoiceNo,
        ovamt:  Math.abs(jupgr.insurer[i].ovin_amt),
        ovtaxamt:  Math.abs(jupgr.insurer[i].ovin_taxamt),
        totalamt:  Math.abs(totalamt),
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommout,
        netgrossprem:  Math.abs(jupgr.insurer[i].netgrossprem),
        duty: Math.abs( jupgr.insurer[i].duty),
        tax: Math.abs( jupgr.insurer[i].tax),
        totalprem: Math.abs( jupgr.insurer[i].totalprem),
        //  ovamt: jupgr.insurer[i].ovin_amt,
        //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
        //  totalamt: jupgr.insurer[i].ovin_amt,
        //  duedate: jupgr.insurer[i].dueDate,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        // mainaccountcode: 'Amity',
        mainaccountcode: policy.insurerCode,
        withheld:  Math.abs(jupgr.insurer[i].withheld),

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
//#endregion
console.log("------------------ done comm/ov-out insurer -------------------");
}

for (let i = 0; i < seqnoads; i++) {
  //#region prem-out agent

  // const dueDatePremin = new Date()
  // if (agent[0].commovCreditUnit.trim() === 'D') {
  //   dueDatePremin.setDate(dueDatePremin.getDate() + agent[0].commovCreditT);
  // } else if (agent[0].commovCreditUnit.trim() === 'M') {
  //   dueDatePremin.setMonth(dueDatePremin.getMonth() + agent[0].commovCreditT);
  // }
  totalamt = parseFloat(jupgr.advisor[i].totalprem) - parseFloat(jupgr.advisor[i].withheld)
// console.log(`------- invoiceNo agt 0 : ${Math.abs(totalamt)}`);
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
          ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
          VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'PREM-IN',
        // type: 'PREM-OUT',
        //subType: 1 * diff, //-1
        subType: 0,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor[i].invoiceNo,
        // totalamt: totalamt,
        // duedate: dueDate,
        // netgrossprem: policy.netgrossprem,
        // duty: policy.duty,
        // tax: policy.tax,
        // totalprem: policy.totalprem,
        totalamt: Math.abs(totalamt),
        // duedate: dueDatePremin,
        duedate: jupgr.advisor[i].dueDate,
        netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
        duty: Math.abs(jupgr.advisor[i].duty),
        tax: Math.abs(jupgr.advisor[i].tax),
        totalprem: Math.abs(jupgr.advisor[i].totalprem),
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.agentCode,
        withheld: Math.abs(jupgr.advisor[i].withheld),


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
//#endregion
  console.log("-------------------done premout agt1 -------------------------");


  const dueDateCommin = new Date(jupgr.advisor[i].dueDate)
  if (agent[0].commovCreditUnit.trim() === 'D') {
    dueDateCommin.setDate(dueDateCommin.getDate() + agent[0].commovCreditT);
  } else if (agent[0].commovCreditUnit.trim() === 'M') {
    dueDateCommin.setMonth(dueDateCommin.getMonth() + agent[0].commovCreditT);
  }

  if (jupgr.advisor[i].specdiscamt >  0) {
     //#region  DISC-out/ DISC-in agent
  
    totalamt = jupgr.advisor[i].specdiscamt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
    VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'DISC-IN',
          // type: 'DISC-OUT',
          //subType: -1 * diff, //1
          subType: 1,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[i].invoiceNo,
          commamt: Math.abs(jupgr.advisor[i].commout1_amt),
          commtaxamt: Math.abs(jupgr.advisor[i].commout1_taxamt),
          totalamt: Math.abs(totalamt),
          
          // duedate: dueDatePremin,
          duedate:jupgr.advisor[i].dueDate,

          netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
          duty: Math.abs(jupgr.advisor[i].duty),
          tax: Math.abs(jupgr.advisor[i].tax),
          totalprem: Math.abs(jupgr.advisor[i].totalprem),
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          // seqno:i,
          seqno: i + 1,
          // mainaccountcode: policy.insureeCode,
          mainaccountcode: policy.agentCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    console.log("---------------------- done discin --------------------");
    //DISC-OUT
    console.log("before discout");
    // totalamt = jupgr.advisor.specdiscamt
    // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
    /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
  ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
  VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'DISC-OUT',
          // type: 'DISC-IN',
          // subType: 1 * diff,//-1
          subType: 0,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[i].invoiceNo,
          endorseNo: policy.endorseNo,
          commamt: Math.abs(jupgr.advisor[i].commout1_amt),
          commtaxamt: Math.abs(jupgr.advisor[i].commout1_taxamt),
          totalamt: Math.abs(totalamt),
          duedate: jupgr.advisor[i].dueDate,
          // duedate: dueDateCommout,
          netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
          duty: Math.abs(jupgr.advisor[i].duty),
          tax: Math.abs(jupgr.advisor[i].tax),
          totalprem: Math.abs(jupgr.advisor[i].totalprem),
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: txtype2,
          // seqno:i,
          seqno: i + 1,
          mainaccountcode: policy.agentCode,
          // mainaccountcode: policy.insureeCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    console.log("---------------------- done discout --------------------"); 
     //#endregion
  }
  
 console.log(`----- before comin agt1`);
  //comm-in agent
  totalamt = jupgr.advisor[i].commout1_amt
  // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
  /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
     VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'COMM-OUT',
        // type: 'COMM-IN',
        // subType: -1 * diff, //1
        subType: 1 ,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor[i].invoiceNo,
        commamt: Math.abs(jupgr.advisor[i].commout1_amt),
        commtaxamt: Math.abs(jupgr.advisor[i].commout1_taxamt),
        totalamt: Math.abs(totalamt),
         duedate: jupgr.advisor[i].dueDate,
        // duedate: dueDateCommout,
        netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
        duty: Math.abs(jupgr.advisor[i].duty),
        tax: Math.abs(jupgr.advisor[i].tax),
        totalprem: Math.abs(jupgr.advisor[i].totalprem),
        //  commamt: jupgr.advisor[i].commout1_amt,
        //  commtaxamt: null,
        //  totalamt: jupgr.advisor[i].commout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.agentCode,
        // mainaccountcode: 'Amity',
        withheld: Math.abs(jupgr.advisor[i].withheld),


      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("--------------------- done  commin agt1 -------------");
  //ov-in agent
  totalamt = jupgr.advisor[i].ovout1_amt
  await sequelize.query(
    ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-OUT',
        // type: 'OV-IN',
        // subType: -1 * diff, // 1
        subType: 1,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: jupgr.advisor[i].invoiceNo,
        ovamt: Math.abs(jupgr.advisor[i].ovout1_amt),
        ovtaxamt: Math.abs(jupgr.advisor[i].ovout1_taxamt),
        totalamt: Math.abs(totalamt),
        //  duedate: policy.duedateagent,
        // duedate: dueDateCommout,
        duedate: jupgr.advisor[i].dueDate,
        netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
        duty: Math.abs(jupgr.advisor[i].duty),
        tax: Math.abs(jupgr.advisor[i].tax),
        totalprem: Math.abs(jupgr.advisor[i].totalprem),
        //  ovamt: jupgr.advisor[i].ovout1_amt,
        //  ovtaxamt: null,
        //  totalamt: jupgr.advisor[i].ovout1_amt,
        //  duedate: jupgr.advisor[i].dueDate,
        //  netgrossprem: jupgr.advisor[i].netgrossprem,
        //  duty: jupgr.advisor[i].duty,
        //  tax: jupgr.advisor[i].tax,
        //  totalprem: jupgr.advisor[i].totalprem,
        txtype2: txtype2,
        // seqno:i,
        seqno: i + 1,
        mainaccountcode: policy.agentCode,
        // mainaccountcode: 'Amity',

        withheld: Math.abs(jupgr.advisor[i].withheld),

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("--------------------- done  ovin agt1 -------------");
  // case 2 advisor amity -> advisor2 (comm/ov-out)

  if (policy.agentCode2) {
    date = new Date()
    
    //comm-in agent2
    let totalamt = jupgr.advisor[i].commout2_amt
    
    await sequelize.query(
      ` INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'COMM-OUT',
          // type: 'COMM-IN',
          // subType: -1 * diff, // 1
          subType: 1,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[i].invoiceNo,
          commamt: Math.abs(jupgr.advisor[i].commout2_amt),
          commtaxamt: Math.abs(jupgr.advisor[i].commout2_taxamt),
          totalamt: Math.abs(totalamt),
          //  duedate: dueDate,
          duedate: jupgr.advisor[i].dueDate,
          // duedate: dueDateCommout,
          netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
          duty: Math.abs(jupgr.advisor[i].duty),
          tax: Math.abs(jupgr.advisor[i].tax ),
          totalprem: Math.abs(jupgr.advisor[i].totalprem),
          txtype2: txtype2,
          seqno: i + 1,
          mainaccountcode: policy.agentCode2,
          withheld: Math.abs(jupgr.advisor[i].withheld),

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    console.log("------------------------- done commin agt2 -------------------");
    //ov-in agent2
    console.log("before ovout2");
    totalamt = jupgr.advisor[i].ovout2_amt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
      netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
     VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
     :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'OV-OUT',
          // type: 'OV-IN',
          // subType: -1 * diff, // 1
          subType: 1,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          agentCode2: policy.agentCode2,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[i].invoiceNo,
          ovamt: Math.abs(jupgr.advisor[i].ovout2_amt),
          ovtaxamt: Math.abs(jupgr.advisor[i].ovout2_taxamt),
          totalamt: Math.abs(totalamt),
          //  duedate: dueDate,
          // duedate: dueDateCommout,
          duedate: jupgr.advisor[i].dueDate,
          netgrossprem: Math.abs(jupgr.advisor[i].netgrossprem),
          duty: Math.abs(jupgr.advisor[i].duty),
          tax: Math.abs(jupgr.advisor[i].tax),
          totalprem: Math.abs(jupgr.advisor[i].totalprem),
          txtype2: txtype2,
          seqno: i + 1,
          mainaccountcode: policy.agentCode2,
          withheld: Math.abs(jupgr.advisor[i].withheld),

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    console.log("------------------------- done ovin agt2 -------------------");

  }

}
}

// clone old jupgr but change only polid
const dupJupgr = async (oldpolid, newpolid, endorseNo, user, t) => {
  console.log(`oldpolid : ${oldpolid}, newpolid : ${newpolid}, endorseNo : ${endorseNo}, user : ${user}`);
  await sequelize.query(
    `DO $$ 
    Begin
    -- Select data from the source table
    CREATE TEMPORARY TABLE temp_data AS
    SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
    -- INTO TEMPORARY TABLE temp_data
    FROM static_data.b_jupgrs bj 
    WHERE polid = ${oldpolid} ; -- Add your condition to filter the rows as needed
    
    -- Update the selected data
    UPDATE temp_data
    SET polid = ${newpolid},
        "endorseNo" = '${endorseNo}',
        createusercode = '${user}' WHERE polid = ${oldpolid} ; -- Add your condition to filter the rows as needed
    
    -- Insert the updated data into the destination table
    INSERT INTO static_data.b_jupgrs  ("policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno")
    SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
    FROM temp_data;
    END $$;`, {
    transaction: t,
    raw: true
  })
}

const createjupgrEndorse = async (policy, edData,  usercode, t) => {
  console.log("--------------------- begin createjupgrEndorse -----------------");
  

  const seqnoads = 0
  const seqnoinv = 0
  const currentdate = getCurrentDate()

  // policy.invoiceNo = 'INV' + await getRunNo('inv',null,null,'kwan',currentdate,t);
  const insureInvoiceCode = await InsureType.findOne({
    where: {
      id: policy.insureID,
    },
    attributes: ['invoiceCode'],
    transaction: t
  })
  console.log(`--------- insureInvoiceCode : ${insureInvoiceCode} ----------`);
  const insurerInvoiceCode = await Insurer.findOne({
    where: {
      insurerCode: policy.insurerCode,
      lastversion: 'Y',
    },
    attributes: ['invoiceCode'],
    transaction: t
  })
  console.log(`--------- insurerInvoiceCode : ${insurerInvoiceCode} ----------`);

  // edData.invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')}`;
  edData.invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${await getRunNo('inv', null, null, 'kwan', currentdate, t)}`;
  console.log(`--------- advisor invoiceNo : ${edData.invoiceNo} ----------`);
  edData.taxInvoiceNo = null
  const advisor = edData
  const insurer = edData
  //let withheld = 0 
  let specdiscamt = 0
  //let commout1_amt = 0
  //let ovout1_amt = 0
  //let commout2_amt = 0
  //let ovout2_amt = 0
  //let commout_amt = 0
  //let ovout_amt = 0

  //insert jupgr advisor
  const ads = await sequelize.query(
    `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", 
           grossprem, specdiscrate, specdiscamt, 
          netgrossprem, tax, duty, totalprem, 
         commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
          "agentCode", "agentCode2", 
          commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
          commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
          commout_rate, commout_amt, ovout_rate, ovout_amt, 
          -- commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
          createusercode, polid, withheld)
          values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
          :grossprem, :specdiscrate, :specdiscamt, 
          :netgrossprem, :tax, :duty, :totalprem, 
          :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt,
          :agentCode, :agentCode2,
          :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt, 
          :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt,  
          :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
          -- :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt, 
          :createusercode, :polid, :withheld )`,
    {
      replacements: {
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: policy.endorseNo,
        polid: policy.polid,
        invoiceNo: advisor.invoiceNo,
        taxInvoiceNo: advisor.taxInvoiceNo,
        installmenttype: 'A',
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        commout1_rate: policy[`commout1_rate`],
        ovout1_rate: policy[`ovout1_rate`],
        commout2_rate: policy[`commout2_rate`],
        ovout2_rate: policy[`ovout2_rate`],
        commout_rate: policy[`commout_rate`],
        ovout_rate: policy[`ovout_rate`],
        seqNo: seqnoads + 1,
        grossprem: advisor.netgrossprem,
        netgrossprem: advisor.netgrossprem,
        duty: advisor.duty,
        tax: advisor.tax,
        totalprem: advisor.totalprem,
        commout1_amt: advisor.commout1_amt,
        ovout1_amt: advisor.ovout1_amt,
        commout2_amt: advisor.commout2_amt,
        ovout2_amt: advisor.ovout2_amt,
        commout_amt: advisor.commout_amt,
        ovout_amt: advisor.ovout_amt,
        createusercode: usercode,
        specdiscrate: 0,
        // specdiscamt: specdiscamt,
        specdiscamt: advisor.discinamt,
        withheld: advisor['withheld'],
        
        commin_rate: policy[`commin_rate`],
        ovin_rate: policy[`ovin_rate`],
        commin_amt: advisor[`commin_amt`],
        commin_taxamt: advisor[`commin_taxamt`],
        ovin_amt: advisor[`ovin_amt`],
        ovin_taxamt: advisor[`ovin_taxamt`],
        // tax wth3%
        // commout1_taxamt: advisor[i][`commout1_taxamt`],
        // ovout1_taxamt: advisor[i][`ovout1_taxamt`],
        // commout2_taxamt: advisor[i][`commout2_taxamt`],
        // ovout2_taxamt: advisor[i][`ovout2_taxamt`],
        // commout_taxamt: advisor[i][`commout_taxamt`],
        // ovout_taxamt: advisor[i][`ovout_taxamt`],

      },

      transaction: t,
      type: QueryTypes.INSERT
    }
  )
  console.log(`done insert advisor jupgr `);

  // insurer.invoiceNo = null
  // insurer.taxInvoiceNo = null
  //insert jupgr insurer
  const ins = await sequelize.query(
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
        :polid, :withheld,
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,
        :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, 
        :commout_rate, :commout_amt, :ovout_rate, :ovout_amt )`,
    {
      replacements: {
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: policy.endorseNo,
        polid: policy.polid,
        // invoiceNo: insurer.invoiceNo,
        // taxInvoiceNo: insurer.taxInvoiceNo,
        invoiceNo: null,
        taxInvoiceNo: null,
        installmenttype: 'I',
        seqNo: seqnoinv + 1,
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        commin_rate: policy[`commin_rate`],
        ovin_rate: policy[`ovin_rate`],
        commout1_rate: policy[`commout1_rate`],
        ovout1_rate: policy[`ovout1_rate`],
        commout2_rate: policy[`commout2_rate`],
        ovout2_rate: policy[`ovout2_rate`],
        commout_rate: policy[`commout_rate`],
        ovout_rate: policy[`ovout_rate`],
        grossprem: insurer.netgrossprem,
        specdiscrate: 0,
        // specdiscamt: specdiscamt,
        specdiscamt: insurer.discinamt,
        netgrossprem: insurer.netgrossprem,
        duty: insurer.duty,
        tax: insurer.tax,
        totalprem: insurer.totalprem,

        commin_amt: insurer[`commin_amt`],
        commin_taxamt: insurer[`commin_taxamt`],

        ovin_amt: insurer[`ovin_amt`],
        ovin_taxamt: insurer[`ovin_taxamt`],

        createusercode: usercode,
        withheld: insurer['withheld'],
        commout1_amt: insurer[`commout1_amt`],
        ovout1_amt: insurer[`ovout1_amt`],
        commout2_amt: insurer[`commout2_amt`],
        ovout2_amt: insurer[`ovout2_amt`],
        commout_amt: insurer[`commout_amt`],
        ovout_amt: insurer[`ovout_amt`],

      },

      transaction: t,
      type: QueryTypes.INSERT
    }
  )
  console.log(`done insert insurer jupgr `);
}
const createjupgrEndorseInstall = async (policy, installment,  usercode, t) => {
  console.log("--------------------- begin createjupgrEndorse installment -----------------");
  

  // const seqnoads = policy.seqNoagt
  // const seqnoinv = policy.seqNoins
  const seqnoads = installment.advisor.length
  const seqnoinv = installment.insurer.length
  const currentdate = getCurrentDate()

  const advisor = installment.advisor
  const insurer = installment.insurer

//insert jupgr advisor
  
    
  // #region gen new invoiceNo amity
  const insureInvoiceCode = await InsureType.findOne({
    where: {
      id: policy.insureID,
    },
    attributes: ['invoiceCode'],
    transaction: t
  })
  console.log(`--------- insureInvoiceCode : ${insureInvoiceCode} ----------`);
  const insurerInvoiceCode = await Insurer.findOne({
    where: {
      insurerCode: policy.insurerCode,
      lastversion: 'Y',
    },
    attributes: ['invoiceCode'],
    transaction: t
  })
  console.log(`--------- insurerInvoiceCode : ${insurerInvoiceCode} ----------`);
 // #endregion 

  for (let i = 0; i < seqnoads; i++) {
    console.log(`----- i = ${i}`);
  // advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')}`;
  advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${ await getRunNo('inv', null, null, 'kwan', currentdate, t) }`;
  advisor[i].taxInvoiceNo = null
  console.log(`--------- advisor invoiceNo${i+1} : ${advisor[i].invoiceNo} ----------`);


 
  const ads = await sequelize.query(
    `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", 
           grossprem, specdiscrate, specdiscamt, 
          netgrossprem, tax, duty, totalprem, 
         commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
          "agentCode", "agentCode2", 
          commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
          commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
          commout_rate, commout_amt, ovout_rate, ovout_amt, 
          commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
          createusercode, polid, withheld)
          values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
          :grossprem, :specdiscrate, :specdiscamt, 
          :netgrossprem, :tax, :duty, :totalprem, 
          :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt,
          :agentCode, :agentCode2,
          :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt, 
          :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt,  
          :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
          :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt, 
          :createusercode, :polid, :withheld )`,
    {
      replacements: {
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: policy.endorseNo,
        polid: policy.polid,
        invoiceNo: advisor[i].invoiceNo,
        taxInvoiceNo: advisor[i].taxInvoiceNo,
        installmenttype: 'A',
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        commout1_rate: policy[`commout1_rate`],
        ovout1_rate: policy[`ovout1_rate`],
        commout2_rate: policy[`commout2_rate`],
        ovout2_rate: policy[`ovout2_rate`],
        commout_rate: policy[`commout_rate`],
        ovout_rate: policy[`ovout_rate`],
        seqNo: i + 1,
        grossprem: advisor[i].netgrossprem,
        netgrossprem: advisor[i].netgrossprem,
        duty: advisor[i].duty,
        tax: advisor[i].tax,
        totalprem: advisor[i].totalprem,
        commout1_amt: advisor[i].commout1_amt,
        ovout1_amt: advisor[i].ovout1_amt,
        commout2_amt: advisor[i].commout2_amt,
        ovout2_amt: advisor[i].ovout2_amt,
        commout_amt: advisor[i].commout_amt,
        ovout_amt: advisor[i].ovout_amt,
        createusercode: usercode,
        specdiscrate: 0,

        // specdiscamt: advisor[i].discinamt,
        specdiscamt: advisor[i].specdiscamt,
        withheld: advisor[i]['withheld'],
        
        commin_rate: policy[`commin_rate`],
        ovin_rate: policy[`ovin_rate`],
        commin_amt: advisor[i][`commin_amt`],
        commin_taxamt: advisor[i][`commin_taxamt`],
        ovin_amt: advisor[i][`ovin_amt`],
        ovin_taxamt: advisor[i][`ovin_taxamt`],
        // tax wth3%
        commout1_taxamt: advisor[i][`commout1_taxamt`],
        ovout1_taxamt: advisor[i][`ovout1_taxamt`],
        commout2_taxamt: advisor[i][`commout2_taxamt`],
        ovout2_taxamt: advisor[i][`ovout2_taxamt`],
        commout_taxamt: advisor[i][`commout_taxamt`],
        ovout_taxamt: advisor[i][`ovout_taxamt`],

      },

      transaction: t,
      type: QueryTypes.INSERT
    }
  )}

  console.log(`------------------ done insert advisor jupgr ------------------`);

  // insurer.invoiceNo = null
  // insurer.taxInvoiceNo = null
  //insert jupgr insurer
  for (let i = 0; i < seqnoinv; i++) {
  const ins = await sequelize.query(
    `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo",
        grossprem, specdiscrate, specdiscamt, 
        netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
        "agentCode", "agentCode2", createusercode, polid, withheld,
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
        commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
        commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
        commout_rate, commout_amt, ovout_rate, ovout_amt )
        values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
        :grossprem, :specdiscrate, :specdiscamt, 
        :netgrossprem, 
        :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :createusercode, 
        :polid, :withheld,
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,
        :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, 
        :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt, 
        :commout_rate, :commout_amt, :ovout_rate, :ovout_amt )`,
    {
      replacements: {
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: policy.endorseNo,
        polid: policy.polid,
        // invoiceNo: insurer.invoiceNo,
        // taxInvoiceNo: insurer.taxInvoiceNo,
        invoiceNo: insurer[i].invoiceNo,
        taxInvoiceNo: insurer[i].taxInvoiceNo,
        installmenttype: 'I',
        seqNo: i + 1,
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        commin_rate: policy[`commin_rate`],
        ovin_rate: policy[`ovin_rate`],
        commout1_rate: policy[`commout1_rate`],
        ovout1_rate: policy[`ovout1_rate`],
        commout2_rate: policy[`commout2_rate`],
        ovout2_rate: policy[`ovout2_rate`],
        commout_rate: policy[`commout_rate`],
        ovout_rate: policy[`ovout_rate`],
        grossprem: insurer[i].netgrossprem,
        specdiscrate: 0,
        // specdiscamt: specdiscamt,
        // specdiscamt: insurer[i].discinamt,
        specdiscamt: insurer[i].specdiscamt,

        netgrossprem: insurer[i].netgrossprem,
        duty: insurer[i].duty,
        tax: insurer[i].tax,
        totalprem: insurer[i].totalprem,

        commin_amt: insurer[i][`commin_amt`],
        commin_taxamt: insurer[i][`commin_taxamt`],

        ovin_amt: insurer[i][`ovin_amt`],
        ovin_taxamt: insurer[i][`ovin_taxamt`],

        createusercode: usercode,
        withheld: insurer[i]['withheld'],
        // commout1_amt: 0,
        // ovout1_amt: 0,
        // commout2_amt: 0,
        // ovout2_amt: 0,
        // commout_amt: 0,
        // ovout_amt: 0,
        commout1_amt: insurer[i][`commout1_amt`],
        ovout1_amt: insurer[i][`ovout1_amt`],
        commout2_amt: insurer[i][`commout2_amt`],
        ovout2_amt: insurer[i][`ovout2_amt`],
        commout_amt: insurer[i][`commout_amt`],
        ovout_amt: insurer[i][`ovout_amt`],
        commout1_taxamt: insurer[i][`commout1_taxamt`],
        ovout1_taxamt: insurer[i][`ovout1_taxamt`],
        commout2_taxamt: insurer[i][`commout2_taxamt`],
        ovout2_taxamt: insurer[i][`ovout2_taxamt`],
        commout_taxamt: insurer[i][`commout_taxamt`],
        ovout_taxamt: insurer[i][`ovout_taxamt`],


      },

      transaction: t,
      type: QueryTypes.INSERT
    }
  )}
  console.log(`------------------ done insert insurer jupgr  ------------------`);
  console.log(`------------------ done createjupgrEndorse installment  ------------------`);
}

//ใ้ชกับสลักหลังภายใน ให้ส่วนลด (MT81) , เปลี่ยนงวดชำระ (MT82) , แก้ไขค่าคอม (MT83)
const createjupgrChangeinv = async (policy, t, usercode) => {
  console.log("------------- begin create jupgr changeinv -------------");
  console.log("------------- dup jupgr changeinv -------------");
  console.log(`oldpolid : ${policy.previousid}, newpolid : ${policy.polid}, endorseNo : ${policy.endorseNo}, user : ${usercode}`);
  //check wht ของ agent1/agent2
  let whtagent1 = wht ;
  let whtagent2 = wht ;
  if(policy.commout1_taxamt == 0){ whtagent1 = 0}
  if(policy.commout2_taxamt == 0){ whtagent2 = 0}
  // cloneข้อมูล jupgr 
  await sequelize.query(
    `DO $$ 
    Begin
    -- Select data from the source table installment = 'I' 
    CREATE TEMPORARY TABLE temp_dataI AS
    SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
    -- INTO TEMPORARY TABLE temp_dataI
    FROM static_data.b_jupgrs bj 
    WHERE polid = ${policy.previousid} and installmenttype  = 'I' ; -- Add your condition to filter the rows as needed
    
    -- Update the selected data
    UPDATE temp_dataI
    SET polid = ${policy.polid},
        "endorseNo" = '${policy.endorseNo}',
        "commin_rate"   = ${policy.commin_rate}   , "commin_amt"  = ROUND(CAST(${policy.commin_rate/100} * netgrossprem AS numeric) , 2), "commin_taxamt"      = ROUND(CAST(${policy.commin_rate/100*wht} * netgrossprem AS numeric ) , 2),
        "ovin_rate"     = ${policy.ovin_rate}     , "ovin_amt"    = ROUND(CAST(${policy.ovin_rate/100} * netgrossprem AS numeric) , 2),   "ovin_taxamt"        = ROUND(CAST(${policy.ovin_rate/100*wht} * netgrossprem AS numeric ) , 2),
        "commout1_rate" = ${policy.commout1_rate} ,"commout1_amt" = ROUND(CAST(${policy.commout1_rate/100} * netgrossprem AS numeric) , 2), "commout1_taxamt"  = ROUND(CAST(${policy.commout1_rate/100*whtagent1} * netgrossprem AS numeric ) , 2),
        "ovout1_rate"   = ${policy.ovout1_rate}   , "ovout1_amt"  = ROUND(CAST(${policy.ovout1_rate/100} * netgrossprem AS numeric) , 2),  "ovout1_taxamt"     = ROUND(CAST(${policy.ovout1_rate/100*whtagent1} * netgrossprem AS numeric ) , 2),
        "commout2_rate" = ${policy.commout2_rate} , "commout2_amt"= ROUND(CAST(${policy.commout2_rate/100} * netgrossprem AS numeric) , 2),  "commout2_taxamt" = ROUND(CAST(${policy.commout2_rate/100*whtagent2} * netgrossprem AS numeric ) , 2),
        "ovout2_rate"   = ${policy.ovout2_rate}   , "ovout2_amt"  = ROUND(CAST(${policy.ovout2_rate/100} * netgrossprem AS numeric) , 2), "ovout2_taxamt"      = ROUND(CAST(${policy.ovout2_rate/100*whtagent2} * netgrossprem AS numeric ) , 2),     
        "commout_rate"  = ${policy.commout_rate}  , "commout_amt" = ROUND(CAST(${policy.commout_rate/100} * netgrossprem AS numeric) , 2),  "commout_taxamt"   = ROUND(CAST(${(policy.commout1_rate/100*whtagent1) + (policy.commout2_rate/100*whtagent2)} * netgrossprem AS numeric ) , 2),
        "ovout_rate"    = ${policy.ovout_rate}    , "ovout_amt"   = ROUND(CAST(${policy.ovout_rate/100} * netgrossprem AS numeric) , 2),  "ovout_taxamt"       = ROUND(CAST(${(policy.ovout1_rate/100*whtagent1) + (policy.ovout2_rate/100*whtagent2)} * netgrossprem AS numeric ) , 2),
        createusercode = '${usercode}' WHERE polid = ${policy.previousid} ; -- Add your condition to filter the rows as needed
    
    -- Insert the updated data into the destination table
    INSERT INTO static_data.b_jupgrs  ("policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno")
    SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
    FROM temp_dataI;

    -- Select data from the source table installment = 'A'
    CREATE TEMPORARY TABLE temp_dataA AS
    SELECT bj."policyNo", bj."invoiceNo", bj."taxInvoiceNo", bj."installmenttype", bj."seqNo", bj."grossprem", bj."specdiscrate", bj."specdiscamt",
             bj."netgrossprem", bj."tax", bj."duty", bj."totalprem", bj."commin_rate", bj."commin_amt", bj."ovin_rate", bj."ovin_amt", 
             bj."commin_taxamt", bj."ovin_taxamt", bj."agentCode", bj."agentCode2", bj."commout1_rate", bj."commout1_amt", bj."ovout1_rate", bj."ovout1_amt",
             bj."commout2_rate", bj."commout2_amt", bj."ovout2_rate", bj."ovout2_amt", bj."commout_rate", bj."commout_amt", bj."ovout_rate", bj."ovout_amt", 
             bj."withheld", bj."commout1_taxamt", bj."ovout1_taxamt", bj."commout2_taxamt", bj."ovout2_taxamt", bj."commout_taxamt", bj."ovout_taxamt", 
             bj."lastprintdate", bj."lastprintuser", bj."polid", bj."endorseNo", bj."createusercode", bj."dftxno"
    -- INTO TEMPORARY TABLE temp_data
    FROM static_data.b_jupgrs bj 
    left join static_data."Transactions" t on t."policyNo" = bj."policyNo" and t.dftxno = bj.dftxno and t."seqNo" =bj."seqNo" and t."transType" ='PREM-IN' 
    WHERE bj.polid =  ${policy.previousid}
   and installmenttype  = 'A'
  and t.status ='N'
 and t.dfrpreferno is not null ; -- Add your condition to filter the rows as needed
    
    -- Update the selected data
    UPDATE temp_dataA
    SET polid = ${policy.polid},
        "endorseNo" = '${policy.endorseNo}',
        "commin_rate"   = ${policy.commin_rate}   , "commin_amt"  = ROUND(CAST(${policy.commin_rate/100} * netgrossprem AS numeric) , 2), "commin_taxamt"      = ROUND(CAST(${policy.commin_rate/100*wht} * netgrossprem AS numeric ) , 2),
        "ovin_rate"     = ${policy.ovin_rate}     , "ovin_amt"    = ROUND(CAST(${policy.ovin_rate/100} * netgrossprem AS numeric) , 2),   "ovin_taxamt"        = ROUND(CAST(${policy.ovin_rate/100*wht} * netgrossprem AS numeric ) , 2),
        "commout1_rate" = ${policy.commout1_rate} ,"commout1_amt" = ROUND(CAST(${policy.commout1_rate/100} * netgrossprem AS numeric) , 2), "commout1_taxamt"  = ROUND(CAST(${policy.commout1_rate/100*whtagent1} * netgrossprem AS numeric ) , 2),
        "ovout1_rate"   = ${policy.ovout1_rate}   , "ovout1_amt"  = ROUND(CAST(${policy.ovout1_rate/100} * netgrossprem AS numeric) , 2),  "ovout1_taxamt"     = ROUND(CAST(${policy.ovout1_rate/100*whtagent1} * netgrossprem AS numeric ) , 2),
        "commout2_rate" = ${policy.commout2_rate} , "commout2_amt"= ROUND(CAST(${policy.commout2_rate/100} * netgrossprem AS numeric) , 2),  "commout2_taxamt" = ROUND(CAST(${policy.commout2_rate/100*whtagent2} * netgrossprem AS numeric ) , 2),
        "ovout2_rate"   = ${policy.ovout2_rate}   , "ovout2_amt"  = ROUND(CAST(${policy.ovout2_rate/100} * netgrossprem AS numeric) , 2), "ovout2_taxamt"      = ROUND(CAST(${policy.ovout2_rate/100*whtagent2} * netgrossprem AS numeric ) , 2),     
        "commout_rate"  = ${policy.commout_rate}  , "commout_amt" = ROUND(CAST(${policy.commout_rate/100} * netgrossprem AS numeric) , 2),  "commout_taxamt"   = ROUND(CAST(${(policy.commout1_rate/100*whtagent1) + (policy.commout2_rate/100*whtagent2)} * netgrossprem AS numeric ) , 2),
        "ovout_rate"    = ${policy.ovout_rate}    , "ovout_amt"   = ROUND(CAST(${policy.ovout_rate/100} * netgrossprem AS numeric) , 2),  "ovout_taxamt"       = ROUND(CAST(${(policy.ovout1_rate/100*whtagent1) + (policy.ovout2_rate/100*whtagent2)} * netgrossprem AS numeric ) , 2),
        createusercode = '${usercode}' WHERE polid = ${policy.previousid} ; -- Add your condition to filter the rows as needed
    
    -- Insert the updated data into the destination table
    INSERT INTO static_data.b_jupgrs  ("policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno")
    SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
    FROM temp_dataA;

    END $$;`, {
    transaction: t,
    raw: true
  })


  const advisor = policy.installment.advisor
  const insurer = policy.installment.insurer
  const arrIns = []
  const arrAds = []
  const currentdate = getCurrentDate()
  // let dftxno = policy.policyNo
  // if (policy.endorseNo) {
  //   dftxno = policy.endorseNo
  // }

  //สลักหลังภายใน dftxno เป็นค่าเดิม
  let dftxno = policy.dftxno
  console.log("dftxno : " + dftxno);

  // policy.invoiceNo = 'INV' + await getRunNo('inv',null,null,'kwan',currentdate,t);
  const insureInvoiceCode = await InsureType.findOne({
    where: {
      id: policy.insureID,
    },
    attributes: ['invoiceCode'],
    transaction: t
  })
  const insurerInvoiceCode = await Insurer.findOne({
    where: {
      insurerCode: policy.insurerCode,
      lastversion: 'Y',
    },
    attributes: ['invoiceCode'],
    transaction: t
  })


//ถ้าเป็นสลักหลังแก้ไขค่าคอม clone jupgr เก่ามา แก้ไขupdate commov_amt/taxamt
if (policy.edtypecode ===  "MT83") {
  await sequelize.query(
    `DO $$ 
    Begin
    -- Select data from the source table installment = 'A'
    CREATE TEMPORARY TABLE temp_dataA2 AS
    SELECT bj."policyNo", bj."invoiceNo", bj."taxInvoiceNo", bj."installmenttype", bj."seqNo", bj."grossprem", bj."specdiscrate", bj."specdiscamt",
             bj."netgrossprem", bj."tax", bj."duty", bj."totalprem", bj."commin_rate", bj."commin_amt", bj."ovin_rate", bj."ovin_amt", 
             bj."commin_taxamt", bj."ovin_taxamt", bj."agentCode", bj."agentCode2", bj."commout1_rate", bj."commout1_amt", bj."ovout1_rate", bj."ovout1_amt",
             bj."commout2_rate", bj."commout2_amt", bj."ovout2_rate", bj."ovout2_amt", bj."commout_rate", bj."commout_amt", bj."ovout_rate", bj."ovout_amt", 
             bj."withheld", bj."commout1_taxamt", bj."ovout1_taxamt", bj."commout2_taxamt", bj."ovout2_taxamt", bj."commout_taxamt", bj."ovout_taxamt", 
             bj."lastprintdate", bj."lastprintuser", bj."polid", bj."endorseNo", bj."createusercode", bj."dftxno"
    -- INTO TEMPORARY TABLE temp_data
    FROM static_data.b_jupgrs bj 
    left join static_data."Transactions" t on t."policyNo" = bj."policyNo" and t.dftxno = bj.dftxno and t."seqNo" =bj."seqNo" and t."transType" ='PREM-IN' 
    WHERE bj.polid =  ${policy.previousid}
   and installmenttype  = 'A'
  and t.status ='N'
  and t.dfrpreferno is  null; -- Add your condition to filter the rows as needed
    
    -- Update the selected data
    UPDATE temp_dataA2
    SET polid = ${policy.polid},
        "endorseNo" = '${policy.endorseNo}',
        "commin_rate"   = ${policy.commin_rate}   , "commin_amt"  = ROUND(CAST(${policy.commin_rate/100} * netgrossprem AS numeric) , 2), "commin_taxamt"      = ROUND(CAST(${policy.commin_rate/100*wht} * netgrossprem AS numeric) , 2),
        "ovin_rate"     = ${policy.ovin_rate}     , "ovin_amt"    = ROUND(CAST(${policy.ovin_rate/100} * netgrossprem AS numeric) , 2),   "ovin_taxamt"        = ROUND(CAST(${policy.ovin_rate/100*wht} * netgrossprem AS numeric) , 2),
        "commout1_rate" = ${policy.commout1_rate} ,"commout1_amt" = ROUND(CAST(${policy.commout1_rate/100} * netgrossprem AS numeric) , 2), "commout1_taxamt"  = ROUND(CAST(${policy.commout1_rate/100*whtagent1} * netgrossprem AS numeric) , 2),
        "ovout1_rate"   = ${policy.ovout1_rate}   , "ovout1_amt"  = ROUND(CAST(${policy.ovout1_rate/100} * netgrossprem AS numeric) , 2),  "ovout1_taxamt"     = ROUND(CAST(${policy.ovout1_rate/100*whtagent1} * netgrossprem AS numeric) , 2),
        "commout2_rate" = ${policy.commout2_rate} , "commout2_amt"= ROUND(CAST(${policy.commout2_rate/100} * netgrossprem AS numeric) , 2),  "commout2_taxamt" = ROUND(CAST(${policy.commout2_rate/100*whtagent2} * netgrossprem AS numeric) , 2),
        "ovout2_rate"   = ${policy.ovout2_rate}   , "ovout2_amt"  = ROUND(CAST(${policy.ovout2_rate/100} * netgrossprem AS numeric) , 2), "ovout2_taxamt"      = ROUND(CAST(${policy.ovout2_rate/100*whtagent2} * netgrossprem AS numeric) , 2),     
        "commout_rate"  = ${policy.commout_rate}  , "commout_amt" = ROUND(CAST(${policy.commout_rate/100} * netgrossprem AS numeric) , 2),  "commout_taxamt"   = ROUND(CAST(${(policy.commout1_rate/100*whtagent1) + (policy.commout2_rate/100*whtagent2)} * netgrossprem AS numeric) , 2),
        "ovout_rate"    = ${policy.ovout_rate}    , "ovout_amt"   = ROUND(CAST(${policy.ovout_rate/100} * netgrossprem AS numeric) , 2),  "ovout_taxamt"       = ROUND(CAST(${(policy.ovout1_rate/100*whtagent1) + (policy.ovout2_rate/100*whtagent2)} * netgrossprem AS numeric) , 2),
        createusercode = '${usercode}' WHERE polid = ${policy.previousid} ; -- Add your condition to filter the rows as needed
    
    -- Insert the updated data into the destination table
    INSERT INTO static_data.b_jupgrs  ("policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno")
    SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
             "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
             "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
             "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
             "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
             "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
    FROM temp_dataA2 ;

    END $$;`, {
    transaction: t,
    raw: true
  })

}//สร้าง ่ jupgr ใหม่ถ้าเป็น เปลี่ยนงงวด (MT82) กับให้ส่วนลด (MT81)
else{
 
  // installment advisor 
  for (let i = 0; i < advisor.length; i++) {

    if (!advisor[i].editflag) {
      // advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')}`;
      advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${ await getRunNo('inv', null, null, 'kwan', currentdate, t) }`;
    
    advisor[i].taxInvoiceNo = null
    // let withheld = 0
    // let specdiscamt = 0
    // let commout1_amt = 0
    // let ovout1_amt = 0
    // let commout2_amt = 0
    // let ovout2_amt = 0
    // let commout_amt = 0
    // let ovout_amt = 0
    // if (i === 0) {
    //   withheld = policy.withheld
    //   specdiscamt = policy.specdiscamt
    //   commout1_amt = policy[`commout1_amt`]
    //   ovout1_amt = policy[`ovout1_amt`]
    //   commout2_amt = policy[`commout2_amt`]
    //   ovout2_amt = policy[`ovout2_amt`]
    //   commout_amt = policy[`commout_amt`]
    //   ovout_amt = policy[`ovout_amt`]

    // }

    console.log('----------- jupgr advisor -------------');
    //insert jupgr
    const ads = await sequelize.query(
      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno" , "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", 
                grossprem, specdiscrate, specdiscamt, 
               netgrossprem, tax, duty, totalprem, 
                commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
               "agentCode", "agentCode2", 
               commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
               commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
               commout_rate, commout_amt, ovout_rate, ovout_amt, 
               commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
               createusercode, polid, withheld)
               values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
               :grossprem, :specdiscrate, :specdiscamt, 
               :netgrossprem, :tax, :duty, :totalprem, 
                :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt,
               :agentCode, :agentCode2,
               :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt, 
               :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt,  
               :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
               :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt, 
               :createusercode, :polid, :withheld )`,
      {
        replacements: {
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          polid: policy.polid,
          invoiceNo: advisor[i].invoiceNo,
          taxInvoiceNo: advisor[i].taxInvoiceNo,
          installmenttype: 'A',
          seqNo: i + 1,
              grossprem: advisor[i].netgrossprem,
          specdiscrate: 0,
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
          ovout1_rate: policy[`ovout1_rate`],
          commout2_rate: policy[`commout2_rate`],
          ovout2_rate: policy[`ovout2_rate`],
          commout_rate: policy[`commout_rate`],
          ovout_rate: policy[`ovout_rate`],

          commout1_amt: advisor[i][`commout1_amt`],
          ovout1_amt: advisor[i][`ovout1_amt`],
          commout2_amt: advisor[i][`commout2_amt`],
          ovout2_amt: advisor[i][`ovout2_amt`],
          commout_amt: advisor[i][`commout_amt`],
          ovout_amt: advisor[i][`ovout_amt`],
          // commout1_amt: commout1_amt,
          // ovout1_amt: ovout1_amt,
          // commout2_amt: commout2_amt,
          // ovout2_amt: ovout2_amt,
          // commout_amt: commout_amt,
          // ovout_amt: ovout_amt,

          createusercode: usercode,
          // specdiscamt: specdiscamt,
          // withheld: withheld,
          specdiscamt: advisor[i].specdiscamt,
          withheld: advisor[i].withheld,
          // tax wth3%
          commout1_taxamt: advisor[i][`commout1_taxamt`],
          ovout1_taxamt: advisor[i][`ovout1_taxamt`],
          commout2_taxamt: advisor[i][`commout2_taxamt`],
          ovout2_taxamt: advisor[i][`ovout2_taxamt`],
          commout_taxamt: advisor[i][`commout_taxamt`],
          ovout_taxamt: advisor[i][`ovout_taxamt`],

        },

        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    arrAds.push[ads]
    console.log('pass insert jupgr A' + i + advisor[i].editflag);
  }
}
}

 
console.log("OK")
 
  return { insurer: arrIns, advisor: arrAds }

}

module.exports = {

  getPolicyListForEndorseDiscin,
  requestEdtDisc,

  getEdTypeCodeAll,
  getPolicyListForEndorseChangeinv,
  getPolicyTransChangeinv,
  endorseChangeinv,

  getPolicyListForEndorseComov,
  endorseComov,

  getPolicyListForEndorseAll,
  endorseAll,
  ConfirmEndorseAll,
  findPolicy
  // postCar,
  // removeCar,
  // editCar,
};