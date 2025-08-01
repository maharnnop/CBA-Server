const Policy = require("../models").Policy;
const Transaction = require("../models").Transaction;
const CommOVIn = require("../models").CommOVIn; //imported fruits array
const CommOVOut = require("../models").CommOVOut;
const b_jabilladvisor = require('../models').b_jabilladvisor;
const b_jabilladvisordetail = require('../models').b_jabilladvisordetail;
const process = require('process');
// const PDFDocument = require('pdfkit');
const {getRunNo,getCurrentDate,getCurrentYYMM} = require("./lib/runningno");
const {decode} = require('jsonwebtoken');
const  ejs = require('ejs');
require('dotenv').config();
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize } = require("sequelize");


const puppeteer = require('puppeteer');
const excelJS = require("exceljs");
const fs = require("fs");
const { throws } = require("assert");

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

const findTransaction = async (req,res) => {
  // let transac1 = null
  // let transac2 = null
  let transac = []
  if (req.body.payType === 'amity') {
    if (req.body.repType === 'insuerName') {
      transac.push(['PREM-OUT', 'O'])
      // transac1 = ['Prem','I']
    } else if (req.body.repType === 'agentCode') {
      transac.push(['COMM-OUT', 'O'])
      transac.push(['OV-OUT', 'O'])
      // transac1 = ['Com/OV','O']
    }
  } else if (req.body.payType === 'insuerName' && req.body.repType === 'amity') {
    transac.push(['COMM-IN', 'I'])
    transac.push(['OV-IN', 'I'])
    // transac1 = ['Com/OV','I']
  } else if (req.body.payType === 'agentCode') {
    transac.push(['PREM-IN', 'I'])
    // transac1 = ['Prem','I']
    if (req.body.repType === 'insuerName') {
      transac.push(['PREM-OUT', 'O'])
      // transac2 = ['Prem','O']
    } else if (req.body.repType === 'amity') {
      transac.push(['COMM-OUT', 'O'])
      transac.push(['OV-OUT', 'O'])
      // transac2 = ['Com/OV','O']
    }
  }
  const records = []
    for (let i = 0; i < transac.length; i++) {
    
    const data = await sequelize.query(
          'select (select ent."t_ogName" from static_data."Insurers" ins join static_data."Entities" ent on ent.id = ins."entityID" where ins."insurerCode" = tran."insurerCode" ) as "insurerName",* from static_data."Transactions" tran  where '+
          'CASE WHEN :filter = \'policyNo\'  THEN tran."policyNo" = :value '+
          'WHEN :filter = \'agentCode\' then tran."agentCode" = :value '+
          'else tran."insurerCode" = (select "insurerCode" from static_data."Insurers" ins join static_data."Entities" ent on ent.id = ins."entityID" where ent."t_ogName" = :value ) '+
          'END and tran."payNo" is null and tran."transType" = :transType  ',
          {
            replacements: {
              filter:req.body.filterName,
              value:req.body.value,
              transType: transac[i][0],
              //status: transac[i][1]
            },
            type: QueryTypes.SELECT
          }
        );
        records.push(...data)

    }
    await res.json(records)
  
}

