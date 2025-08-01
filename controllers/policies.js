const Policy = require("../models").Policy;
const Transaction = require("../models").Transaction;
const CommOVIn = require("../models").CommOVIn; //imported fruits array
const CommOVOut = require("../models").CommOVOut;
const Insuree = require("../models").Insuree;
const InsureType = require("../models").InsureType;
const Insurer = require("../models").Insurer;
const { isNullorUndef } = require("./lib/functionlib")
const { throws } = require("assert");
const config = require("../config.json");
const process = require('process');
const { getRunNo, getCurrentDate, getCurrentYYMM, getCurrentYY } = require("./lib/runningno");
const account = require('./lib/runningaccount')
const { decode } = require('jsonwebtoken'); // jwt-decode
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize } = require("sequelize");
const { logger } = require("express-winston");
const { loggers } = require("winston");
// const { insures } = require("../routes");
const { required } = require("joi");
const { raw } = require("body-parser");
const excelJS = require("exceljs");
const fs = require("fs");

const tax = config.tax
const duty = config.duty

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

const createTransection = async (policy, t) => {
  console.log(`----------- begin createTransection()  ----------------`);
  const jupgr = policy.installment
  let dftxno = policy.policyNo
  if (policy.endorseNo) {
    dftxno = policy.endorseNo
  }
  //find credit term 
  const insurer = await sequelize.query(
    'select * FROM static_data."Insurers" where "insurerCode" = :insurerCode',
    {
      replacements: {
        insurerCode: policy.insurerCode,

      },
      transaction: t,
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
      transaction: t,
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
        transaction: t,
        type: QueryTypes.SELECT
      }
    )
    policy.insureID = insureType[0].id
  }


  // // find comm ov defualt
  // const commov1 = await sequelize.query(
  //   'select * FROM static_data."CommOVOuts" comout ' +
  //   'JOIN static_data."CommOVIns" comin ' +
  //   'ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" ' +
  //   'where comout."agentCode" = :agentcode ' +
  //   'and comout."insureID" = :insureID ' +
  //   'and comout."insurerCode" = :insurerCode',
  //   {
  //     replacements: {
  //       agentcode: policy.agentCode,
  //       insureID: policy.insureID,
  //       // subClass: policy.subClass,
  //       insurerCode: policy.insurerCode,
  //     },
  //     transaction: t,
  //     type: QueryTypes.SELECT
  //   }
  // )

  if (jupgr.insurer.length === 0) {
    jupgr.insurer.push(policy)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + insurer[0].premCreditT);
    jupgr.insurer[0].dueDate = dueDate
  }

  if (jupgr.advisor.length === 0) {
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
      jupgr.insurer[i].withheld = Number(((jupgr.insurer[i].netgrossprem + jupgr.insurer[i].duty) * withheld).toFixed(2))
    } else {
      jupgr.insurer[i].withheld
    }

    //let totalamt = policy.totalprem/ policy.seqNoins
    //const dueDate = new Date()
    //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
            ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", 
            totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid,
             "seqNo",  mainaccountcode, withheld ) 
            VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, 
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
          totalamt: jupgr.insurer[i].totalprem,
          // duedate: dueDate,
          duedate: jupgr.insurer[i].dueDate,
          // netgrossprem: policy.netgrossprem,
          // duty: policy.duty,
          // tax: policy.tax,
          // totalprem: policy.totalprem,
          netgrossprem: jupgr.insurer[i].netgrossprem,
          duty: jupgr.insurer[i].duty,
          tax: jupgr.insurer[i].tax,
          totalprem: jupgr.insurer[i].totalprem,
          txtype2: 1,
          //seqno:i,
          seqno: i + 1,
          mainaccountcode: policy.insurerCode,
          withheld: jupgr.insurer[i].withheld,

        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );

    //comm-in
    //totalamt = policy.commin_amt/ policy.seqNoins
    //dueDate.setDate(dueDate.getDate() + insurer[0].commovCreditT);
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", 
         commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid,
          "seqNo", mainaccountcode, withheld ) 
        VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, 
         :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,
         :seqno ,:mainaccountcode ,:withheld ) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'COMM-IN',
          subType: 1,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.insurer[i].invoiceNo,
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
          txtype2: 1,
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
    //totalamt = policy.ovin_amt/ policy.seqNoins
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", 
        ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid,
         "seqNo" ,mainaccountcode , withheld) 
        VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, 
          :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid 
          ,:seqno ,:mainaccountcode, :withheld) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'OV-IN',
          subType: 1,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.insurer[i].invoiceNo,
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
          txtype2: 1,
          // seqno:i,
          seqno: i + 1,
          mainaccountcode: 'Amity',
          withheld: jupgr.insurer[i].withheld,

        },
        transaction: t,
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
      jupgr.advisor[i].withheld = Number(((jupgr.advisor[i].netgrossprem + jupgr.advisor[i].duty) * withheld).toFixed(2))
    } else {
      jupgr.advisor[i].withheld
    }

    //let totalamt = policy.totalprem/ policy.seqNoagt
    //const dueDate = new Date()
    //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
            ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno",
             totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, 
             "seqNo" , mainaccountcode, withheld ) 
            VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo,
               :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid,
                :seqno ,:mainaccountcode , :withheld ) `,
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
          totalamt: jupgr.advisor[i].totalprem,
          duedate: jupgr.advisor[i].dueDate,
          netgrossprem: jupgr.advisor[i].netgrossprem,
          duty: jupgr.advisor[i].duty,
          tax: jupgr.advisor[i].tax,
          totalprem: jupgr.advisor[i].totalprem,
          txtype2: 1,
          // seqno:i,
          seqno: i + 1,
          mainaccountcode: policy.agentCode,
          withheld: jupgr.advisor[i].withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );

    //comm-out
    // totalamt = policy.commout1_amt/ policy.seqNoagt
    // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
    /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), 
        :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
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
          // commamt: policy.commout_amt,
          // commtaxamt: null,
          // totalamt: totalamt,
          // duedate: dueDate,
          // netgrossprem: policy.netgrossprem,
          // duty: policy.duty,
          // tax: policy.tax,
          // totalprem: policy.totalprem,
          commamt: jupgr.advisor[i].commout1_amt,
          commtaxamt: jupgr.advisor[i].commout1_taxamt,
          totalamt: jupgr.advisor[i].commout1_amt,
          duedate: jupgr.advisor[i].dueDate,
          netgrossprem: jupgr.advisor[i].netgrossprem,
          duty: jupgr.advisor[i].duty,
          tax: jupgr.advisor[i].tax,
          totalprem: jupgr.advisor[i].totalprem,
          txtype2: 1,
          // seqno:i,
          seqno: i + 1,
          mainaccountcode: policy.agentCode,
          withheld: jupgr.advisor[i].withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );

    //ov-out
    //totalamt = policy.ovout1_amt/ policy.seqNoagt
    await sequelize.query(
      ` INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), 
        :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
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
          // ovamt: policy.ovout_amt,
          // ovtaxamt: null,
          // totalamt: totalamt,
          // duedate: dueDate,
          // netgrossprem: policy.netgrossprem,
          // duty: policy.duty,
          // tax: policy.tax,
          // totalprem: policy.totalprem,
          ovamt: jupgr.advisor[i].ovout1_amt,
          ovtaxamt: jupgr.advisor[i].ovout1_taxamt,
          totalamt: jupgr.advisor[i].ovout1_amt,
          duedate: jupgr.advisor[i].dueDate,
          netgrossprem: jupgr.advisor[i].netgrossprem,
          duty: jupgr.advisor[i].duty,
          tax: jupgr.advisor[i].tax,
          totalprem: jupgr.advisor[i].totalprem,
          txtype2: 1,
          // seqno:i,
          seqno: i + 1,
          mainaccountcode: policy.agentCode,
          withheld: jupgr.advisor[i].withheld,

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
      let totalamt = policy.commout2_amt / policy.seqNoagt
      const dueDate = new Date()
      dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
      await sequelize.query(
        ` INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), 
        :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
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
            totalamt: jupgr.advisor[i].commout2_amt,
            duedate: jupgr.advisor[i].dueDate,
            netgrossprem: jupgr.advisor[i].netgrossprem,
            duty: jupgr.advisor[i].duty,
            tax: jupgr.advisor[i].tax,
            totalprem: policy.totalprem,
            txtype2: 1,
            seqno: i + 1,
            mainaccountcode: policy.agentCode2,
            withheld: jupgr.advisor[i].withheld,

          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      );
      //ov-out
      totalamt = policy.ovout2_amt / policy.seqNoagt
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
        ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
         netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
        VALUES (:type, :subType, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y' ), 
        :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
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
            endorseNo: policy.endorseNo,
            dftxno: dftxno,
            invoiceNo: jupgr.advisor[i].invoiceNo,
            ovamt: jupgr.advisor[i].ovout2_amt,
            ovtaxamt: jupgr.advisor[i].ovout2_taxamt,
            totalamt: jupgr.advisor[i].ovout2_amt,
            duedate: jupgr.advisor[i].dueDate,
            netgrossprem: jupgr.advisor[i].netgrossprem,
            duty: jupgr.advisor[i].duty,
            tax: jupgr.advisor[i].tax,
            totalprem: jupgr.advisor[i].totalprem,
            txtype2: 1,
            seqno: i + 1,
            mainaccountcode: policy.agentCode2,
            withheld: jupgr.advisor[i].withheld,

          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      );

    }

  }





}

const findPolicy = async (req, res) => {
  console.log(`----------- begin findPolicy()  ----------------`);
  let cond = ``
  let join = ``
  if (req.body.policyNo !== null && req.body.policyNo !== '') {
    cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
  }
  if (req.body.applicationNo !== null && req.body.applicationNo !== '') {
    cond = `${cond} and pol."applicationNo" like '%${req.body.applicationNo}%'`
  }
  if (req.body.policyType !== null && req.body.policyType !== '') {
    if (req.body.policyType === 'minor') {
      cond = `${cond} and pol."fleetflag" = 'N' -- and pol."fleetCode" is null `
      // join = ` left join static_data."Motors" mt on mt."id" = pol."itemList" `
    }else if (req.body.policyType === 'fleet') {
       cond = `${cond} and pol."fleetflag" = 'Y' `
        // join = ` left join static_data."FleetGroups" fg on fg."groupCode" = pol."itemList" 
        //          left join static_data."Motors" mt on mt."id" = fg."itemID"  `
    }
  }
  const records = await sequelize.query(
    `select pol.id as polid ,pol.*, ent.*, lo.*, inst.*, 
    edt.edtypecode as edtype, (ine.version + 1 )as "InsureeVersion",
    (case when (select count(*) from static_data.b_juepms where polid = pol.id) > 0 then 'Y' else 'N' end) as edprem,
    (case when pol."fleetflag" = 'Y' then 'fleet' else 'minor' end) as "insuranceType" , 
    pol."policyNo", pol."applicationNo", pol."insurerCode",pol."agentCode",
    lo.id as "locationid",
     inst.class || '/' || inst."subClass" as classsubclass,
     (select t_provincename from static_data."provinces" where provinceid = lo."provinceID" limit 1) as province,
     (select t_amphurname from static_data."Amphurs" where amphurid = lo."districtID" limit 1) as district,
     (select t_tambonname from static_data."Tambons" where tambonid = lo."subDistrictID" limit 1) as subdistrict,
     mt.*, mt.brand  as brandname, mt.model as modelname,
     (select t_provincename from static_data."provinces" where provinceid = mt."motorprovinceID" limit 1) as "motorprovinceID"
    from static_data."Policies" pol 
    join static_data."InsureTypes" inst on inst.id = pol."insureID"
    join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y'
    join static_data."Entities" ent on ent.id = ine."entityID"
    join static_data."Locations" lo on lo."entityID" = ent.id
    join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    left join static_data.b_juedts edt on edt.polid = pol.id
     left join static_data."Motors" mt on mt."id" = pol."itemList" 
    --${join}
    left join static_data."Fleets" ft on ft."fleetCode" = pol."fleetCode"
    where  1 = 1
    and pol."lastVersion" = 'Y'
    and lo."lastversion" = 'Y'
    and pol.insurancestatus != 'CC'
    ${cond}
    order by pol."applicationNo" ASC `,
    {

      type: QueryTypes.SELECT
    }
  )

//   let motordatas = []
//   if (req.body.policyType === 'fleet') {
    
  
//    motordatas = await sequelize.query(
//     `select * from static_data."FleetGroups" fg
//      left join static_data."Motors" mt on mt."id" = fg."itemID"  
//      where fg."groupCode" = :itemList `,
//     {
//       replacements: {
//         itemList: records[0].itemList,
//       },
//       type: QueryTypes.SELECT
//     }
//   )
// }

  res.json({policyData : records})
};

const getPolicyList = async (req, res) => {
  try{
    let cond = ` pol.insurancestatus = '${req.body.insurancestatus}'`
    let limit = ''
    if (req.body.insurancestatus === 'AI') {
      cond = ` pol.insurancestatus = '${req.body.insurancestatus}' and  pol.policystatus is null `
    } else if (req.body.insurancestatus === 'AA') {
      cond = ` pol.insurancestatus = '${req.body.insurancestatus}' and  pol.policystatus = 'PC' `
    }
    if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
      cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
    }
    if (req.body.policyNo !== null && req.body.policyNo !== '') {
      cond = `${cond} and pol."policyNo" like '%${req.body.policyNo}%'`
    }
    if (req.body.applicationNo !== null && req.body.applicationNo !== '') {
      cond = `${cond} and pol."applicationNo" like '%${req.body.applicationNo}%'`
    }
    if (req.body.insureID !== null && req.body.insureID !== '') {
      cond = `${cond} and pol."insureID" = ${req.body.insureID}`
    }
    if (req.body.createdate_start !== null && req.body.createdate_start !== '') {
      cond = `${cond} and  DATE(pol."createdAt") between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
    }
    if (req.body.effdate_start !== null && req.body.effdate_start !== '') {
      cond = `${cond} 
      and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
    }
    if (req.body.createusercode !== null && req.body.createusercode !== '') {
      cond = `${cond} and pol."createusercode" like '%${req.body.createusercode}%'`
    }
    if (req.body.agentCode !== null && req.body.agentCode !== '') {
      cond = `${cond} and pol."agentCode" like '%${req.body.agentCode}%'`
    }
    if (req.body.carRegisNo !== null && req.body.carRegisNo !== '') {
      cond = `${cond} and mt."licenseNo" like '%${req.body.carRegisNo}%'`
    }
    if (req.body.chassisNo !== null && req.body.chassisNo !== '') {
      cond = `${cond} and mt."chassisNo" like '%${req.body.chassisNo}%'`
    }
    if (req.body.provinceID !== null && req.body.provinceID !== '') {
      cond = `${cond} and mt."motorprovinceID" = ${req.body.provinceID}`
    }
    if (req.body.fleetCode !== null && req.body.fleetCode !== '') {
      cond = `${cond} and ft."fleetCode" = '${req.body.fleetCode}'`
    }
    if (!isNullorUndef(req.body.postPerPage)  && !isNullorUndef(req.body.currentPage) ) {
    const postPerPage = req.body.postPerPage
    const skip =  (req.body.currentPage - 1) * req.body.postPerPage
    limit = ` LIMIT ${postPerPage}  OFFSET ${skip} `
  }
    const records = await sequelize.query(
      `select *,pol.id as polid , edt.edtypecode as edtype, 
      (case when (select count(*) from static_data.b_juepms where polid = pol.id) > 0 then 'Y' else 'N' end) as edprem,
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
      left join static_data.b_juedts edt on edt.polid = pol.id
      left join static_data."Fleets" ft on ft."fleetCode" = pol."fleetCode"
      where ${cond}
      and pol."lastVersion" = 'Y'
      -- and (case when pol."endorseNo" is null and ft."fleetType" = 'INV' then false else true end )
      order by pol."applicationNo" ASC ${limit} ;`,
      {
  
        type: QueryTypes.SELECT
      }
    )
    const count = await sequelize.query(
      `select count(*)
      from static_data."Policies" pol 
      join static_data."InsureTypes" inst on inst.id = pol."insureID"
      left join static_data."Motors" mt on mt.id = pol."itemList"
      join static_data."Insurees" ine on ine."insureeCode" = pol."insureeCode" and ine.lastversion = 'Y'
      join static_data."Entities" ent on ent.id = ine."entityID"
      join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
      left join static_data.b_juedts edt on edt.polid = pol.id
      left join static_data."Fleets" ft on ft."fleetCode" = pol."fleetCode"
      where ${cond}
      and pol."lastVersion" = 'Y'
      -- and (case when pol."endorseNo" is null and ft."fleetType" = 'INV' then false else true end )
      ;`,
      {
  
        type: QueryTypes.SELECT
      }
    )
    res.json({data : records ,count :count[0].count})
  }catch(err) {
    console.error(err);
    res.status(500).send({
      status: "error",
      message: err.message,
    });
  }
  
};
// ok ค้นหากรมธรรม์ เปลี่ยนสถานะใบคำขอ
const getPolicyListChangestatus = async (req, res) => {
  let cond = ` pol.insurancestatus = '${req.body.insurancestatus}' `
  if (req.body.insurancestatus === 'AI') {
    cond = ` pol.insurancestatus = '${req.body.insurancestatus}' and  pol.policystatus is null `
  } else if (req.body.insurancestatus === 'AA') {
    cond = ` pol.insurancestatus = '${req.body.insurancestatus}' and  pol.policystatus = 'PC' `
  }
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = `${cond} and pol."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.policyNo !== null && req.body.policyNo !== '') {
    cond = `${cond} and pol."policyNo" like '${req.body.policyNo}%'`
  }
  if (req.body.polbatch !== null && req.body.polbatch !== '') {
    cond = `${cond} and pol."polbatch" like '${req.body.polbatch}%'`
  }
  if (req.body.applicationNo !== null && req.body.applicationNo !== '') {
    cond = `${cond} and pol."applicationNo" like '${req.body.applicationNo}%'`
  }
  if (req.body.insureID !== null && req.body.insureID !== '') {
    cond = `${cond} and pol."insureID" = ${req.body.insureID}`
  }
  if (req.body.createdate_start !== null && req.body.createdate_start !== '') {
    cond = `${cond} and  DATE(pol."createdAt") between '${req.body.createdate_start}' and '${req.body.createdate_end}'`
  }
  if (req.body.effdate_start !== null && req.body.effdate_start !== '') {
    cond = `${cond} 
    and  pol."actDate" between '${req.body.effdate_start}' and '${req.body.effdate_end}'`
  }
  if (req.body.createusercode !== null && req.body.createusercode !== '') {
    cond = `${cond} and pol."createusercode" like '${req.body.createusercode}%'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = `${cond} and pol."agentCode" like '${req.body.agentCode}%'`
  }
  let cond1 = cond
  if (req.body.carRegisNo !== null && req.body.carRegisNo !== '') {
    cond1 = `${cond1} and mt."licenseNo" like '${req.body.carRegisNo}%'`
  }
  if (req.body.chassisNo !== null && req.body.chassisNo !== '') {
    cond1 = `${cond1} and mt."chassisNo" like '${req.body.chassisNo}%'`
  }
  if (req.body.provinceID !== null && req.body.provinceID !== '') {
    cond1 = `${cond1} and mt."motorprovinceID" = ${req.body.provinceID}`
  }

  const policylist = await sequelize.query(
    `select *,pol.id as polid , edt.edtypecode as edtype, 
    (static_data.getagentpersontype(pol."agentCode")) as "personTypeAgent", (static_data.getagentpersontype(pol."agentCode2")) as "personTypeAgent2",
    (case when (select count(*) from static_data.b_juepms where polid = pol.id) > 0 then 'Y' else 'N' end) as edprem,
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
    left join static_data.b_juedts edt on edt.polid = pol.id
    left join static_data."Fleets" ft on ft."fleetCode" = pol."fleetCode"
    where ${cond1}
    and pol."lastVersion" = 'Y'
    and (case when pol."endorseNo" is null and ft."fleetType" = 'INV' then false else true end )
    order by pol."applicationNo" ASC `,
    {

      type: QueryTypes.SELECT
    }
  )
  const fleetlist = await sequelize.query(
    `select distinct ( ft."fleetCode" ),ft."fleetType" ,
    --  edt.edtypecode as edtype,
    -- (case when (select count(*) from static_data.b_juepms where polid = pol.id) > 0 then 'Y' else 'N' end) as edprem,
    -- TO_CHAR(pol."createdAt", 'dd/MM/yyyy HH24:MI:SS') AS "polcreatedAt",
    -- TO_CHAR(pol."updatedAt", 'dd/MM/yyyy HH24:MI:SS') AS "polupdatedAt"
    --  inst.class as class, inst."subClass" as "subClass",
     (tt."TITLETHAIBEGIN" ||' '||
     (case when trim(ent."personType") = 'O' then ent."t_ogName"|| COALESCE(' สาขา '|| ent."t_branchName",'' ) else ent."t_firstName" || ' ' || ent."t_lastName" end)
     || '  ' || tt."TITLETHAIEND" ) as "fullName"
    from static_data."Fleets" ft
    join static_data."Policies" pol  on ft."fleetCode" = pol."fleetCode"
    left join static_data."Entities" ent on ent.id = ft."entityID" 
    left join static_data."Titles" tt on tt."TITLEID" = ent."titleID" 
    where  ${cond}
    and ft."fleetType" = 'INV'
    and pol."lastVersion" = 'Y'
    and pol."endorseNo" is null;`,
    {

      type: QueryTypes.SELECT
    }
  )


  res.json({ policylist: policylist, fleetlist: fleetlist })
};