// ค้นหารายการ เพื่อสร้างใบวางบิล & ตักหนี้รายย่อย PREM-IN
const findPolicyByPreminDue = async (req,res) => {
try{   
  
  let cond =''
  if(req.body.insurerCode !== null && req.body.insurerCode !== ''){
    cond = `${cond} and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if(req.body.agentCode !== null && req.body.agentCode !== ''){
    cond = `${cond} and t."agentCode"  = '${req.body.agentCode}'`
  }
  if(req.body.dueDate !== null && req.body.dueDate !== ''){
    cond = `${cond} and date(t."dueDate") <= '${req.body.dueDate}'`
  }
  if(req.body.policyNoStart !== null && req.body.policyNoStart !== ''){
    cond = `${cond} and t."policyNo" >= '${req.body.policyNoStart}'`
  }
  if(req.body.policyNoEnd !== null && req.body.policyNoEnd !== ''){
    cond = `${cond} and t."policyNo" <= '${req.body.policyNoEnd}'`
  }
  if(req.body.policyNoList !== null && Array.isArray(req.body.policyNoList) ){
      if(req.body.policyNoList.length  >= 1 ){
        const pol = req.body.policyNoList.join("', '")
        cond = `${cond} and t."policyNo" in ('${pol}')`
      }
  }
  if(req.body.createdDateStart !== null && req.body.createdDateStart !== ''){
    cond = `${cond} and date(p."createdAt") >= '${req.body.createdDateStart}'`
  }
  if(req.body.createdDateEnd !== null && req.body.createdDateEnd !== ''){
    cond = `${cond} and date(p."createdAt") <= '${req.body.createdDateEnd}'`
  }
  // if(req.body.fleetCode ){ // fleetCode = true
  //   cond = `${cond} and txtype2 in ('1', '2', '3', '4', '5') `
  // }else {
  //   cond = `${cond} and p."fleetCode" is null  and p.fleetflag = 'N' and txtype2 in ('1', '2')  `
  // }


    const records = await sequelize.query(
      `select j."agentCode",j."agentCode2",  t."insurerCode",  t."withheld" , t.txtype2 , 
      t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" ,t.dftxno,
      i.id as customerid, t.id as transID,
      p."insureeCode", getname(a."entityID") as "agentName",
      (case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as insureeName ,
      j.polid, motor."licenseNo", motor."chassisNo", (select t_provincename from static_data."provinces" where provinceid = motor."motorprovinceID" ) as "motorprovince",
      j.grossprem, j.specdiscrate, j.specdiscamt, j.netgrossprem, j.duty, j.tax, j.totalprem, 
      j.commout_rate,j.commout_amt, j.ovout_rate, j.ovout_amt, t.netflag, t.remainamt, j.commout_taxamt, j.ovout_taxamt,
      j.commout1_rate,j.commout1_amt, j.ovout1_rate, j.ovout1_amt,
      (case when a."stamentType" = 'Net' then true else false end) as "statementtype",
      (j.totalprem - j.withheld - j.specdiscamt ) as "totalamt",
      true as "select"
      from static_data."Transactions" t 
      left join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
      join static_data."Policies" p on p.id = j.polid and  p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
      left join static_data."Agents" a on a."agentCode" = t."mainaccountcode" and a.lastversion ='Y'
      left join static_data."Insurees" i on i."insureeCode" =p."insureeCode" and i.lastversion = 'Y'
      left join static_data."Entities" e on e.id = i."entityID" 
      left join static_data."Titles" t2 on t2."TITLEID" = e."titleID" 
      left join static_data."Motors" motor on motor.id = p."itemList"
      where t."transType" = 'PREM-IN' 
      and txtype2 in ('1', '2', '3', '4', '5') 
      -- and txtype2 in ('1', '2') 
      and rprefdate is null 
      and dfrpreferno is null 
      and t.billadvisorno is null 
      and t.status = 'N'
      and j.installmenttype ='A'
      ${cond}
      order by t."policyNo", t."seqNo"  `,
          {
            replacements: {
              // agentCode:req.body.agentCode,
              insurerCode:req.body.insurerCode,
              dueDate: req.body.dueDate,
              policyNoStart: req.body.policyNoStart,
              policyNoEnd: req.body.policyNoEnd,
              policyNoAll:req.body.policyNoAll,
            },
            type: QueryTypes.SELECT
          }
        );
        const vatflag = await sequelize.query(
          `select vatflag from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y' ` ,
          {
            replacements: {
              agentCode:req.body.agentCode
            },
            type: QueryTypes.SELECT
          }
        );
        
        if (records.length === 0) {
          await res.status(201).json({msg:"not found policy"})
        }else{

          await res.json({records : records, vatflag: vatflag})
        }

        
    
} catch (err) {
  console.error(err);
  res.status(500).send({
    status: "error",
    message: err.message,
  });
}
  
}

// ค้นหารายการ เพื่อดึงรายงานใบแจ้งหนี้
const findPolicyForinvoice = async (req,res) => {

  let cond =''
  if(req.body.insurerCode !== null && req.body.insurerCode !== ''){
    cond = `${cond} and p."insurerCode" = '${req.body.insurerCode}'`
  }
  if(req.body.agentCode !== null && req.body.agentCode !== ''){
    cond = `${cond} and p."agentCode"  = '${req.body.agentCode}'`
  }
  if(req.body.startInvoiceNo !== null && req.body.startInvoiceNo !== ''){
    cond = `${cond} and j."invoiceNo" >= '${req.body.startInvoiceNo}'`
  }
  if(req.body.endInvoiceNo !== null && req.body.endInvoiceNo !== ''){
    cond = `${cond} and j."invoiceNo" <= '${req.body.endInvoiceNo}'`
  }
  if(req.body.createdDateStart !== null && req.body.createdDateStart !== ''){
    cond = `${cond} and date(p."createdAt") >= '${req.body.createdDateStart}'`
  }
  if(req.body.createdDateEnd !== null && req.body.createdDateEnd !== ''){
    cond = `${cond} and date(p."createdAt") <= '${req.body.createdDateEnd}'`
  }

    const records = await sequelize.query(
      `select p."agentCode", p."insurerCode", p."applicationNo",
       p."policyNo", p."endorseNo", j."invoiceNo", j."seqNo" ,
      -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid, 
      i.id as customerid, 
      p."insureeCode",
      (case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' )  || ' '|| t2."TITLETHAIEND" end) as agentname ,
      j.polid, 
      j.grossprem, j.specdiscrate, j.specdiscamt, j.netgrossprem, j.duty, j.tax, j.totalprem, j.withheld, 
      (j.totalprem - j.specdiscamt - j.withheld) as "totalamt",
      j.commout_rate,j.commout_amt, j.ovout_rate, j.ovout_amt,
      j.commout1_rate,j.commout1_amt, j.ovout1_rate, j.ovout1_amt, 
      t."dueDate"
      from  static_data.b_jupgrs j 
      join static_data."Policies" p on p.id = j.polid
      join static_data."Transactions" t on j."policyNo" = t."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" and t."transType" = 'PREM-IN'
      left join static_data."Agents" a on a."agentCode" = p."agentCode" and a.lastversion ='Y'
      left join static_data."Insurees" i on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
      left join static_data."Entities" e on e.id = a."entityID" 
      left join static_data."Titles" t2 on t2."TITLEID" = e."titleID" 
      where j.installmenttype ='A'
      and p."lastVersion" = 'Y'
      ${cond}
      order by j."policyNo", j."seqNo"  `,
          {
            replacements: {
              // agentCode:req.body.agentCode,
              insurerCode:req.body.insurerCode,
              dueDate: req.body.dueDate,
              policyNoStart: req.body.policyNoStart,
              policyNoEnd: req.body.policyNoEnd,
              policyNoAll:req.body.policyNoAll,
            },
            type: QueryTypes.SELECT
          }
        );
        
        
        if (records.length === 0) {
          await res.status(201).json({msg:"not found policy"})
        }else{

          await res.json( records)
        }
  
}

const findPolicyByBillno = async (req,res) => {
    console.log(req.body.billadvisorno)
  const records = await sequelize.query(
    ` select pol.id as polid, tran.dftxno,
    tran."policyNo", tran."endorseNo", jupgr."invoiceNo", jupgr."taxInvoiceNo",
    tran."seqNo", pol."insurerCode", jupgr."agentCode", jupgr."agentCode2", tran."dueDate", pol."insureeCode",
     (case when ent."personType" = 'O' then tt."TITLETHAIBEGIN" ||' ' || ent."t_ogName"|| COALESCE(' สาขา '|| ent."t_branchName",'' ) || ' ' || tt."TITLETHAIEND"  else tt."TITLETHAIBEGIN" || ' ' || ent."t_firstName"||' '||ent."t_lastName"  end) as "insureeName",
     mt."licenseNo", (select t_provincename from static_data.provinces where provinceid = mt."motorprovinceID")as "motorprovince",
     mt."chassisNo" , jupgr.grossprem , jupgr.specdiscrate ,jupgr.specdiscamt ,jupgr.netgrossprem ,jupgr.duty , jupgr.tax ,jupgr.totalprem ,jupgr.withheld,
     jupgr.commout_rate,jupgr.commout_amt, jupgr.ovout_rate , jupgr.ovout_amt ,jupgr.commout_taxamt, jupgr.ovout_taxamt,
     bd.netflag
     from  static_data.b_jabilladvisors bill
	  left join static_data.b_jabilladvisordetails bd on bd.keyidm = bill.id 
    left join static_data."b_jupgrs" jupgr on bd."policyNo"  = jupgr."policyNo" and  bd.dftxno = jupgr.dftxno   and bd."seqno" = jupgr."seqNo" 
    left join static_data."Transactions" tran on tran."policyNo" = jupgr."policyNo"  and tran.dftxno = jupgr.dftxno and tran."seqNo" = jupgr."seqNo" 
    join static_data."Policies" pol on pol.id = jupgr.polid and pol."lastVersion" = 'Y'
    left join static_data."Motors" mt on mt.id = pol."itemList"
    left join static_data."Insurees" insuree on insuree."insureeCode" = pol."insureeCode" and insuree.lastversion = 'Y'
    left join static_data."Entities" ent on ent.id = insuree."entityID"
    left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    where bill.billadvisorno = :billadvisorno 
    and bill.active ='Y' 
   	and jupgr.installmenttype ='A'
    and tran.status = 'N'
    and tran."transType" = 'PREM-IN';`,
        {
          replacements: {
            billadvisorno: req.body.billadvisorno
          },
          type: QueryTypes.SELECT
        }
      );
      const old_keyid = await sequelize.query(
        `select id, billdate,"insurerCode", "agentCode", cashierreceiptno
        -- (select "insurerCode" from static_data."Insurers" where id = insurerno),
        -- (select "agentCode" from static_data."Agents" where id = advisorno)
         from static_data.b_jabilladvisors where billadvisorno = :billadvisorno
         and active = 'Y'`,{
        replacements: {
          billadvisorno: req.body.billadvisorno
        },
        type: QueryTypes.SELECT
      })

      if (records.length === 0) {
        await res.status(201).json({msg:"not found policy in bill"})
      }else{

        await res.json({data:records,
                       old_keyid: old_keyid[0].id,
                       insurerCode: old_keyid[0].insurerCode,
                       agentCode: old_keyid[0].agentCode,
                       billdate: old_keyid[0].billdate,  
                       cashierreceiptno: old_keyid[0].cashierreceiptno})
      }

}
const createbilladvisor = async (req,res) =>{
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try{

  
      //insert to master jabilladvisor
      const billdate = new Date().toISOString().split('T')[0]
      const currentdate = getCurrentDate()
      // req.body.bill.billadvisorno = 'BILL-' +getCurrentYYMM() +'/'+ String(await getRunNo('bill',null,null,'kw',currentdate,t)).padStart(4, '0');
      req.body.bill.billadvisorno = 'BILL-' +getCurrentYYMM() +'/'+ await getRunNo('bill',null,null,'kw',currentdate,t);
      const billadvisors = await sequelize.query(
        `INSERT INTO static_data.b_jabilladvisors (insurerno,"insurerCode", advisorno, "agentCode", billadvisorno, billdate, createusercode, amt, cashierreceiptno, active,
          withheld, totalprem, commout_amt, commout_taxamt, ovout_amt, ovout_taxamt , specdiscamt ) 
        VALUES ((select id from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), :insurerCode,
        (select id from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y'), :agentCode,
        :billadvisorno, :billdate, :createusercode, :amt, :cashierreceiptno, 'Y' ,
        :withheld, :totalprem, :commout_amt, :commout_taxamt, :ovout_amt, :ovout_taxamt , :specdiscamt ) RETURNING "id" `,
            {
              replacements: {
                insurerCode:req.body.bill.insurerCode,
                agentCode:req.body.bill.agentCode,
                 billadvisorno: req.body.bill.billadvisorno,
                billdate: billdate,
                createusercode: usercode,
                amt:req.body.bill.amt,
                cashierreceiptno:null,
                withheld    : req.body.bill.withheld, 
                totalprem   : req.body.bill.totalprem, 
                commout_amt : req.body.bill.commout_amt, 
                commout_taxamt : req.body.bill.commout_taxamt, 
                ovout_amt   : req.body.bill.ovout_amt,
                ovout_taxamt   : req.body.bill.ovout_taxamt,
                specdiscamt : req.body.bill.specdiscamt,
              },
              transaction: t ,
              type: QueryTypes.INSERT
            }
          );

      console.log(`------------- done insert b_jabilladvisors : ${req.body.bill.billadvisorno} -------------`);


      for (let i = 0; i < req.body.detail.length; i++) {
          //insert to deteil of jabilladvisor
        if (req.body.detail[i].statementtype === 'G') {
          req.body.detail[i].commout_taxamt = 0
          req.body.detail[i].ovout_taxamt = 0
        }

          sequelize.query(
            `insert into static_data.b_jabilladvisordetails (keyidm, polid, "policyNo", dftxno, customerid, motorid, grossprem, duty, tax, totalprem, "comm-out%", "comm-out-amt", 
             "ov-out%", "ov-out-amt", "commout_taxamt", "ovout_taxamt", netflag, billpremium,updateusercode, seqno, withheld, specdiscamt) 
            values (:keyidm, :polid, :policyNo, :dftxno,
            -- (select id from static_data."Insurees" where "insureeCode" = :insureeCode and "lastversion" = \'Y\' ),
            :customerid,
              :motorid, 
            :grossprem, :duty, :tax, :totalprem, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :commout_taxamt, :ovout_taxamt, :netflag, :billpremium, :updateusercode, :seqno, :withheld, :specdiscamt)` ,
                {
                  replacements: {
                    keyidm: billadvisors[0][0].id,
                    polid :  req.body.detail[i].polid,
                    policyNo: req.body.detail[i].policyNo,
                    dftxno: req.body.detail[i].dftxno,
                    insureeCode: req.body.detail[i].insureeCode,
                    customerid : req.body.detail[i].customerid,
                    motorid: req.body.detail[i].itemList || null,
                    grossprem: req.body.detail[i].netgrossprem,
                    duty: req.body.detail[i].duty,
                    tax: req.body.detail[i].tax,
                    totalprem: req.body.detail[i].totalprem,
                    commout_rate: req.body.detail[i].commout_rate,
                    commout_amt: req.body.detail[i].commout_amt,
                    ovout_rate: req.body.detail[i].ovout_rate,
                    ovout_amt: req.body.detail[i].ovout_amt,
                    commout_taxamt: req.body.detail[i].commout_taxamt,
                    ovout_taxamt: req.body.detail[i].ovout_taxamt,
                    netflag: req.body.detail[i].statementtype,
                    billpremium: req.body.detail[i].billpremium,
                    updateusercode: usercode,
                    seqno: req.body.detail[i].seqNo,
                    withheld: req.body.detail[i].withheld,
                    specdiscamt :  req.body.detail[i].specdiscamt,
                  },
                  transaction: t ,
                  type: QueryTypes.INSERT
                  
                }
              );

            }
            console.log(billadvisors[0][0].id);
            //update ARAP table
            await sequelize.query(
              `DO $$ 
                DECLARE a_policyno text; a_dftxno text; a_billadvisorno text; a_netflag text; a_seqno int;
                BEGIN FOR a_policyno, a_dftxno, a_billadvisorno, a_netflag, a_seqno IN 
                    SELECT d."policyNo", d.dftxno, billadvisorno, netflag ,seqno 
                    FROM static_data.b_jabilladvisors m JOIN static_data.b_jabilladvisordetails d ON m.id = d.keyidm 
                    WHERE m.active = 'Y' and m.id =  ${billadvisors[0][0].id}
                 LOOP  
                UPDATE static_data."Transactions" SET billadvisorno = a_billadvisorno, netflag = a_netflag 
                  WHERE "policyNo" = a_policyno and dftxno = a_dftxno and status ='N' and "seqNo" = a_seqno
                   and "transType" in ('COMM-OUT','OV-OUT', 'DISC-OUT','PREM-IN', 'DISC-IN') ; 
                END LOOP; 
              END $$; `,
              {
                transaction: t ,
                raw: true 
              }
              
            )
            await t.commit();
            await res.json({msg:`created billadvisorNO : ${req.body.bill.billadvisorno} success!!` })
        } catch (error) {
          console.error(error)
          await t.rollback();
          await res.status(500).json(error);

          }
        
        
}


const findbilladvisor =async (req,res) =>{
  let cond = ''
  if(req.body.insurerCode !== null && req.body.insurerCode !== ''){
    cond = `${cond} and bill."insurerCode" = :insurerCode`
  }
  if(req.body.agentCode !== null && req.body.agentCode !== ''){
    cond = `${cond} and bill."agentCode" = :agentCode`
  }
  if(req.body.startBilladvisorno !== null && req.body.startBilladvisorno !== ''){
    cond = `${cond} and bill.billadvisorno >= :startBilladvisorno`
  }
  if(req.body.endBilladvisorno !== null && req.body.endBilladvisorno !== ''){
    cond = `${cond} and bill.billadvisorno <= :endBilladvisorno`
  }
  if(req.body.startBilldate !== null && req.body.startBilldate !== ''){
    cond = `${cond} and bill.billdate >= :startBilldate`
  }
  if(req.body.endBilldate !== null && req.body.endBilldate !== ''){
    cond = `${cond} and bill.billdate <= :endBilldate`
  }
  const records = await sequelize.query(
    `select bill.* ,
	(case when bill.cashierreceiptno is null then true else false end ) as editflag ,
	(case when bill.cashierreceiptno is null then 'รอรับเงิน'  
		  when cash.status = 'I' then 'รับเงินแล้ว' else 'ตัดหนี้แล้ว' end ) as status 
      from static_data.b_jabilladvisors  bill 
      left join static_data.b_jacashiers cash on cash.cashierreceiveno = bill.cashierreceiptno 
    where 1=1 
    and bill.active = 'Y'
    ${cond}
    order by billdate` ,
        {
          replacements: {
            insurerid: req.body.insurerId,
            agentid:req.body.agentId,
            startBilladvisorno: req.body.startBilladvisorno,
            endBilladvisorno: req.body.endBilladvisorno,
            startBilldate: req.body.startBilldate,
            endBilldate: req.body.endBilldate,
          },
          type: QueryTypes.SELECT
        }
      );
      
  await res.json(records)
}

const getbilladvisordetail =async (req,res) =>{
  
  const records = await sequelize.query(
    'select *   from  static_data.b_jabilladvisordetails d '+
    'join  static_data."Policies" pol on pol.id = d.polid '+
    'where 1=1 and d.keyidm = :keymid',
        {
          replacements: {
            keymid: req.body.keymid,
          },
          type: QueryTypes.SELECT
        }
      );

  await res.json(records)
}

const editbilladvisor = async (req,res) =>{
  //insert new bill to master jabilladvisor
  const jwt = req.headers.authorization.split(' ')[1];
    const usercode = decode(jwt).USERNAME;

  const t = await sequelize.transaction();
  try{
    const currentdate = getCurrentDate()
    // req.body.bill.billadvisorno = 'BILL' + await getRunNo('bill',null,null,'kw',currentdate,t);
    // req.body.bill.billadvisorno = getCurrentYYMM() +'/'+ String(await getRunNo('bill',null,null,'kw',currentdate,t)).padStart(4, '0');
  const billadvisors = await sequelize.query(
    `INSERT INTO static_data.b_jabilladvisors (insurerno,"insurerCode",
     advisorno,"agentCode", 
     billadvisorno, billdate, createusercode, amt, cashierreceiptno, active, old_keyid,
    withheld, totalprem, commout_amt, commout_taxamt, ovout_amt, ovout_taxamt , specdiscamt ) 
    VALUES ((select id from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y' ),:insurerCode, 
    (select id from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y' ), :agentCode,
    :billadvisorno, :billdate, :createusercode, :amt, :cashierreceiptno, 'Y', :old_keyid,
    :withheld, :totalprem, :commout_amt,  :commout_taxamt, :ovout_amt, :ovout_taxamt , :specdiscamt ) RETURNING "id" `,
        {
          replacements: {
            insurerCode:req.body.bill.insurerCode,
            agentCode:req.body.bill.agentCode,
            billadvisorno: req.body.bill.billadvisorno,
            billdate: new Date(),
            createusercode: usercode,
            amt:req.body.bill.amt,
            cashierreceiptno:null,
            withheld: req.body.bill.withheld,
            totalprem: req.body.bill.totalprem,
            commout_amt: req.body.bill.commout_amt,
            commout_taxamt : req.body.bill.commout_taxamt, 
            ovout_amt   : req.body.bill.ovout_amt,
            ovout_taxamt   : req.body.bill.ovout_taxamt,
            specdiscamt: req.body.bill.specdiscamt,
            old_keyid: req.body.bill.old_keyid,
          },
          transaction: t ,
          type: QueryTypes.INSERT
        }
      );
      // `INSERT INTO static_data.b_jabilladvisors (insurerno,"insurerCode",
      //  advisorno, "agentCode",
      //   billadvisorno, billdate, createusercode, amt, cashierreceiptno, active, old_keyid ,
      //     withheld, totalprem, commout_amt, commout_taxamt, ovout_amt, ovout_taxamt  ) 
      //   VALUES ((select id from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), :insurerCode,
      //   (select id from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y'), :agentCode,
      //   :billadvisorno, :billdate, :createusercode, :amt, :cashierreceiptno, 'Y', :old_keyid ,
      //   :withheld, :totalprem, :commout_amt, :commout_taxamt, :ovout_amt, :ovout_taxamt ) RETURNING "id" `,
      //       {
      //         replacements: {
      //           insurerCode:req.body.bill.insurerCode,
      //           agentCode:req.body.bill.agentCode,
      //            billadvisorno: req.body.bill.billadvisorno,
      //           billdate: billdate,
      //           createusercode: usercode,
      //           amt:req.body.bill.amt,
      //           cashierreceiptno:null,
      //           withheld    : req.body.bill.withheld, 
      //           totalprem   : req.body.bill.totalprem, 
      //           commout_amt : req.body.bill.commout_amt, 
      //           commout_taxamt : req.body.bill.commout_taxamt, 
      //           ovout_amt   : req.body.bill.ovout_amt,
      //           ovout_taxamt   : req.body.bill.ovout_taxamt,
      //           old_keyid: req.body.bill.old_keyid,
      //         },
      //         transaction: t ,
      //         type: QueryTypes.INSERT
      //       }
      //     );

      //update status old bill
       await sequelize.query(
        `UPDATE static_data.b_jabilladvisors SET active = \'N\', inactiveusercode = :inactiveusercode, inactivedate = :inactivedate WHERE id = :old_keyid ;`,
            {
              replacements: {
                inactivedate: new Date(),
                inactiveusercode: usercode,
                old_keyid: req.body.bill.old_keyid,
              },
              transaction: t ,
              type: QueryTypes.INSERT
            }
          );

  for (let i = 0; i < req.body.detail.length; i++) {
      //insert to deteil of jabilladvisor
      if (req.body.detail[i].statementtype === 'G') {
        req.body.detail[i].commout_taxamt = 0
        req.body.detail[i].ovout_taxamt = 0
      }

      await sequelize.query(
        `insert into static_data.b_jabilladvisordetails (keyidm, polid, "policyNo", dftxno, customerid, motorid, grossprem, duty, tax, totalprem, "comm-out%", "comm-out-amt", 
         "ov-out%", "ov-out-amt",  "commout_taxamt", "ovout_taxamt", netflag, billpremium, updateusercode, seqno, withheld, specdiscamt) 
        values (:keyidm, :polid, :policyNo, :dftxno,
        (select id from static_data."Insurees" where "insureeCode" = :insureeCode and lastversion = 'Y' ), :motorid, 
        -- :customerid,
        :grossprem, :duty, :tax, :totalprem, :commout_rate, :commout_amt, :ovout_rate, :ovout_amt, :commout_taxamt, :ovout_taxamt, :netflag,
         :billpremium, :updateusercode, :seqno, :withheld, :specdiscamt) `,
            {
              replacements: {
                keyidm: billadvisors[0][0].id,
                polid : req.body.detail[i].polid,
                policyNo: req.body.detail[i].policyNo,
                dftxno: req.body.detail[i].dftxno,
                insureeCode: req.body.detail[i].insureeCode,
                // customerid : req.body.detail[i].customerid,
                motorid: req.body.detail[i].itemList || null,
                grossprem: req.body.detail[i].netgrossprem,
                duty: req.body.detail[i].duty,
                tax: req.body.detail[i].tax,
                totalprem: req.body.detail[i].totalprem,
                commout_rate: req.body.detail[i].commout_rate,
                commout_amt: req.body.detail[i].commout_amt,
                ovout_rate: req.body.detail[i].ovout_rate,
                ovout_amt: req.body.detail[i].ovout_amt,
                commout_taxamt: req.body.detail[i].commout_taxamt,
                ovout_taxamt: req.body.detail[i].ovout_taxamt,
                netflag: req.body.detail[i].statementtype,
                billpremium: req.body.detail[i].billpremium,
                withheld: req.body.detail[i].withheld,
                specdiscamt: req.body.detail[i].specdiscamt,
                updateusercode: usercode,
                seqno: req.body.detail[i].seqNo,
              },
              transaction: t ,
              type: QueryTypes.INSERT
            }
          );

        }
        console.log('oldkeyid : ' +req.body.bill.old_keyid);
        console.log('billid : ' +billadvisors[0][0].id);
        //update ARAP table remove old billadvisor && netflag then update
        await sequelize.query(
          `DO $$ 
          DECLARE a_policyno text; a_dftxno text; a_billadvisorno text; a_netflag text; a_seqno int; 
          BEGIN 
          -- Update rows where billadvisor matches
          UPDATE static_data."Transactions" 
          SET billadvisorno = null, netflag = null 
          WHERE billadvisorno = (SELECT billadvisorno FROM static_data.b_jabilladvisors WHERE id = ${req.body.bill.old_keyid} ); 

          FOR a_policyno, a_dftxno, a_billadvisorno, a_netflag , a_seqno IN 
              SELECT d."policyNo", d.dftxno, billadvisorno, netflag , seqno
              FROM static_data.b_jabilladvisors m
              JOIN static_data.b_jabilladvisordetails d  ON m.id = d.keyidm 
              WHERE m.active = 'Y' AND m.id = ${billadvisors[0][0].id} 
            LOOP
              UPDATE static_data."Transactions" 
              SET billadvisorno = a_billadvisorno, netflag = a_netflag 
              WHERE "policyNo" = a_policyno and dftxno = a_dftxno and status ='N' and "seqNo" = a_seqno ; 
            END LOOP; 

            
          END $$;`,
          { 
          transaction: t ,
          raw: true 
        }
        )

        await t.commit();
        await res.json({msg:"success!!"})

     } catch (error) {
      console.error(error)
      await t.rollback();
      await res.status(500).json(error);
      }
}

const invoicePDF = async (req,res) =>{
  try {
    const jwt = req.headers.authorization.split(' ')[1];
    const usercode = decode(jwt).USERNAME;
  const currentdate = getCurrentDate()
  const invoiceNo = req.body.invoiceNo
  const results = await sequelize.query(
    `select ju."invoiceNo" ,t."dueDate" ,ju."seqNo",
(case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as "insureeName" ,
 (l.t_location_1||' '||l.t_location_2||' หมู่ '||l.t_location_3||' ซอย '||l.t_location_4||' ถนน '||l.t_location_5||' ต.'||t3.t_tambonname||' อ.'||a.t_amphurname||' จ.'||p2.t_provincename||' '||l.zipcode) as "insureeLocation",
 p."insureeCode" ,
 (case when e_ins."personType" ='P' then  tt_ins."TITLETHAIBEGIN" || ' ' || e_ins."t_firstName"||' '||e_ins."t_lastName" else 
        tt_ins."TITLETHAIBEGIN"|| ' '|| e_ins."t_ogName"|| COALESCE(' สาขา '|| e_ins."t_branchName",'' ) || ' '|| tt_ins."TITLETHAIEND" end) as "insurerName" ,
 (select it."insureName"  from static_data."InsureTypes" it where it.id = p."insureID") as "insureName",
 p."policyNo" ,p3."endorseNo" ,p3.cover_amt ,p."actDate" ,p."expDate" ,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.netgrossprem else epm.diffnetgrossprem  end ) as netgrossprem,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.duty else epm.diffduty  end ) as duty,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.tax else epm.difftax  end ) as tax,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.totalprem else epm.difftotalprem  end ) as totalprem,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.specdiscamt else epm.discinamt  end ) as specdiscamt,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then (p3.totalprem - p3.specdiscamt) else (epm.difftotalprem - epm.discinamt)  end ) as totalamt,
  (ju.totalprem - ju.specdiscamt) as seqamt
 from  static_data.b_jupgrs ju  
join static_data."Policies" p on ju.polid =p.id and p."lastVersion" ='Y'
--and ju."endorseNo" =p."endorseNo"
left join static_data."Transactions" t on ju."policyNo" = t."policyNo" and t.dftxno = ju.dftxno and ju."seqNo" =t."seqNo"
--and ju."endorseNo" =t."endorseNo"  
left join static_data."Insurees" i on p."insureeCode"  = i."insureeCode" and i.lastversion = 'Y'
left join static_data."Entities" e on e.id = i."entityID" 
left join static_data."Titles" t2 on t2."TITLEID" =e."titleID" 
left join static_data."Insurers"  ins on p."insurerCode"  = ins."insurerCode"  and ins.lastversion  ='Y'
left join static_data."Entities" e_ins on e_ins.id = ins."entityID" 
left join static_data."Titles" tt_ins on tt_ins."TITLEID" =e_ins."titleID" 
left join static_data."Locations" l on l."entityID" =e.id and l.lastversion = 'Y'
join static_data.provinces p2 on p2.provinceid =l."provinceID" 
join  static_data."Amphurs" a on a.amphurid =l."districtID" 
join static_data."Tambons" t3 on t3.tambonid =l."subDistrictID" 
left join static_data.b_juepms epm on epm.polid = t.polid 
left join static_data.b_juedts edt2 on edt2.polid= t.polid 
left join static_data."Policies" p3 on p3.id = t.polid 
where ju."invoiceNo" = :invoiceNo
and t.status ='N'
and t."transType" ='PREM-IN' ;`,
        {
          replacements: {
            invoiceNo: invoiceNo,
          },
          type: QueryTypes.SELECT
        }
      );
      if (results.length < 1) {
        
        throw new Error('not found data');
      }

      //#region GENEXCEL FROM TEMPLATE 
  // const workbook = new excelJS.Workbook();
  // const path = "./Reports";
  // const invoiceBuffer = await fs.promises.readFile(`${path}/invoice.xlsx`);
  // await workbook.xlsx.load(invoiceBuffer);
  

  // const worksheet = workbook.getWorksheet("Sheet1");

  // if (!worksheet) {
    
  //   throw new Error('Worksheet not found');
  // }
  // worksheet.getCell('H4').value = results[0].invoiceNo;
  // worksheet.getCell('H6').value = results[0].dueDate;
  // worksheet.getCell('B6').value = results[0].insureeName;
  // worksheet.getCell('B7').value = results[0].insureeCode;
  // worksheet.getCell('B8').value = results[0].insureeLocation;
  // worksheet.getCell('F8').value = results[0].insurerName;
  // worksheet.getCell('F10').value = results[0].insureName;
  // worksheet.getCell('B12').value = results[0].policyNo;
  // worksheet.getCell('F12').value = results[0].actDate;
  // worksheet.getCell('H12').value = results[0].expDate;
  // worksheet.getCell('B14').value = results[0].endorseNo;
  // worksheet.getCell('B16').value = results[0].cover_amt;
  // worksheet.getCell('G14').value = results[0].netgrossprem;
  // worksheet.getCell('G15').value = results[0].duty;
  // worksheet.getCell('G16').value = results[0].tax;
  // worksheet.getCell('G17').value = results[0].totalprem;
  // worksheet.getCell('G18').value = results[0].specdiscamt;
  // worksheet.getCell('G19').value = results[0].totalamt;
  // worksheet.getCell('G20').value = results[0].seqamt;

  // worksheet.getCell('H28').value = results[0].invoiceNo;
  // worksheet.getCell('H30').value = results[0].dueDate;
  // worksheet.getCell('B30').value = results[0].insureeName;
  // worksheet.getCell('B31').value = results[0].insureeCode;
  // worksheet.getCell('B32').value = results[0].insureeLocation;
  // worksheet.getCell('F32').value = results[0].insurerName;
  // worksheet.getCell('F34').value = results[0].insureName;
  // worksheet.getCell('B36').value = results[0].policyNo;
  // worksheet.getCell('F36').value = results[0].actDate;
  // worksheet.getCell('H36').value = results[0].expDate;
  // worksheet.getCell('B38').value = results[0].endorseNo;
  // worksheet.getCell('B40').value = results[0].cover_amt;
  // worksheet.getCell('G38').value = results[0].netgrossprem;
  // worksheet.getCell('G39').value = results[0].duty;
  // worksheet.getCell('G40').value = results[0].tax;
  // worksheet.getCell('G41').value = results[0].totalprem;
  // worksheet.getCell('G42').value = results[0].specdiscamt;
  // worksheet.getCell('G43').value = results[0].totalamt;
  // worksheet.getCell('G44').value = results[0].seqamt;



  // const newInvoiceBuffer = await workbook.xlsx.writeBuffer();
//#endregion GENEXCEL FROM TEMPLATE
//#region CONVERT EXCEL TO PDF
// Create a browser instance
// const browser = await puppeteer.launch();
const htmlContent  = await getPreviewinvoice(invoiceNo);
const browser  = await puppeteer.launch(
              {
                executablePath: '/usr/bin/chromium-browser', // Ensure this path is correct
                 headless: true,
                 args: [
                      '--no-sandbox',
                     '--disable-setuid-sandbox',
                     '--font-render-hinting=none'
                  ]
             }
         );
// Create a new page
const page = await browser.newPage();
await page.setContent(htmlContent, { waitUntil: 'networkidle0' });


// await page.setContent(html, { waitUntil: 'domcontentloaded' });
//To reflect CSS used for screens instead of print
await page.emulateMediaType('screen');
const pdfBuffer = await page.pdf({
  // path: `${path}/invoice.pdf`,
  margin: { top: '30px', right: '10px', bottom: '10px', left: '10px' },
  printBackground: true,
  format: 'A4',
});

// Close the browser instance
await browser.close();  



     res.setHeader('Content-Type', 'application/pdf');
        res.setHeader("Content-Disposition", "attachment; filename=modified_invoice.pdf");
        console.log('ok6');

 //upodate lastprintdate lastprintuser
 await sequelize.query(
  `update static_data.b_jupgrs 
  set 
  lastprintuser = :lastprintuser,
  lastprintdate = :lastprintdate
  where "invoiceNo" = :invoiceNo;`,
      {
        replacements: {
          invoiceNo: invoiceNo,
          lastprintuser: usercode,
          lastprintdate: currentdate,
        },
        type: QueryTypes.UPDATE
      }
    );
    console.log('ok7');
    // await res.send(newInvoiceBuffer);
    await res.send(Buffer.from(pdfBuffer));
    
  } catch (err) {
    console.error(err);
    res.status(500).send({
      status: "error",
      message: err.message,
    });
  }

}

const invoiceHTML = async (req,res) =>{
  try {
    const jwt = req.headers.authorization.split(' ')[1];
    const usercode = decode(jwt).USERNAME;
  const currentdate = getCurrentDate()
  const invoiceNo = req.body.invoiceNo

  const htmlString = await getPreviewinvoice(invoiceNo);



     res.setHeader('Content-Type', 'text/html');
        res.setHeader("Content-Disposition", "attachment; filename=modified_invoice.pdf");
        console.log('ok6');

 

    await res.send(htmlString);
    
  } catch (err) {
    console.error(err);
    res.status(500).send({
      status: "error",
      message: err.message,
    });
  }

}
const getPreviewinvoice = async (invoiceNo) =>{
  try {
    
  const currentdate = getCurrentDate()
  const results = await sequelize.query(
    `select ju."invoiceNo" ,t."dueDate" ,ju."seqNo",
(case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as "insureeName" ,
 (l.t_location_1||' '||l.t_location_2||' หมู่ '||l.t_location_3||' ซอย '||l.t_location_4||' ถนน '||l.t_location_5||' ต.'||t3.t_tambonname||' อ.'||a.t_amphurname||' จ.'||p2.t_provincename||' '||l.zipcode) as "insureeLocation",
 p."insureeCode" ,
 (case when e_ins."personType" ='P' then  tt_ins."TITLETHAIBEGIN" || ' ' || e_ins."t_firstName"||' '||e_ins."t_lastName" else 
        tt_ins."TITLETHAIBEGIN"|| ' '|| e_ins."t_ogName"|| COALESCE(' สาขา '|| e_ins."t_branchName",'' ) || ' '|| tt_ins."TITLETHAIEND" end) as "insurerName" ,
 (select it."insureName"  from static_data."InsureTypes" it where it.id = p."insureID") as "insureName",
 p."policyNo" ,p3."endorseNo" ,p3.cover_amt ,p."actDate" ,p."expDate" ,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.netgrossprem else epm.diffnetgrossprem  end ) as netgrossprem,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.duty else epm.diffduty  end ) as duty,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.tax else epm.difftax  end ) as tax,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.totalprem else epm.difftotalprem  end ) as totalprem,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.specdiscamt else epm.discinamt  end ) as specdiscamt,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then (p3.totalprem - p3.specdiscamt) else (epm.difftotalprem - epm.discinamt)  end ) as totalamt,
  (ju.totalprem - ju.specdiscamt) as seqamt
 from  static_data.b_jupgrs ju  
join static_data."Policies" p on ju.polid =p.id and p."lastVersion" ='Y'
--and ju."endorseNo" =p."endorseNo"
left join static_data."Transactions" t on ju."policyNo" = t."policyNo" and t.dftxno = ju.dftxno and ju."seqNo" =t."seqNo"
--and ju."endorseNo" =t."endorseNo"  
left join static_data."Insurees" i on p."insureeCode"  = i."insureeCode" and i.lastversion = 'Y'
left join static_data."Entities" e on e.id = i."entityID" 
left join static_data."Titles" t2 on t2."TITLEID" =e."titleID" 
left join static_data."Insurers"  ins on p."insurerCode"  = ins."insurerCode"  and ins.lastversion  ='Y'
left join static_data."Entities" e_ins on e_ins.id = ins."entityID" 
left join static_data."Titles" tt_ins on tt_ins."TITLEID" =e_ins."titleID" 
left join static_data."Locations" l on l."entityID" =e.id and l.lastversion = 'Y'
join static_data.provinces p2 on p2.provinceid =l."provinceID" 
join  static_data."Amphurs" a on a.amphurid =l."districtID" 
join static_data."Tambons" t3 on t3.tambonid =l."subDistrictID" 
left join static_data.b_juepms epm on epm.polid = t.polid 
left join static_data.b_juedts edt2 on edt2.polid= t.polid 
left join static_data."Policies" p3 on p3.id = t.polid 
where ju."invoiceNo" = :invoiceNo
and t.status ='N'
and t."transType" ='PREM-IN' ;`,
        {
          replacements: {
            invoiceNo: invoiceNo,
          },
          type: QueryTypes.SELECT
        }
      );
      if (results.length < 1) {
        
        throw new Error('not found data');
      }

      
  // worksheet.getCell('H4').value = results[0].invoiceNo;
  // worksheet.getCell('H6').value = results[0].dueDate;
  // worksheet.getCell('B6').value = results[0].insureeName;
  // worksheet.getCell('B7').value = results[0].insureeCode;
  // worksheet.getCell('B8').value = results[0].insureeLocation;
  // worksheet.getCell('F8').value = results[0].insurerName;
  // worksheet.getCell('F10').value = results[0].insureName;
  // worksheet.getCell('B12').value = results[0].policyNo;
  // worksheet.getCell('F12').value = results[0].actDate;
  // worksheet.getCell('H12').value = results[0].expDate;
  // worksheet.getCell('B14').value = results[0].endorseNo;
  // worksheet.getCell('B16').value = results[0].cover_amt;
  // worksheet.getCell('G14').value = results[0].netgrossprem;
  // worksheet.getCell('G15').value = results[0].duty;
  // worksheet.getCell('G16').value = results[0].tax;
  // worksheet.getCell('G17').value = results[0].totalprem;
  // worksheet.getCell('G18').value = results[0].specdiscamt;
  // worksheet.getCell('G19').value = results[0].totalamt;
  // worksheet.getCell('G20').value = results[0].seqamt;

  // worksheet.getCell('H28').value = results[0].invoiceNo;
  // worksheet.getCell('H30').value = results[0].dueDate;
  // worksheet.getCell('B30').value = results[0].insureeName;
  // worksheet.getCell('B31').value = results[0].insureeCode;
  // worksheet.getCell('B32').value = results[0].insureeLocation;
  // worksheet.getCell('F32').value = results[0].insurerName;
  // worksheet.getCell('F34').value = results[0].insureName;
  // worksheet.getCell('B36').value = results[0].policyNo;
  // worksheet.getCell('F36').value = results[0].actDate;
  // worksheet.getCell('H36').value = results[0].expDate;
  // worksheet.getCell('B38').value = results[0].endorseNo;
  // worksheet.getCell('B40').value = results[0].cover_amt;
  // worksheet.getCell('G38').value = results[0].netgrossprem;
  // worksheet.getCell('G39').value = results[0].duty;
  // worksheet.getCell('G40').value = results[0].tax;
  // worksheet.getCell('G41').value = results[0].totalprem;
  // worksheet.getCell('G42').value = results[0].specdiscamt;
  // worksheet.getCell('G43').value = results[0].totalamt;
  // worksheet.getCell('G44').value = results[0].seqamt;

  const path = "./Reports";
  const templatePath = `${path}/invoice.ejs`;
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file '${templatePath}' not found.`);
}
const template = fs.readFileSync(templatePath, 'utf-8');

        const htmlContent = ejs.render(template, { data: results[0] });
        return htmlContent;
    
    
  } catch (err) {
    console.error(err);
    throw err;
    
  }
}
const invoicePDF_old = async (req,res) =>{
  try {
    const jwt = req.headers.authorization.split(' ')[1];
    const usercode = decode(jwt).USERNAME;
  const currentdate = getCurrentDate()
  const invoiceNo = req.body.invoiceNo
  const results = await sequelize.query(
    `select ju."invoiceNo" ,t."dueDate" ,ju."seqNo",
(case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as "insureeName" ,
 (l.t_location_1||' '||l.t_location_2||' หมู่ '||l.t_location_3||' ซอย '||l.t_location_4||' ถนน '||l.t_location_5||' ต.'||t3.t_tambonname||' อ.'||a.t_amphurname||' จ.'||p2.t_provincename||' '||l.zipcode) as "insureeLocation",
 p."insureeCode" ,
 (case when e_ins."personType" ='P' then  tt_ins."TITLETHAIBEGIN" || ' ' || e_ins."t_firstName"||' '||e_ins."t_lastName" else 
        tt_ins."TITLETHAIBEGIN"|| ' '|| e_ins."t_ogName"|| COALESCE(' สาขา '|| e_ins."t_branchName",'' ) || ' '|| tt_ins."TITLETHAIEND" end) as "insurerName" ,
 (select it."insureName"  from static_data."InsureTypes" it where it.id = p."insureID") as "insureName",
 p."policyNo" ,p3."endorseNo" ,p3.cover_amt ,p."actDate" ,p."expDate" ,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.netgrossprem else epm.diffnetgrossprem  end ) as netgrossprem,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.duty else epm.diffduty  end ) as duty,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.tax else epm.difftax  end ) as tax,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.totalprem else epm.difftotalprem  end ) as totalprem,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then p3.specdiscamt else epm.discinamt  end ) as specdiscamt,