const newPolicyList = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  for (let i = 0; i < req.body.length; i++) {
    //create entity 
    const t = await sequelize.transaction();
    try {
      await sequelize.query(
        'insert into static_data."Entities" ("personType","titleID","t_ogName","t_firstName","t_lastName","idCardType","idCardNo","taxNo") ' +
        'values (:personType, (select "TITLEID" from static_data."Titles" where "TITLETHAIBEGIN" = :title limit 1), :t_ogName, :t_firstName, :t_lastName,:idCardType,:idCardNo,:taxNo) ' +
        'ON CONFLICT ((case when :personType = \'P\' then "idCardNo" else "taxNo" end)) DO NOTHING RETURNING "id" ',
        {
          replacements: {
            personType: req.body[i].personType,
            title: req.body[i].title,
            t_ogName: req.body[i].t_ogName,
            t_firstName: req.body[i].t_firstName,
            t_lastName: req.body[i].t_lastName,
            idCardType: req.body[i].idCardType,
            idCardNo: req.body[i].idCardNo,
            taxNo: req.body[i].taxNo
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      ).then(async (entity) => {

        let insureeCode

        if (entity[1] === 1) {   // entity[1] === 1 when create new entity


          const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode: 'A' + entity[0][0].id }, { returning: ['insureeCode'] })

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
                t_location_1: req.body[i].t_location_1.toString(),
                t_location_2: req.body[i].t_location_2.toString(),
                t_location_3: req.body[i].t_location_3.toString(),
                t_location_4: req.body[i].t_location_4.toString(),
                t_location_5: req.body[i].t_location_5.toString(),
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
          const insuree = await sequelize.query(
            `select * FROM static_data."Insurees" ins 
          JOIN static_data."Entities" ent ON ins."entityID" = ent."id" 
          WHERE 
          (CASE WHEN ent."personType" = 'P' THEN "idCardNo" ELSE "taxNo" END) = :idNo 
          and ins.lastversion = 'Y' `,
            { replacements: { idNo: req.body[i].personType === "P" ? req.body[i].idCardNo : req.body[i].taxNo }, transaction: t, type: QueryTypes.SELECT })

          insureeCode = insuree[0].insureeCode


        }

        //insert new car or select
        let cars = [{ id: null }]
        if (req.body[i].class === 'MO') {
          cars = await sequelize.query(
            'WITH inserted AS ( ' +
            'INSERT INTO static_data."Motors" ("brand", "voluntaryCode", "model", "specname", "licenseNo", "motorprovinceID", "chassisNo", "modelYear") ' +
            'VALUES (:brandname, :voluntaryCode , :modelname , :specname, :licenseNo, :motorprovinceID, :chassisNo, :modelYear) ON CONFLICT ("chassisNo") DO NOTHING RETURNING * ) ' +
            'SELECT * FROM inserted UNION ALL SELECT * FROM static_data."Motors" WHERE "chassisNo" = :chassisNo ',
            {
              replacements: {
                licenseNo: req.body[i].licenseNo,
                chassisNo: req.body[i].chassisNo,
                brandname: req.body[i].brandname,
                voluntaryCode: req.body[i].voluntaryCode || '220',
                modelname: req.body[i].modelname || null,
                specname: 'tesz',
                // motorprovinceID: req.body[i].motorprovinceID,
                motorprovinceID: 2,
                modelYear: req.body[i].modelYear,
              },
              transaction: t,
              type: QueryTypes.SELECT
            }
          )
        }

        //set defualt comm ov if null 
        const commov = await sequelize.query(
          'select * FROM static_data."CommOVOuts" comout ' +
          'JOIN static_data."CommOVIns" comin ' +
          'ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" ' +
          'where comout."agentCode" = :agentcode ' +
          'and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) ' +
          'and comout."insurerCode" = :insurerCode',
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
        //undefined comm/ov in
        if (req.body[i][`commin_rate`] === undefined || req.body[i][`commin_rate`] === null) {
          req.body[i][`commin_rate`] = commov[0].rateComIn
          req.body[i][`commin_amt`] = commov[0].rateComIn * req.body[i][`netgrossprem`] / 100
        }
        if (req.body[i][`ovin_rate`] === undefined || req.body[i][`ovin_rate`] === null) {
          req.body[i][`ovin_rate`] = commov[0].rateOVIn_1
          req.body[i][`ovin_amt`] = commov[0].rateOVIn_1 * req.body[i][`netgrossprem`] / 100
        }

        req.body[i][`commin_taxamt`] = req.body[i][`commin_amt`] * wht
        req.body[i][`ovin_taxamt`] = req.body[i][`ovin_amt`] * wht


        //undefined comm/ov out agent 1 
        if (req.body[i][`commout1_rate`] === undefined || req.body[i][`commout1_rate`] === null) {
          req.body[i][`commout1_rate`] = commov[0].rateComOut
          req.body[i][`commout1_amt`] = commov[0].rateComOut * req.body[i][`netgrossprem`] / 100
        }
        if (req.body[i][`ovout1_rate`] === undefined || req.body[i][`ovout1_rate`] === null) {
          req.body[i][`ovout1_rate`] = commov[0].rateOVOut_1
          req.body[i][`ovout1_amt`] = commov[0].rateOVOut_1 * req.body[i][`netgrossprem`] / 100
        }

        //check agentcode2
        if (req.body[i][`agentCode2`]) {
          const commov2 = await sequelize.query(
            'select * FROM static_data."CommOVOuts" comout ' +
            'where comout."agentCode" = :agentcode ' +
            'and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) ' +
            'and comout."insurerCode" = :insurerCode',
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
          if (req.body[i][`commout2_rate`] === null && req.body[i][`ovout2_rate`] === null) {
            req.body[i][`commout2_rate`] = commov2[0].rateComOut
            req.body[i][`commout2_amt`] = commov2[0].rateComOut * req.body[i][`netgrossprem`] / 100
            req.body[i][`ovout2_rate`] = commov2[0].rateOVOut_1
            req.body[i][`ovout2_amt`] = commov2[0].rateOVOut_1 * req.body[i][`netgrossprem`] / 100
          }
          req.body[i][`commout_rate`] = req.body[i][`commout1_rate`] + req.body[i][`commout2_rate`]
          req.body[i][`commout_amt`] = req.body[i][`commout1_amt`] + req.body[i][`commout2_amt`]
          req.body[i][`ovout_rate`] = req.body[i][`ovout1_rate`] + req.body[i][`ovout2_rate`]
          req.body[i][`ovout_amt`] = req.body[i][`ovout1_amt`] + req.body[i][`ovout2_amt`]

        } else {
          req.body[i][`agentCode2`] = null
          req.body[i][`commout2_rate`] = null
          req.body[i][`commout2_amt`] = null
          req.body[i][`ovout2_rate`] = null
          req.body[i][`ovout2_amt`] = null
          req.body[i][`commout_rate`] = req.body[i][`commout1_rate`]
          req.body[i][`commout_amt`] = req.body[i][`commout1_amt`]
          req.body[i][`ovout_rate`] = req.body[i][`ovout1_rate`]
          req.body[i][`ovout_amt`] = req.body[i][`ovout1_amt`]
        }

        //cal withheld 1% 
        if (req.body[i].personType.trim() === 'O') {
          req.body[i].withheld = Number(((req.body[i].netgrossprem + req.body[i].duty) * withheld).toFixed(2))
        } else {
          req.body[i].withheld
        }

        //get application no
        const currentdate = getCurrentDate()
        req.body[i].applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);
        console.log(req.body[i].applicationNo);

        //insert policy
        const policy = await sequelize.query(
          'insert into static_data."Policies" ("applicationNo","insureeCode","insurerCode","agentCode","agentCode2","insureID","actDate", "expDate" ,grossprem, duty, tax, totalprem, ' +
          'commin_rate, commin_amt, ovin_rate, ovin_amt, commin_taxamt, ovin_taxamt, commout_rate, commout_amt, ovout_rate, ovout_amt, createusercode, "itemList","status", ' +
          'commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, netgrossprem, specdiscrate, specdiscamt, cover_amt, "policyNo", "policyDate", "issueDate", "policyType", withheld ) ' +
          // 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree), '+
          'values ( :applicationNo, :insureeCode, ' +
          '(select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode), ' +
          ':agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass), ' +
          ':actDate, :expDate, :grossprem, :duty, :tax, :totalprem, ' +
          ':commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :createusercode, :itemList ,\'A\', ' +
          ' :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :policyNo, :policyDate, :issueDate, :policyType, :withheld) Returning id`',
          {
            replacements: {
              applicationNo: req.body[i].applicationNo,
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
              cover_amt: req.body[i][`cover_amt`],
              createusercode: usercode,
              itemList: cars[0].id,
              policyNo: req.body[i].policyNo,
              policyDate: new Date().toJSON().slice(0, 10),
              issueDate: req.body[i][`issueDate`],
              policyType: "F",
              withheld: req.body[i]['withheld'],

            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
        console.log(policy[0][0].id);
        //insert jupgr
        req.body[i].polid = policy[0][0].id
        //check installment 
        if (!req.body[i].installment) {
          req.body[i].installment = { advisor: [], insurer: [] }
        }

        await createjupgr(req.body[i], t, usercode)

        //insert transaction 
        await createTransection(req.body[i], t)
        // await createTransection(req.body[i],t)

        // insert  jugltx table -> ลงผังบัญชี
        await account.insertjugltx('POLICY', req.body[i].policyNo, t)

      })
      await t.commit();
      // If the execution reaches this line, an error was thrown.
      // We rollback the transaction.
    } catch (error) {
      console.error(error)
      await t.rollback();
      await res.status(500).json(error);
      return "fail"

    }

  }

  await res.json({ status: 'success' })

};

// ok งานรายย่อย
const draftPolicyMinor = async (req, res) => {
  console.log(`----------- begin draftPolicMinor()  ----------------`);
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    //create entity 
    const t = await sequelize.transaction();
    try {

      // check duplicate entity if idcard type = 'บัตรประชาชน'
      let entity
      let checkEntity
      let entityType = 'new' // new ลูกค้าใหม่ old ลูกค้าเดิม  update ลูกค้าเดิมแต่ชื่อเปลี่ยน
      req.body[i].version = 1
      const upsert = upsertEntityInsuree(req.body[i] ,t)
     entity = upsert.entity
     checkEntity = upsert.checkEntity
     entityType = upsert.entityType
        

      console.log(entity);
      let insureeCode
      if (entity[1] === 1) {   // entity[1] === 1 when create new entity

        if(entityType === 'update'){
          
          const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode: checkEntity[0].insureeCode, version: req.body[i].int_version+1, }, { returning: ['insureeCode'], transaction: t })
          insureeCode = insuree['dataValues'].insureeCode
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
          const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode:  entity[0][0].id, version: req.body[i].version, }, { returning: ['insureeCode'], transaction: t })
          insureeCode = insuree['dataValues'].insureeCode
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
          `select * FROM static_data."Insurees" ins JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
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


      }

      //insert new car or select
      let cars = [{ id: null }]
      if (req.body[i].class === 'MO') {
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
              brandname: req.body[i].brandname || null,
              voluntaryCode: req.body[i].voluntaryCode || '',
              modelname: req.body[i].modelname || null,
              specname: req.body[i].specname || null,
              licenseNo: req.body[i].licenseNo || null,
              motorprovince: req.body[i].motorprovinceID,
              chassisNo: req.body[i].chassisNo,
              modelYear: req.body[i].modelYear,

              compulsoryCode: req.body[i].compulsoryCode || '',
              unregisterflag: req.body[i].unregisterflag || 'N',
              engineNo: req.body[i].engineNo || '',
              cc: req.body[i].cc || null,
              seat: req.body[i].seat || null,
              gvw: req.body[i].gvw || null,
            },
            transaction: t,
            type: QueryTypes.SELECT
          }
        )
      }
      //#region setup commov
      //set defualt comm ov if null 
      const commov = await sequelize.query(
        `select  -- (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode" and lastversion='Y'),
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
      //undefined comm/ov in
      if (req.body[i][`commin_rate`] === undefined || req.body[i][`commin_rate`] === null) {
        req.body[i][`commin_rate`] = commov[0].rateComIn
        req.body[i][`commin_amt`] = commov[0].rateComIn * req.body[i][`netgrossprem`] / 100
      }
      if (req.body[i][`ovin_rate`] === undefined || req.body[i][`ovin_rate`] === null) {
        req.body[i][`ovin_rate`] = commov[0].rateOVIn_1
        req.body[i][`ovin_amt`] = commov[0].rateOVIn_1 * req.body[i][`netgrossprem`] / 100
      }

      // wht3% commov in
      req.body[i][`commin_taxamt`] = parseFloat((req.body[i][`commin_amt`] * wht).toFixed(2))
      req.body[i][`ovin_taxamt`] = parseFloat((req.body[i][`ovin_amt`] * wht).toFixed(2))


      //undefined comm/ov out agent 1 
      if (req.body[i][`commout1_rate`] === undefined || req.body[i][`commout1_rate`] === null) {
        req.body[i][`commout1_rate`] = commov[0].rateComOut
        req.body[i][`commout1_amt`] = commov[0].rateComOut * req.body[i][`netgrossprem`] / 100
      }
      if (req.body[i][`ovout1_rate`] === undefined || req.body[i][`ovout1_rate`] === null) {
        req.body[i][`ovout1_rate`] = commov[0].rateOVOut_1
        req.body[i][`ovout1_amt`] = commov[0].rateOVOut_1 * req.body[i][`netgrossprem`] / 100
      }

      // //tax comm/ov out 1
      // if (commov[0].vatflag === 'Y') {
      //   req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] * tax).toFixed(2))
      //   req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] * tax).toFixed(2))
      // } else {
      //   req.body[i][`commout1_taxamt`] = 0
      //   req.body[i][`ovout1_taxamt`] = 0
      // }

      //wht3% comm/ov out 1
      if (commov[0].personType === 'O') {
        req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] * wht).toFixed(2))
        req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] * wht).toFixed(2))
      } else {
        req.body[i][`commout1_taxamt`] = 0
        req.body[i][`ovout1_taxamt`] = 0
      }

      //check agentcode2
      if (req.body[i][`agentCode2`]) {
        const commov2 = await sequelize.query(
          `select -- (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode"and lastversion='Y'), 
              static_data.getagentpersontype(comout."agentCode") as "personType" ,* 
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
        if (req.body[i][`commout2_rate`] === null && req.body[i][`ovout2_rate`] === null) {
          req.body[i][`commout2_rate`] = commov2[0].rateComOut
          req.body[i][`commout2_amt`] = commov2[0].rateComOut * req.body[i][`netgrossprem`] / 100
          req.body[i][`ovout2_rate`] = commov2[0].rateOVOut_1
          req.body[i][`ovout2_amt`] = commov2[0].rateOVOut_1 * req.body[i][`netgrossprem`] / 100
        }
        // //tax comm/ov out 2
        // if (commov2[0].vatflag === 'Y') {
        //   req.body[i][`commout2_taxamt`] = parseFloat((req.body[i][`commout2_amt`] * tax).toFixed(2))
        //   req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] * tax).toFixed(2))
        // } else {
        //   req.body[i][`commout2_taxamt`] = 0
        //   req.body[i][`ovout2_taxamt`] = 0
        // }

        //wht3% comm/ov out 2
        if (commov2[0].personType === 'O') {
          req.body[i][`commout2_taxamt`] = parseFloat((req.body[i][`commout2_amt`] * wht).toFixed(2))
          req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] * wht).toFixed(2))
        } else {
          req.body[i][`commout2_taxamt`] = 0
          req.body[i][`ovout2_taxamt`] = 0
        }

        req.body[i][`commout_rate`] = parseFloat(req.body[i][`commout1_rate`]) + parseFloat(req.body[i][`commout2_rate`])
        req.body[i][`commout_amt`] = parseFloat(req.body[i][`commout1_amt`]) + parseFloat(req.body[i][`commout2_amt`])
        req.body[i][`ovout_rate`] = parseFloat(req.body[i][`ovout1_rate`]) + parseFloat(req.body[i][`ovout2_rate`])
        req.body[i][`ovout_amt`] = parseFloat(req.body[i][`ovout1_amt`]) + parseFloat(req.body[i][`ovout2_amt`])
        req.body[i][`commout_taxamt`] = parseFloat(req.body[i][`commout1_taxamt`]) + parseFloat(req.body[i][`commout2_taxamt`])
        req.body[i][`ovout_taxamt`] = parseFloat(req.body[i][`ovout1_taxamt`]) + parseFloat(req.body[i][`ovout2_taxamt`])

      } else {
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
        req.body[i].withheld = Number(((req.body[i].netgrossprem + req.body[i].duty) * withheld).toFixed(2))
      } else {
        req.body[i].withheld
      }

      //get application no
      const currentdate = getCurrentDate()
      req.body[i].applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);
      console.log(req.body[i].applicationNo);
//#endregion
      //insert policy
      await sequelize.query(
        ` insert into static_data."Policies" ("applicationNo","insureeCode","insurerCode","agentCode","agentCode2","insureID","actDate", "expDate" ,grossprem, duty, tax, totalprem, 
        commin_rate, commin_amt, ovin_rate, ovin_amt, commin_taxamt, ovin_taxamt, commout_rate, commout_amt, ovout_rate, ovout_amt,
        commout1_taxamt, ovout1_taxamt, commout2_taxamt, ovout2_taxamt, commout_taxamt, ovout_taxamt,
        createusercode, "itemList","insurancestatus" ,
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, netgrossprem, specdiscrate, specdiscamt, cover_amt, withheld,
        duedateinsurer, duedateagent, endorseseries) 
        -- 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree and lastversion = 'Y'), '+
        values ( :applicationNo, :insureeCode, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y' ), 
        :agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ), 
        :actDate, :expDate, :grossprem, :duty, :tax, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
        :commout1_taxamt, :ovout1_taxamt, :commout2_taxamt, :ovout2_taxamt, :commout_taxamt, :ovout_taxamt,
        :createusercode, :itemList ,:insurancestatus,
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :withheld,
        :dueDateInsurer, :dueDateAgent ,:endorseseries)`
        ,
        {
          replacements: {
            applicationNo: req.body[i].applicationNo,
            endorseseries: -99,
            insurancestatus: 'AI',
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
            // specdiscrate: req.body[i][`specdiscrate`],
            // specdiscamt: req.body[i][`specdiscamt`],
            specdiscrate: 0,
            specdiscamt: 0,
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
            cover_amt: req.body[i][`cover_amt`],
            createusercode: usercode,
            itemList: cars[0].id,
            withheld: req.body[i].withheld,
            dueDateInsurer: req.body[i].dueDateInsurer,
            dueDateAgent: req.body[i].dueDateAgent,
            commout1_taxamt: req.body[i][`commout1_taxamt`],
            ovout1_taxamt: req.body[i][`ovout1_taxamt`],
            commout2_taxamt: req.body[i][`commout2_taxamt`],
            ovout2_taxamt: req.body[i][`ovout2_taxamt`],
            commout_taxamt: req.body[i][`commout_taxamt`],
            ovout_taxamt: req.body[i][`ovout_taxamt`],


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
      await res.status(500).json({ status: 'error', describe: error, appNo: appNo });
      return "fail"

    }

  }

  await res.json({ status: 'success', appNo: appNo })


};
const upsertEntityInsuree = async (data ,t) =>{
  let entity
  let checkEntity
  let entityType = 'new'
  try {
    
 
   if (data.personType === 'P') {

        checkEntity = await sequelize.query(
          `select e.*, i."insureeCode",i.version as ins_version, i.id as ins_id from static_data."Entities"  e
          join static_data."Insurees" i on e.id = i."entityID"  
        where e."personType" = 'P' and e."idCardType" = 'บัตรประชาชน' and e."idCardNo" = :idCardNo 
        and i.lastversion = 'Y' order by version DESC` ,
          {
            replacements: {
              idCardNo: data.idCardNo,
            },
            transaction: t,
            type: QueryTypes.SELECT
          })
        if (checkEntity.length > 0) {
          if (checkEntity[0].titleID === data.titleID && checkEntity[0].t_firstName === data.t_firstName && checkEntity[0].t_lastName === data.t_lastName) {
            data.version = checkEntity[0].version
            entityType = 'old'
          } else {
            data.version = checkEntity[0].version + 1
            entityType = 'update'
           
          }
        }


        entity = await sequelize.query(
          `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
            values (:personType, :titleID, :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
            ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
          {
            replacements: {
              personType: data.personType,
              titleID: data.titleID,
              t_firstName: data.t_firstName,
              t_lastName: data.t_lastName,
              idCardType: data.idCardType,
              idCardNo: data.idCardNo,

              version: data.version,
              email: data.email,
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )




      } else if (data.personType === 'O') {
        entity = await sequelize.query(
          `insert into static_data."Entities" ("personType","titleID","t_ogName","taxNo",email, branch, "t_branchName","vatRegis") 
        values (:personType, :titleID, :t_ogName,:taxNo,:email, :branch, :t_branchName, true) 
        ON CONFLICT ON CONSTRAINT "taxNo" DO NOTHING  RETURNING "id" `,
          {
            replacements: {
              personType: data.personType,
              titleID: data.titleID,
              t_ogName: data.t_ogName,
              taxNo: data.taxNo,
              email: data.email,
              branch: data.branch,
              t_branchName: data.t_branchName,
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
      }

      return { entity : entity, checkEntity: checkEntity ,entityType : entityType }
       } catch (error) {
    
    throw new Error(error)
  }


}
// ok งานfleet excel
const draftPolicyExcel = async (req, res) => {
  console.log(`----------- begin draftPolicyExcel()  ----------------`);
  try{
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const currentdate = getCurrentDate()
  let policyData = req.body.policyData
  const fleetCode = req.body.fleetCode
  const polBatch = `BATCH-${getCurrentYY()}${await getRunNo('polbatch', null, null, 'kw', currentdate, null)}`
  const statusPolicy = {polBatch:polBatch,success:[], error :[]}
  console.log('polBatch : ' + polBatch);
  for (let i = 0; i < policyData.length; i++) {
     
    const t = await sequelize.transaction();
    try {
console.log('step check dup policy');
//#region check dup policy
      const checkPolicy = await sequelize.query(
        `select * from static_data."Policies" 
     WHERE "policyNo" = :policyNo `,
        {
          replacements: {
            policyNo: policyData[i].policyNo,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })
      console.log(checkPolicy.length > 0)
      if ((checkPolicy.length > 0)) {
        throw new Error(`เลขกรมธรรม์ : ${policyData[i].policyNo} มีอยู่ในระบบอยู่แล้ว`)
      }
//#endregion
console.log('step check duplicate entity if idcard type = "บัตรประชาชน"');
      //#region duplicate entity if idcard type = 'บัตรประชาชน'
      let entity
      let checkEntity
      policyData[i].version = 1
      if (policyData[i].personType === 'P') {

        checkEntity = await sequelize.query(
          `select ent.*, ti."TITLETHAIBEGIN" from static_data."Entities" ent join  static_data."Titles" ti on ti."TITLEID" = ent."titleID"
        where "personType" = 'P' and "idCardType" = 'บัตรประชาชน' and "idCardNo" = :idCardNo and lastversion = 'Y' order by version DESC` ,
          {
            replacements: {
              idCardNo: policyData[i].idCardNo,
            },
            transaction: t,
            type: QueryTypes.SELECT
          })

        console.log(`----------- Done check entity dup --------------`);
        if (checkEntity.length > 0) {
          if (checkEntity[0].TITLETHAIBEGIN === policyData[i].title && checkEntity[0].t_firstName === policyData[i].t_firstName && checkEntity[0].t_lastName === policyData[i].t_lastName) {
            policyData[i].version = checkEntity[0].version
          } else {
            policyData[i].version = checkEntity[0].version + 1
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
          console.log(`----------- update entity if dup --------------`);
        }

        entity = await sequelize.query(
          `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
            values (:personType, (select "TITLEID" from static_data."Titles" where  "TITLETHAIBEGIN" = :title limit 1), :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
            ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
          {
            replacements: {
              personType: policyData[i].personType,
              title: policyData[i].title,
              t_firstName: policyData[i].t_firstName,
              t_lastName: policyData[i].t_lastName,
              idCardType: policyData[i].idCardType,
              idCardNo: policyData[i].idCardNo,

              version: policyData[i].version,
              email: policyData[i].email || null,
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
        console.log(`----------- insert new entity Persontype = 'P' --------------`);



      } else if (policyData[i].personType === 'O') {
        entity = await sequelize.query(
          `insert into static_data."Entities" ("personType","titleID","t_ogName","taxNo",email, branch, "t_branchName","vatRegis") 
        values (:personType, (select "TITLEID" from static_data."Titles" where  "TITLETHAIBEGIN" = :title limit 1), :t_ogName,:taxNo,:email, :branch, :t_branchName, true) 
        ON CONFLICT ON CONSTRAINT "taxNo" DO NOTHING  RETURNING "id" `,
          {
            replacements: {
              personType: policyData[i].personType,
              title: policyData[i].title,
              t_ogName: policyData[i].t_ogName,
              taxNo: policyData[i].taxNo,
              email: policyData[i].email || null,
              branch: policyData[i].branch || '00001',
              t_branchName: policyData[i].t_branchName || '-',
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
        console.log(`----------- insert new entity Persontype = 'O' --------------`);

      }
//#endregion

    

      console.log(entity);
      
      let insureeCode
      if (entity[1] === 1) {   // entity[1] === 1 when create new entity


        const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode: entity[0][0].id, version: policyData[i].version, }, { returning: ['insureeCode'], transaction: t })

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
              t_location_1: policyData[i].t_location_1,
              t_location_2: policyData[i].t_location_2,
              t_location_3: policyData[i].t_location_3,
              t_location_4: policyData[i].t_location_4,
              t_location_5: policyData[i].t_location_5,
              province: policyData[i].province,
              district: policyData[i].district,
              tambon: policyData[i].subdistrict,
              zipcode: policyData[i].zipcode.toString(),
              tel_1: policyData[i].telNum_1 || null,
              locationType: 'A'
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        )
        console.log(`----------- insert new Insurees --------------`);
      } else {
        console.log('step create entity , location');
        //select insuree
        let conInsuree = ''
        if (policyData[i].personType === "P") {
          conInsuree = `ent."personType" = 'P' and ent."idCardNo" = :idCardNo 
                        and ent."titleID" =  (select "TITLEID" from static_data."Titles" where  "TITLETHAIBEGIN" = :title limit 1) and ent."t_firstName" = :t_firstName 
                        and ent."t_lastName" = :t_lastName 
                        -- and ent."idCardType" = :idCardType`
        } else[
          conInsuree = `ent."personType" = 'O' and ent."taxNo" = :taxNo 
                        and ent."titleID" =  (select "TITLEID" from static_data."Titles" where  "TITLETHAIBEGIN" = :title limit 1) and ent."t_ogName" = :t_ogName 
                        -- and ent."branch" = :branch `
        ]
        const insuree = await sequelize.query(
          `select * FROM static_data."Insurees" ins JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
           WHERE ${conInsuree}
           and ins.lastversion = 'Y' `,
          {
            replacements: {
              idCardNo: policyData[i].idCardNo,
              taxNo: policyData[i].taxNo,
              title: policyData[i].title,
              t_firstName: policyData[i].t_firstName,
              t_lastName: policyData[i].t_lastName,
              t_ogName: policyData[i].t_ogName,
              // branch: policyData[i].branch ,
              // idCardType: policyData[i].idCardType ,
            }, transaction: t, type: QueryTypes.SELECT
          })

        insureeCode = insuree[0].insureeCode
        console.log(`----------- select Insurees --------------`);

      }


      //insert new car or select
      let cars = [{ id: null }]
      if (policyData[i].class === 'MO') {
        cars = await sequelize.query(
          `WITH inserted AS ( 
          INSERT INTO static_data."Motors" ("brand", "voluntaryCode", "model", "specname", "licenseNo", "motorprovinceID", "chassisNo", "modelYear",
          "compulsoryCode", "unregisterflag", "engineNo", "cc", "seat", "gvw" , "addition_access" ) 
          VALUES (:brandname, :voluntaryCode , :modelname , :specname, :licenseNo, 
           (select provinceid from static_data.provinces  where t_provincename =  :motorprovince limit 1), :chassisNo, :modelYear,
          :compulsoryCode, :unregisterflag, :engineNo, :cc, :seat, :gvw , :addition_access ) ON CONFLICT ("chassisNo") DO NOTHING RETURNING * ) 
          SELECT * FROM inserted UNION ALL SELECT * FROM static_data."Motors" WHERE "chassisNo" = :chassisNo `,
          {
            replacements: {
              brandname: policyData[i].brandname || null,
              voluntaryCode: policyData[i].voluntaryCode || '',
              modelname: policyData[i].modelname || null,
              specname: policyData[i].specname || null,
              licenseNo: policyData[i].licenseNo || null,
              motorprovince: policyData[i].motorprovince,
              chassisNo: policyData[i].chassisNo,
              modelYear: policyData[i].modelYear,

              compulsoryCode: policyData[i].compulsoryCode || '',
              unregisterflag: policyData[i].unregisterflag || 'N',
              engineNo: policyData[i].engineNo || '',
              cc: policyData[i].cc || null,
              seat: policyData[i].seat || null,
              gvw: policyData[i].gvw || null,
              addition_access :  policyData[i].addition_access || null,
            },
            transaction: t,
            type: QueryTypes.SELECT
          }
        )
        console.log(`----------- insert new Motors --------------`);
      }
//#region setup comov
      //set defualt comm ov if null 
      const commov = await sequelize.query(
        `select agt.vatflag, static_data.getagentpersontype(agt."agentCode") as "personType" , comout,* ,comin.*,
      agt."premCreditT" as "creditTAgent" , agt."premCreditUnit" as "creditUAgent",
      ins."premCreditT" as "creditTInsurer" , ins."premCreditUnit" as "creditUInsurer"
      FROM static_data."CommOVOuts" comout 
      JOIN static_data."CommOVIns" comin ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" 
      left JOIN static_data."Agents" agt on agt."agentCode" = comout."agentCode" and agt.lastversion = 'Y'
      left JOIN static_data."Insurers" ins on ins."insurerCode" = comout."insurerCode" and ins.lastversion = 'Y'
      where comout."agentCode" = :agentcode 
      and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
      and comout."insurerCode" = :insurerCode 
     	and comout.lastversion = 'Y'
     and comin.lastversion = 'Y'`,
        {
          replacements: {
            agentcode: policyData[i].agentCode,
            class: policyData[i].class,
            subClass: policyData[i].subClass,
            insurerCode: policyData[i].insurerCode,
          },
          transaction: t,
          type: QueryTypes.SELECT
        }
      )
      console.log(commov.length );
      
    if(commov.length === 0 ){
        throw new Error(`ไม่มีการset commov ${policyData[i].agentCode} / ${policyData[i].insurerCode} / ${policyData[i].class}+${policyData[i].subClass}`)
    }
    
      const duedateA = new Date()
      const duedateI = new Date()
      if (commov[0].creditUAgent === "D") {
        duedateA.setDate(duedateA.getDate() + commov[0].creditTAgent)
      } else if (res.data[0].creditUAgent === "M") {
        duedateA.setMonth(duedateA.getMonth() + commov[0].creditTAgent)
      }
      if (commov[0].creditUInsurer === "D") {
        duedateI.setDate(duedateI.getDate() + commov[0].creditTInsurer)
      } else if (res.data[0].creditUInsurer === "M") {
        duedateI.setMonth(duedateI.getMonth() + commov[0].creditTInsurer)
      }
      policyData[i].dueDateAgent = duedateA
      policyData[i].dueDateInsurer = duedateI
      console.log(`----------- get defualt comm ov/ duedate agent 1--------------`);

      //undefined comm/ov in
      if (policyData[i][`commin_rate`] === undefined || policyData[i][`commin_rate`] === null) {
        policyData[i][`commin_rate`] = commov[0].rateComIn
       
      }
      if (policyData[i][`ovin_rate`] === undefined || policyData[i][`ovin_rate`] === null) {
        policyData[i][`ovin_rate`] = commov[0].rateOVIn_1
      }

      policyData[i][`commin_amt`] = policyData[i][`commin_rate`] * policyData[i][`netgrossprem`] / 100
      policyData[i][`ovin_amt`] = policyData[i][`ovin_rate`] * policyData[i][`netgrossprem`] / 100
      // wht3% commov in
      policyData[i][`commin_taxamt`] = parseFloat((policyData[i][`commin_amt`] * wht).toFixed(2))
      policyData[i][`ovin_taxamt`] = parseFloat((policyData[i][`ovin_amt`] * wht).toFixed(2))


      //undefined comm/ov out agent 1 
      if (policyData[i][`commout1_rate`] === undefined || policyData[i][`commout1_rate`] === null) {
        policyData[i][`commout1_rate`] = commov[0].rateComOut
      }
      if (policyData[i][`ovout1_rate`] === undefined || policyData[i][`ovout1_rate`] === null) {
        policyData[i][`ovout1_rate`] = commov[0].rateOVOut_1
      }
      policyData[i][`commout1_amt`] = policyData[i][`commout1_rate`] * policyData[i][`netgrossprem`] / 100
      policyData[i][`ovout1_amt`] = policyData[i][`ovout1_rate`] * policyData[i][`netgrossprem`] / 100
      // //tax comm/ov out 1
      // if (commov[0].vatflag === 'Y') {
      //   policyData[i][`commout1_taxamt`] = parseFloat((policyData[i][`commout1_amt`] * tax).toFixed(2))
      //   policyData[i][`ovout1_taxamt`] = parseFloat((policyData[i][`ovout1_amt`] * tax).toFixed(2))
      // } else {
      //   policyData[i][`commout1_taxamt`] = 0
      //   policyData[i][`ovout1_taxamt`] = 0
      // }

      //wht3% comm/ov out 1
      if (commov[0].personType === 'O') {
        policyData[i][`commout1_taxamt`] = parseFloat((policyData[i][`commout1_amt`] * wht).toFixed(2))
        policyData[i][`ovout1_taxamt`] = parseFloat((policyData[i][`ovout1_amt`] * wht).toFixed(2))
      } else {
        policyData[i][`commout1_taxamt`] = 0
        policyData[i][`ovout1_taxamt`] = 0
      }
//#endregion

      //#region check agentcode2
      if (policyData[i][`agentCode2`]) {
        const commov2 = await sequelize.query(
          `select (select vatflag  from static_data."Agents" where "agentCode" = comout."agentCode"and lastversion='Y'),
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
              agentcode: policyData[i].agentCode2,
              class: policyData[i].class,
              subClass: policyData[i].subClass,
              insurerCode: policyData[i].insurerCode,
            },
            type: QueryTypes.SELECT
          }
        )
        console.log(`----------- get defualt comm ov agent 2--------------`);

        if (policyData[i][`commout2_rate`] === null && policyData[i][`ovout2_rate`] === null) {
          policyData[i][`commout2_rate`] = commov2[0].rateComOut
          policyData[i][`ovout2_rate`] = commov2[0].rateOVOut_1
        }
        
        policyData[i][`commout2_amt`] = policyData[i][`commout2_rate`] * policyData[i][`netgrossprem`] / 100
        policyData[i][`ovout2_amt`] = policyData[i][`ovout2_rate`] * policyData[i][`netgrossprem`] / 100
        // //tax comm/ov out 2
        // if (commov2[0].vatflag === 'Y') {
        //   policyData[i][`commout2_taxamt`] = parseFloat((policyData[i][`commout2_amt`] * tax).toFixed(2))
        //   policyData[i][`ovout2_taxamt`] = parseFloat((policyData[i][`ovout2_amt`] * tax).toFixed(2))
        // } else {
        //   policyData[i][`commout2_taxamt`] = 0
        //   policyData[i][`ovout2_taxamt`] = 0
        // }

        //tax comm/ov out 2
        if (commov2[0].personType === 'O') {
          policyData[i][`commout2_taxamt`] = parseFloat((policyData[i][`commout2_amt`] * wht).toFixed(2))
          policyData[i][`ovout2_taxamt`] = parseFloat((policyData[i][`ovout2_amt`] * wht).toFixed(2))
        } else {
          policyData[i][`commout2_taxamt`] = 0
          policyData[i][`ovout2_taxamt`] = 0
        }

        policyData[i][`commout_rate`] = parseFloat(policyData[i][`commout1_rate`]) + parseFloat(policyData[i][`commout2_rate`])
        policyData[i][`commout_amt`] = parseFloat(policyData[i][`commout1_amt`]) + parseFloat(policyData[i][`commout2_amt`])
        policyData[i][`ovout_rate`] = parseFloat(policyData[i][`ovout1_rate`]) + parseFloat(policyData[i][`ovout2_rate`])
        policyData[i][`ovout_amt`] = parseFloat(policyData[i][`ovout1_amt`]) + parseFloat(policyData[i][`ovout2_amt`])
        policyData[i][`commout_taxamt`] = parseFloat(policyData[i][`commout1_taxamt`]) + parseFloat(policyData[i][`commout2_taxamt`])
        policyData[i][`ovout_taxamt`] = parseFloat(policyData[i][`ovout1_taxamt`]) + parseFloat(policyData[i][`ovout2_taxamt`])

      } else {
        policyData[i][`agentCode2`] = null
        policyData[i][`commout2_rate`] = 0
        policyData[i][`commout2_amt`] = 0
        policyData[i][`commout2_taxamt`] = 0
        policyData[i][`ovout2_rate`] = 0
        policyData[i][`ovout2_amt`] = 0
        policyData[i][`ovout2_taxamt`] = 0
        policyData[i][`commout_rate`] = policyData[i][`commout1_rate`]
        policyData[i][`commout_amt`] = policyData[i][`commout1_amt`]
        policyData[i][`ovout_rate`] = policyData[i][`ovout1_rate`]
        policyData[i][`ovout_amt`] = policyData[i][`ovout1_amt`]
        policyData[i][`commout_taxamt`] = policyData[i][`commout1_taxamt`]
        policyData[i][`ovout_taxamt`] = policyData[i][`ovout1_taxamt`]
      }
      //#endregion

      //#region cal withheld 1%  duty tax totalprem
      policyData[i].duty = Math.ceil(policyData[i].netgrossprem * duty)
      policyData[i].tax = parseFloat(((policyData[i].netgrossprem + policyData[i].duty) * tax).toFixed(2))
      policyData[i].totalprem = policyData[i].netgrossprem + policyData[i].duty + policyData[i].tax
      if (policyData[i].personType.trim() === 'O') {

        policyData[i].withheld = Number(((policyData[i].netgrossprem + policyData[i].duty) * withheld).toFixed(2))
      } else {
        policyData[i].withheld = 0
      }


      //#endregion

      //get application no
     
      policyData[i].applicationNo = `APP-${getCurrentYY()}` + await getRunNo('app', null, null, 'kw', currentdate, t);
      console.log(`---------- Application No : ${policyData[i].applicationNo} -----------------`);

      //#region insert policy
      await sequelize.query(
        ` insert into static_data."Policies" ("policyNo", "issueDate", "applicationNo","insureeCode","insurerCode","agentCode","agentCode2","insureID","actDate", "expDate" ,grossprem, duty, tax, totalprem, 
        commin_rate, commin_amt, ovin_rate, ovin_amt, commin_taxamt, ovin_taxamt, commout_rate, commout_amt, ovout_rate, ovout_amt,
        commout1_taxamt, ovout1_taxamt, commout2_taxamt, ovout2_taxamt, commout_taxamt, ovout_taxamt,
        createusercode, "itemList","insurancestatus" ,
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, netgrossprem, specdiscrate, specdiscamt, cover_amt, withheld,
        duedateinsurer, duedateagent, endorseseries, "fleetCode", "invoiceNo", "taxInvoiceNo", "invoiceName", "beneficiary", polbatch) 
        -- 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree and lastversion = 'Y'), '+
        values ( :policyNo, :issueDate , :applicationNo, :insureeCode, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y' ), 
        :agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ), 
        :actDate, :expDate, :grossprem, :duty, :tax, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
        :commout1_taxamt, :ovout1_taxamt, :commout2_taxamt, :ovout2_taxamt, :commout_taxamt, :ovout_taxamt,
        :createusercode, :itemList ,:insurancestatus,
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :withheld,
        :dueDateInsurer, :dueDateAgent ,:endorseseries, :fleetCode, :invoiceNo, :taxInvoiceNo , :invoiceName, :beneficiary, :polbatch)`
        ,
        {
          replacements: {
            policyNo: policyData[i].policyNo,
            issueDate: policyData[i].issueDate,
            applicationNo: policyData[i].applicationNo,
            invoiceNo: policyData[i].invoiceNo,
            taxInvoiceNo: policyData[i].taxInvoiceNo,
            invoiceName : policyData[i].invoiceName,
            beneficiary : policyData[i].beneficiary,
            polbatch : polBatch,
            endorseseries: -99,
            insurancestatus: 'AI',
            fleetCode: fleetCode,
            // seqNoins: policyData[i].seqNoins,
            // seqNoagt: policyData[i].seqNoagt,
            // entityInsuree:
            insureeCode: insureeCode,
            insurerCode: policyData[i].insurerCode,
            class: policyData[i].class,
            subClass: policyData[i].subClass,
            agentCode: policyData[i].agentCode,
            agentCode2: policyData[i].agentCode2,
            actDate: policyData[i].actDate,
            expDate: policyData[i].expDate,
            grossprem: policyData[i].netgrossprem,
            netgrossprem: policyData[i].netgrossprem,
            duty: policyData[i].duty,
            tax: policyData[i].tax,
            totalprem: policyData[i].totalprem,
            // specdiscrate: policyData[i][`specdiscrate`],
            // specdiscamt: policyData[i][`specdiscamt`],
            specdiscrate: 0,
            specdiscamt: 0,
            commin_rate: policyData[i][`commin_rate`],
            commin_amt: policyData[i][`commin_amt`],
            ovin_rate: policyData[i][`ovin_rate`],
            ovin_amt: policyData[i][`ovin_amt`],
            commin_taxamt: policyData[i][`commin_taxamt`],
            ovin_taxamt: policyData[i][`ovin_taxamt`],
            commout_rate: policyData[i][`commout_rate`],
            commout_amt: policyData[i][`commout_amt`],
            ovout_rate: policyData[i][`ovout_rate`],
            ovout_amt: policyData[i][`ovout_amt`],
            commout1_rate: policyData[i][`commout1_rate`],
            commout1_amt: policyData[i][`commout1_amt`],
            ovout1_rate: policyData[i][`ovout1_rate`],
            ovout1_amt: policyData[i][`ovout1_amt`],
            commout2_rate: policyData[i][`commout2_rate`],
            commout2_amt: policyData[i][`commout2_amt`],
            ovout2_rate: policyData[i][`ovout2_rate`],
            ovout2_amt: policyData[i][`ovout2_amt`],
            cover_amt: policyData[i][`cover_amt`],
            createusercode: usercode,
            itemList: cars[0].id,
            withheld: policyData[i].withheld,
            dueDateInsurer: policyData[i].dueDateInsurer,
            dueDateAgent: policyData[i].dueDateAgent,
            commout1_taxamt: policyData[i][`commout1_taxamt`],
            ovout1_taxamt: policyData[i][`ovout1_taxamt`],
            commout2_taxamt: policyData[i][`commout2_taxamt`],
            ovout2_taxamt: policyData[i][`ovout2_taxamt`],
            commout_taxamt: policyData[i][`commout_taxamt`],
            ovout_taxamt: policyData[i][`ovout_taxamt`],


          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
    //#endregion


      await t.commit();
      statusPolicy.success.push({policyNo : policyData[i].policyNo , describe: 'success'})

    } catch (error) {
      console.error(error.message)
      await t.rollback();
      statusPolicy.error.push({policyNo: policyData[i].policyNo, describe: JSON.stringify(error.message)})


      //await res.status(500).json({ status: 'error', describe: error, policyNo: appNo });
      //return "fail"

    }

  }
const workbook = new excelJS.Workbook();

  const worksheet = workbook.addWorksheet("Sheet1");

  if (!worksheet) {
    
    throw new Error('Worksheet not found');
  }
  let row = 3;
  worksheet.getCell(row ,1).value = "PolicyNo";
    worksheet.getCell(row ,2).value = "Error describe";
  statusPolicy.error.forEach(ele => {
    row = row  +1
    worksheet.getCell(row ,1).value = ele.policyNo;
    worksheet.getCell(row ,2).value = ele.describe;
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
  // await res.json(statusPolicy)


};

// ok AI -> AA งานfleet std / inv
const editPolicyList = async (req, res) => {
  console.log(`----------- begin editPolicyList()  ----------------`);
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  
  for (let i = 0; i < req.body.length; i++) {
    const t = await sequelize.transaction();

    try {

      const checkPolicy = await sequelize.query(
        `select * from static_data."Policies" 
       WHERE "policyNo" = :policyNo and insurancestatus ='AA'`,
        {
          replacements: {
            policyNo: req.body[i].policyNo,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })
      console.log(checkPolicy.length > 0)
      if ((checkPolicy.length > 0)) {

        
        throw `เลขกรมธรรม์ : ${req.body[i].policyNo} มีอยู่ในระบบอยู่แล้ว`
      }

      if (!req.body[i].installment) {
        req.body[i].policyType = 'F'
      } else {

        if (req.body[i].installment.advisor.length === 1 && req.body[i].installment.insurer.length === 1) {
          req.body[i].policyType = 'F'
        } else { req.body[i].policyType = 'S' }
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
          transaction: t,
          type: QueryTypes.SELECT
        }
      )
      req.body[i].personType = insuree[0].personType.trim()
      if (req.body[i].personType === 'O') {
        req.body[i].withheld = Number(((req.body[i].netgrossprem + req.body[i].duty) * withheld).toFixed(2))
      } else {
        req.body[i].withheld
      }

      //update policy
      const policy = await sequelize.query(
        `update static_data."Policies" 
       SET "policyNo" = :policyNo,  grossprem = :grossprem,  netgrossprem = :netgrossprem, specdiscrate = :specdiscrate, specdiscamt = :specdiscamt, duty = :duty, tax = :tax, totalprem = :totalprem, 
       commin_rate = :commin_rate, commin_amt = :commin_amt, ovin_rate = :ovin_rate, ovin_amt = :ovin_amt,
        commin_taxamt = :commin_taxamt,  ovin_taxamt = :ovin_taxamt,
      "policyDate" = :policyDate, "insurancestatus" = 'AA',"policystatus"='PC', 
      commout1_rate = :commout1_rate, commout1_amt = :commout1_amt, ovout1_rate = :ovout1_rate, ovout1_amt = :ovout1_amt,
       commout2_rate = :commout2_rate, commout2_amt = :commout2_amt, ovout2_rate = :ovout2_rate, ovout2_amt = :ovout2_amt,
        commout_rate = :commout_rate, commout_amt = :commout_amt, ovout_rate = :ovout_rate, ovout_amt = :ovout_amt, 
      commout1_taxamt = :commout1_taxamt, ovout1_taxamt = :ovout1_taxamt, commout2_taxamt = :commout2_taxamt, ovout2_taxamt = :ovout2_taxamt, commout_taxamt = :commout_taxamt, ovout_taxamt = :ovout_taxamt, 
      "seqNoins" = :seqNoins, "seqNoagt" = :seqNoagt, "issueDate" = :issueDate , "policyType" = :policyType, "cover_amt" = :cover_amt, "withheld" = :withheld,
       "invoiceNo" = :invoiceNo, "taxInvoiceNo" = :taxInvoiceNo, "endorseseries" = :endorseseries
      WHERE "applicationNo" = :applicationNo and "insurancestatus" = 'AI' Returning id`,
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

            commout_taxamt: req.body[i][`commout_taxamt`],
            ovout_taxamt: req.body[i][`ovout_taxamt`],
            commout1_taxamt: req.body[i][`commout1_taxamt`],
            ovout1_taxamt: req.body[i][`ovout1_taxamt`],
            commout2_taxamt: req.body[i][`commout2_taxamt`],
            ovout2_taxamt: req.body[i][`ovout2_taxamt`],


            issueDate: req.body[i][`issueDate`],
            policyType: req.body[i][`policyType`],
            cover_amt: req.body[i][`cover_amt`],
            policyDate: new Date().toJSON().slice(0, 10),
            withheld: req.body[i]['withheld'],
            invoiceNo: req.body[i]['invoiceNo'],
            taxInvoiceNo: req.body[i]['taxInvoiceNo'],
            endorseseries: 0

          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )
      console.log("polid : " + policy[0][0].id);
      //insert jupgr
      req.body[i].polid = policy[0][0].id
      //check installment 
      if (!req.body[i].installment) {
        req.body[i].installment = { advisor: [], insurer: [] }
      }
      console.log(`----------- before create jupgr ----------------`);
      await createjupgr(req.body[i], t, usercode)

      console.log(`----------- before create transection ----------------`);
      //insert transaction 
      await createTransection(req.body[i], t)
      // await createTransection(req.body[i],t)

      // insert  jugltx table -> ลงผังบัญชี
      // await account.insertjugltx('POLICY', req.body[i].policyNo, t)

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

const createjupgr = async (policy, t, usercode) => {
  console.log(`----------- begin createjupgr()  ----------------`);
  const advisor = policy.installment.advisor
  const insurer = policy.installment.insurer
  const arrIns = []
  const arrAds = []
  const currentdate = getCurrentDate()
  let dftxno = policy.policyNo
  if (policy.endorseNo) {
    dftxno = policy.endorseNo
  }

  //console.log(policy);
  // installment advisor 
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

  // #region for fleet INV
  if (policy.installment.advisor.length === 0) {
    // policy.invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')
    policy.invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + await getRunNo('inv', null, null, 'kwan', currentdate, t)
    policy.taxInvoiceNo = `TAXINV-${getCurrentYYMM()}` + await getRunNo('taxinv', null, null, 'kwan', currentdate, t);
    const ads = await sequelize.query(
      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno" , "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", grossprem, 
    specdiscrate, specdiscamt, netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
    "agentCode", "agentCode2", commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, commout_rate, 
    commout_amt, ovout_rate, ovout_amt, createusercode, polid, withheld,
    commout1_taxamt, commout2_taxamt, commout_taxamt, ovout1_taxamt, ovout2_taxamt, ovout_taxamt)
    values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, :grossprem, :specdiscrate, :specdiscamt, :netgrossprem, 
    :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :commout1_rate, :commout1_amt, 
    :ovout1_rate, :ovout1_amt, :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :createusercode, 
     :polid, :withheld,
     :commout1_taxamt, :commout2_taxamt, :commout_taxamt, :ovout1_taxamt, :ovout2_taxamt, :ovout_taxamt)`,
      {
        replacements: {
          policyNo: policy.policyNo,
          polid : policy.polid,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
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
          withheld: policy['withheld'],
          commout1_taxamt: policy[`commout1_taxamt`],
          ovout1_taxamt: policy[`ovout1_taxamt`],
          commout2_taxamt: policy[`commout2_taxamt`],
          ovout2_taxamt: policy[`ovout2_taxamt`],
          commout_taxamt: policy[`commout_taxamt`],
          ovout_taxamt: policy[`ovout_taxamt`],
        },

        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    arrAds.push[ads]
  }
  if (policy.installment.insurer.length === 0) {
    const ins = await sequelize.query(
      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", grossprem, 
    specdiscrate, specdiscamt, netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
    "agentCode", "agentCode2", commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, commout_rate, 
    commout_amt, ovout_rate, ovout_amt, createusercode, polid, withheld,
    commout1_taxamt, commout2_taxamt, commout_taxamt, ovout1_taxamt, ovout2_taxamt, ovout_taxamt)
    values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, :grossprem, :specdiscrate, :specdiscamt, :netgrossprem, 
    :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :commout1_rate, :commout1_amt, 
    :ovout1_rate, :ovout1_amt, :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :createusercode,
     :polid, :withheld,
      :commout1_taxamt, :commout2_taxamt, :commout_taxamt, :ovout1_taxamt, :ovout2_taxamt, :ovout_taxamt)`,
      {
        replacements: {
          policyNo: policy.policyNo,
          polid : policy.polid,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
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
          withheld: policy['withheld'],
          commout1_taxamt: policy[`commout1_taxamt`],
          ovout1_taxamt: policy[`ovout1_taxamt`],
          commout2_taxamt: policy[`commout2_taxamt`],
          ovout2_taxamt: policy[`ovout2_taxamt`],
          commout_taxamt: policy[`commout_taxamt`],
          ovout_taxamt: policy[`ovout_taxamt`],
        },

        transaction: t,
        type: QueryTypes.INSERT
      }
    )
    arrIns.push(ins)
  }
  //#endregion


  for (let i = 0; i < advisor.length; i++) {
    // advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')
    advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + await getRunNo('inv', null, null, 'kwan', currentdate, t)
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
          dftxno: dftxno,
          invoiceNo: advisor[i].invoiceNo,
          taxInvoiceNo: advisor[i].taxInvoiceNo,
          installmenttype: 'A',
          seqNo: i + 1,
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
          withheld: advisor[i]['withheld'],
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
    const ins = await sequelize.query(
      `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo",
      grossprem, specdiscrate, specdiscamt, 
      netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
      "agentCode", "agentCode2", createusercode, polid, withheld,
      commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
      commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
      commout_rate, commout_amt, ovout_rate, ovout_amt,
      commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt )
      values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
      :grossprem, :specdiscrate, :specdiscamt, 
      :netgrossprem, 
      :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt, :agentCode, :agentCode2, :createusercode, 
      (select id from static_data."Policies" where "policyNo" = :policyNo and "lastVersion" = 'Y' ), :withheld,
      :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,
      :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, 
      :commout_rate, :commout_amt, :ovout_rate, :ovout_amt ,
      :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt)`,
      {
        replacements: {
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: insurer[i].invoiceNo,
          taxInvoiceNo: insurer[i].taxInvoiceNo,
          installmenttype: 'I',
          seqNo: i + 1,
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
          withheld: insurer[i]['withheld'],

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

          // tax wth3%
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


  return { insurer: arrIns, advisor: arrAds }

}

// edit for status = I
const savechangPolicy = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    const t = await sequelize.transaction();

    try {
      if (!req.body[i].installment) {
        req.body[i].policyType = 'F'
      } else {

        if (req.body[i].installment.advisor.length === 0 && req.body[i].installment.insurer.length === 0) {
          req.body[i].policyType = 'F'
        } else { req.body[i].policyType = 'S' }
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
          transaction: t,
          type: QueryTypes.SELECT
        }
      )
      req.body[i].personType = insuree[0].personType.trim()
      if (req.body[i].personType === 'O') {
        req.body[i].withheld = Number(((req.body[i].netgrossprem + req.body[i].duty) * withheld).toFixed(2))
      } else {
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
            issueDate: req.body[i][`issueDate`],
            policyType: req.body[i][`policyType`],
            cover_amt: req.body[i][`cover_amt`],
            policyDate: new Date().toJSON().slice(0, 10),
            withheld: req.body[i]['withheld'],
            invoiceNo: req.body[i]['invoiceNo'],
            taxInvoiceNo: req.body[i]['taxInvoiceNo'],

          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )
      console.log(policy[0][0].id);
      //insert jupgr
      req.body[i].polid = policy[0][0].id
      //check installment 
      if (!req.body[i].installment) {
        req.body[i].installment = { advisor: [], insurer: [] }
      }

      await createjupgr(req.body[i], t, usercode)

      //insert transaction 
      await createTransection(req.body[i], t)
      // await createTransection(req.body[i],t)

      // insert  jugltx table -> ลงผังบัญชี
      await account.insertjugltx('POLICY', req.body[i].policyNo, t)

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

// ok AI -> AA งานรายย่อย
const editPolicyMinor = async (req, res) => {
  console.log("------------ begin editPolicyMinor() ---------------");
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    const t = await sequelize.transaction();

    try {
      const checkPolicy = await sequelize.query(
        `select * from static_data."Policies" 
       WHERE "policyNo" = :policyNo and insurancestatus = 'AA' `,
        {
          replacements: {
            policyNo: req.body[i].policyNo,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })
      console.log(checkPolicy.length > 0)
      if ((checkPolicy.length > 0)) {
        throw `เลขกรมธรรม์ : ${req.body[i].policyNo} มีอยู่ในระบบอยู่แล้ว`
      }

      if (!req.body[i].installment) {
        req.body[i].policyType = 'F'
      } else {

        if (req.body[i].installment.advisor.length === 1) {
          req.body[i].policyType = 'F'
        } else { req.body[i].policyType = 'S' }
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
          transaction: t,
          type: QueryTypes.SELECT
        }
      )
      req.body[i].personType = insuree[0].personType.trim()
      if (req.body[i].personType === 'O') {
        req.body[i].withheld = Number(((req.body[i].netgrossprem + req.body[i].duty) * withheld).toFixed(2))
      } else {
        req.body[i].withheld
      }

      //update endorseseries

      req.body[i].endorseseries = 0

       //#region set comm ov wht3%
       const agentPersonType = await sequelize.query(
        `select static_data.getagentpersontype(:agentCode) as "personType1" 
        ,static_data.getagentpersontype(:agentCode2) as "personType2" `,
        {
          replacements: {
            agentCode: req.body[i].agentCode,
            agentCode2: req.body[i].agentCode2,
          },
          transaction: t,
          type: QueryTypes.SELECT
        }
      )

      req.body[i][`commin_taxamt`] = parseFloat((req.body[i][`commin_amt`] *wht).toFixed(2))
      req.body[i][`ovin_taxamt`] = parseFloat((req.body[i][`ovin_amt`] *wht).toFixed(2))
    
    if (agentPersonType[0].personType1 === 'O') {
      req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *wht).toFixed(2))
      req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] *wht).toFixed(2))
    }else{
      req.body[i][`commout1_taxamt`] = 0
      req.body[i][`ovout1_taxamt`] = 0
    }

    if (agentPersonType[0].personType2 === 'O') {
      req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *wht).toFixed(2))
      req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] *wht).toFixed(2))
    }else{
      req.body[i][`commout1_taxamt`] = 0
      req.body[i][`ovout2_taxamt`] = 0

    }

    req.body[i][`commout_taxamt`] = parseFloat(req.body[i][`commout1_taxamt`]) +parseFloat(req.body[i][`commout2_taxamt`])
    req.body[i][`ovout_taxamt`] = parseFloat(req.body[i][`ovout1_taxamt`]) +parseFloat(req.body[i][`ovout2_taxamt`])
    //#endregion


      //update policy
      const policy = await sequelize.query(
        `update static_data."Policies" 
       SET "policyNo" = :policyNo,  grossprem = :grossprem,  netgrossprem = :netgrossprem, specdiscrate = :specdiscrate, specdiscamt = :specdiscamt, duty = :duty, tax = :tax, totalprem = :totalprem, 
       commin_rate = :commin_rate, commin_amt = :commin_amt, commin_taxamt = :commin_taxamt, 
       ovin_rate = :ovin_rate, ovin_amt = :ovin_amt, ovin_taxamt = :ovin_taxamt, 
        commout1_rate = :commout1_rate, commout1_amt = :commout1_amt, commout1_taxamt = :commout1_taxamt, 
         ovout1_rate = :ovout1_rate,  ovout1_amt = :ovout1_amt, ovout1_taxamt = :ovout1_taxamt,
         commout2_rate = :commout2_rate, commout2_amt = :commout2_amt, commout2_taxamt = :commout2_taxamt,
          ovout2_rate = :ovout2_rate, ovout2_amt = :ovout2_amt, ovout2_taxamt = :ovout2_taxamt,
      commout_rate = :commout_rate, commout_amt = :commout_amt, commout_taxamt = :commout_taxamt, 
      ovout_rate = :ovout_rate, ovout_amt = :ovout_amt, ovout_taxamt = :ovout_taxamt,
      "policyDate" = :policyDate, "insurancestatus" = 'AA', "policystatus" = 'PC',
      "seqNoins" = :seqNoins, "seqNoagt" = :seqNoagt, "issueDate" = :issueDate , "policyType" = :policyType, "cover_amt" = :cover_amt, "withheld" = :withheld,
       "invoiceNo" = :invoiceNo, "taxInvoiceNo" = :taxInvoiceNo, "endorseseries" = :endorseseries
      WHERE "applicationNo" = :applicationNo and "insurancestatus" = 'AI' Returning id`,
        {
          replacements: {
            policyNo: req.body[i].policyNo,
            applicationNo: req.body[i].applicationNo,
            endorseseries: req.body[i].endorseseries,
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
            commout_taxamt: req.body[i][`commout_taxamt`],
            ovout_taxamt: req.body[i][`ovout_taxamt`],

            commout1_rate: req.body[i][`commout1_rate`],
            commout1_amt: req.body[i][`commout1_amt`],
            ovout1_rate: req.body[i][`ovout1_rate`],
            ovout1_amt: req.body[i][`ovout1_amt`],
            commout1_taxamt: req.body[i][`commout1_taxamt`],
            ovout1_taxamt: req.body[i][`ovout1_taxamt`],

            commout2_rate: req.body[i][`commout2_rate`],
            commout2_amt: req.body[i][`commout2_amt`],
            ovout2_rate: req.body[i][`ovout2_rate`],
            ovout2_amt: req.body[i][`ovout2_amt`],
            commout2_taxamt: req.body[i][`commout2_taxamt`],
            ovout2_taxamt: req.body[i][`ovout2_taxamt`],

            issueDate: req.body[i][`issueDate`],
            policyType: req.body[i][`policyType`],
            cover_amt: req.body[i][`cover_amt`],
            policyDate: new Date().toJSON().slice(0, 10),
            withheld: req.body[i]['withheld'],
            invoiceNo: req.body[i]['invoiceNo'],
            taxInvoiceNo: req.body[i]['taxInvoiceNo'],

          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )
      console.log("polid : " + policy[0][0].id);
      //insert jupgr
      req.body[i].polid = policy[0][0].id
      // //check installment 
      // if (!req.body[i].installment) {
      //   req.body[i].installment = {advisor:[], insurer:[]}
      // }
    
      await createjupgrMinor(req.body[i], t, usercode)

      //insert transaction 
      
      await createTransectionMinor(req.body[i], t)
      // await createTransection(req.body[i],t)

      // insert  jugltx table -> ลงผังบัญชี
      // await account.insertjugltx('POLICY',req.body[i].policyNo,t )

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

const createTransectionMinor = async (policy, t) => {
  console.log("------------ begin createTransectionMinor() ---------------");
  const jupgr = policy.installment
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
        transaction: t,
        type: QueryTypes.SELECT
      }
    )
    policy.insureID = insureType[0].id
  }


  // find comm ov defualt
  // const commov1 = await sequelize.query(
  //   'select * FROM static_data."CommOVOuts" comout ' +
  //   'JOIN static_data."CommOVIns" comin ' +
  //   'ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" ' +
  //   'where comout."agentCode" = :agentcode ' +
  //   'and comout."insureID" = :insureID ' +
  //   'and comout."insurerCode" = :insurerCode',
  //   {
  //     replacements: {
  //       agentcode: policy.agentCode,
  //       insureID: policy.insureID,
  //       // subClass: policy.subClass,
  //       insurerCode: policy.insurerCode,
  //     },
  //     transaction: t,
  //     type: QueryTypes.SELECT
  //   }
  // )

  jupgr.insurer = policy
  //  const dueDate = new Date()
  //  dueDate.setDate(dueDate.getDate() + insurer[0].premCreditT);
  //  jupgr.insurer[0].dueDate = dueDate


  if (jupgr.advisor.length === 0) {
    jupgr.advisor.push(policy)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + agent[0].premCreditT);
    jupgr.advisor[0].dueDate = dueDate
  }


  // amity -> insurer (prem-out) && insurer -> amity (comm/ov-in)
  // seqnoins >1
  let date = new Date()

  let dftxno = policy.policyNo
  if (policy.endorseNo) {
    dftxno = policy.endorseNo
  }

  //prem-out

  let totalamt = parseFloat(policy.totalprem) - parseFloat(policy.withheld)
  //const dueDate = new Date()
  //dueDate.setDate(date.getDate() + i*insurer[0].premCreditT);

  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
         ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo",  mainaccountcode, withheld ) 
         VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode, :withheld )` ,

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
        invoiceNo: policy.invoiceNo,
        // totalamt: totalamt,
        totalamt: totalamt,
        // duedate: dueDate,
        duedate: policy.duedateinsurer,
        netgrossprem: policy.netgrossprem,
        duty: policy.duty,
        tax: policy.tax,
        totalprem: policy.totalprem,
        netgrossprem: policy.netgrossprem,
        duty: policy.duty,
        tax: policy.tax,
        totalprem: policy.totalprem,
        txtype2: 1,
        //seqno:i,
        seqno: 1,
        mainaccountcode: policy.insurerCode,
        withheld: policy.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("------------- done create Transection Prem-Out -------------");
  //comm-in
  totalamt = policy.commin_amt
  const dueDateCommin = new Date(policy.duedateinsurer)
  if (insurer[0].commovCreditUnit.trim() === 'D') {
    dueDateCommin.setDate(dueDateCommin.getDate() + insurer[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommin.setMonth(dueDateCommin.getMonth() + insurer[0].commovCreditT);
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
        subType: 1,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: policy.invoiceNo,
        netgrossprem: policy.netgrossprem,
        duty: policy.duty,
        tax: policy.tax,
        totalprem: policy.totalprem,
        commamt: policy.commin_amt,
        commtaxamt: policy.commin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommin,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: 1,
        // seqno:i,
        seqno: 1,
        mainaccountcode: 'Amity',
        withheld: policy.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("------------- done create Transection Comm-In -------------");
  //ov-in
  totalamt = policy.ovin_amt
  await sequelize.query(
    `INSERT INTO static_data."Transactions" 
     ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",  ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld) 
     VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
    {
      replacements: {
        polid: policy.polid,
        type: 'OV-IN',
        subType: 1,
        insurerCode: policy.insurerCode,
        agentCode: policy.agentCode,
        policyNo: policy.policyNo,
        endorseNo: policy.endorseNo,
        dftxno: dftxno,
        invoiceNo: policy.invoiceNo,
        ovamt: policy.ovin_amt,
        ovtaxamt: policy.ovin_taxamt,
        totalamt: totalamt,
        //  duedate: policy.duedateinsurer,
        duedate: dueDateCommin,
        netgrossprem: policy.netgrossprem,
        duty: policy.duty,
        tax: policy.tax,
        totalprem: policy.totalprem,
        //  ovamt: jupgr.insurer[i].ovin_amt,
        //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
        //  totalamt: jupgr.insurer[i].ovin_amt,
        //  duedate: jupgr.insurer[i].dueDate,
        //  netgrossprem: jupgr.insurer[i].netgrossprem,
        //  duty: jupgr.insurer[i].duty,
        //  tax: jupgr.insurer[i].tax,
        //  totalprem: jupgr.insurer[i].totalprem,
        txtype2: 1,
        // seqno:i,
        seqno: 1,
        mainaccountcode: 'Amity',
        withheld: policy.withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log("------------- done create Transection Ov-In -------------");

  // amity -> advisor1 (comm/ov-out) &&  advisor1  -> amity (prem-in)
  // seqnoagt >1
  date = new Date()

  const dueDateCommout = new Date(jupgr.advisor[jupgr.advisor.length - 1].dueDate)
  if (agent[0].commovCreditUnit.trim() === 'D') {
    dueDateCommout.setDate(dueDateCommout.getDate() + agent[0].commovCreditT);
  } else if (insurer[0].commovCreditUnit.trim() === 'M') {
    dueDateCommout.setMonth(dueDateCommout.getMonth() + agent[0].commovCreditT);
  }
  

  //  for (let i = 1; i <= policy.seqNoagt; i++) {
  if (jupgr.advisor.length >= 1) {

    for (let i = 0; i < jupgr.advisor.length; i++) {
      //prem-in

      totalamt = parseFloat(jupgr.advisor[i].totalprem) - parseFloat(jupgr.advisor[i].withheld)
      //const dueDate = new Date()
      //dueDate.setDate(date.getDate() + i*agent[0].premCreditT);
      await sequelize.query(
        `INSERT INTO static_data."Transactions" 
          ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", 
          netgrossprem, duty, tax, 
          totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
          VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo,
            :netgrossprem, :duty, :tax, 
             :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
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
            seqno: i + 1,
            mainaccountcode: policy.agentCode,
            withheld: jupgr.advisor[i].withheld,


          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      );

      console.log(`------------- done create Transection Prem-In seqno ${i + 1} -------------`);
//comm-out
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
      txtype2: 1,
      // seqno:i,
      seqno: i + 1,
      mainaccountcode: policy.agentCode,
      withheld: jupgr.advisor[i].withheld,


    },
    transaction: t,
    type: QueryTypes.INSERT
  }
);

console.log(`------------- done create Transection Comm-Out1 seqno ${i + 1} -------------`);
//ov-out
totalamt = jupgr.advisor[i].ovout1_amt,
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
      txtype2: 1,
      // seqno:i,
      seqno: i + 1,
      mainaccountcode: policy.agentCode,
      withheld:  jupgr.advisor[i].withheld,

    },
    transaction: t,
    type: QueryTypes.INSERT
  }
);
console.log(`------------- done create Transection OV-Out1 seqno ${i + 1} -------------`);
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
  let totalamt = jupgr.advisor[i].commout2_amt
  const dueDate = new Date()
  dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
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
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor[i].netgrossprem,
        duty: jupgr.advisor[i].duty,
        tax: jupgr.advisor[i].tax,
        totalprem: jupgr.advisor[i].totalprem,
        txtype2: 1,
        seqno: i + 1,
        mainaccountcode: policy.agentCode2,
        withheld: jupgr.advisor[i].withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log(`------------- done create Transection Comm-Out2 seqno ${i + 1} -------------`);
  //ov-out
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
        subType: 0,
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
        duedate: dueDateCommout,
        netgrossprem: jupgr.advisor[i].netgrossprem,
        duty: jupgr.advisor[i].duty,
        tax: jupgr.advisor[i].tax,
        totalprem: jupgr.advisor[i].totalprem,
        txtype2: 1,
        seqno: i + 1,
        mainaccountcode: policy.agentCode2,
        withheld: jupgr.advisor[i].withheld,

      },
      transaction: t,
      type: QueryTypes.INSERT
    }
  );
  console.log(`------------- done create Transection OV-Out2 seqno ${i + 1} -------------`);
}

    }

  } else {
    // totalamt = parseFloat(jupgr.advisor[0].totalprem) - parseFloat(jupgr.advisor[0].withheld)
    // await sequelize.query(
    //   `INSERT INTO static_data."Transactions" 
    //   ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", 
    //   netgrossprem, duty, tax, 
    //    totalamt,remainamt,"dueDate",totalprem,txtype2, polid, "seqNo" , mainaccountcode, withheld ) 
    //   VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo,
    //     :netgrossprem, :duty, :tax, 
    //     :totalamt,:totalamt, :duedate,:totalprem, :txtype2, :polid, :seqno ,:mainaccountcode , :withheld ) `,
    //   {
    //     replacements: {
    //       polid: policy.polid,
    //       type: 'PREM-IN',
    //       subType: 1,
    //       insurerCode: policy.insurerCode,
    //       agentCode: policy.agentCode,
    //       policyNo: policy.policyNo,
    //       endorseNo: policy.endorseNo,
    //       dftxno: dftxno,
    //       invoiceNo: jupgr.advisor[0].invoiceNo,
    //       // totalamt: totalamt,
    //       // duedate: dueDate,
    //       // netgrossprem: policy.netgrossprem,
    //       // duty: policy.duty,
    //       // tax: policy.tax,
    //       // totalprem: policy.totalprem,
    //       totalamt: totalamt,
    //       // duedate: policy.duedateagent,
    //       duedate: jupgr.advisor[0].dueDate,
    //       netgrossprem: jupgr.advisor[0].netgrossprem,
    //       duty: jupgr.advisor[0].duty,
    //       tax: jupgr.advisor[0].tax,
    //       totalprem: policy.totalprem,
    //       txtype2: 1,
    //       // seqno:i,
    //       seqno: 1,
    //       mainaccountcode: policy.agentCode,
    //       withheld: policy.withheld,


    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // );
    // console.log(`------------- done create Transection Prem-In  -------------`);
  }

  
  if (policy.specdiscamt > 0) {
    //DISC-IN
    totalamt = policy.specdiscamt
    await sequelize.query(
      `INSERT INTO static_data."Transactions" 
    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate", netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode) 
    VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty, :tax, :totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode  ) `,
      {
        replacements: {
          polid: policy.polid,
          type: 'DISC-IN',
          subType: 0,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: jupgr.advisor[0].invoiceNo,
          commamt: policy.commout1_amt,
          commtaxamt: policy.commout1_taxamt,
          totalamt: totalamt,
          // duedate: policy.duedateagent,
          duedate: jupgr.advisor[0].dueDate,
          netgrossprem: policy.netgrossprem,
          duty: policy.duty,
          tax: policy.tax,
          totalprem: policy.totalprem,
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: 1,
          // seqno:i,
          seqno: 1,
          mainaccountcode: policy.insureeCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
    //DISC-OUT
    totalamt = policy.specdiscamt
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
          type : policy.disctype,
          subType: 1,
          insurerCode: policy.insurerCode,
          agentCode: policy.agentCode,
          policyNo: policy.policyNo,
          endorseNo: policy.endorseNo,
          dftxno: dftxno,
          invoiceNo: policy.invoiceNo,
          commamt: policy.commout1_amt,
          commtaxamt: policy.commout1_taxamt,
          totalamt: totalamt,
          // duedate: policy.duedateagent,
          duedate: dueDateCommout,
          netgrossprem: policy.netgrossprem,
          duty: policy.duty,
          tax: policy.tax,
          totalprem: policy.totalprem,
          //  commamt: jupgr.advisor[i].commout1_amt,
          //  commtaxamt: null,
          //  totalamt: jupgr.advisor[i].commout1_amt,
          //  duedate: jupgr.advisor[i].dueDate,
          //  netgrossprem: jupgr.advisor[i].netgrossprem,
          //  duty: jupgr.advisor[i].duty,
          //  tax: jupgr.advisor[i].tax,
          //  totalprem: jupgr.advisor[i].totalprem,
          txtype2: 1,
          // seqno:i,
          seqno: 1,
          mainaccountcode: policy.agentCode,
          // withheld : policy.withheld,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    );
  }


  //#region old commov out 1 and 2
  // //comm-out
  // totalamt = policy.commout1_amt
  // // dueDate.setDate(dueDate.getDate() + agent[0].commovCreditT);
  // /// errrorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  // await sequelize.query(
  //   `INSERT INTO static_data."Transactions" 
  //    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", commamt, commtaxamt, totalamt, remainamt,"dueDate",netgrossprem, duty, tax, totalprem, txtype2, polid, "seqNo", mainaccountcode, withheld) 
  //    VALUES (:type, :subType, :insurerCode ,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt, :totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode , :withheld ) `,
  //   {
  //     replacements: {
  //       polid: policy.polid,
  //       type: 'COMM-OUT',
  //       subType: 0,
  //       insurerCode: policy.insurerCode,
  //       agentCode: policy.agentCode,
  //       policyNo: policy.policyNo,
  //       endorseNo: policy.endorseNo,
  //       dftxno: dftxno,
  //       invoiceNo: policy.invoiceNo,
  //       commamt: policy.commout1_amt,
  //       commtaxamt: policy.commout1_taxamt,
  //       totalamt: totalamt,
  //       //  duedate: policy.duedateagent,
  //       duedate: dueDateCommout,
  //       netgrossprem: policy.netgrossprem,
  //       duty: policy.duty,
  //       tax: policy.tax,
  //       totalprem: policy.totalprem,
  //       //  commamt: jupgr.advisor[i].commout1_amt,
  //       //  commtaxamt: null,
  //       //  totalamt: jupgr.advisor[i].commout1_amt,
  //       //  duedate: jupgr.advisor[i].dueDate,
  //       //  netgrossprem: jupgr.advisor[i].netgrossprem,
  //       //  duty: jupgr.advisor[i].duty,
  //       //  tax: jupgr.advisor[i].tax,
  //       //  totalprem: jupgr.advisor[i].totalprem,
  //       txtype2: 1,
  //       // seqno:i,
  //       seqno: 1,
  //       mainaccountcode: policy.agentCode,
  //       withheld: policy.withheld,


  //     },
  //     transaction: t,
  //     type: QueryTypes.INSERT
  //   }
  // );


  // //ov-out
  // totalamt = policy.ovout1_amt
  // await sequelize.query(
  //   ` INSERT INTO static_data."Transactions" 
  //    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode ,withheld) 
  //    VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld) `,
  //   {
  //     replacements: {
  //       polid: policy.polid,
  //       type: 'OV-OUT',
  //       subType: 0,
  //       insurerCode: policy.insurerCode,
  //       agentCode: policy.agentCode,
  //       policyNo: policy.policyNo,
  //       endorseNo: policy.endorseNo,
  //       dftxno: dftxno,
  //       invoiceNo: policy.invoiceNo,
  //       ovamt: policy.ovout1_amt,
  //       ovtaxamt: policy.ovout1_taxamt,
  //       totalamt: totalamt,
  //       //  duedate: policy.duedateagent,
  //       duedate: dueDateCommout,
  //       netgrossprem: policy.netgrossprem,
  //       duty: policy.duty,
  //       tax: policy.tax,
  //       totalprem: policy.totalprem,
  //       //  ovamt: jupgr.advisor[i].ovout1_amt,
  //       //  ovtaxamt: null,
  //       //  totalamt: jupgr.advisor[i].ovout1_amt,
  //       //  duedate: jupgr.advisor[i].dueDate,
  //       //  netgrossprem: jupgr.advisor[i].netgrossprem,
  //       //  duty: jupgr.advisor[i].duty,
  //       //  tax: jupgr.advisor[i].tax,
  //       //  totalprem: jupgr.advisor[i].totalprem,
  //       txtype2: 1,
  //       // seqno:i,
  //       seqno: 1,
  //       mainaccountcode: policy.agentCode,
  //       withheld: policy.withheld,

  //     },
  //     transaction: t,
  //     type: QueryTypes.INSERT
  //   }
  // );

  // // case 2 advisor amity -> advisor2 (comm/ov-out)

  // if (policy.agentCode2) {
  //   date = new Date()
  //   const agent2 = await sequelize.query(
  //     'select * FROM static_data."Agents" ' +
  //     'where "agentCode" = :agentcode',
  //     {
  //       replacements: {
  //         agentcode: policy.agentCode2,
  //       },
  //       transaction: t,
  //       type: QueryTypes.SELECT
  //     }
  //   )
  //   //comm-out
  //   let totalamt = policy.commout2_amt
  //   const dueDate = new Date()
  //   dueDate.setDate(date.getDate() + agent2[0].commovCreditT);
  //   await sequelize.query(
  //     ` INSERT INTO static_data."Transactions" 
  //    ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno", commamt,commtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo", mainaccountcode, "agentCode2" , withheld) 
  //    VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :commamt , :commtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
  //     {
  //       replacements: {
  //         polid: policy.polid,
  //         type: 'COMM-OUT',
  //         subType: 0,
  //         insurerCode: policy.insurerCode,
  //         agentCode: policy.agentCode,
  //         agentCode2: policy.agentCode2,
  //         policyNo: policy.policyNo,
  //         endorseNo: policy.endorseNo,
  //         dftxno: dftxno,
  //         invoiceNo: policy.invoiceNo,
  //         commamt: policy.commout2_amt,
  //         commtaxamt: policy.commout2_taxamt,
  //         totalamt: totalamt,
  //         //  duedate: dueDate,
  //         duedate: dueDateCommout,
  //         netgrossprem: policy.netgrossprem,
  //         duty: policy.duty,
  //         tax: policy.tax,
  //         totalprem: policy.totalprem,
  //         txtype2: 1,
  //         seqno: 1,
  //         mainaccountcode: policy.agentCode2,
  //         withheld: policy.withheld,

  //       },
  //       transaction: t,
  //       type: QueryTypes.INSERT
  //     }
  //   );
  //   //ov-out
  //   totalamt = policy.ovout2_amt
  //   await sequelize.query(
  //     `INSERT INTO static_data."Transactions" 
  //    ("transType", "subType", "insurerCode","agentCode", "policyNo", "endorseNo", "dftxno", "documentno", ovamt,ovtaxamt,totalamt,remainamt,"dueDate", 
  //     netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode, "agentCode2", withheld ) 
  //    VALUES (:type, :subType, :insurerCode, :agentCode, :policyNo, :endorseNo, :dftxno, :invoiceNo, :ovamt , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, 
  //    :polid ,:seqno ,:mainaccountcode, :agentCode2 , :withheld) `,
  //     {
  //       replacements: {
  //         polid: policy.polid,
  //         type: 'OV-OUT',
  //         subType: 0,
  //         insurerCode: policy.insurerCode,
  //         agentCode: policy.agentCode,
  //         agentCode2: policy.agentCode2,
  //         policyNo: policy.policyNo,
  //         endorseNo: policy.endorseNo,
  //         dftxno: dftxno,
  //         invoiceNo: policy.invoiceNo,
  //         ovamt: policy.ovout2_amt,
  //         ovtaxamt: policy.ovout2_taxamt,
  //         totalamt: totalamt,
  //         //  duedate: dueDate,
  //         duedate: dueDateCommout,
  //         netgrossprem: policy.netgrossprem,
  //         duty: policy.duty,
  //         tax: policy.tax,
  //         totalprem: policy.totalprem,
  //         txtype2: 1,
  //         seqno: 1,
  //         mainaccountcode: policy.agentCode2,
  //         withheld: policy.withheld,

  //       },
  //       transaction: t,
  //       type: QueryTypes.INSERT
  //     }
  //   );

  // }

//#endregion





}
const createjupgrMinor = async (policy, t, usercode) => {
  console.log("------------ begin createjupgrMinor() ---------------");
  const advisor = policy.installment.advisor
  // const insurer = policy.installment.insurer
  const arrIns = []
  const arrAds = []
  const currentdate = getCurrentDate()
  let dftxno = policy.policyNo
  if (policy.endorseNo) {
    dftxno = policy.endorseNo
  }
  console.log("dftxno : " + dftxno);
  console.log("-------------  create dup jupgr minor -------------");

  // กรณีสลักหลังภายนอกมาใช้ แต่ตอนนี้สร้างแยกกันแล้ว -> createjupgrEndorseInstall
  // if (policy.endorseseries > 0) {
  //   await sequelize.query(
  //     `DO $$ 
  //   Begin

  //   -- Select data from the source table installment = 'A'
  //   CREATE TEMPORARY TABLE temp_dataA AS
  //   SELECT bj."policyNo", bj."invoiceNo", bj."taxInvoiceNo", bj."installmenttype", bj."seqNo", bj."grossprem", bj."specdiscrate", bj."specdiscamt",
  //            bj."netgrossprem", bj."tax", bj."duty", bj."totalprem", bj."commin_rate", bj."commin_amt", bj."ovin_rate", bj."ovin_amt", 
  //            bj."commin_taxamt", bj."ovin_taxamt", bj."agentCode", bj."agentCode2", bj."commout1_rate", bj."commout1_amt", bj."ovout1_rate", bj."ovout1_amt",
  //            bj."commout2_rate", bj."commout2_amt", bj."ovout2_rate", bj."ovout2_amt", bj."commout_rate", bj."commout_amt", bj."ovout_rate", bj."ovout_amt", 
  //            bj."withheld", bj."commout1_taxamt", bj."ovout1_taxamt", bj."commout2_taxamt", bj."ovout2_taxamt", bj."commout_taxamt", bj."ovout_taxamt", 
  //            bj."lastprintdate", bj."lastprintuser", bj."polid", bj."endorseNo", bj."createusercode", bj."dftxno"
  //   -- INTO TEMPORARY TABLE temp_data
  //   FROM static_data.b_jupgrs bj 
  //   -- left join static_data."Transactions" t on t."policyNo" = bj."policyNo" and t.dftxno = bj.dftxno and t."seqNo" =bj."seqNo" and t."transType" ='PREM-IN' 
  //   WHERE bj.dftxno in (select distinct("dftxno") from static_data."Transactions" t where txtype2 in (2, 3, 4, 5));
  //   -- bj.polid = 12863
  //   -- and installmenttype  = 'A'
  //   -- and t.status ='N'
  //   -- and t.dfrpreferno is not null; -- Add your condition to filter the rows as needed
    
  //   -- Update the selected data
  //   UPDATE temp_dataA
  //   SET polid = ${policy.polid},
  //       "endorseNo" = '${policy.endorseNo}',
  //       createusercode = '${usercode}' ; -- Add your condition to filter the rows as needed
    
  //   -- Insert the updated data into the destination table
  //   INSERT INTO static_data.b_jupgrs  ("policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
  //            "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
  //            "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
  //            "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
  //            "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
  //            "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno")
  //   SELECT "policyNo", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", "grossprem", "specdiscrate", "specdiscamt",
  //            "netgrossprem", "tax", "duty", "totalprem", "commin_rate", "commin_amt", "ovin_rate", "ovin_amt", 
  //            "commin_taxamt", "ovin_taxamt", "agentCode", "agentCode2", "commout1_rate", "commout1_amt", "ovout1_rate", "ovout1_amt",
  //            "commout2_rate", "commout2_amt", "ovout2_rate", "ovout2_amt", "commout_rate", "commout_amt", "ovout_rate", "ovout_amt", 
  //            "withheld", "commout1_taxamt", "ovout1_taxamt", "commout2_taxamt", "ovout2_taxamt", "commout_taxamt", "ovout_taxamt", 
  //            "lastprintdate", "lastprintuser", "polid", "endorseNo", "createusercode", "dftxno"
  //   FROM temp_dataA;

  //   END $$;`, {
  //     transaction: t,
  //     raw: true
  //   })
  // }

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
  // policy.taxInvoiceNo = 'TAXINV' + await getRunNo('taxinv',null,null,'kwan',currentdate,t);
  // if (policy.installment.advisor.length === 0) {
  //   policy.invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}` + String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')
  //   policy.taxInvoiceNo = 'TAXINV' + await getRunNo('taxinv', null, null, 'kwan', currentdate, t);
  //   const ads = await sequelize.query(
  //     `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno" , "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", grossprem, 
  //   specdiscrate, specdiscamt, netgrossprem, tax, duty, totalprem,
  //    commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
  //   "agentCode", "agentCode2", commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, 
  //   commout2_rate, commout2_amt, ovout2_rate, ovout2_amt,
  //    commout_rate, commout_amt, ovout_rate, ovout_amt, 
  //    commout1_taxamt, ovout1_taxamt,  commout2_taxamt, ovout2_taxamt,  commout_taxamt, ovout_taxamt, 
  //    createusercode, polid, withheld)
  //   values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, :grossprem, :specdiscrate, :specdiscamt, :netgrossprem, 
  //   :tax, :duty, :totalprem, :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt,
  //    :agentCode, :agentCode2, :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,
  //     :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt,
  //    :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
  //     :commout1_taxamt, :ovout1_taxamt,  :commout2_taxamt, :ovout2_taxamt,  :commout_taxamt, :ovout_taxamt, 
  //      :createusercode, :polid, :withheld )`,
  //     {
  //       replacements: {
  //         policyNo: policy.policyNo,
  //         endorseNo: policy.endorseNo,
  //         dftxno: dftxno,
  //         invoiceNo: policy.invoiceNo,
  //         taxInvoiceNo: policy.taxInvoiceNo,
  //         installmenttype: 'A',
  //         seqNo: 1,
  //         grossprem: policy[`grossprem`],
  //         specdiscrate: policy[`specdiscrate`],
  //         specdiscamt: policy[`specdiscamt`],
  //         netgrossprem: policy[`netgrossprem`],
  //         duty: policy[`duty`],
  //         tax: policy[`tax`],
  //         totalprem: policy[`totalprem`],
  //         commin_rate: policy[`commin_rate`],
  //         commin_amt: policy[`commin_amt`],
  //         commin_taxamt: policy[`commin_taxamt`],
  //         ovin_rate: policy[`ovin_rate`],
  //         ovin_amt: policy[`ovin_amt`],
  //         ovin_taxamt: policy[`ovin_taxamt`],
  //         agentCode: policy.agentCode,
  //         agentCode2: policy.agentCode2,

  //         commout1_rate: policy[`commout1_rate`],
  //         commout1_amt: policy[`commout1_amt`],
  //         ovout1_rate: policy[`ovout1_rate`],
  //         ovout1_amt: policy[`ovout1_amt`],
  //         commout2_rate: policy[`commout2_rate`],
  //         commout2_amt: policy[`commout2_amt`],
  //         ovout2_rate: policy[`ovout2_rate`],
  //         ovout2_amt: policy[`ovout2_amt`],
  //         commout_rate: policy[`commout_rate`],
  //         commout_amt: policy[`commout_amt`],
  //         ovout_rate: policy[`ovout_rate`],
  //         ovout_amt: policy[`ovout_amt`],

  //         commout1_taxamt: policy[`commout1_taxamt`],
  //         ovout1_taxamt: policy[`ovout1_taxamt`],
  //         commout2_taxamt: policy[`commout2_taxamt`],
  //         ovout2_taxamt: policy[`ovout2_taxamt`],
  //         commout_taxamt: policy[`commout_taxamt`],
  //         ovout_taxamt: policy[`ovout_taxamt`],

  //         createusercode: usercode,
  //         withheld: policy['withheld'],
  //         polid: policy['polid']
  //       },

  //       transaction: t,
  //       type: QueryTypes.INSERT
  //     }
  //   )
  //   arrAds.push[ads]
  // }
  //console.log(policy);

  // installment advisor 
  if (advisor.length >= 1) {
    for (let i = 0; i < advisor.length; i++) {

      // advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')}`;
      advisor[i].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${await getRunNo('inv', null, null, 'kwan', currentdate, t)}`;

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
      //insert jupgr
      const ads = await sequelize.query(
        `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno" , "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", 
         grossprem, specdiscrate, specdiscamt, 
        netgrossprem, tax, duty, totalprem, 
        commin_rate, commin_amt, ovin_rate, ovin_amt,
       commin_taxamt,  ovin_taxamt, 
        "agentCode", "agentCode2", 
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
        commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
        commout_rate, commout_amt, ovout_rate, ovout_amt, 
       commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
        createusercode, polid, withheld)
        values(:policyNo, :endorseNo, :dftxno, :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
        :grossprem, :specdiscrate, :specdiscamt, 
        :netgrossprem, :tax, :duty, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, 
        :commin_taxamt, :ovin_taxamt,
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
            grossprem: advisor[i].grossprem,
            specdiscrate: 0,
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
            specdiscamt: advisor[i][`specdiscamt`],
            withheld: advisor[i][`withheld`],
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
  } else {

    // advisor[0].invoiceNo = `${insureInvoiceCode.invoiceCode}-${insurerInvoiceCode.invoiceCode}-${getCurrentYYMM()}${String(await getRunNo('inv', null, null, 'kwan', currentdate, t)).padStart(5, '0')}`;
    // advisor[0].taxInvoiceNo = null
    // // let withheld = 0
    // // let specdiscamt = 0 
    // // let commout1_amt = 0
    // // let ovout1_amt = 0
    // // let commout2_amt = 0
    // // let ovout2_amt = 0
    // // let commout_amt = 0
    // // let ovout_amt = 0
    // // if (i === 0) {
    // //   withheld = policy.withheld
    // //   specdiscamt = policy.specdiscamt
    // //   commout1_amt =  policy[`commout1_amt`]
    // //   ovout1_amt =  policy[`ovout1_amt`]
    // //   commout2_amt =  policy[`commout2_amt`]
    // //   ovout2_amt =  policy[`ovout2_amt`]
    // //   commout_amt =  policy[`commout_amt`]
    // //   ovout_amt =  policy[`ovout_amt`]

    // // }

    // //insert jupgr
    // const ads = await sequelize.query(
    //   `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno" , "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo", 
    //    grossprem, specdiscrate, specdiscamt, 
    //   netgrossprem, tax, duty, totalprem, 
    //   -- commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
    //   "agentCode", "agentCode2", 
    //   commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
    //   commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
    //   commout_rate, commout_amt, ovout_rate, ovout_amt, 
    //   -- commout1_taxamt,  ovout1_taxamt, commout2_taxamt,  ovout2_taxamt, commout_taxamt,  ovout_taxamt,
    //   createusercode, polid, withheld)
    //   values(:policyNo, :endorseNo, :dftxno , :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
    //   :grossprem, :specdiscrate, :specdiscamt, 
    //   :netgrossprem, :tax, :duty, :totalprem, 
    //   -- :commin_rate, :commin_amt, :commin_taxamt, :ovin_rate, :ovin_amt, :ovin_taxamt,
    //   :agentCode, :agentCode2,
    //   :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt, 
    //   :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt,  
    //   :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
    //   -- :commout1_taxamt,  :ovout1_taxamt, :commout2_taxamt,  :ovout2_taxamt, :commout_taxamt,  :ovout_taxamt, 
    //   :createusercode, :polid, :withheld )`,
    //   {
    //     replacements: {
    //       policyNo: policy.policyNo,
    //       endorseNo: policy.endorseNo,
    //       dftxno: dftxno,
    //       polid: policy.polid,
    //       invoiceNo: advisor[0].invoiceNo,
    //       taxInvoiceNo: advisor[0].taxInvoiceNo,
    //       installmenttype: 'A',
    //       seqNo: 1,
    //       grossprem: policy.grossprem,
    //       specdiscrate: 0,
    //       netgrossprem: policy.netgrossprem,
    //       duty: policy.duty,
    //       tax: policy.tax,
    //       totalprem: policy.totalprem,
    //       // commin_rate: policy[`commin_rate`],
    //       // commin_amt: advisor[i][`commin_amt`],
    //       // commin_taxamt: advisor[i][`commin_taxamt`], 
    //       // ovin_rate: policy[`ovin_rate`],
    //       // ovin_amt: advisor[i][`ovin_amt`],
    //       // ovin_taxamt: advisor[i][`ovin_taxamt`],
    //       agentCode: policy.agentCode,
    //       agentCode2: policy.agentCode2,
    //       commout1_rate: policy[`commout1_rate`],
    //       ovout1_rate: policy[`ovout1_rate`],
    //       commout2_rate: policy[`commout2_rate`],
    //       ovout2_rate: policy[`ovout2_rate`],
    //       commout_rate: policy[`commout_rate`],
    //       ovout_rate: policy[`ovout_rate`],

    //       // commout1_amt: advisor[i][`commout1_amt`],
    //       // ovout1_amt: advisor[i][`ovout1_amt`],
    //       // commout2_amt: advisor[i][`commout2_amt`],
    //       // ovout2_amt: advisor[i][`ovout2_amt`],
    //       // commout_amt: advisor[i][`commout_amt`],
    //       // ovout_amt: advisor[i][`ovout_amt`],
    //       commout1_amt: policy.commout1_amt,
    //       ovout1_amt: policy.ovout1_amt,
    //       commout2_amt: policy.commout2_amt,
    //       ovout2_amt: policy.ovout2_amt,
    //       commout_amt: policy.commout_amt,
    //       ovout_amt: policy.ovout_amt,

    //       createusercode: usercode,
    //       specdiscamt: policy.specdiscamt,
    //       withheld: policy.withheld,
    //       // tax wth3%
    //       // commout1_taxamt: advisor[i][`commout1_taxamt`],
    //       // ovout1_taxamt: advisor[i][`ovout1_taxamt`],
    //       // commout2_taxamt: advisor[i][`commout2_taxamt`],
    //       // ovout2_taxamt: advisor[i][`ovout2_taxamt`],
    //       // commout_taxamt: advisor[i][`commout_taxamt`],
    //       // ovout_taxamt: advisor[i][`ovout_taxamt`],

    //     },

    //     transaction: t,
    //     type: QueryTypes.INSERT
    //   }
    // )
    // arrAds.push[ads]
  }
  // installment insurer
  //insert jupgr
  const ins = await sequelize.query(
    `insert into static_data.b_jupgrs ("policyNo", "endorseNo", "dftxno", "invoiceNo", "taxInvoiceNo", "installmenttype", "seqNo",
      grossprem, specdiscrate, specdiscamt, 
      netgrossprem, tax, duty, totalprem, commin_rate, commin_amt, commin_taxamt, ovin_rate, ovin_amt, ovin_taxamt, 
      "agentCode", "agentCode2", createusercode, polid, withheld,
      commout1_rate, commout1_amt, ovout1_rate, ovout1_amt,
      commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, 
      commout_rate, commout_amt, ovout_rate, ovout_amt )
      values(:policyNo, :endorseNo, :dftxno , :invoiceNo, :taxInvoiceNo, :installmenttype, :seqNo, 
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
        dftxno: dftxno,
        invoiceNo: policy.invoiceNo,
        polid: policy.polid,
        taxInvoiceNo: policy.taxInvoiceNo,
        installmenttype: 'I',
        seqNo: 1,
        grossprem: policy.grossprem,
        specdiscrate: policy.specdiscrate,
        specdiscamt: policy.specdiscamt,
        netgrossprem: policy.netgrossprem,
        duty: policy.duty,
        tax: policy.tax,
        totalprem: policy.totalprem,
        commin_rate: policy[`commin_rate`],
        commin_amt: policy[`commin_amt`],
        commin_taxamt: policy[`commin_taxamt`],
        ovin_rate: policy[`ovin_rate`],
        ovin_amt: policy[`ovin_amt`],
        ovin_taxamt: policy[`ovin_taxamt`],
        agentCode: policy.agentCode,
        agentCode2: policy.agentCode2,
        createusercode: usercode,
        withheld: policy['withheld'],

        commout1_rate: policy[`commout1_rate`],
        ovout1_rate: policy[`ovout1_rate`],
        commout2_rate: policy[`commout2_rate`],
        ovout2_rate: policy[`ovout2_rate`],
        commout_rate: policy[`commout_rate`],
        ovout_rate: policy[`ovout_rate`],
        
        commout1_amt: policy[`commout1_amt`],
        ovout1_amt: policy[`ovout1_amt`],
        commout2_amt: policy[`commout2_amt`],
        ovout2_amt: policy[`ovout2_amt`],
        commout_amt: policy[`commout_amt`],
        ovout_amt: policy[`ovout_amt`],

        commout1_taxamt: policy[`commout1_taxamt`],
        ovout1_taxamt: policy[`ovout1_taxamt`],
        commout2_taxamt: policy[`commout2_taxamt`],
        ovout2_taxamt: policy[`ovout2_taxamt`],
        commout_taxamt: policy[`commout_taxamt`],
        ovout_taxamt: policy[`ovout_taxamt`],



      },

      transaction: t,
      type: QueryTypes.INSERT
    }
  )
  arrIns.push(ins)





  return { insurer: arrIns, advisor: arrAds }

}
const editApplication = async (req, res) => {
  console.log(`----------- begin editApplication()  ----------------`);
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  for (let i = 0; i < req.body.length; i++) {
    //create entity 
    const t = await sequelize.transaction();
    try {

      // check duplicate entity if idcard type = 'บัตรประชาชน'
      let entity
      let checkEntity
      // req.body[i].version  =  1
      // if (req.body[i].personType === 'P') {

      //   checkEntity =  await sequelize.query(
      //     `select * from static_data."Entities" 
      //     where "personType" = 'P' and "idCardType" = 'บัตรประชาชน' and "idCardNo" = :idCardNo and lastversion = 'Y' order by version DESC` ,
      //     {
      //       replacements: {
      //         idCardNo: req.body[i].idCardNo,
      //       },
      //       transaction: t,
      //       type: QueryTypes.SELECT
      //     })
      //     if (checkEntity.length > 0){
      //       if(checkEntity[0].titleID === req.body[i].titleID && checkEntity[0].t_firstName === req.body[i].t_firstName && checkEntity[0].t_lastName === req.body[i].t_lastName) {
      //         req.body[i].version = checkEntity[0].version 
      //       }else{
      //         req.body[i].version = checkEntity[0].version + 1
      //         await sequelize.query(
      //           ` UPDATE static_data."Entities" 
      //           SET lastversion  ='N'
      //           where  id = :oldid ` ,
      //           {
      //             replacements: {
      //               oldid: checkEntity[0].id,
      //             },
      //             transaction: t,
      //             type: QueryTypes.UPDATE
      //           })
      //       }
      //     }


      //     entity =   await sequelize.query(
      //         `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
      //         values (:personType, :titleID, :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
      //         ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
      //         {
      //           replacements: {
      //             personType: req.body[i].personType,
      //             titleID: req.body[i].titleID,
      //             t_firstName: req.body[i].t_firstName,
      //             t_lastName: req.body[i].t_lastName,
      //             idCardType: req.body[i].idCardType,
      //             idCardNo: req.body[i].idCardNo,

      //             version : req.body[i].version,
      //             email: req.body[i].email,
      //           },
      //           transaction: t,
      //           type: QueryTypes.INSERT
      //         }
      //       )




      // }else if (req.body[i].personType === 'O'){
      //   entity = await sequelize.query(
      //     `insert into static_data."Entities" ("personType","titleID","t_ogName","taxNo",email, branch, "t_branchName","vatRegis") 
      //     values (:personType, :titleID, :t_ogName,:taxNo,:email, :branch, :t_branchName, true) 
      //     ON CONFLICT ON CONSTRAINT "taxNo" DO NOTHING  RETURNING "id" `,
      //     {
      //       replacements: {
      //         personType: req.body[i].personType,
      //         titleID: req.body[i].titleID,
      //         t_ogName: req.body[i].t_ogName,
      //         taxNo: req.body[i].taxNo,
      //         email: req.body[i].email,
      //         branch: req.body[i].branch,
      //         t_branchName: req.body[i].t_branchName,
      //       },
      //       transaction: t,
      //       type: QueryTypes.INSERT
      //     }
      //   )
      // }

      // update entity
      entity = await sequelize.query(
        `update static_data."Entities" set
       "personType" = :personType,
       "titleID" = :titleID,
       "t_firstName" = :t_firstName,
       "t_lastName" = :t_lastName,
       "idCardType" = :idCardType,
       "idCardNo" = :idCardNo,
        email = :email,
        version = :version,
        "t_ogName" = :t_ogName,
        "taxNo" = :taxNo,
         branch = :branch,
        "t_branchName" = :t_branchName
        where id = :entityID
      -- ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
        {
          replacements: {
            personType: req.body[i].personType,
            titleID: req.body[i].titleID,
            t_firstName: req.body[i].t_firstName,
            t_lastName: req.body[i].t_lastName,
            idCardType: req.body[i].idCardType,
            idCardNo: req.body[i].idCardNo,
            version: req.body[i].version,
            email: req.body[i].email,
            t_ogName: req.body[i].t_ogName,
            taxNo: req.body[i].taxNo,
            branch: req.body[i].branch,
            t_branchName: req.body[i].t_branchName,
            entityID: req.body[i].entityID,
          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )

      // console.log(entity);
      // let insureeCode
      // if (entity[1] === 1) {   // entity[1] === 1 when create new entity


      //   const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode:  entity[0][0].id }, { returning: ['insureeCode'], transaction: t })

      //   insureeCode = insuree['dataValues'].insureeCode

      //   //create location
      //   await sequelize.query(

      //     'INSERT INTO static_data."Locations" ("entityID", "t_location_1", "t_location_2", "t_location_3", "t_location_4", "t_location_5", "provinceID", "districtID", "subDistrictID", "zipcode", "telNum_1","locationType") ' +
      //     'values(:entityID, :t_location_1, :t_location_2,  :t_location_3, :t_location_4, :t_location_5, ' +
      //     '(select "provinceid" from static_data.provinces where t_provincename = :province limit 1), ' +
      //     '(select "amphurid" from static_data."Amphurs" where t_amphurname = :district limit 1), ' +
      //     '(select "tambonid" from static_data."Tambons" where t_tambonname = :tambon limit 1), ' +
      //     ':zipcode, :tel_1, :locationType) ',
      //     {
      //       replacements: {
      //         entityID: entity[0][0].id,
      //         t_location_1: req.body[i].t_location_1,
      //         t_location_2: req.body[i].t_location_2,
      //         t_location_3: req.body[i].t_location_3,
      //         t_location_4: req.body[i].t_location_4,
      //         t_location_5: req.body[i].t_location_5,
      //         province: req.body[i].province,
      //         district: req.body[i].district,
      //         tambon: req.body[i].subdistrict,
      //         zipcode: req.body[i].zipcode.toString(),
      //         tel_1: req.body[i].telNum_1,
      //         locationType: 'A'
      //       },
      //       transaction: t,
      //       type: QueryTypes.INSERT
      //     }
      //   )
      // } else {
      //   //select insuree
      //   let conInsuree = ''
      //   if (req.body[i].personType === "P") {
      //     conInsuree = `ent."personType" = 'P' and ent."idCardNo" = :idCardNo 
      //                   and ent."titleID" = :titleID and ent."t_firstName" = :t_firstName 
      //                   and ent."t_lastName" = :t_lastName and ent."idCardType" = :idCardType`
      //   }else[
      //     conInsuree = `ent."personType" = 'O' and ent."taxNo" = :taxNo 
      //                   and ent."titleID" = :titleID and ent."t_ogName" = :t_ogName 
      //                   and ent."branch" = :branch `
      //   ]
      //   const insuree = await sequelize.query(
      //     `select * FROM static_data."Insurees" ins JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
      //      WHERE ${conInsuree}`,
      //     { replacements: { 
      //                     idCardNo: req.body[i].idCardNo ,
      //                     taxNo: req.body[i].taxNo ,
      //                     titleID: req.body[i].titleID ,
      //                     t_firstName: req.body[i].t_firstName ,
      //                     t_lastName: req.body[i].t_lastName ,
      //                     t_ogName: req.body[i].t_ogName ,
      //                     branch: req.body[i].branch ,
      //                     idCardType: req.body[i].idCardType ,
      //     },  transaction: t, type: QueryTypes.SELECT })

      //  insureeCode = insuree[0].insureeCode


      // }

      //update location
      await sequelize.query(

        `update static_data."Locations" set 
  "t_location_1" = :t_location_1,
  "t_location_2" = :t_location_2,
  "t_location_3" = :t_location_3,
  "t_location_4" = :t_location_4,
  "t_location_5" = :t_location_5, 
  "provinceID" = (select "provinceid" from static_data.provinces where t_provincename = :province limit 1), 
  "districtID" = (select "amphurid" from static_data."Amphurs" where t_amphurname = :district limit 1), 
  "subDistrictID" = (select "tambonid" from static_data."Tambons" where t_tambonname = :tambon limit 1), 
  "zipcode" = :zipcode, 
  "telNum_1" = :tel_1,
  "locationType" = :locationType
  where "entityID" = :entityID and "locationType" = 'A' `,
        {
          replacements: {
            entityID: req.body[i].entityID,
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
          type: QueryTypes.UPDATE
        }
      )
      //insert new car or select
      let cars = [{ id: null }]

    console.log();
      if (req.body[i].class === 'MO') {
        // cars = await sequelize.query(
        //   `WITH inserted AS ( 
        //   INSERT INTO static_data."Motors" ("brand", "voluntaryCode", "model", "specname", "licenseNo", "motorprovinceID", "chassisNo", "modelYear",
        //   "compulsoryCode", "unregisterflag", "engineNo", "cc", "seat", "gvw"  ) 
        //   VALUES (:brandname, :voluntaryCode , :modelname , :specname, :licenseNo, 
        //    (select provinceid from static_data.provinces  where t_provincename =  :motorprovince limit 1), :chassisNo, :modelYear,
        //   :compulsoryCode, :unregisterflag, :engineNo, :cc, :seat, :gvw  ) ON CONFLICT ("chassisNo") DO NOTHING RETURNING * ) 
        //   SELECT * FROM inserted UNION ALL SELECT * FROM static_data."Motors" WHERE "chassisNo" = :chassisNo `,
        //   {
        //     replacements: {
        //       brandname: req.body[i].brandname || null,
        //       voluntaryCode: req.body[i].voluntaryCode|| '',
        //       modelname: req.body[i].modelname || null,
        //       specname: req.body[i].specname || null,
        //       licenseNo: req.body[i].licenseNo || null,
        //       motorprovince: req.body[i].motorprovinceID,
        //       chassisNo: req.body[i].chassisNo,
        //       modelYear: req.body[i].modelYear,

        //       compulsoryCode : req.body[i].compulsoryCode || '',
        //       unregisterflag : req.body[i].unregisterflag || 'N',
        //       engineNo : req.body[i].engineNo || '',
        //       cc : req.body[i].cc || null,
        //       seat : req.body[i].seat || null,
        //       gvw : req.body[i].gvw || null,
        //     },
        //     transaction: t,
        //     type: QueryTypes.SELECT
        //   }
        // )

       

        if (req.params.type === 'fleet') {
            for (let j = 0; j < req.body[i].motorData.length; j++) {
              const motorData = req.body[i].motorData[j]
              //update motor
           cars = await sequelize.query(
            `DO $$ 
                DECLARE
                  temp_motor_id INTEGER;
                  inserted_motor_id INTEGER;
                begin

                  Delete from static_data."FleetGroups" where "groupCode" = ${req.body[i].itemList} ;  

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

                        insert into static_data."FleetGroups" ("groupCode", "type", "itemID") values(${req.body[i].itemList} , 'Motors', inserted_motor_id ) ;
                        
                    else 
                      insert into static_data."Motors" ( "brand", "voluntaryCode", "model", "specname"
                      ,"licenseNo", "motorprovinceID", "chassisNo", "modelYear", "compulsoryCode", "unregisterflag"
                      , "engineNo", "cc", "seat", "gvw", "addition_access", "chassisNo")
                      values ('${motorData.brand}', '${motorData.voluntaryCode}', '${motorData.model}', '${motorData.specname}', '${motorData.licenseNo}'
                      , (select provinceid from static_data.provinces  where t_provincename =  '${motorData.motorprovince}' limit 1)
                      , '${motorData.chassisNo}', ${motorData.modelYear}, '${motorData.compulsoryCode}', '${motorData.unregisterflag}', '${motorData.engineNo}', ${motorData.cc}
                      , ${motorData.seat}, ${motorData.gvw}, '${motorData.addition_access}', '${motorData.chassisNo}') RETURNING id INTO inserted_motor_id ;

                      insert into static_data."FleetGroups" ("groupCode", "type", "itemID") values(${req.body[i].itemList} , 'Motors', inserted_motor_id ) ;
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
                itemList : req.body[i].itemList
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
              brandname: req.body[i].brandname || null,
              voluntaryCode: req.body[i].voluntaryCode || '',
              modelname: req.body[i].modelname || null,
              specname: req.body[i].specname || null,
              licenseNo: req.body[i].licenseNo || null,
              motorprovince: req.body[i].motorprovinceID,
              chassisNo: req.body[i].chassisNo,
              modelYear: req.body[i].modelYear,
              itemList: req.body[i].itemList,
              compulsoryCode: req.body[i].compulsoryCode || '',
              unregisterflag: req.body[i].unregisterflag || 'N',
              engineNo: req.body[i].engineNo || '',
              cc: req.body[i].cc || null,
              seat: req.body[i].seat || null,
              gvw: req.body[i].gvw || null,
            },
            transaction: t,
            type: QueryTypes.SELECT
          }
        )

        }
  

      }

       //#region set comm ov wht3%
       const agentPersonType = await sequelize.query(
        `select static_data.getagentpersontype(:agentCode) as "personType1" 
        ,static_data.getagentpersontype(:agentCode2) as "personType2" `,
        {
          replacements: {
            agentCode: req.body[i].agentCode,
            agentCode2: req.body[i].agentCode2,
          },
          transaction: t,
          type: QueryTypes.SELECT
        }
      )

      req.body[i][`commin_taxamt`] = parseFloat((req.body[i][`commin_amt`] *wht).toFixed(2))
      req.body[i][`ovin_taxamt`] = parseFloat((req.body[i][`ovin_amt`] *wht).toFixed(2))
    
    if (agentPersonType[0].personType1 === 'O') {
      req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *wht).toFixed(2))
      req.body[i][`ovout1_taxamt`] = parseFloat((req.body[i][`ovout1_amt`] *wht).toFixed(2))
    }

    if (agentPersonType[0].personType2 === 'O') {
      req.body[i][`commout1_taxamt`] = parseFloat((req.body[i][`commout1_amt`] *wht).toFixed(2))
      req.body[i][`ovout2_taxamt`] = parseFloat((req.body[i][`ovout2_amt`] *wht).toFixed(2))
    }

    req.body[i][`commout_taxamt`] = parseFloat(req.body[i][`commout1_taxamt`]) +parseFloat(req.body[i][`commout2_taxamt`])
    req.body[i][`ovout_taxamt`] = parseFloat(req.body[i][`ovout1_taxamt`]) +parseFloat(req.body[i][`ovout2_taxamt`])
    //#endregion

      //update policy
      await sequelize.query(
        `update static_data."Policies" set  
       "insurerCode" = :insurerCode,
       "agentCode" = :agentCode,
       "agentCode2" = :agentCode2,
       "insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ),
       "actDate" = :actDate, 
       "expDate" = :expDate,
       grossprem = :grossprem, duty = :duty, tax = :tax, totalprem = :totalprem, 
      commin_rate = :commin_rate, commin_amt = :commin_amt, ovin_rate = :ovin_rate, ovin_amt = :ovin_amt, 
      commin_taxamt = :commin_taxamt, ovin_taxamt = :ovin_taxamt, 
      commout_rate = :commout_rate, commout_amt = :commout_amt, ovout_rate =:ovout_rate, ovout_amt = :ovout_amt,
      commout1_taxamt = :commout1_taxamt, ovout1_taxamt = :ovout1_taxamt, 
      commout2_taxamt = :commout2_taxamt, ovout2_taxamt = :ovout2_taxamt, 
      commout_taxamt = :commout_taxamt, ovout_taxamt = :ovout_taxamt,
      commout1_rate = :commout1_rate, commout1_amt = :commout1_amt, ovout1_rate = :ovout1_rate, ovout1_amt = :ovout1_amt, 
      commout2_rate = :commout2_rate, commout2_amt = :commout2_amt, ovout2_rate = :ovout2_rate, ovout2_amt = :ovout2_amt, 
      netgrossprem = :netgrossprem, specdiscamt = :specdiscamt, cover_amt = :cover_amt, withheld = :withheld,
      duedateinsurer = :dueDateInsurer, duedateagent = :dueDateAgent,
      "fleetCode" = :fleetCode
      where "applicationNo" = :applicationNo `
        ,
        {
          replacements: {
            applicationNo: req.body[i].applicationNo,
            endorseseries: -99,
            fleetCode: req.body[i].fleetCode,
            // seqNoins: req.body[i].seqNoins,
            // seqNoagt: req.body[i].seqNoagt,
            // entityInsuree:
            // insureeCode: insureeCode,
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
            cover_amt: req.body[i][`cover_amt`],
            createusercode: usercode,
            // itemList: cars[0].id,
            itemList: req.body[i].itemList,
            withheld: req.body[i].withheld,
            dueDateInsurer: req.body[i].dueDateInsurer,
            dueDateAgent: req.body[i].dueDateAgent,
            commin_taxamt: req.body[i][`commin_taxamt`],
            ovin_taxamt: req.body[i][`ovin_taxamt`],
            commout1_taxamt: req.body[i][`commout1_taxamt`],
            ovout1_taxamt: req.body[i][`ovout1_taxamt`],
            commout2_taxamt: req.body[i][`commout2_taxamt`],
            ovout2_taxamt: req.body[i][`ovout2_taxamt`],
            commout_taxamt: req.body[i][`commout_taxamt`],
            ovout_taxamt: req.body[i][`ovout_taxamt`],


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
      await res.status(500).json({ status: 'error', describe: error, appNo: appNo });
      return "fail"

    }

  }

  await res.json({ status: 'success', appNo: appNo })


};

const editPolicyDetail = async (req, res) => {
  console.log(`----------- begin editApplication()  ----------------`);
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  const data = req.body
    //create entity 
    const t = await sequelize.transaction();
    try {

      // check duplicate entity if idcard type = 'บัตรประชาชน'
      let entity
      let checkEntity

      // update entity
      entity = await sequelize.query(
        `update static_data."Entities" set
       "personType" = :personType,
       "titleID" = :titleID,
       "t_firstName" = :t_firstName,
       "t_lastName" = :t_lastName,
       "idCardType" = :idCardType,
       "idCardNo" = :idCardNo,
        email = :email,
        version = :version,
        "t_ogName" = :t_ogName,
        "taxNo" = :taxNo,
         branch = :branch,
        "t_branchName" = :t_branchName
        where id = :entityID
      -- ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
        {
          replacements: {
            personType: data.personType,
            titleID: data.titleID,
            t_firstName: data.t_firstName,
            t_lastName: data.t_lastName,
            idCardType: data.idCardType,
            idCardNo: data.idCardNo,
            version: data.version,
            email: data.email,
            t_ogName: data.t_ogName,
            taxNo: data.taxNo,
            branch: data.branch,
            t_branchName: data.t_branchName,
            entityID: data.entityID,
          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )

      //update location
      await sequelize.query(

        `update static_data."Locations" set 
  "t_location_1" = :t_location_1,
  "t_location_2" = :t_location_2,
  "t_location_3" = :t_location_3,
  "t_location_4" = :t_location_4,
  "t_location_5" = :t_location_5, 
  "provinceID" = (select "provinceid" from static_data.provinces where t_provincename = :province limit 1), 
  "districtID" = (select "amphurid" from static_data."Amphurs" where t_amphurname = :district limit 1), 
  "subDistrictID" = (select "tambonid" from static_data."Tambons" where t_tambonname = :tambon limit 1), 
  "zipcode" = :zipcode, 
  "telNum_1" = :tel_1,
  "locationType" = :locationType
  where "entityID" = :entityID and "locationType" = 'A' `,
        {
          replacements: {
            entityID: data.entityID,
            t_location_1: data.t_location_1,
            t_location_2: data.t_location_2,
            t_location_3: data.t_location_3,
            t_location_4: data.t_location_4,
            t_location_5: data.t_location_5,
            province: data.province,
            district: data.district,
            tambon: data.subdistrict,
            zipcode: data.zipcode.toString(),
            tel_1: data.telNum_1,
            locationType: 'A'
          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )
      //insert new car or select
      let cars = [{ id: null }]

    console.log();
      if (data.class === 'MO') {
        

        if (req.params.type === 'fleet') {
            for (let j = 0; j < data.motorData.length; j++) {
              const motorData = data.motorData[j]
              //update motor
           cars = await sequelize.query(
            `DO $$ 
                DECLARE
                  temp_motor_id INTEGER;
                  inserted_motor_id INTEGER;
                begin

                  Delete from static_data."FleetGroups" where "groupCode" = ${data.itemList} ;  

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

                        insert into static_data."FleetGroups" ("groupCode", "type", "itemID") values(${data.itemList} , 'Motors', inserted_motor_id ) ;
                        
                    else 
                      insert into static_data."Motors" ( "brand", "voluntaryCode", "model", "specname"
                      ,"licenseNo", "motorprovinceID", "chassisNo", "modelYear", "compulsoryCode", "unregisterflag"
                      , "engineNo", "cc", "seat", "gvw", "addition_access", "chassisNo")
                      values ('${motorData.brand}', '${motorData.voluntaryCode}', '${motorData.model}', '${motorData.specname}', '${motorData.licenseNo}'
                      , (select provinceid from static_data.provinces  where t_provincename =  '${motorData.motorprovince}' limit 1)
                      , '${motorData.chassisNo}', ${motorData.modelYear}, '${motorData.compulsoryCode}', '${motorData.unregisterflag}', '${motorData.engineNo}', ${motorData.cc}
                      , ${motorData.seat}, ${motorData.gvw}, '${motorData.addition_access}', '${motorData.chassisNo}') RETURNING id INTO inserted_motor_id ;

                      insert into static_data."FleetGroups" ("groupCode", "type", "itemID") values(${data.itemList} , 'Motors', inserted_motor_id ) ;
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
                itemList : data.itemList
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
              brandname: data.brandname || null,
              voluntaryCode: data.voluntaryCode || '',
              modelname: data.modelname || null,
              specname: data.specname || null,
              licenseNo: data.licenseNo || null,
              motorprovince: data.motorprovinceID,
              chassisNo: data.chassisNo,
              modelYear: data.modelYear,
              itemList: data.itemList,
              compulsoryCode: data.compulsoryCode || '',
              unregisterflag: data.unregisterflag || 'N',
              engineNo: data.engineNo || '',
              cc: data.cc || null,
              seat: data.seat || null,
              gvw: data.gvw || null,
            },
            transaction: t,
            type: QueryTypes.SELECT
          }
        )

        }
  

      }

       //#region set comm ov wht3%
       const agentPersonType = await sequelize.query(
        `select static_data.getagentpersontype(:agentCode) as "personType1" 
        ,static_data.getagentpersontype(:agentCode2) as "personType2" `,
        {
          replacements: {
            agentCode: data.agentCode,
            agentCode2: data.agentCode2,
          },
          transaction: t,
          type: QueryTypes.SELECT
        }
      )

      data[`commin_taxamt`] = parseFloat((data[`commin_amt`] *wht).toFixed(2))
      data[`ovin_taxamt`] = parseFloat((data[`ovin_amt`] *wht).toFixed(2))
    
    if (agentPersonType[0].personType1 === 'O') {
      data[`commout1_taxamt`] = parseFloat((data[`commout1_amt`] *wht).toFixed(2))
      data[`ovout1_taxamt`] = parseFloat((data[`ovout1_amt`] *wht).toFixed(2))
    }

    if (agentPersonType[0].personType2 === 'O') {
      data[`commout1_taxamt`] = parseFloat((data[`commout1_amt`] *wht).toFixed(2))
      data[`ovout2_taxamt`] = parseFloat((data[`ovout2_amt`] *wht).toFixed(2))
    }

    data[`commout_taxamt`] = parseFloat(data[`commout1_taxamt`]) +parseFloat(data[`commout2_taxamt`])
    data[`ovout_taxamt`] = parseFloat(data[`ovout1_taxamt`]) +parseFloat(data[`ovout2_taxamt`])
    //#endregion

      //update policy
      await sequelize.query(
        `update static_data."Policies" set  
       "insurerCode" = :insurerCode,
       "agentCode" = :agentCode,
       "agentCode2" = :agentCode2,
       "insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ),
       "actDate" = :actDate, 
       "expDate" = :expDate,
       grossprem = :grossprem, duty = :duty, tax = :tax, totalprem = :totalprem, 
      commin_rate = :commin_rate, commin_amt = :commin_amt, ovin_rate = :ovin_rate, ovin_amt = :ovin_amt, 
      commin_taxamt = :commin_taxamt, ovin_taxamt = :ovin_taxamt, 
      commout_rate = :commout_rate, commout_amt = :commout_amt, ovout_rate =:ovout_rate, ovout_amt = :ovout_amt,
      commout1_taxamt = :commout1_taxamt, ovout1_taxamt = :ovout1_taxamt, 
      commout2_taxamt = :commout2_taxamt, ovout2_taxamt = :ovout2_taxamt, 
      commout_taxamt = :commout_taxamt, ovout_taxamt = :ovout_taxamt,
      commout1_rate = :commout1_rate, commout1_amt = :commout1_amt, ovout1_rate = :ovout1_rate, ovout1_amt = :ovout1_amt, 
      commout2_rate = :commout2_rate, commout2_amt = :commout2_amt, ovout2_rate = :ovout2_rate, ovout2_amt = :ovout2_amt, 
      netgrossprem = :netgrossprem, specdiscamt = :specdiscamt, cover_amt = :cover_amt, withheld = :withheld,
      duedateinsurer = :dueDateInsurer, duedateagent = :dueDateAgent,
      "fleetCode" = :fleetCode,
      -- add new
       "policyNo" = :policyNo,"policyDate" = :policyDate,
      "seqNoins" = :seqNoins, "seqNoagt" = :seqNoagt,"policyType" = :policyType
      where "applicationNo" = :applicationNo `
        ,
        {
          replacements: {
            applicationNo: data.applicationNo,
            policyNo: data.policyNo,
            policyDate: data.policyDate,
            //endorseseries: -99,
            fleetCode: data.fleetCode,
            seqNoins: data.seqNoins,
            seqNoagt: data.seqNoagt,
            policyType: data.policyType,
            // entityInsuree:
            // insureeCode: insureeCode,
            insurerCode: data.insurerCode,
            class: data.class,
            subClass: data.subClass,
            agentCode: data.agentCode,
            agentCode2: data.agentCode2,
            actDate: data.actDate,
            expDate: data.expDate,
            grossprem: data.grossprem,
            netgrossprem: data.netgrossprem,
            duty: data.duty,
            tax: data.tax,
            totalprem: data.totalprem,
            specdiscrate: data[`specdiscrate`],
            specdiscamt: data[`specdiscamt`],
            commin_rate: data[`commin_rate`],
            commin_amt: data[`commin_amt`],
            ovin_rate: data[`ovin_rate`],
            ovin_amt: data[`ovin_amt`],
           
            commout_rate: data[`commout_rate`],
            commout_amt: data[`commout_amt`],
            ovout_rate: data[`ovout_rate`],
            ovout_amt: data[`ovout_amt`],
            commout1_rate: data[`commout1_rate`],
            commout1_amt: data[`commout1_amt`],
            ovout1_rate: data[`ovout1_rate`],
            ovout1_amt: data[`ovout1_amt`],
            commout2_rate: data[`commout2_rate`],
            commout2_amt: data[`commout2_amt`],
            ovout2_rate: data[`ovout2_rate`],
            ovout2_amt: data[`ovout2_amt`],
            cover_amt: data[`cover_amt`],
            createusercode: usercode,
            // itemList: cars[0].id,
            itemList: data.itemList,
            withheld: data.withheld,
            dueDateInsurer: data.dueDateInsurer,
            dueDateAgent: data.dueDateAgent,
            commin_taxamt: data[`commin_taxamt`],
            ovin_taxamt: data[`ovin_taxamt`],
            commout1_taxamt: data[`commout1_taxamt`],
            ovout1_taxamt: data[`ovout1_taxamt`],
            commout2_taxamt: data[`commout2_taxamt`],
            ovout2_taxamt: data[`ovout2_taxamt`],
            commout_taxamt: data[`commout_taxamt`],
            ovout_taxamt: data[`ovout_taxamt`],


          },
          transaction: t,
          type: QueryTypes.UPDATE
        }
      )

      // remove jupgr
      b_jupgrs = await sequelize.query(
          `select distinct "policyNo" ,dftxno  from static_data.b_jupgrs bj where polid = :polid;`,
          {
            replacements: {
              polid: data.polid || null
            },
            transaction: t,
            type: QueryTypes.SELECT
          }
        )
        for (let j = 0; j < b_jupgrs.length; j++) {
          const ele = b_jupgrs[j];
          await sequelize.query(
          `update static_data."Transactions" set
          status = 'C' where "policyNo" = :policyNo and dftxno = :dftxno;`,
          {
            replacements: {
              policyNo: ele.policyNo ,
              dftxno: ele.dftxno ,
            },
            transaction: t,
            type: QueryTypes.UPDATE
          }
        )
          await sequelize.query(
          `DELETE  from static_data.b_jupgrs  where "policyNo" = :policyNo and dftxno = :dftxno;`,
          {
            replacements: {
              policyNo: ele.policyNo ,
              dftxno: ele.dftxno ,
            },
            transaction: t,
            type: QueryTypes.DELETE
          }
        )
        }
        
      await createjupgrMinor(data, t, usercode)
      //insert transaction 
      await createTransectionMinor(data, t)

      await t.commit();


      
    } catch (error) {
      console.error(error)
      await t.rollback();
      await res.status(500).json({ status: 'error', describe: error, appNo: appNo });
      return "fail"

    }


console.log(`----------- end editApplication()  ----------------`);
  await res.json({ status: 'success', appNo: appNo })


};


// งาน interfacefrom aggritator
const externalPolicy = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const appNo = []
  let policyData = req.body
  const fleetCode = req.body.fleetCode

  //create entity 
  const t = await sequelize.transaction();
  try {
    // trim value in obj
    for (let key in policyData) {
      if (typeof policyData[key] === 'string') {
        policyData[key] = policyData[key].trim();
      }
    }

    const checkPolicy = await sequelize.query(
      `select * from static_data."Policies" 
     WHERE "policyNo" = :policyNo `,
      {
        replacements: {
          policyNo: policyData.policyNo,
        },
        transaction: t,
        type: QueryTypes.SELECT
      })
    console.log(checkPolicy.length > 0)
    if ((checkPolicy.length > 0)) {
      throw `เลขกรมธรรม์ : ${policyData.policyNo} มีอยู่ในระบบอยู่แล้ว`
    }

    // check duplicate entity if idcard type = 'บัตรประชาชน'
    let entity
    let checkEntity
    policyData.version = 1 // version of entity
    if (policyData.personType === 'P' && policyData.idCardType === 'บัตรประชาชน') {

      checkEntity = await sequelize.query(
        `select ent.*, ti."TITLETHAIBEGIN" 
        from static_data."Entities" ent 
        join  static_data."Titles" ti on ti."TITLEID" = ent."titleID"
        where "personType" = 'P' and "idCardType" = 'บัตรประชาชน' and "idCardNo" = :idCardNo and lastversion = 'Y' order by version DESC` ,
        {
          replacements: {
            idCardNo: policyData.idCardNo,
          },
          transaction: t,
          type: QueryTypes.SELECT
        })

      console.log(`----------- Done check entity dup --------------`);
      if (checkEntity.length > 0) {
        if (checkEntity[0].titleID === policyData.titleID && checkEntity[0].t_firstName === policyData.t_firstName && checkEntity[0].t_lastName === policyData.t_lastName) {
          policyData.version = checkEntity[0].version
        } else {
          policyData.version = checkEntity[0].version + 1
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

          console.log(`----------- update entity if dup --------------`);


          entity = await sequelize.query(
            `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
            values (:personType, :titleID, :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
            ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
            {
              replacements: {
                personType: policyData.personType,
                titleID: policyData.titleID,
                t_firstName: policyData.t_firstName,
                t_lastName: policyData.t_lastName,
                idCardType: policyData.idCardType,
                idCardNo: policyData.idCardNo,
                version: policyData.version,
                email: policyData.email || null,
              },
              transaction: t,
              type: QueryTypes.INSERT
            }
          )
          console.log(`----------- insert new entity Persontype = 'P' --------------`);
        }
      }

    } else if (policyData.personType === 'O') {
      entity = await sequelize.query(
        `insert into static_data."Entities" ("personType","titleID","t_ogName","taxNo",email, branch, "t_branchName","vatRegis") 
        values (:personType, :titleID , :t_ogName, :taxNo, :email, :branch, :t_branchName, :vatRegis) 
        ON CONFLICT ON CONSTRAINT "taxNo" DO NOTHING  RETURNING "id" `,
        {
          replacements: {
            personType: policyData.personType,
            titleID: policyData.titleID,
            t_ogName: policyData.t_ogName,
            taxNo: policyData.taxNo,
            email: policyData.email || null,
            branch: policyData.branch,
            vatRegis: policyData.vatRegis,
            t_branchName: policyData.t_branchName,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
      console.log(`----------- insert new entity Persontype = 'O' --------------`);

    } else {
      entity = await sequelize.query(
        `insert into static_data."Entities" ("personType","titleID","t_firstName","t_lastName","idCardType","idCardNo", email , version) 
        values (:personType, :titleID, :t_firstName, :t_lastName, :idCardType, :idCardNo, :email, :version ) 
        ON CONFLICT ON CONSTRAINT "idCardNo" DO NOTHING  RETURNING "id" `,
        {
          replacements: {
            personType: policyData.personType,
            titleID: policyData.titleID,
            t_firstName: policyData.t_firstName,
            t_lastName: policyData.t_lastName,
            idCardType: policyData.idCardType,
            idCardNo: policyData.idCardNo,
            version: policyData.version,
            email: policyData.email || null,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
      console.log(`----------- insert new entity Persontype = 'P' --------------`);
    }




    console.log(entity);
    let insureeCode
    if (entity[1] === 1 && policyData.version === 1) {   // entity[1] === 1 when create new entity and new insuree


      const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode: entity[0][0].id, version: policyData.version, }, { returning: ['insureeCode'], transaction: t })

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
            t_location_1: policyData.t_location_1,
            t_location_2: policyData.t_location_2,
            t_location_3: policyData.t_location_3,
            t_location_4: policyData.t_location_4,
            t_location_5: policyData.t_location_5,
            province: policyData.province,
            district: policyData.district,
            tambon: policyData.subdistrict,
            zipcode: policyData.zipcode,
            tel_1: policyData.telNum_1 || null,
            locationType: policyData.locationType,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )
      console.log(`----------- insert new Insurees --------------`);
    } else if (entity[1] === 1 && policyData.version !== checkEntity[0].version) { // entity[1] === 1 when create new entity and old insuree
      //select insuree
      const insuree = await Insuree.create({ entityID: entity[0][0].id, insureeCode: checkEntity[0].id, version: policyData.version, }, { returning: ['insureeCode'], transaction: t })

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
            t_location_1: policyData.t_location_1,
            t_location_2: policyData.t_location_2,
            t_location_3: policyData.t_location_3,
            t_location_4: policyData.t_location_4,
            t_location_5: policyData.t_location_5,
            province: policyData.province,
            district: policyData.district,
            tambon: policyData.subdistrict,
            zipcode: policyData.zipcode,
            tel_1: policyData.telNum_1 || null,
            locationType: policyData.locationType,
          },
          transaction: t,
          type: QueryTypes.INSERT
        }
      )

    } else {
      //select insuree
      let conInsuree = ''
      if (policyData.personType === "P") {
        conInsuree = `ent."personType" = 'P' and ent."idCardNo" = :idCardNo 
                        and ent."titleID" =  (select "TITLEID" from static_data."Titles" where  "TITLETHAIBEGIN" = :title limit 1) and ent."t_firstName" = :t_firstName 
                        and ent."t_lastName" = :t_lastName 
                        -- and ent."idCardType" = :idCardType`
      } else[
        conInsuree = `ent."personType" = 'O' and ent."taxNo" = :taxNo 
                        and ent."titleID" =  (select "TITLEID" from static_data."Titles" where  "TITLETHAIBEGIN" = :title limit 1) and ent."t_ogName" = :t_ogName 
                        -- and ent."branch" = :branch `
      ]
      const insuree = await sequelize.query(
        `select * FROM static_data."Insurees" ins JOIN static_data."Entities" ent ON ins."entityID" = ent."id"
           WHERE ${conInsuree}
           and ins.lastversion = 'Y' `,
        {
          replacements: {
            idCardNo: policyData.idCardNo,
            taxNo: policyData.taxNo,
            title: policyData.title,
            t_firstName: policyData.t_firstName,
            t_lastName: policyData.t_lastName,
            t_ogName: policyData.t_ogName,
            // branch: policyData.branch ,
            // idCardType: policyData.idCardType ,
          }, transaction: t, type: QueryTypes.SELECT
        })

      insureeCode = insuree[0].insureeCode
      console.log(`----------- select Insurees --------------`);

    }


    //insert new car or select
    let cars = [{ id: null }]
    if (policyData.class === 'MO') {
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
            brandname: policyData.brand || null,
            voluntaryCode: policyData.voluntaryCode || '',
            compulsoryCode: policyData.compulsoryCode || '',
            modelname: policyData.model || null,
            specname: policyData.specname || null,
            licenseNo: policyData.licenseNo || null,
            motorprovince: policyData.motorprovince,
            chassisNo: policyData.chassisNo,
            modelYear: policyData.modelYear,

            unregisterflag: policyData.unregisterflag || 'N',
            engineNo: policyData.engineNo || '',
            cc: policyData.cc || null,
            seat: policyData.seat || null,
            gvw: policyData.gvw || null,
          },
          transaction: t,
          type: QueryTypes.SELECT
        }
      )
      console.log(`----------- insert new Motors --------------`);
    }

    //set defualt comm ov if null 
    const commov = await sequelize.query(
      `select agt.vatflag , comout,* ,comin.*,
      agt."premCreditT" as "creditTAgent" , agt."premCreditUnit" as "creditUAgent",
      ins."premCreditT" as "creditTInsurer" , ins."premCreditUnit" as "creditUInsurer"
      FROM static_data."CommOVOuts" comout 
      JOIN static_data."CommOVIns" comin ON comin."insurerCode" = comout."insurerCode" and comin."insureID" = comout."insureID" 
      left JOIN static_data."Agents" agt on agt."agentCode" = comout."agentCode" and agt.lastversion = 'Y'
      left JOIN static_data."Insurers" ins on ins."insurerCode" = comout."insurerCode" and ins.lastversion = 'Y'
      where comout."agentCode" = :agentcode 
      and comout."insureID" = (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass) 
      and comout."insurerCode" = :insurerCode 
     	and comout.lastversion = 'Y'
     and comin.lastversion = 'Y'`,
      {
        replacements: {
          agentcode: policyData.agentCode,
          class: policyData.class,
          subClass: policyData.subClass,
          insurerCode: policyData.insurerCode,
        },
        transaction: t,
        type: QueryTypes.SELECT
      }
    )

    const duedateA = new Date()
    const duedateI = new Date()
    if(commov.length === 0 ){
      throw `ไม่มีการset commov ผู้แนะนำ : ${policyData[i].agentCode} / บริษัทประกัน : ${policyData[i].insurerCode} / แผนประกัน : ${policyData[i].class}+${policyData[i].subClass}`
      }
    if (commov[0].creditUAgent === "D") {
      duedateA.setDate(duedateA.getDate() + commov[0].creditTAgent)
    } else if (res.data[0].creditUAgent === "M") {
      duedateA.setMonth(duedateA.getMonth() + commov[0].creditTAgent)
    }
    if (commov[0].creditUInsurer === "D") {
      duedateI.setDate(duedateI.getDate() + commov[0].creditTInsurer)
    } else if (res.data[0].creditUInsurer === "M") {
      duedateI.setMonth(duedateI.getMonth() + commov[0].creditTInsurer)
    }
    policyData.dueDateAgent = duedateA
    policyData.dueDateInsurer = duedateI
    console.log(`----------- get defualt comm ov/ duedate agent 1--------------`);

    // #region commm ov default agent 1 

    //undefined comm/ov in
    //   if(policyData[`commin_rate`] === undefined || policyData[`commin_rate`] === null ){
    //     policyData[`commin_rate`] = commov[0].rateComIn
    //     policyData[`commin_amt`] = commov[0].rateComIn * policyData[`netgrossprem`]/100
    //   }
    //   if(policyData[`ovin_rate`]  === undefined || policyData[`ovin_rate`]  === null ){
    //     policyData[`ovin_rate`] = commov[0].rateOVIn_1
    //     policyData[`ovin_amt`] = commov[0].rateOVIn_1 * policyData[`netgrossprem`] /100
    //   }

    //   //undefined comm/ov out agent 1 
    // if(policyData[`commout1_rate`] === undefined || policyData[`commout1_rate`] === null ){
    //   policyData[`commout1_rate`] = commov[0].rateComOut
    //   policyData[`commout1_amt`] = commov[0].rateComOut * policyData[`netgrossprem`]/100
    // }  
    // if(policyData[`ovout1_rate`] === undefined || policyData[`ovout1_rate`] === null ){
    //   policyData[`ovout1_rate`] = commov[0].rateOVOut_1
    //   policyData[`ovout1_amt`] = commov[0].rateOVOut_1 * policyData[`netgrossprem`]/100
    // }  
    // #endregion

    // tax commov in
    policyData[`commin_taxamt`] = parseFloat((policyData[`commin_amt`] * tax).toFixed(2))
    policyData[`ovin_taxamt`] = parseFloat((policyData[`ovin_amt`] * tax).toFixed(2))

    //tax comm/ov out 1
    if (commov[0].vatflag === 'Y') {
      policyData[`commout1_taxamt`] = parseFloat((policyData[`commout1_amt`] * tax).toFixed(2))
      policyData[`ovout1_taxamt`] = parseFloat((policyData[`ovout1_amt`] * tax).toFixed(2))
    } else {
      policyData[`commout1_taxamt`] = 0
      policyData[`ovout1_taxamt`] = 0
    }


    //check agentcode2
    if (policyData[`agentCode2`]) {
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
            agentcode: policyData.agentCode2,
            class: policyData.class,
            subClass: policyData.subClass,
            insurerCode: policyData.insurerCode,
          },
          type: QueryTypes.SELECT
        }
      )
      console.log(`----------- get defualt comm ov agent 2--------------`);

      // #region commm ov default agent 2
      //  if(policyData[`commout2_rate`] === null && policyData[`ovout2_rate`] === null ){
      //   policyData[`commout2_rate`] = commov2[0].rateComOut
      //   policyData[`commout2_amt`] = commov2[0].rateComOut * policyData[`netgrossprem`]/100
      //   policyData[`ovout2_rate`] = commov2[0].rateOVOut_1
      //   policyData[`ovout2_amt`] = commov2[0].rateOVOut_1 * policyData[`netgrossprem`]/100
      //  }
      // #endregion


      //tax comm/ov out 2
      if (commov2[0].vatflag === 'Y') {
        policyData[`commout2_taxamt`] = parseFloat((policyData[`commout2_amt`] * tax).toFixed(2))
        policyData[`ovout2_taxamt`] = parseFloat((policyData[`ovout2_amt`] * tax).toFixed(2))
      } else {
        policyData[`commout2_taxamt`] = 0
        policyData[`ovout2_taxamt`] = 0
      }
      policyData[`commout_rate`] = parseFloat(policyData[`commout1_rate`]) + parseFloat(policyData[`commout2_rate`])
      policyData[`commout_amt`] = parseFloat(policyData[`commout1_amt`]) + parseFloat(policyData[`commout2_amt`])
      policyData[`ovout_rate`] = parseFloat(policyData[`ovout1_rate`]) + parseFloat(policyData[`ovout2_rate`])
      policyData[`ovout_amt`] = parseFloat(policyData[`ovout1_amt`]) + parseFloat(policyData[`ovout2_amt`])
      policyData[`commout_taxamt`] = parseFloat(policyData[`commout1_taxamt`]) + parseFloat(policyData[`commout2_taxamt`])
      policyData[`ovout_taxamt`] = parseFloat(policyData[`ovout1_taxamt`]) + parseFloat(policyData[`ovout2_taxamt`])

    } else {
      policyData[`agentCode2`] = null
      policyData[`commout2_rate`] = 0
      policyData[`commout2_amt`] = 0
      policyData[`commout2_taxamt`] = 0
      policyData[`ovout2_rate`] = 0
      policyData[`ovout2_amt`] = 0
      policyData[`ovout2_taxamt`] = 0
      policyData[`commout_rate`] = policyData[`commout1_rate`]
      policyData[`commout_amt`] = policyData[`commout1_amt`]
      policyData[`ovout_rate`] = policyData[`ovout1_rate`]
      policyData[`ovout_amt`] = policyData[`ovout1_amt`]
      policyData[`commout_taxamt`] = policyData[`commout1_taxamt`]
      policyData[`ovout_taxamt`] = policyData[`ovout1_taxamt`]
    }

    //#region cal withheld 1%  duty tax totalprem
    // policyData.duty = Math.ceil(policyData.netgrossprem * duty)
    // policyData.tax = parseFloat(((policyData.netgrossprem + policyData.duty) * tax).toFixed(2))
    // policyData.totalprem = policyData.netgrossprem + policyData.duty + policyData.tax
    // if (policyData.personType.trim() === 'O') {

    //   policyData.withheld = Number(((policyData.netgrossprem + policyData.duty) * withheld).toFixed(2))
    // } else {
    //   policyData.withheld = 0
    // }


    //#endregion

    //get application no
    const currentdate = getCurrentDate()
    // policyData.applicationNo = 'APP' + await getRunNo('app', null, null, 'kw', currentdate, t);
    console.log(`---------- Application No : ${policyData.applicationNo} -----------------`);

    //insert policy
    await sequelize.query(
      ` insert into static_data."Policies" ("policyNo", "endorseNo", "issueDate", "applicationNo","insureeCode","insurerCode",
        "agentCode","agentCode2","insureID",
        "actDate", "actTime", "expDate", "expTime", "policyDate", "policyTime", grossprem, duty, tax, totalprem, 
        commin_rate, commin_amt, ovin_rate, ovin_amt, commin_taxamt, ovin_taxamt, commout_rate, commout_amt, ovout_rate, ovout_amt,
        commout1_taxamt, ovout1_taxamt, commout2_taxamt, ovout2_taxamt, commout_taxamt, ovout_taxamt,
        createusercode, "itemList","insurancestatus" ,"policystatus", "seqNoins", "seqNoagt",
        commout1_rate, commout1_amt, ovout1_rate, ovout1_amt, commout2_rate, commout2_amt, ovout2_rate, ovout2_amt, netgrossprem, specdiscrate, specdiscamt, cover_amt, withheld,
        duedateinsurer, duedateagent, endorseseries, "fleetCode", "fleetflag", "invoiceNo", "taxInvoiceNo", "lastVersion", "policyType", "source") 
        -- 'values (:policyNo, (select "insureeCode" from static_data."Insurees" where "entityID" = :entityInsuree and lastversion = 'Y'), '+
        values ( :policyNo, :endorseNo, :issueDate , :applicationNo, :insureeCode, 
        (select "insurerCode" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y' ), 
        :agentCode, :agentCode2, (select "id" from static_data."InsureTypes" where "class" = :class and  "subClass" = :subClass ), 
        :actDate, :actTime, :expDate, :expTime, :policyDate, :policyTime, :grossprem, :duty, :tax, :totalprem, 
        :commin_rate, :commin_amt, :ovin_rate, :ovin_amt, :commin_taxamt, :ovin_taxamt, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt,
        :commout1_taxamt, :ovout1_taxamt, :commout2_taxamt, :ovout2_taxamt, :commout_taxamt, :ovout_taxamt,
        :createusercode, :itemList ,:insurancestatus, :policystatus, :seqNoins, :seqNoagt,
        :commout1_rate, :commout1_amt, :ovout1_rate, :ovout1_amt,  :commout2_rate, :commout2_amt, :ovout2_rate, :ovout2_amt, :netgrossprem,  :specdiscrate, :specdiscamt, :cover_amt, :withheld,
        :dueDateInsurer, :dueDateAgent ,:endorseseries, :fleetCode, :fleetflag, :invoiceNo, :taxInvoiceNo, :lastVersion, :policyType, :source)`
      ,
      {
        replacements: {
          policyNo: policyData.policyNo,
          endorseNo: policyData.endorseNo,
          issueDate: policyData.issueDate,
          applicationNo: policyData.applicationNo,
          invoiceNo: policyData.invoiceNo,
          taxInvoiceNo: policyData.taxInvoiceNo,
          endorseseries: policyData.endorseseries,
          insurancestatus: policyData.insurancestatus,
          policystatus: policyData.policystatus,
          fleetCode: policyData.fleetCode,
          fleetflag: policyData.fleetflag,
          seqNoins: policyData.seqNoins,
          seqNoagt: policyData.seqNoagt,
          // entityInsuree:
          insureeCode: insureeCode,
          insurerCode: policyData.insurerCode,
          class: policyData.class,
          subClass: policyData.subClass,
          agentCode: policyData.agentCode,
          agentCode2: policyData.agentCode2,
          actDate: policyData.actDate,
          actTime : policyData.actTime,
          expDate: policyData.expDate,
          expTime : policyData.expTime,
          policyDate: policyData.policyDate,
          policyTime : policyData.policyTime,

          grossprem: policyData.netgrossprem,
          netgrossprem: policyData.netgrossprem,
          duty: policyData.duty,
          tax: policyData.tax,
          totalprem: policyData.totalprem,
          // specdiscrate: policyData[`specdiscrate`],
          // specdiscamt: policyData[`specdiscamt`],
          specdiscrate: 0,
          specdiscamt: policyData.specdiscamt,
          commin_rate: policyData[`commin_rate`],
          commin_amt: policyData[`commin_amt`],
          ovin_rate: policyData[`ovin_rate`],
          ovin_amt: policyData[`ovin_amt`],
          commin_taxamt: policyData[`commin_taxamt`],
          ovin_taxamt: policyData[`ovin_taxamt`],
          commout_rate: policyData[`commout_rate`],
          commout_amt: policyData[`commout_amt`],
          ovout_rate: policyData[`ovout_rate`],
          ovout_amt: policyData[`ovout_amt`],
          commout1_rate: policyData[`commout1_rate`],
          commout1_amt: policyData[`commout1_amt`],
          ovout1_rate: policyData[`ovout1_rate`],
          ovout1_amt: policyData[`ovout1_amt`],
          commout2_rate: policyData[`commout2_rate`],
          commout2_amt: policyData[`commout2_amt`],
          ovout2_rate: policyData[`ovout2_rate`],
          ovout2_amt: policyData[`ovout2_amt`],
          cover_amt: policyData[`cover_amt`],
          createusercode: policyData.createusercode,
          itemList: cars[0].id,
          withheld: policyData.withheld,
          dueDateInsurer: policyData.dueDateInsurer,
          dueDateAgent: policyData.dueDateAgent,
          commout1_taxamt: policyData[`commout1_taxamt`],
          ovout1_taxamt: policyData[`ovout1_taxamt`],
          commout2_taxamt: policyData[`commout2_taxamt`],
          ovout2_taxamt: policyData[`ovout2_taxamt`],
          commout_taxamt: policyData[`commout_taxamt`],
          ovout_taxamt: policyData[`ovout_taxamt`],
          lastVersion: policyData.lastVersion,
          source : policyData.source,


        },
        transaction: t,
        type: QueryTypes.INSERT
      }
    )



    await t.commit();
    appNo.push(policyData.policyNo)
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ status: 'error', describe: error, policyNo: appNo });
    return "fail"

  }



  await res.json({ status: 'success', policyNo: appNo })


};


const cancelAppNo  = async (req,res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  let applicationNo = req.body.applicationNo
console.log('///---- cancelAppNo  ----///')
  //create entity 
  const t = await sequelize.transaction();
  try {
 
    console.log('------------- check in db appNo :' + applicationNo)
    const checkPolicy = await sequelize.query(
      `select * from static_data."Policies" 
     WHERE "applicationNo" = :applicationNo and insurancestatus = 'AI' `,
      {
        replacements: {
          applicationNo: applicationNo,
        },
        transaction: t,
        type: QueryTypes.SELECT
      })
    console.log('check existing appNo is status = AI :' + checkPolicy.length === 0)
    if ((checkPolicy.length === 0)) {
      console.error('cant cancel appNo :' + applicationNo )
      throw `เลขกรมธรรม์ : ${applicationNo} มีอยู่ในระบบอยู่แล้ว`
    }




    // policyData.applicationNo = 'APP' + await getRunNo('app', null, null, 'kw', currentdate, t);
   

    //insert policy
    await sequelize.query(
      ` update static_data."Policies" 
        set "canceledAt" = now(),
        cancelusercode = :usercode,
        insurancestatus  = 'CC'
        where "applicationNo" = :applicationNo and insurancestatus  = 'AI' ;`
      ,
      {
        replacements: {
          usercode: usercode,
          applicationNo : applicationNo


        },
        transaction: t,
        type: QueryTypes.UPDATE
      }
    )
    
    
    await t.commit();
  } catch (error) {
    console.error(error);
    await t.rollback();
    await res.status(500).json({ status: 'error', describe: error, applicationNo: applicationNo });
    return "fail"
    
  }
  
  console.log(`update status AI -> CC appNo : ${applicationNo} success`);
  await res.json({ status: 'success', applicationNo: applicationNo })




}
module.exports = {

  findPolicy,
  getPolicyList,
  upsertEntityInsuree,
  newPolicyList,   //create policy status A from excel and add ARAP
  draftPolicyMinor, //create policy status I from excel
  editPolicyList, // change status I ->A and add ARAP
  editPolicyMinor, // change status I ->A and add ARAP งานรายย่อย
  externalPolicy,
  // postCar,
  // removeCar,
  // editCar,
  getPolicyListChangestatus,
  createjupgrMinor, // for endorse
  createTransectionMinor,  // for endorse
  editApplication,
  draftPolicyExcel,

  cancelAppNo, // ยกเลิกใบคำขอ
  editPolicyDetail, //แก้ไขข้อมูลกรมธรรม xlock == "N"
};