( case when epm.id  is null or edt2.edtypecode like 'MT%' then (p3.totalprem - p3.specdiscamt) else (epm.difftotalprem - epm.discinamt)  end ) as totalamt,
  (ju.totalprem - ju.specdiscamt) as seqamt
 from  static_data.b_jupgrs ju  
join static_data."Policies" p on ju.polid =p.id and p."lastVersion" ='Y'
--and ju."endorseNo" =p."endorseNo"
left join static_data."Transactions" t on ju."policyNo" = t."policyNo" and t.dftxno = ju.dftxno and ju."seqNo" =t."seqNo"
--and ju."endorseNo" =t."endorseNo"  
left join static_data."Insurees" i on p."insureeCode"  = i."insureeCode" and i.lastversion = 'Y'
left join static_data."Entities" e on e.id = i."entityID" 
left join static_data."Titles" t2 on t2."TITLEID" =e."titleID" 
left join static_data."Insurers"  ins on p."insurerCode"  = ins."insurerCode"  and ins.lastversion  ='Y'
left join static_data."Entities" e_ins on e_ins.id = ins."entityID" 
left join static_data."Titles" tt_ins on tt_ins."TITLEID" =e_ins."titleID" 
left join static_data."Locations" l on l."entityID" =e.id and l.lastversion = 'Y'
join static_data.provinces p2 on p2.provinceid =l."provinceID" 
join  static_data."Amphurs" a on a.amphurid =l."districtID" 
join static_data."Tambons" t3 on t3.tambonid =l."subDistrictID" 
left join static_data.b_juepms epm on epm.polid = t.polid 
left join static_data.b_juedts edt2 on edt2.polid= t.polid 
left join static_data."Policies" p3 on p3.id = t.polid 
where ju."invoiceNo" = :invoiceNo
and t.status ='N'
and t."transType" ='PREM-IN' ;`,
        {
          replacements: {
            invoiceNo: invoiceNo,
          },
          type: QueryTypes.SELECT
        }
      );
      if (results.length < 1) {
        
        throw new Error('not found data');
      }
  const workbook = new excelJS.Workbook();
  const path = "./Reports";
  const invoiceBuffer = await fs.promises.readFile(`${path}/invoice.xlsx`);
  await workbook.xlsx.load(invoiceBuffer);
  

  const worksheet = workbook.getWorksheet("Sheet1");

  if (!worksheet) {
    
    throw new Error('Worksheet not found');
  }
  worksheet.getCell('H4').value = results[0].invoiceNo;
  worksheet.getCell('H6').value = results[0].dueDate;
  worksheet.getCell('B6').value = results[0].insureeName;
  worksheet.getCell('B7').value = results[0].insureeCode;
  worksheet.getCell('B8').value = results[0].insureeLocation;
  worksheet.getCell('F8').value = results[0].insurerName;
  worksheet.getCell('F10').value = results[0].insureName;
  worksheet.getCell('B12').value = results[0].policyNo;
  worksheet.getCell('F12').value = results[0].actDate;
  worksheet.getCell('H12').value = results[0].expDate;
  worksheet.getCell('B14').value = results[0].endorseNo;
  worksheet.getCell('B16').value = results[0].cover_amt;
  worksheet.getCell('G14').value = results[0].netgrossprem;
  worksheet.getCell('G15').value = results[0].duty;
  worksheet.getCell('G16').value = results[0].tax;
  worksheet.getCell('G17').value = results[0].totalprem;
  worksheet.getCell('G18').value = results[0].specdiscamt;
  worksheet.getCell('G19').value = results[0].totalamt;
  worksheet.getCell('G20').value = results[0].seqamt;

  worksheet.getCell('H28').value = results[0].invoiceNo;
  worksheet.getCell('H30').value = results[0].dueDate;
  worksheet.getCell('B30').value = results[0].insureeName;
  worksheet.getCell('B31').value = results[0].insureeCode;
  worksheet.getCell('B32').value = results[0].insureeLocation;
  worksheet.getCell('F32').value = results[0].insurerName;
  worksheet.getCell('F34').value = results[0].insureName;
  worksheet.getCell('B36').value = results[0].policyNo;
  worksheet.getCell('F36').value = results[0].actDate;
  worksheet.getCell('H36').value = results[0].expDate;
  worksheet.getCell('B38').value = results[0].endorseNo;
  worksheet.getCell('B40').value = results[0].cover_amt;
  worksheet.getCell('G38').value = results[0].netgrossprem;
  worksheet.getCell('G39').value = results[0].duty;
  worksheet.getCell('G40').value = results[0].tax;
  worksheet.getCell('G41').value = results[0].totalprem;
  worksheet.getCell('G42').value = results[0].specdiscamt;
  worksheet.getCell('G43').value = results[0].totalamt;
  worksheet.getCell('G44').value = results[0].seqamt;



  const newInvoiceBuffer = await workbook.xlsx.writeBuffer();

  // await fs.promises.writeFile("modified_invoice.xlsx", newInvoiceBuffer);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=modified_invoice.xlsx");
  
    //  // Create PDF
    //  const pdfDoc = new PDFDocument();
    //  const pdfBuffers = [];
 
    //   pdfDoc.addPage();
    //   pdfDoc.fontSize(12).text(worksheet.name, { align: 'center' });
    //   worksheet.eachRow(row => {
    //       row.eachCell(cell => {
    //           pdfDoc.text(cell.value.toString());
              
    //       });
    //       pdfDoc.moveDown();
    //   });

      
    //   pdfDoc.on('data', chunk => { pdfBuffers.push(chunk)});
    //   pdfDoc.end()
    //   console.log("pdfbffer : " + pdfBuffers.length);
    //  // Collect PDF buffers
    //  const newInvoiceBuffer =   Buffer.concat(pdfBuffers);
    //  console.log(pdfBuffers);
    //  res.setHeader("Content-Type", "application/pdf");
    //     res.setHeader("Content-Disposition", "attachment; filename=modified_invoice.pdf");


 //upodate lastprintdate lastprintuser
 await sequelize.query(
  `update static_data.b_jupgrs 
  set 
  lastprintuser = :lastprintuser,
  lastprintdate = :lastprintdate
  where "invoiceNo" = :invoiceNo;`,
      {
        replacements: {
          invoiceNo: invoiceNo,
          lastprintuser: usercode,
          lastprintdate: currentdate,
        },
        type: QueryTypes.UPDATE
      }
    );
    await res.send(newInvoiceBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      status: "error",
      message: err.message,
    });
  }

}



module.exports = {


  findTransaction,
  findPolicyByPreminDue,
  findPolicyForinvoice,
  findPolicyByBillno,
  createbilladvisor,
  findbilladvisor,
  getbilladvisordetail,
  editbilladvisor,
  invoicePDF,
  invoiceHTML
};