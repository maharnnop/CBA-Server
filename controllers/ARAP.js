const Policy = require("../models").Policy;
const Transaction = require("../models").Transaction;
const CommOVIn = require("../models").CommOVIn; //imported fruits array
const CommOVOut = require("../models").CommOVOut;
const b_jabilladvisor = require("../models").b_jabilladvisor;
const b_jabilladvisordetail = require("../models").b_jabilladvisordetail;
const process = require("process");
const { getRunNo, getCurrentDate, getCurrentYY } = require("./lib/runningno");
const { decode } = require('jsonwebtoken');
require("dotenv").config();
const config = require("../config.json");
const { createCashierMinor } = require("./bill");
// const Package = require("../models").Package;
// const User = require("../models").User;

const wht = config.wht

const { Op, QueryTypes, Sequelize } = require("sequelize");

// Replace 'your_database', 'your_username', 'your_password', and 'your_host' with your database credentials
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    port: process.env.DB_PORT,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

const select_cfg = async (type) => {
  const records = await sequelize.query(
    `SELECT initype, inicode, textvalue, numvalue, activeflag
FROM static_data.b_tuinico
where activeflag ='Y' and initype in (:initype );`,
    {
      replacements: {
        initype: type,
      },
      type: QueryTypes.SELECT,
    }
  );
  return records
}
//ตัดหนี้ premin แบบปกติ
const getbilldata = async (req, res) => {
  const records = await sequelize.query(
    `select bj.* , bj2.amt as receiptamt
    -- (select "insurerCode" from static_data."Insurers" where id = insurerno  ), (select "agentCode" from static_data."Agents" where id = advisorno ), * 
     from static_data.b_jabilladvisors bj
     left join static_data.b_jacashiers bj2 on bj2.cashierreceiveno  = bj.cashierreceiptno 
    where bj.active ='Y' and bj.billadvisorno = :billadvisorno `,
    {
      replacements: {
        billadvisorno: req.body.billadvisorno.trim(),
      },
      type: QueryTypes.SELECT,
    }
  );
  console.log(`------- found billadvisorno : ${req.body.billadvisorno} ----------------`);



  const trans = await sequelize.query(
    // `select t."agentCode", t."insurerCode", t."withheld",
    //     t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" ,
    //     (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid, 
    //     (select "t_firstName"||' '||"t_lastName"  as insureeName from static_data."Entities" where id =
    //     (select "entityID" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) ) as insureeName , 

    //     j.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , (select  "chassisNo" from static_data."Motors" where id = p."itemList"), j.netgrossprem, j.duty, j.tax, j.totalprem, j.commout_rate,
    //     j.commout_amt, j.ovout_rate, j.ovout_amt, t.netflag, t.remainamt
    //     from static_data."Transactions" t 
    //     left join static_data.b_jupgrs j on t.polid = j.polid and t."seqNo" = j."seqNo" 
    //     join static_data."Policies" p on p.id = j.polid
    //     where t.billadvisorno = :billadvisorno 
    //     and t."transType" = 'PREM-IN' and j.installmenttype ='A' 
    //     and t.dfrpreferno is null
    //     and t."agentCode2" is null`
    // get whtcom/ov out only agent1 
    ` select p.fleetflag, t.txtype2, t.id, j.id,t."agentCode", t."insurerCode", t."withheld",
        t."dueDate", t."policyNo", t."endorseNo", t."seqNo" , t.netflag, t.dftxno,
        (case when t.netflag = 'N' then j.totalprem - j.withheld  -j.specdiscamt -j.commout_amt - j.ovout_amt + j.commout_taxamt + j.ovout_taxamt   else
        j.totalprem - j.withheld -j.specdiscamt  end ) as remainamt,
        -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid,
        i.id as customerid,
        (case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as insureeName ,
        (select "licenseNo" from static_data."Motors" where id = p."itemList") ,
        (select  "chassisNo" from static_data."Motors" where id = p."itemList" ),
        j.grossprem ,j.specdiscamt ,j.netgrossprem, j.duty, j.tax, j.totalprem, j.commout_rate, j."invoiceNo",
        j.commout_amt, j.ovout_rate, j.ovout_amt, t.polid, j.commout_taxamt ,j.ovout_taxamt ,
        (select vatflag from static_data."Agents" where "agentCode" = p."agentCode" and lastversion = 'Y' ) 
        from static_data.b_jupgrs j
        left join static_data."Transactions" t on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo"
        left join static_data.b_jabilladvisors bj on t.billadvisorno =bj.billadvisorno and bj.active ='Y'
        left join static_data.b_jabilladvisordetails bd on bd.keyidm =bj.id and t."seqNo"  = bd.seqno and t."policyNo" = bd."policyNo" and t.dftxno = bd.dftxno
        left join static_data."Policies" p on p.id = j.polid
        left join static_data."Insurees" i on i."insureeCode" =p."insureeCode"  and i.lastversion = 'Y'
        left join static_data."Entities" e on e.id = i."entityID" 
        left join static_data."Titles" t2 on t2."TITLEID" = e."titleID" 
        where t.billadvisorno = :billadvisorno
        and t."transType" = 'PREM-IN' 
   		  and j.installmenttype ='A'
        -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
        and t.dfrpreferno is null
        and t."agentCode2" is null;`
    ,
    {
      replacements: {
        billadvisorno: req.body.billadvisorno.trim(),
      },
      type: QueryTypes.SELECT,
    }
  );
  if (records.length === 0) {
    await res.status(201).json({ msg: "not found billadvisorno" });
  } else {
    await res.json({ billdata: records, trans: trans });
  }
};

const getcashierdata = async (req, res) => {
  const records = await sequelize.query(
    "select  *  from static_data.b_jacashiers " +
    "where cashierreceiveno = :cashierreceiveno and transactiontype = :cashierttype",
    {
      replacements: {
        cashierreceiveno: req.body.cashierreceiveno.trim(),
        cashierttype: req.body.cashierttype
      },
      type: QueryTypes.SELECT,
    }
  );

  if (records.length === 0) {
    await res.status(201).json({ msg: "not found cashierno" });
  } else {
    await res.json(records);
  }
};

const getARPremindata = async (req, res) => {
  let cond = ''
  if (req.body.billadvisorno !== null && req.body.billadvisorno !== '') {
    cond = cond + ` and a.billadvisorno = '${req.body.billadvisorno.trim()}'`
  }
  if (req.body.insurercode !== null && req.body.insurercode !== '') {
    // cond = cond + ` and a.insurerno = (select id from static_data."Insurers" where "insurerCode" = '${req.body.insurercode.trim()}')`
    cond = cond + ` and a."insurerCode" =  '${req.body.insurercode.trim()}' `
  }
  if (req.body.advisorcode !== null && req.body.advisorcode !== '') {
    // cond = cond + ` and a.advisorno = (select id from static_data."Agents" where "agentCode" = '${req.body.advisorcode.trim()}')`
    cond = cond + ` and a."agentCode" =  '${req.body.advisorcode.trim()}' `
  }
  if (req.body.cashierreceiveno !== null && req.body.cashierreceiveno !== '') {
    cond = cond + ` and a.cashierreceiveno = '${req.body.cashierreceiveno.trim()}'`
  }
  if (req.body.refno !== null && req.body.refno !== '') {
    cond = cond + ` and a.refno = '${req.body.refno.trim()}'`
  }
  if (req.body.arno !== null && req.body.arno !== '') {
    cond = cond + ` and a.dfrpreferno = '${req.body.arno.trim()}'`
  }
  if (req.body.ardatestart !== null && req.body.ardatestart !== '') {
    cond = cond + ` and a.rprefdate >= '${req.body.ardate}'`
  }
  if (req.body.ardateend !== null && req.body.ardateend !== '') {
    cond = cond + ` and a.rprefdate <= '${req.body.ardate}'`
  }
  if (req.body.arcreateusercode !== null && req.body.arcreateusercode !== '') {
    cond = cond + ` and a.createusercode ='${req.body.arcreateusercode.trim()}'`
  }
  const records = await sequelize.query(
    `select a.billadvisorno, 
    -- (select "insurerCode" from static_data."Insurers" where id = a.insurerno ) as insurercode,
    -- (select "agentCode" from static_data."Agents" where id = a.advisorno ) as advisorcode,
    a."insurerCode" as insurercode, a."agentCode"  as advisorcode,
    a.cashierreceiveno, b.cashierdate as cashierdate, a.cashieramt,
    a.dfrpreferno as "ARNO", a.rprefdate as "ARDate",
    a.createusercode as "ARcreateusercode",a.actualvalue,a.diffamt,a.status
    from static_data.b_jaaraps a
    join static_data.b_jacashiers b on b.cashierreceiveno = a.cashierreceiveno
    where 1=1 
    ${cond}`,
    {
      type: QueryTypes.SELECT,
    }
  );

  if (records.length === 0) {
    await res.status(201).json({ msg: "not found cashierno" });
  } else {
    await res.json(records);
  }
};

const submitARPremin = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.arno =
      `ARNO-${getCurrentYY()}` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));
    


    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, dfrpreferno, rprefdate,
             netprem, commout, ovout, whtcommout, whtovout, withheld, specdiscamt )
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode ,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode, :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :dfrpreferno, :rprefdate,
            :netprem, :commout, :ovout, :whtcommout, :whtovout, :withheld, :specdiscamt ) Returning id`,
      {
        replacements: {
          billadvisorno: req.body.master.billadvisorno,
          cashierreceiveno: req.body.master.cashierreceiveno,
          cashieramt: req.body.master.amt,
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-IN",
          actualvalue: req.body.master.actualvalue,
          diffamt: req.body.master.diffamt,
          status: "A",
          createusercode: usercode,
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,
          billdate: billdate,
          netprem: req.body.master.netprem,
          commout: req.body.master.commout,
          ovout: req.body.master.ovout,
          whtcommout: req.body.master.whtcommout,
          whtovout: req.body.master.whtovout,
          withheld: req.body.master.withheld,
          specdiscamt: req.body.master.specdiscamt,
        },

        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //update arno to b_jacashier
    await sequelize.query(
      `update static_data.b_jacashiers set "dfrpreferno" = :arno , status = 'A' where cashierreceiveno = :cashierreceiveno `,
      {
        replacements: {
          arno: req.body.master.arno,
          cashierreceiveno: req.body.master.cashierreceiveno,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );
    for (let i = 0; i < req.body.trans.length; i++) {

      //update xlock = 'Y' policy
    await sequelize.query(
      `update static_data."Policies" set "xlock" = 'Y' where id = :polid `,
      {
        replacements: {
          polid: req.body.trans[i].polid,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].remainamt,
            withheld: req.body.trans[i].withheld,
            specdiscamt: req.body.trans[i].specdiscamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );


      //update arno, refdate to transaction table
      if (req.body.trans[i].fleetflag === 'Y') {
        //#region งาน fleet update premin-dfrpreferno (PremInOut, discIN/Out, CommOvOut, CommOvIn) and dfrprefer (premin, DiscIn) same seqNo
        await sequelize.query(
          `update static_data."Transactions" 
        set 
        dfrpreferno = CASE WHEN "transType" in ( 'PREM-IN', 'DISC-IN') THEN :dfrpreferno ELSE dfrpreferno END,
        rprefdate = CASE WHEN "transType" in ( 'PREM-IN', 'DISC-IN') THEN :rprefdate ELSE rprefdate END,
        receiptno = CASE WHEN "transType" in ('PREM-IN', 'DISC-IN') THEN :cashierreceiveno ELSE receiptno END,
            "premin-dfrpreferno" = :dfrpreferno,
            "premin-rprefdate" = :rprefdate
          where  "transType" in ( 'PREM-IN', 'DISC-IN', 'COMM-OUT', 'OV-OUT', 'DISC-OUT' ,'PREM-OUT', 'COMM-IN', 'OV-IN')
            and "insurerCode" = :insurerCode
            and "agentCode" = :agentCode
            and "policyNo" = :policyNo 
            and "dftxno" = :dftxno 
            and "seqNo" = :seqNo
            and txtype2 in ( 1, 2, 3, 4, 5 ) 
            and status = 'N'`,
          {
            replacements: {
              dfrpreferno: req.body.master.arno,
              rprefdate: billdate,
              agentCode: req.body.trans[i].agentCode,
              insurerCode: req.body.trans[i].insurerCode,
              policyNo: req.body.trans[i].policyNo,
              dftxno: req.body.trans[i].dftxno,

              cashierreceiveno: req.body.master.cashierreceiveno,
              seqNo: req.body.trans[i].seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })

        //#endregion

      } else {

        //#region งาน รายย่อย update  dfrprefer (premin, DiscIn) same seqNo
        await sequelize.query(
          `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'PREM-IN', 'DISC-IN')
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'  and "seqNo" = :seqNo `,
          {
            replacements: {
              dfrpreferno: req.body.master.arno,
              rprefdate: billdate,
              agentCode: req.body.trans[i].agentCode,
              insurerCode: req.body.trans[i].insurerCode,
              policyNo: req.body.trans[i].policyNo,
              dftxno: req.body.trans[i].dftxno,
              // dftxno: req.body.master.dftxno,
              // seqNo: req.body.master.seqNo,
              cashierreceiveno: req.body.master.cashierreceiveno,
              seqNo: req.body.trans[i].seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })

        // กรณี กรมธรรม์ ต้องไม่เหลือ premin หนี้ค้าง ถึง update premin-dfrpreferno (PremInOut, discIN/Out, CommOvOut, CommOvIn) 
        // กรณี สลักหลัง  update premin-dfrpreferno (PremInOut, discIN/Out, CommOvOut, CommOvIn)  same seqNo 
        if (req.body.trans[i].txtype2 === 1) {
          // update premin-dfrpreferno ถ้าจ่ายครบทุกงวดแล้ว
          await sequelize.query(
            `DO $$ 
    BEGIN
        IF (SELECT COUNT(*)
            FROM static_data."Transactions"
            WHERE "transType" = 'PREM-IN'
              AND "policyNo" = '${req.body.trans[i].policyNo}'
              AND dfrpreferno IS NULL
              -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
              and txtype2 = 1
              and status = 'N') = 0
        THEN
            UPDATE static_data."Transactions"
            SET 
                "premin-dfrpreferno" = '${req.body.master.arno}',
                "premin-rprefdate" = '${billdate}'
            WHERE  
                "transType" IN ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
                AND "policyNo" = '${req.body.trans[i].policyNo}'
                AND dfrpreferno IS NULL
                -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
                and txtype2 = 1 
                and status = 'N';
        END if;
    END $$;`,
            {
              transaction: t,
              raw: true
            })

        } else {
          await sequelize.query(
            `update static_data."Transactions" 
    set 
        "premin-dfrpreferno" = :dfrpreferno,
        "premin-rprefdate" = :rprefdate
      where  "transType" in ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
        and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and txtype2 in (  2, 3, 4, 5 ) 
        and status ='N'
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno `,
            {
              replacements: {
                dfrpreferno: req.body.master.arno,
                rprefdate: billdate,
                agentCode: req.body.trans[i].agentCode,
                insurerCode: req.body.trans[i].insurerCode,
                policyNo: req.body.trans[i].policyNo,
                cashierreceiveno: req.body.master.cashierreceiveno,
                // dftxno: req.body.master.dftxno,
                // seqNo: req.body.master.seqNo,
                dftxno: req.body.trans[i].dftxno,
                seqNo: req.body.trans[i].seqNo,
              },
              transaction: t,
              type: QueryTypes.UPDATE,
            })
        }
        //#endregion

      }

      //update arno, refdate to transaction table when netflag = N  update dfrprefer (CommOVOut, DiscOut) same seqNo
      if (req.body.trans[i].netflag === "N") {

        await sequelize.query(
          `update static_data."Transactions" 
        set dfrpreferno = :dfrpreferno ,
          rprefdate = :rprefdate ,
          receiptno = :cashierreceiveno
        where "transType" in ('COMM-OUT','OV-OUT', 'DISC-OUT')
          and status = 'N'
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno 
          and "seqNo" = :seqNo
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'`,
          {
            replacements: {
              dfrpreferno: req.body.master.arno,
              rprefdate: billdate,
              agentCode: req.body.trans[i].agentCode,
              insurerCode: req.body.trans[i].insurerCode,
              // polid: req.body.trans[i].polid,
              policyNo: req.body.trans[i].policyNo,
              dftxno: req.body.trans[i].dftxno,
              seqNo: req.body.trans[i].seqNo,
              // endorseNo: req.body.trans[i].endorseNo,
              cashierreceiveno: req.body.master.cashierreceiveno,
              // seqNo: req.body.trans[i].seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })
      }

    }// end for loop

    //insert to deteil of jatw when netflag = N
    if (req.body.master.netflag === "N") {
      const agent = await sequelize.query(
        '(select taxno, deducttaxrate from static_data."Agents" where "agentCode" = :agentCode )',
        {
          replacements: {
            agentCode: req.body.master.agentCode,
          },
          transaction: t,
          type: QueryTypes.SELECT,
        }

      );
      await sequelize.query(
        `insert into static_data.b_jatws (keyidm, advisorcode, commout_amt, ovout_amt, whtrate, whtcommout_amt,  whtovout_amt, taxid) 
                values(:keyidm, :advisorcode, :commout_amt, :ovout_amt, :deducttaxrate,
                 :whtcommout_amt, :whtovout_amt, :taxno)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            advisorcode: req.body.master.agentCode,
            taxno: agent[0].taxno,
            deducttaxrate: agent[0].deducttaxrate,
            commout_amt: req.body.master.commout,
            ovout_amt: req.body.master.ovout,
            whtcommout_amt: req.body.master.whtcommout,
            whtovout_amt: req.body.master.whtovout,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );
    }

    await t.commit();
    await res.json({
      msg: `created ARNO : ${req.body.master.arno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const saveARPremin = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];

    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode )
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode), :agentCode,
           :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode ) Returning id`,
      {
        replacements: {
          billadvisorno: req.body.master.billadvisorno,
          cashierreceiveno: req.body.master.cashierreceiveno,
          cashieramt: req.body.master.amt,
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-IN",
          actualvalue: req.body.master.actualvalue,
          diffamt: req.body.master.diffamt,
          status: "I",
          createusercode: usercode,

          billdate: billdate,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].remainamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );


    }//end for loop

    //insert to deteil of jatw when netflag = N
    if (req.body.master.netflag === "N") {
      const agent = await sequelize.query(
        'select taxno, deducttaxrate from static_data."Agents" where "agentCode" = :agentCode ',
        {
          replacements: {
            agentCode: req.body.master.agentCode,
          },
          transaction: t,
          type: QueryTypes.SELECT,
        }
      );
      console.log(agent[0]);
      await sequelize.query(
        `insert into static_data.b_jatws (keyidm, advisorcode, commout_amt, ovout_amt, whtrate, whtcommout_amt,  whtovout_amt, taxid) 
                values(:keyidm, :advisorcode, :commout_amt, :ovout_amt, :deducttaxrate,
                 :whtcommout_amt, :whtovout_amt, :taxno)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            advisorcode: req.body.master.agentCode,
            taxno: agent[0].taxno,
            deducttaxrate: agent[0].deducttaxrate,
            commout_amt: req.body.master.commout,
            ovout_amt: req.body.master.ovout,
            whtcommout_amt: req.body.master.whtcommout,
            whtovout_amt: req.body.master.whtovout,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );
    }
    await t.commit();
    await res.json({
      msg: `created billadvisorNO : ${req.body.master.billadvisorno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const getARtrans = async (req, res) => {

  let cond = ''
  let sql = ''
  if (req.body.billadvisorno !== null && req.body.billadvisorno !== '') {
    cond = cond + ` and t.billadvisorno = '${req.body.billadvisorno}'`
  }
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }

  if (req.body.cashierreceiveno !== null && req.body.cashierreceiveno !== '') {
    cond = cond + ` and t.receiptno = '${req.body.cashierreceiveno}'`
  }
  if (req.body.arno !== null && req.body.arno !== '') {
    cond = cond + ` and t."premin-dfrpreferno" = '${req.body.arno}'`
  }

  if (req.body.type === 'prem_out') {
    if (req.body.agentCode !== null && req.body.agentCode !== '') {
      cond = cond + ` and t."agentCode" = '${req.body.agentCode}'`
    }
    if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
      cond = cond + ` and t."premin-rprefdate" >= '${req.body.rprefdatestart}'`
    }
    if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
      cond = cond + ` and t."premin-rprefdate" <= '${req.body.rprefdateend}'`
    }
    sql = `select t."agentCode", t."insurerCode",  
          t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", j."taxInvoiceNo", t."seqNo" ,
          t."premin-dfrpreferno", t."premin-rprefdate",
          -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid, 
          insuree.id  as customerid, 
          (case when ent."personType" = 'P' then  tt."TITLETHAIBEGIN" ||' '|| ent."t_firstName"|| ' ' || ent."t_lastName"  || ' ' ||  tt."TITLETHAIEND" 
          else tt."TITLETHAIBEGIN" ||' '|| ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  || ' ' ||  tt."TITLETHAIEND"  end  ) as insureeName , 
          t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , 
          (select  "chassisNo" from static_data."Motors" where id = p."itemList"), 
          t.netflag, j.netgrossprem, j.duty, j.tax, j.totalprem, j."withheld" ,
          (case when t.netflag = 'N' then  j.commin_rate else 0 end ) as commin_rate,
          (case when t.netflag = 'N' then  j.commin_amt else 0  end ) as commin_amt,
          (case when t.netflag = 'N' then  j.ovin_rate else 0  end ) as ovin_rate,
          (case when t.netflag = 'N' then  j.ovin_amt else 0  end ) as ovin_amt,
          -- j.commout_rate, j.commout_amt, j.ovout_rate, j.ovout_amt, 
          (case when t.netflag = 'N' then j.totalprem - j.withheld - j.commin_amt - j.ovin_amt else j.totalprem - j.withheld end ) as remainamt 
          from static_data."Transactions" t 
          join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
          join static_data."Policies" p on p.id = j.polid 
          left join static_data."Insurees" insuree on insuree."insureeCode" = p."insureeCode" and insuree.lastversion = 'Y'
          left join static_data."Entities" ent on ent.id = insuree."entityID"
          left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
          where t.txtype2 in ( 1, 2, 3, 4, 5 )
          and t.status ='N'
         --  and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
          and "premin-rprefdate" is not null
          and  "premin-dfrpreferno" is not null
          and j.installmenttype ='I' 
          and t."transType" = 'PREM-OUT' 
          and "premout-rprefdate" is null
          and "premout-dfrpreferno" is null
          and rprefdate is null ${cond}`
  } else if (req.body.type === 'comm/ov_out') {
    if (req.body.agentCode !== null && req.body.agentCode !== '') {
      cond = cond + ` and t."mainaccountcode" = '${req.body.agentCode}'`
    }
    if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
      cond = cond + ` and t."premin-rprefdate" >= '${req.body.rprefdatestart}'`
    }
    if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
      cond = cond + ` and t."premin-rprefdate" <= '${req.body.rprefdateend}'`
    }
    sql = `select t."mainaccountcode" as "agentCode" , t."insurerCode",  
            t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo",  j."taxInvoiceNo", t."seqNo" ,
            -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid, 
            insuree.id as customerid, 
            (case when ent."personType" = 'P' then  tt."TITLETHAIBEGIN" ||' '|| ent."t_firstName"|| ' ' || ent."t_lastName"  || ' ' ||  tt."TITLETHAIEND" 
            else tt."TITLETHAIBEGIN" ||' '|| ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  || ' ' ||  tt."TITLETHAIEND"  end  ) as insureeName , 
            t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , 
            (select  "chassisNo" from static_data."Motors" where id = p."itemList"), 
            t.netflag, j.netgrossprem, j.duty, j.tax, j.totalprem, j."withheld" ,
             t."premin-dfrpreferno", t."premin-rprefdate", t.billadvisorno, t.receiptno,
            -- j.commin_rate, j.commin_amt, j.ovin_rate, j.ovin_amt,
            -- (case when t."agentCode2" is null then  j.commout1_rate else j.commout2_rate  end ) as commout_rate,
            -- (case when t."agentCode2" is null then  j.ovout1_rate else j.ovout2_rate  end ) as ovout_rate,
            (case when t."agentCode2" is null then  j.commout1_amt else j.commout2_amt  end ) as commout_amt,
            (case when t."agentCode2" is null then  j.ovout1_amt else j.ovout2_amt  end ) as ovout_amt,
            (case when t."agentCode2" is null then  j.commout1_amt + j.ovout1_amt else j.commout2_amt + j.ovout2_amt  end ) as remainamt 
            from static_data."Transactions" t 
            join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
            join static_data."Policies" p on p.id = j.polid
            left join static_data."Insurees" insuree on insuree."insureeCode" = p."insureeCode" and insuree.lastversion = 'Y'
            left join static_data."Entities" ent on ent.id = insuree."entityID"
            left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
            where t.txtype2 in ( 1, 2, 3, 4, 5 )
            and t.status ='N'
            -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
            and "premin-rprefdate" is not null
            and  "premin-dfrpreferno" is not null
            and j.installmenttype ='A' 
            and t."transType" in ( 'COMM-OUT' ) and rprefdate is null ${cond}`
  } else if (req.body.type === 'comm/ov_in') {
    if (req.body.agentCode !== null && req.body.agentCode !== '') {
      cond = cond + ` and t."agentCode" = '${req.body.agentCode}'`
    }
    if (req.body.arno !== null && req.body.arno !== '') {
      cond = cond + ` and t."premout-dfrpreferno" = '${req.body.arno}'`
    }
    if (req.body.rprefdateend) {
      cond = cond + ` and t."premout-rprefdate" <= '${req.body.rprefdateend}'`
    }
    if (req.body.rprefdatestart) {
      cond = cond + ` and t."premout-rprefdate" >= '${req.body.rprefdatestart}'`
    }
    sql = `select t."agentCode" , t."insurerCode",  
            t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo",  j."taxInvoiceNo", t."seqNo" ,
            -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid, 
            insuree.id as customerid, 
            (case when ent."personType" = 'P' then  tt."TITLETHAIBEGIN" ||' '|| ent."t_firstName"|| ' ' || ent."t_lastName"  || ' ' ||  tt."TITLETHAIEND" 
            else tt."TITLETHAIBEGIN" ||' '|| ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  || ' ' ||  tt."TITLETHAIEND"  end  ) as insureeName , 
            t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , 
            (select  "chassisNo" from static_data."Motors" where id = p."itemList"), 
            t.netflag, j.netgrossprem, j.duty, j.tax, j.totalprem, j."withheld" , 
            t."premout-dfrpreferno", t."premout-rprefdate", t.billadvisorno, t.receiptno,
            j.commin_rate, j.commin_amt, j.ovin_rate, j.ovin_amt, j.commin_taxamt, j.ovin_taxamt,
            (j.commin_amt + j.ovin_amt - j.commin_taxamt - j.ovin_taxamt) as remainamt ,
            (case when (select count(*) from static_data.b_jacashiers where refdfrpreferno = t."premout-dfrpreferno" ) > 0 then 'รอตัดรับค่าคอม' else 'รอสร้างใบรับเงิน' end ) as cashierstatus
            from static_data."Transactions" t 
            join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
            join static_data."Policies" p on p.id = j.polid 
            left join static_data."Insurees" insuree on insuree."insureeCode" = p."insureeCode" and insuree.lastversion = 'Y' 
            left join static_data."Entities" ent on ent.id = insuree."entityID"
            left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
            where t.txtype2 in ( 1, 2, 3, 4, 5 )
            and t.status ='N'
            and "premout-rprefdate" is not null
            and  "premout-dfrpreferno" is not null
            -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
            and j.installmenttype ='I' 
            and t."transType" in ( 'COMM-IN' ) 
            and dfrpreferno is null
            and rprefdate is null ${cond}`
  }

  const trans = await sequelize.query(
    sql,
    {
      replacements: {
        billadvisorno: req.body.billadvisorno,
      },
      type: QueryTypes.SELECT,
    }
  );
  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found transaction" });
  } else {
    await res.json({ trans: trans });
  }
};

//ตัดหนี้ premin แบบ advisor มาจ่ายโดยตรงที่บริษัทประกัน (direct)
const findARPremInDirect = async (req, res) => {
  let cond = ''
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = cond + ` and t."agentCode" = '${req.body.agentCode}'`
  }
  if (req.body.policyNoStart !== null && req.body.policyNoStart !== '') {
    cond = cond + ` and t."policyNo" >= '${req.body.policyNoStart}'`
  }
  if (req.body.policyNoEnd !== null && req.body.policyNoEnd !== '') {
    cond = cond + ` and t."policyNo" <= '${req.body.policyNoEnd}'`
  }
  if (req.body.endorseNoStart !== null && req.body.endorseNoStart !== '') {
    cond = cond + ` and j."endorseNo" = '${req.body.endorseNoStart}'`
  }
  if (req.body.endorseNoEnd !== null && req.body.endorseNoEnd !== '') {
    cond = cond + ` and j."endorseNo" = '${req.body.endorseNoEnd}'`
  }
  if (req.body.invoiceNoStart !== null && req.body.invoiceNoStart !== '') {
    cond = cond + ` and j."invoiceNo" = '${req.body.invoiceNoStart}'`
  }
  if (req.body.invoiceNoEnd !== null && req.body.invoiceNoEnd !== '') {
    cond = cond + ` and j."invoiceNo" = '${req.body.invoiceNoEnd}'`
  }
  const trans = await sequelize.query(
    `select true as select, t."agentCode", t."insurerCode", t."withheld" ,
        t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" ,t.dftxno,
        i.id as customerid, 
        (case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
          t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as insureeName ,
        t.polid, 
        motor."licenseNo", motor."chassisNo", (select t_provincename from static_data."provinces" where provinceid = motor."motorprovinceID" ) as "motorprovince",
        j.specdiscamt, j.netgrossprem, j.duty, j.tax, j.totalprem,
          j.commout_rate,j.commout_amt, j.ovout_rate, j.ovout_amt,
         'G' as netflag, t.remainamt, j.commin_amt, j.ovin_amt, j.commin_rate, j.ovin_rate
        from static_data."Transactions" t 
        join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
        join static_data."Policies" p on p.id = j.polid
        left join static_data."Insurees" i on i."insureeCode" =p."insureeCode" and i.lastversion = 'Y'
        left join static_data."Entities" e on e.id = i."entityID" 
        left join static_data."Titles" t2 on t2."TITLEID" = e."titleID" 
        left join static_data."Motors" motor on motor.id = p."itemList"
        where t."transType" = 'PREM-IN' 
        and t.status ='N'
        -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
        and p."policyType" = 'F'
        and p.specdiscamt = 0 
        and t.dfrpreferno is null
        and j.installmenttype ='A' ${cond} `,
    {

      type: QueryTypes.SELECT,
    }
  );
  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found policy" });
  } else {
    await res.json(trans);
  }
};

const saveARPreminDirect = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    const billdate = new Date().toISOString().split("T")[0];

    //insert to master jaarap
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno,"insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, netprem, commin, ovin, whtcommin, whtovin, commout, ovout, whtcommout, whtovout)
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode), :agentCode,
           :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :netprem, :commin , :ovin,  :whtcommin, :whtovin, :commout, :ovout, :whtcommout, :whtovout) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-INS",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "I",
          createusercode: usercode,
          billdate: billdate,
          netprem: req.body.master.netprem,
          commin: req.body.master.commin,
          ovin: req.body.master.ovin,
        
          whtcommin: req.body.master.whtcommin,
          whtovin: req.body.master.whtovin,
          commout: req.body.master.commout,
          ovout: req.body.master.ovout,
          whtcommout: req.body.master.whtcommout,
          whtovout: req.body.master.whtovout,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].remainamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );


    }//end for loop

    //insert to deteil of jatw when netflag = N
    if (req.body.master.netflag === "N") {
      const agent = await sequelize.query(
        'select taxno, deducttaxrate from static_data."Agents" where "agentCode" = :agentCode ',
        {
          replacements: {
            agentCode: req.body.master.agentCode,
          },
          transaction: t,
          type: QueryTypes.SELECT,
        }
      );
      console.log(agent[0]);
      await sequelize.query(
        `insert into static_data.b_jatws (keyidm, advisorcode, commout_amt, ovout_amt, whtrate, whtcommout_amt,  whtovout_amt, taxid) 
                values(:keyidm, :advisorcode, :commout_amt, :ovout_amt, :deducttaxrate,
                 :whtcommout_amt, :whtovout_amt, :taxno)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            advisorcode: req.body.master.agentCode,
            taxno: agent[0].taxno,
            deducttaxrate: agent[0].deducttaxrate,
            commout_amt: req.body.master.commout,
            ovout_amt: req.body.master.ovout,
            whtcommout_amt: req.body.master.whtcommout,
            whtovout_amt: req.body.master.whtovout,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );
    }
    await t.commit();
    await res.json({
      msg: `created billadvisorNO : ${req.body.master.billadvisorno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const submitARPreminDirect = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.arno =
      `ARNO-${getCurrentYY()}` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno,"insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, netprem, commin, ovin,  whtcommin, whtovin, commout, ovout, whtcommout, whtovout, dfrpreferno, rprefdate )
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode , 
          :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :netprem, :commin , :ovin, :whtcommin, :whtovin, :commout, :ovout, :whtcommout, :whtovout, :dfrpreferno, :rprefdate ) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-INS",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          billdate: billdate,
          netprem: req.body.master.totalprem,
          // commin :  req.body.master.commin,
          // ovin :  req.body.master.ovin,
        
          // whtcommin :  req.body.master.whtcommin,
          // whtovin :  req.body.master.whtovin,
          // commout :  req.body.master.commout,
          // ovout :  req.body.master.ovout,
          // whtcommout :  req.body.master.whtcommout,
          // whtovout :  req.body.master.whtovout,
          commin: 0,
          ovin: 0,
          whtcommin: 0,
          whtovin: 0,
          commout: 0,
          ovout: 0,
          whtcommout: 0,
          whtovout: 0,
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    for (let i = 0; i < req.body.trans.length; i++) {
         //update xlock = 'Y' policy
    await sequelize.query(
      `update static_data."Policies" set "xlock" = 'Y' where id = :polid `,
      {
        replacements: {
          polid: req.body.trans[i].polid,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].remainamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );

      console.log("------------------------ update dfrpreferno in Transaction type PREM-IN/PREM-OUT --------------");
      //update arno, refdate to transaction table
      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno = CASE WHEN "transType" in ( 'PREM-IN', 'PREM-OUT','DISC-IN' ) THEN :dfrpreferno ELSE dfrpreferno END,
      rprefdate = CASE WHEN "transType" in ( 'PREM-IN', 'PREM-OUT','DISC-IN' ) THEN :rprefdate ELSE rprefdate END,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate,
          "premout-dfrpreferno" = :dfrpreferno,
          "premout-rprefdate" = :rprefdate
        where  "transType" in ( 'PREM-IN', 'COMM-OUT', 'OV-OUT','DISC-IN' , 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N'
          -- and polid = :polid
          and "policyNo" = :policyNo
          and dftxno = :dftxno
          and "seqNo" = :seqNo
          and txtype2 in ( 1, 2, 3, 4, 5 ) 
          -- and txtype2 in ( 1, 2 ) `,
        {
          replacements: {
            dfrpreferno: req.body.master.arno,
            rprefdate: billdate,
            insurerCode: req.body.trans[i].insurerCode,
            agentCode: req.body.trans[i].agentCode,
            // polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            dftxno: req.body.trans[i].dftxno,
            seqNo: req.body.trans[i].seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })
      //update arno, refdate to transaction table when netflag = N
      if (req.body.trans[i].netflag === "N") {

        await sequelize.query(
          `update static_data."Transactions" 
        set dfrpreferno = :dfrpreferno ,
          rprefdate = :rprefdate ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where "transType" in ('COMM-OUT','OV-OUT')
          and status = 'N'
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          -- and polid = :polid
          and policyNo = :policyNo
          and dftxno = :dftxno
          and seqNo = :seqNo
          and txtype2 in ( 1, 2, 3, 4, 5 )
          -- and txtype2 in ( 1, 2 )`,
          {
            replacements: {
              dfrpreferno: req.body.master.arno,
              rprefdate: billdate,
              insurerCode: req.body.trans[i].insurerCode,
              agentCode: req.body.trans[i].agentCode,
              // polid: req.body.trans[i].polid,
              policyNo: req.body.trans[i].policyNo,
              dftxno: req.body.trans[i].dftxno,
              seqNo: req.body.trans[i].seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })
      }

    }// end for loop

    //insert to deteil of jatw when netflag = N
    if (req.body.master.netflag === "N") {
      const agent = await sequelize.query(
        '(select taxno, deducttaxrate from static_data."Agents" where "agentCode" = :agentCode )',
        {
          replacements: {
            agentCode: req.body.master.agentCode,
          },
          transaction: t,
          type: QueryTypes.SELECT,
        }
      );
      await sequelize.query(
        `insert into static_data.b_jatws (keyidm, advisorcode, commout_amt, ovout_amt, whtrate, whtcommout_amt,  whtovout_amt, taxid) 
                values(:keyidm, :advisorcode, :commout_amt, :ovout_amt, :deducttaxrate,
                 :whtcommout_amt, :whtovout_amt, :taxno)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            advisorcode: req.body.master.agentCode,
            taxno: agent[0].taxno,
            deducttaxrate: agent[0].deducttaxrate,
            commout_amt: req.body.master.commout,
            ovout_amt: req.body.master.ovout,
            whtcommout_amt: req.body.master.whtcommout,
            whtovout_amt: req.body.master.whtovout,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );

    }
    await t.commit();
    await res.json({
      msg: `created ARNO : ${req.body.master.arno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};
// ค้นหารายการ  ตักหนี้รายย่อย PREM-IN
const findARPremInMinor = async (req, res) => {

  let cond = ''
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = `${cond} and p."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = `${cond} and p."agentCode"  = '${req.body.agentCode}'`
  }
  // if(req.body.dueDate !== null && req.body.dueDate !== ''){
  //   cond = `${cond} and date(t."dueDate") <= '${req.body.dueDate}'`
  // }
  if (req.body.policyNoStart !== null && req.body.policyNoStart !== '') {
    cond = `${cond} and p."policyNo" >= '${req.body.policyNoStart}'`
  }
  if (req.body.policyNoEnd !== null && req.body.policyNoEnd !== '') {
    cond = `${cond} and p."policyNo" <= '${req.body.policyNoEnd}'`
  }
  if (req.body.createdDateStart !== null && req.body.createdDateStart !== '') {
    cond = `${cond} and date(p."createdAt") >= '${req.body.createdDateStart}'`
  }
  if (req.body.createdDateEnd !== null && req.body.createdDateEnd !== '') {
    cond = `${cond} and date(p."createdAt") <= '${req.body.createdDateEnd}'`
  }
  // if(req.body.fleetCode ){ // fleetCode = true
  //   cond = `${cond} and txtype2 in ('1', '2', '3', '4', '5') `
  // }else {
  //   cond = `${cond} and p."fleetCode" is null  and p.fleetflag = 'N' `
  // }


  const records = await sequelize.query(
    `select 
      p."agentCode", p."insurerCode",
      p."policyNo", p."endorseNo",
      -- t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" ,t.dftxno,
      i.id as customerid, p.id as polid ,-- t.id as transID,
      p."insureeCode", it."class" , it."subClass" ,
      (case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
        t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' ) || ' '|| t2."TITLETHAIEND" end) as insureeName ,
       motor."licenseNo", motor."chassisNo", (select t_provincename from static_data."provinces" where provinceid = motor."motorprovinceID" ) as "motorprovince",
      --  j.polid, j.grossprem, j.specdiscrate, j.specdiscamt, j.netgrossprem, j.duty, j.tax, j.totalprem, 
      -- j.commout_rate,j.commout_amt, j.ovout_rate, j.ovout_amt, t.netflag, t.remainamt, j.commout_taxamt, j.ovout_taxamt,
      -- j.commout1_rate,j.commout1_amt, j.ovout1_rate, j.ovout1_amt,
      (case when a."stamentType" = 'Net' then true else false end) as "statementtype",
      -- (j.totalprem - j.withheld - j.specdiscamt ) as "totalamt",
      true as "select"
      from static_data."Policies" p 
      left join static_data."Agents" a on a."agentCode" = p."agentCode" and a.lastversion ='Y'
      left join static_data."Insurees" i on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
      left join static_data."Entities" e on e.id = i."entityID" 
      join static_data."InsureTypes" it on it.id = p."insureID" 
      left join static_data."Titles" t2 on t2."TITLEID" = e."titleID" 
      left join static_data."Motors" motor on motor.id = p."itemList"
      where 
      (select count(*) from static_data."Transactions" t where
      t."policyNo" = p."policyNo" 
      and t."transType" = 'PREM-IN' 
      and txtype2 in ('1', '2') 
      and t.status = 'N'
      and t.billadvisorno is null 
      and t.dfrpreferno is null ) > 0
      -- and p."lastVersion" ='Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
      and p."fleetCode" is null 
       and p.fleetflag = 'N' 
      ${cond}
      order by p."policyNo" `,
    {
      replacements: {
        // agentCode:req.body.agentCode,
        insurerCode: req.body.insurerCode,
        dueDate: req.body.dueDate,
        policyNoStart: req.body.policyNoStart,
        policyNoEnd: req.body.policyNoEnd,
        policyNoAll: req.body.policyNoAll,
      },
      type: QueryTypes.SELECT
    }
  );
  const vatflag = await sequelize.query(
    `select vatflag from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y' `,
    {
      replacements: {
        agentCode: req.body.agentCode
      },
      type: QueryTypes.SELECT
    }
  );

  if (records.length === 0) {
    await res.status(201).json({ msg: "not found policy" })
  } else {

    await res.json({ records: records, vatflag: vatflag })
  }

}

// ตัดหนี้ premin รายย่อย (ใช้เลขกรมธรรม์ตัดจ้าาาา)
const submitARPreminMinorOld = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    let data = {
      transactiontype: 'PREM-IN',
      insurercode: req.body.master.insurerCode,
      advisorcode: req.body.master.agentCode,
      customerid: req.body.master.insureeCode,
      receivefrom: "Advisor",
      receivename: "-",
      usercode: usercode,
      Amt: req.body.master.actualvalue,
    }
    const txtype2 = req.body.master.txtype2

    const cashierreceiveno = await createCashierMinor(data, t)
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.arno =
      `ARNO-${getCurrentYY()}` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, dfrpreferno, rprefdate,
             netprem, commout, ovout, whtcommout, whtovout, withheld , specdiscamt)
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode , :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :dfrpreferno, :rprefdate,
            :netprem, :commout, :ovout, :whtcommout, :whtovout, :withheld, :specdiscamt ) Returning id`,
      {
        replacements: {
          billadvisorno: "-",
          cashierreceiveno: cashierreceiveno,
          cashieramt: req.body.master.actualvalue,
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-IN",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,
          billdate: billdate,
          netprem: req.body.master.totalprem,
          commout: 0,
          ovout: 0,
          whtcommout: 0,
          whtovout: 0,
          withheld: req.body.master.withheld,
          specdiscamt: req.body.master.specdiscamt,
        },

        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //update arno to b_jacashier
    await sequelize.query(
      `update static_data.b_jacashiers set "dfrpreferno" = :arno , status = 'A' where cashierreceiveno = :cashierreceiveno `,
      {
        replacements: {
          arno: req.body.master.arno,
          cashierreceiveno: cashierreceiveno,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

    //insert to deteil of jaarapds
    await sequelize.query(
      `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
      {
        replacements: {
          keyidm: arPremIn[0][0].id,
          polid: req.body.master.polid,
          policyNo: req.body.master.policyNo,
          endorseNo: req.body.master.endorseNo,
          invoiceNo: req.body.master.invoiceNo,
          seqNo: req.body.master.seqNo,
          netflag: "G",
          netamt: req.body.master.actualvalue,
          withheld: req.body.master.withheld,
          specdiscamt: req.body.master.specdiscamt,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );


    //update arno, refdate to transaction table
    // let cond = ' and txtype2 in ( 1, 2, 3, 4, 5 ) and status = \'N\'  and "seqNo" = ' + req.body.master.seqNo
    // if (req.body.master.endorseNo  !== null && req.body.master.endorseNo !== '') {
    //   cond =cond + ` and "endorseNo" =  '${req.body.master.endorseNo}' `
    // }
    // if (req.body.master.seqNo  !== null && req.body.master.seqNo !== '') {
    //   cond = cond +' and "seqNo" = ' + req.body.master.seqNo
    // }
    await sequelize.query(
      `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'PREM-IN', 'DISC-IN')
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'  and "seqNo" = :seqNo `,
      {
        replacements: {
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,
          agentCode: req.body.master.agentCode,
          insurerCode: req.body.master.insurerCode,
          policyNo: req.body.master.policyNo,
          dftxno: req.body.master.dftxno,
          cashierreceiveno: cashierreceiveno,
          seqNo: req.body.master.seqNo,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      })
    if (txtype2 === 1) {
      // update premin-dfrpreferno ถ้าจ่ายครบทุกงวดแล้ว
      await sequelize.query(
        `DO $$ 
    BEGIN
        IF (SELECT COUNT(*)
            FROM static_data."Transactions"
            WHERE "transType" = 'PREM-IN'
              AND "policyNo" = '${req.body.master.policyNo}'
              AND dfrpreferno IS NULL
              -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
              and txtype2 = 1
              and status = 'N') = 0
        THEN
            UPDATE static_data."Transactions"
            SET 
                "premin-dfrpreferno" = '${req.body.master.arno}',
                "premin-rprefdate" = '${billdate}'
            WHERE  
                "transType" IN ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
                AND "policyNo" = '${req.body.master.policyNo}'
                AND dfrpreferno IS NULL
                -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
                and txtype2 = 1 
                and status = 'N';
        END if;
    END $$;`,
        {
          transaction: t,
          raw: true
        })
      // end for loop
    } else {
      await sequelize.query(
        `update static_data."Transactions" 
    set 
        "premin-dfrpreferno" = :dfrpreferno,
        "premin-rprefdate" = :rprefdate
      where  "transType" in ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
        and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and txtype2 in (  2, 3, 4, 5 ) 
        and status ='N'
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno `,
        {
          replacements: {
            dfrpreferno: req.body.master.arno,
            rprefdate: billdate,
            agentCode: req.body.master.agentCode,
            insurerCode: req.body.master.insurerCode,
            policyNo: req.body.master.policyNo,
            dftxno: req.body.master.dftxno,

            cashierreceiveno: cashierreceiveno,
            seqNo: req.body.master.seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })
    }






    await t.commit();
    await res.json({
      msg: `created ARNO : ${req.body.master.arno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

// ตัดหนี้ premin รายย่อย pollist
const submitARPreminMinorPol = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    let data = {
      transactiontype: 'PREM-IN',
      insurercode: req.body.master.insurerCode |'-',
      advisorcode: req.body.master.agentCode,
      customerid: req.body.master.insureeCode |'-',
      receivefrom: "Advisor",
      receivename: "-",
      usercode: usercode,
      Amt: req.body.master.actualvalue,
    }


    const cashierreceiveno = await createCashierMinor(data, t)
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.arno =
      `ARNO-${getCurrentYY()}` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, dfrpreferno, rprefdate,
             netprem, commout, ovout, whtcommout, whtovout, withheld , specdiscamt)
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode , :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :dfrpreferno, :rprefdate,
            :netprem, :commout, :ovout, :whtcommout, :whtovout, :withheld, :specdiscamt ) Returning id`,
      {
        replacements: {
          billadvisorno: "-",
          cashierreceiveno: cashierreceiveno,
          cashieramt: req.body.master.actualvalue,
          insurerCode: req.body.master.insurerCode || '-',
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-IN",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,
          billdate: billdate,
          netprem: req.body.master.totalprem,
          commout: 0,
          ovout: 0,
          whtcommout: 0,
          whtovout: 0,
          withheld: req.body.master.withheld,
          specdiscamt: req.body.master.specdiscamt,
        },

        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //update arno to b_jacashier
    await sequelize.query(
      `update static_data.b_jacashiers set "dfrpreferno" = :arno , status = 'A' where cashierreceiveno = :cashierreceiveno `,
      {
        replacements: {
          arno: req.body.master.arno,
          cashierreceiveno: cashierreceiveno,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

    await Promise.all(req.body.trans.map(async ele => {
      const txtype2 = ele.txtype2

       //update xlock = 'Y' policy
    await sequelize.query(
      `update static_data."Policies" set "xlock" = 'Y' where id = :polid `,
      {
        replacements: {
          polid: ele.polid,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );
    
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
            values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            netflag: "G",
            // polid: req.body.master.polid,
            // policyNo: req.body.master.policyNo,
            // endorseNo: req.body.master.endorseNo,
            // invoiceNo: req.body.master.invoiceNo,
            // seqNo: req.body.master.seqNo,
            // netamt: req.body.master.actualvalue,
            // withheld   :req.body.master.withheld,
            // specdiscamt   :req.body.master.specdiscamt,
            polid: ele.polid,
            policyNo: ele.policyNo,
            endorseNo: ele.endorseNo,
            invoiceNo: ele.invoiceNo,
            seqNo: ele.seqNo,
            netamt: parseFloat(ele.totalamt.toFixed(2)),
            withheld: ele.withheld,
            specdiscamt: ele.specdiscamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );


      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'PREM-IN', 'DISC-IN')
         and "insurerCode" = :insurerCode
         and "agentCode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'  and "seqNo" = :seqNo `,
        {
          replacements: {
            rprefdate: billdate,
            dfrpreferno: req.body.master.arno,
            agentCode: ele.agentCode,
            insurerCode: ele.insurerCode,
            policyNo: ele.policyNo,
            cashierreceiveno: cashierreceiveno,
            // dftxno: req.body.master.dftxno,
            // seqNo: req.body.master.seqNo,
            dftxno: ele.dftxno,
            seqNo: ele.seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })
      if (txtype2 === 1) {
        // update premin-dfrpreferno ถ้าจ่ายครบทุกงวดแล้ว
        await sequelize.query(
          `DO $$ 
    BEGIN
        IF (SELECT COUNT(*)
            FROM static_data."Transactions"
            WHERE "transType" = 'PREM-IN'
              AND "policyNo" = '${ele.policyNo}'
              AND dfrpreferno IS NULL
              -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
              and txtype2 = 1
              and status = 'N') = 0
        THEN
            UPDATE static_data."Transactions"
            SET 
                "premin-dfrpreferno" = '${req.body.master.arno}',
                "premin-rprefdate" = '${billdate}'
            WHERE  
                "transType" IN ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
                AND "policyNo" = '${ele.policyNo}'
                AND dfrpreferno IS NULL
                -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
                and txtype2 = 1 
                and status = 'N';
        END if;
    END $$;`,
          {
            transaction: t,
            raw: true
          })
        // end for loop
      } else {
        await sequelize.query(
          `update static_data."Transactions" 
    set 
        "premin-dfrpreferno" = :dfrpreferno,
        "premin-rprefdate" = :rprefdate
      where  "transType" in ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
         and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and txtype2 in (  2, 3, 4, 5 ) 
        and status ='N'
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno `,
          {
            replacements: {
              dfrpreferno: req.body.master.arno,
              rprefdate: billdate,
              agentCode: ele.agentCode,
              insurerCode: ele.insurerCode,
              policyNo: ele.policyNo,
              cashierreceiveno: cashierreceiveno,
              // dftxno: req.body.master.dftxno,
              // seqNo: req.body.master.seqNo,
              dftxno: ele.dftxno,
              seqNo: ele.seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })
      }

    }));







    await t.commit();
    await res.json({
      msg: `created ARNO : ${req.body.master.arno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};
// ตัดหนี้ premin รายย่อยtranslist
const submitARPreminMinor = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    let data = {
      transactiontype: 'PREM-IN',
      insurercode: req.body.master.insurerCode ,
      advisorcode: req.body.master.agentCode,
      customerid: req.body.master.insureeCode ,
      receivefrom: "Advisor",
      receivename: "-",
      usercode: usercode,
      Amt: req.body.master.actualvalue,
    }


    const cashierreceiveno = await createCashierMinor(data, t)
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.arno =
      `ARNO-${getCurrentYY()}` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, dfrpreferno, rprefdate,
             netprem, commout, ovout, whtcommout, whtovout, withheld , specdiscamt)
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode , :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :dfrpreferno, :rprefdate,
            :netprem, :commout, :ovout, :whtcommout, :whtovout, :withheld, :specdiscamt ) Returning id`,
      {
        replacements: {
          billadvisorno: "-",
          cashierreceiveno: cashierreceiveno,
          cashieramt: req.body.master.actualvalue,
          insurerCode: req.body.master.insurerCode ,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "PREM-IN",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,
          billdate: billdate,
          netprem: req.body.master.totalprem,
          commout: 0,
          ovout: 0,
          whtcommout: 0,
          whtovout: 0,
          withheld: req.body.master.withheld,
          specdiscamt: req.body.master.specdiscamt,
        },

        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //update arno to b_jacashier
    await sequelize.query(
      `update static_data.b_jacashiers set "dfrpreferno" = :arno , status = 'A' where cashierreceiveno = :cashierreceiveno `,
      {
        replacements: {
          arno: req.body.master.arno,
          cashierreceiveno: cashierreceiveno,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

    await Promise.all(req.body.trans.map(async ele => {
      const txtype2 = ele.txtype2

         //update xlock = 'Y' policy
    await sequelize.query(
      `update static_data."Policies" set "xlock" = 'Y' where id = :polid `,
      {
        replacements: {
          polid: ele.polid,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
            values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            netflag: "G",
            // polid: req.body.master.polid,
            // policyNo: req.body.master.policyNo,
            // endorseNo: req.body.master.endorseNo,
            // invoiceNo: req.body.master.invoiceNo,
            // seqNo: req.body.master.seqNo,
            // netamt: req.body.master.actualvalue,
            // withheld   :req.body.master.withheld,
            // specdiscamt   :req.body.master.specdiscamt,
            polid: ele.polid,
            policyNo: ele.policyNo,
            endorseNo: ele.endorseNo,
            invoiceNo: ele.invoiceNo,
            seqNo: ele.seqNo,
            netamt: parseFloat(ele.totalamt.toFixed(2)),
            withheld: ele.withheld,
            specdiscamt: ele.specdiscamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );


      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'PREM-IN', 'DISC-IN')
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'  and "seqNo" = :seqNo `,
        {
          replacements: {
            rprefdate: billdate,
            dfrpreferno: req.body.master.arno,
            agentCode: req.body.master.agentCode,
            insurerCode: req.body.master.insurerCode,
            policyNo: req.body.master.policyNo,
            cashierreceiveno: cashierreceiveno,
            // dftxno: req.body.master.dftxno,
            // seqNo: req.body.master.seqNo,
            dftxno: ele.dftxno,
            seqNo: ele.seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })
      if (txtype2 === 1) {
        // update premin-dfrpreferno ถ้าจ่ายครบทุกงวดแล้ว
        await sequelize.query(
          `DO $$ 
    BEGIN
        IF (SELECT COUNT(*)
            FROM static_data."Transactions"
            WHERE "transType" = 'PREM-IN'
              AND "policyNo" = '${req.body.master.policyNo}'
              AND dfrpreferno IS NULL
              -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
              and txtype2 = 1
              and status = 'N') = 0
        THEN
            UPDATE static_data."Transactions"
            SET 
                "premin-dfrpreferno" = '${req.body.master.arno}',
                "premin-rprefdate" = '${billdate}'
            WHERE  
                "transType" IN ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
                AND "policyNo" = '${req.body.master.policyNo}'
                AND dfrpreferno IS NULL
                -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
                and txtype2 = 1 
                and status = 'N';
        END if;
    END $$;`,
          {
            transaction: t,
            raw: true
          })
        // end for loop
      } else {
        await sequelize.query(
          `update static_data."Transactions" 
    set 
        "premin-dfrpreferno" = :dfrpreferno,
        "premin-rprefdate" = :rprefdate
      where  "transType" in ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
        and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and txtype2 in (  2, 3, 4, 5 ) 
        and status ='N'
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno `,
          {
            replacements: {
              dfrpreferno: req.body.master.arno,
              rprefdate: billdate,
              agentCode: req.body.master.agentCode,
              insurerCode: req.body.master.insurerCode,
              policyNo: req.body.master.policyNo,
              cashierreceiveno: cashierreceiveno,
              // dftxno: req.body.master.dftxno,
              // seqNo: req.body.master.seqNo,
              dftxno: ele.dftxno,
              seqNo: ele.seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })
      }

    }));







    await t.commit();
    await res.json({
      msg: `created ARNO : ${req.body.master.arno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};
// ตัดหนี้ premin รายย่อยtranslist_V2
const submitARPreminMinor_V2 = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  const cashierInfo = req.body.cashierInfo
  const receiverInfo = req.body.receiverInfo
  const invoiceList = req.body.invoiceList
  try {
    const CASHOVER_cfg = (await select_cfg('CASHOVER'))[0].numvalue
    const CASHSHORT_cfg = (await select_cfg('CASHSHORT'))[0].numvalue
    console.log(`>>CASHOVER_cfg : ${CASHOVER_cfg}`)
    console.log(`>>CASHSHORT_cfg : ${CASHSHORT_cfg}`)
    let insurerCode = null
    let agentCode = null
    let insureeCode = null
    if(cashierInfo.receiveForm == "Insurer"){insurerCode = receiverInfo.code
    }else if(cashierInfo.receiveForm == "Advisor"){agentCode = receiverInfo.code
    }else if(cashierInfo.receiveForm == "Customer"){insureeCode = receiverInfo.code}
    let data = {
      transactiontype: 'PREM-IN',
      insurercode: insurerCode,
      advisorcode: agentCode,
      customerid: insureeCode,
      receivefrom: cashierInfo.receiveForm,
      receivename: receiverInfo.name,
      usercode: usercode,
      receivetype : cashierInfo.receiveType,
      Amt: cashierInfo.amount,
    }


    const cashierreceiveno = await createCashierMinor(data, t)
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    const arno =
      `ARNO-${getCurrentYY()}` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, dfrpreferno, rprefdate,
             netprem, commout, ovout, whtcommout, whtovout, withheld , specdiscamt)
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode , :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :dfrpreferno, :rprefdate,
            :netprem, :commout, :ovout, :whtcommout, :whtovout, :withheld, :specdiscamt ) Returning id`,
      {
        replacements: {
          billadvisorno: "-",
          cashierreceiveno: cashierreceiveno,
          cashieramt: cashierInfo.amount,
          insurerCode: insurerCode,
          agentCode: agentCode,
          type: "AR",
          transactiontype: "PREM-IN",
          actualvalue: req.body.amount,
          diffamt: req.body.diffamount,
          status: "A",
          createusercode: usercode,
          dfrpreferno: arno,
          rprefdate: billdate,
          billdate: billdate,
          netprem: req.body.totalprem,
          commout: 0,
          ovout: 0,
          whtcommout: 0,
          whtovout: 0,
          withheld: req.body.withheld,
          specdiscamt: req.body.specdiscamt,
        },

        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //update arno to b_jacashier
    await sequelize.query(
      `update static_data.b_jacashiers set "dfrpreferno" = :arno , status = 'A' where cashierreceiveno = :cashierreceiveno `,
      {
        replacements: {
          arno: arno,
          cashierreceiveno: cashierreceiveno,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );
     const maxInvoice = invoiceList.reduce((max, current) => {
  return (current.totalamt > max.totalamt) ? current : max;
      }, invoiceList[0]); // Initialize with the first object in the array

     //ถ้าเบี้ยรับมาไม่ตรงให้ต้อง transaction 'SUSPENSE' เป็น ค่าเบี้ยคงค้างรอเคลีย ให้ไปตั้งที่กรมธรรมที่เบี้ยรับมามากที่สุด
    if(req.body.diffamount !== 0){ 
      let subType = req.body.diffamount >0 ? 1: 0 ; // 1 จ่ายเงินเกิน 0 จ่ายขาด จะกลายเป็นส่วนลด
       // SUSPENSE ตั้ง transaction บัญชีพักรอเคลีย
        await sequelize.query(
          `INSERT INTO static_data."Transactions" 
           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",  ovamt
           ,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld
           ,"premin-dfrpreferno", "premin-rprefdate" ) 
           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt 
           , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld
           ,:dfrpreferno , :rprefdate) `,
          {
            replacements: {
              dfrpreferno : arno,
              rprefdate : billdate,
              polid: maxInvoice.polid,
              type: 'SUSPENSE',
              subType: subType,
              insurerCode: maxInvoice.insurerCode,
              agentCode: maxInvoice.agentCode,
              policyNo: maxInvoice.policyNo,
              endorseNo: maxInvoice.endorseNo,
              dftxno: maxInvoice.dftxno,
              invoiceNo: '-',
              ovamt: null,
              ovtaxamt: null,
              totalamt: Math.abs(req.body.diffamount),
              //  duedate: policy.duedateinsurer,
              duedate: billdate,
              netgrossprem: maxInvoice.netgrossprem,
              duty: maxInvoice.duty,
              tax: maxInvoice.tax,
              totalprem: maxInvoice.totalprem,
              //  ovamt: jupgr.insurer[i].ovin_amt,
              //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
              //  totalamt: jupgr.insurer[i].ovin_amt,
              //  duedate: jupgr.insurer[i].dueDate,
              //  netgrossprem: jupgr.insurer[i].netgrossprem,
              //  duty: jupgr.insurer[i].duty,
              //  tax: jupgr.insurer[i].tax,
              //  totalprem: jupgr.insurer[i].totalprem,
              txtype2: maxInvoice.txtype2,
              // seqno:i,
              seqno: maxInvoice.seqNo,
              mainaccountcode: receiverInfo.code,
              withheld: maxInvoice.withheld,
      
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        );
        // ถ้าจำนวนเงินน้อยกว่า config ที่ยอมรับได้ให้ตัดหนี้ไปเลย สร้าง Tansaction ขาดเกินดุลบัญชี
        if ( subType == 1 && CASHOVER_cfg >= Math.abs(req.body.diffamount)) {
          
        await sequelize.query(
          `INSERT INTO static_data."Transactions" 
           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",  ovamt
           ,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld
           ,"premin-dfrpreferno", "premin-rprefdate" , dfrpreferno , rprefdate, receiptno) 
           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt 
           , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld
           ,:dfrpreferno , :rprefdate ,:dfrpreferno , :rprefdate, :receiptno) `,
          {
            replacements: {
              receiptno : cashierreceiveno,
              dfrpreferno : arno,
              rprefdate : billdate,
              polid: maxInvoice.polid,
              type: 'CASHOVER',
              subType: 1,
              insurerCode: maxInvoice.insurerCode,
              agentCode: maxInvoice.agentCode,
              policyNo: maxInvoice.policyNo,
              endorseNo: maxInvoice.endorseNo,
              dftxno: maxInvoice.dftxno,
              invoiceNo: '-',
              ovamt: null,
              ovtaxamt: null,
              totalamt: Math.abs(req.body.diffamount),
              //  duedate: policy.duedateinsurer,
              duedate: billdate,
              netgrossprem: maxInvoice.netgrossprem,
              duty: maxInvoice.duty,
              tax: maxInvoice.tax,
              totalprem: maxInvoice.totalprem,
              //  ovamt: jupgr.insurer[i].ovin_amt,
              //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
              //  totalamt: jupgr.insurer[i].ovin_amt,
              //  duedate: jupgr.insurer[i].dueDate,
              //  netgrossprem: jupgr.insurer[i].netgrossprem,
              //  duty: jupgr.insurer[i].duty,
              //  tax: jupgr.insurer[i].tax,
              //  totalprem: jupgr.insurer[i].totalprem,
              txtype2: maxInvoice.txtype2,
              seqno: maxInvoice.seqNo,
              mainaccountcode: 'AMITY',
              withheld: maxInvoice.withheld,
      
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        );

        await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'SUSPENSE' )
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N' and "seqNo" = :seqno
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( :txtype2 ) `,
        {
          replacements: {
            rprefdate: billdate,
            dfrpreferno: arno,
            agentCode: maxInvoice.agentCode,
            insurerCode: maxInvoice.insurerCode,
            policyNo: maxInvoice.policyNo,
            cashierreceiveno: cashierreceiveno,
            // dftxno: req.body.master.dftxno,
            // seqNo: req.body.master.seqNo,
            txtype2: maxInvoice.txtype2,
            seqno: maxInvoice.seqNo,
            dftxno: maxInvoice.dftxno,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })

        }else if(subType == 0 && CASHSHORT_cfg >= Math.abs(req.body.diffamount)){
 
        await sequelize.query(
          `INSERT INTO static_data."Transactions" 
           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",  ovamt
           ,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld
           ,"premin-dfrpreferno", "premin-rprefdate" ,dfrpreferno , rprefdate , receiptno) 
           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt 
           , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld
           ,:dfrpreferno , :rprefdate ,:dfrpreferno , :rprefdate, :receiptno) `,
          {
            replacements: {
              receiptno : cashierreceiveno,
              dfrpreferno : arno,
              rprefdate : billdate,
              polid: maxInvoice.polid,
              type: 'CASHSHORT',
              subType: 1,
              insurerCode: maxInvoice.insurerCode,
              agentCode: maxInvoice.agentCode,
              policyNo: maxInvoice.policyNo,
              endorseNo: maxInvoice.endorseNo,
              dftxno: maxInvoice.dftxno,
              invoiceNo: '-',
              ovamt: null,
              ovtaxamt: null,
              totalamt: Math.abs(req.body.diffamount),
              //  duedate: policy.duedateinsurer,
              duedate: billdate,
              netgrossprem: maxInvoice.netgrossprem,
              duty: maxInvoice.duty,
              tax: maxInvoice.tax,
              totalprem: maxInvoice.totalprem,
              //  ovamt: jupgr.insurer[i].ovin_amt,
              //  ovtaxamt: jupgr.insurer[i].ovin_taxamt,
              //  totalamt: jupgr.insurer[i].ovin_amt,
              //  duedate: jupgr.insurer[i].dueDate,
              //  netgrossprem: jupgr.insurer[i].netgrossprem,
              //  duty: jupgr.insurer[i].duty,
              //  tax: jupgr.insurer[i].tax,
              //  totalprem: jupgr.insurer[i].totalprem,
               txtype2: maxInvoice.txtype2,
              seqno: maxInvoice.seqNo,
              mainaccountcode: 'AMITY',
              withheld: maxInvoice.withheld,
      
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        );

      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'SUSPENSE')
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N' and "seqNo" = :seqno
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( :txtype2 )   `,
        {
          replacements: {
            rprefdate: billdate,
            dfrpreferno: arno,
            agentCode: maxInvoice.agentCode,
            insurerCode: maxInvoice.insurerCode,
            policyNo: maxInvoice.policyNo,
            cashierreceiveno: cashierreceiveno,
            // dftxno: req.body.master.dftxno,
             txtype2: maxInvoice.txtype2,
            seqno: maxInvoice.seqNo,
            dftxno: maxInvoice.dftxno
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })

        }
    }
  



    await Promise.all(invoiceList.map(async ele => {
      const txtype2 = ele.txtype2

         //update xlock = 'Y' policy
    await sequelize.query(
      `update static_data."Policies" set "xlock" = 'Y' where id = :polid `,
      {
        replacements: {
          polid: ele.polid,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
            values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            netflag: "G",
            // polid: req.body.master.polid,
            // policyNo: req.body.master.policyNo,
            // endorseNo: req.body.master.endorseNo,
            // invoiceNo: req.body.master.invoiceNo,
            // seqNo: req.body.master.seqNo,
            // netamt: req.body.master.actualvalue,
            // withheld   :req.body.master.withheld,
            // specdiscamt   :req.body.master.specdiscamt,
            polid: ele.polid,
            policyNo: ele.policyNo,
            endorseNo: ele.endorseNo,
            invoiceNo: ele.invoiceNo,
            seqNo: ele.seqNo,
            netamt: parseFloat(ele.totalamt.toFixed(2)),
            withheld: ele.withheld,
            specdiscamt: ele.specdiscamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );

      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno ,
          "premin-dfrpreferno" = :dfrpreferno,
          "premin-rprefdate" = :rprefdate
        where  "transType" in ( 'PREM-IN', 'DISC-IN')
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'  and "seqNo" = :seqNo `,
        {
          replacements: {
            rprefdate: billdate,
            dfrpreferno: arno,
            agentCode: ele.agentCode,
            insurerCode: ele.insurerCode,
            policyNo: ele.policyNo,
            cashierreceiveno: cashierreceiveno,
            // dftxno: req.body.master.dftxno,
            // seqNo: req.body.master.seqNo,
            dftxno: ele.dftxno,
            seqNo: ele.seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })

      if (txtype2 === 1) {
        // update premin-dfrpreferno ถ้าจ่ายครบทุกงวดแล้ว
        await sequelize.query(
          `DO $$ 
    BEGIN
        IF (SELECT COUNT(*)
            FROM static_data."Transactions"
            WHERE "transType" = 'PREM-IN'
              AND "policyNo" = '${ele.policyNo}'
              AND dfrpreferno IS NULL
              -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
              and txtype2 = 1
              and status = 'N') = 0
        THEN
            UPDATE static_data."Transactions"
            SET 
                "premin-dfrpreferno" = '${arno}',
                "premin-rprefdate" = '${billdate}'
            WHERE  
                "transType" IN ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
                AND "policyNo" = '${ele.policyNo}'
                AND dfrpreferno IS NULL
                -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
                and txtype2 = 1 
                and status = 'N';
        END if;
    END $$;`,
          {
            transaction: t,
            raw: true
          })
        // end for loop
      } else {
        await sequelize.query(
          `update static_data."Transactions" 
    set 
        "premin-dfrpreferno" = :dfrpreferno,
        "premin-rprefdate" = :rprefdate
      where  "transType" in ('COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN','DISC-OUT')
        and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and txtype2 in (  2, 3, 4, 5 ) 
        and status ='N'
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno `,
          {
            replacements: {
              dfrpreferno: arno,
              rprefdate: billdate,
              agentCode: ele.agentCode,
              insurerCode: ele.insurerCode,
              policyNo: ele.policyNo,
              cashierreceiveno: cashierreceiveno,
              // dftxno: req.body.master.dftxno,
              // seqNo: req.body.master.seqNo,
              dftxno: ele.dftxno,
              seqNo: ele.seqNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })
      }

    }));







    await t.commit();
    await res.json({
      msg: `created ARNO : ${arno} success!!`,
    });
  } catch (error) {
    console.error(error.message)
    await t.rollback();
     await res.status(500).json({ message: error.message });
  }


};

const getSuspenseList = async (req, res) => {
  try {
    const jwt = req.headers.authorization.split(' ')[1];
    const usercode = decode(jwt).USERNAME;
   
    let cond = ` `
    if (req.body.type === 'Approve') {
      cond = `${cond} and  u."role" IN (SELECT unnest(get_subordinates('${usercode}'))) `
      if (req.body.requestFrom !== null && req.body.requestFrom !== '') {
        cond = `${cond} and u."userName" ='${req.body.requestFrom}' `
      }
    } else if (req.body.type === 'Request') {
      cond = `${cond} and u."userName"  = '${usercode}'`
    }

    if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
      cond = `${cond} and csh."insurercode"  = '${req.body.insurerCode}'`
    }
    if (req.body.agentCode !== null && req.body.agentCode !== '') {
      cond = `${cond} and csh."advisorcode" = '${req.body.agentCode}'`
    }

    if (req.body.requestdate_start !== null && req.body.requestdate_start !== '') {
      cond = `${cond} and  csh.cashierdate between '${req.body.requestdate_start}' and '${req.body.requestdate_end}'`
    }

    if (req.body.policyNoStart !== null && req.body.policyNoStart !== '') {
      cond = `${cond} and p."policyNo" >= '${req.body.policyNoStart}'`
    }
    if (req.body.policyNoEnd !== null && req.body.policyNoEnd !== '') {
      cond = `${cond} and p."policyNo" <= '${req.body.policyNoEnd}'`
    }


    const records = await sequelize.query(
      `select t."policyNo" ,t."endorseNo" ,p."insureID" 
      ,t."seqNo" ,t.polid ,t."insurerCode" , t."agentCode" ,t."policyNo" ,t."endorseNo" ,t.dftxno,t.dfrpreferno 
      ,t.netgrossprem ,t.duty ,t.tax ,t.totalprem ,t.txtype2 ,t.withheld 
      ,it."insureName" , csh.receivename ,csh.receivefrom 
      ,(t.totalamt *( 2*t."subType"-1)) as totalamt
      ,csh.dfrpreferno ,csh.billadvisorno , p.createusercode 
      ,csh.cashierreceiveno , csh.cashierdate 
      ,csh."insurercode",csh."advisorcode", csh.customerid
     ,t."subType"
      from static_data."Transactions" t 
      join static_data."Policies" p on p.id = t.polid 
      join static_data."InsureTypes" it on it.id = p."insureID" 
      join static_data.b_jaaraps bj on bj.dfrpreferno = t."premin-dfrpreferno" 
      join static_data.b_jacashiers csh on csh.cashierreceiveno = bj.cashierreceiveno 
      join static_data."Users" u on u."userName" = p.createusercode
      --select * from static_data."Transactions" t
      where t."transType" in ('SUSPENSE', 'CASHOVER','CASHSHORT')
      and t.dfrpreferno is null
      and t.status = 'N'
      ${cond}
      order by csh.cashierdate  ASC ;`,
      {

        type: QueryTypes.SELECT
      }
    )
    res.json(records)
  } catch (error) {

    console.error(error.message)
    await res.status(500).json({ message: error.message });
  }
};

const approveSuspense = async (req,res) =>{
  const jwt = req.headers.authorization.split(' ')[1];
 const usercode = decode(jwt).USERNAME;
 const t = await sequelize.transaction();
 const input =req.body;
  try {
    let receivefrom = null
    let receivename = null
    if(data.suspenseFrom == 'agent'){
      receivefrom = input.advisorcode
      receivename ='-'
    }else if(data.suspenseFrom == "amity"){
      receivefrom = 'Amity'
      receivename ='-'
    }else if(data.suspenseFrom  == 'other'){
      receivefrom = input.receivefrom
      receivename =input.receivename
    }
    let data = {
      transactiontype: input.suspenseType,
      insurercode: input.insurercode,
      advisorcode: input.advisorcode,
      customerid: input.customerid,
      receivefrom: receivefrom,
      receivename: receivename,
      usercode: usercode,
      receivetype : '-',
      Amt: Math.abs(input.totalamt),
    }
let cashierreceiveno =null
let dfrpreferno =null
let rprefdate =null
console.log('>> suspenseType : ' + input.suspenseType);
// suspenseType =[ DISC-OUT, SUSPENSE-CLEAR, DISC-AMITY ]
if(input.suspenseType === 'SUSPENSE-CLEAR' ){
  
  cashierreceiveno = await createCashierMinor(data, t)
  console.log('>>Gen Cashierreceive : ' + cashierreceiveno);
   dfrpreferno = `ARNO-${getCurrentYY()}` +
(await getRunNo("arno", null, null, "kw", cuurentdate, t)); 
  rprefdate = getCurrentDate()
  console.log('>>Gen ARNO : ' + dfrpreferno);
}

 await sequelize.query(
          `INSERT INTO static_data."Transactions" 
           ("transType", "subType", "insurerCode","agentCode", "policyNo","endorseNo", "dftxno", "documentno",  ovamt
           ,ovtaxamt,totalamt,remainamt,"dueDate",netgrossprem,duty,tax,totalprem,txtype2, polid, "seqNo" ,mainaccountcode , withheld
           ,"premin-dfrpreferno", "premin-rprefdate" , dfrpreferno, rprefdate, receiptno) 
           VALUES (:type, :subType, :insurerCode,:agentCode, :policyNo,:endorseNo, :dftxno, :invoiceNo, :ovamt 
           , :ovtaxamt, :totalamt,:totalamt, :duedate, :netgrossprem, :duty,:tax,:totalprem, :txtype2, :polid ,:seqno ,:mainaccountcode, :withheld
           ,:preminDfrpreferno , :preminRprefdate , :dfrpreferno, :rprefdate, :receiptno) `,
          {
            replacements: {
              preminDfrpreferno : input.dfrpreferno,
              preminRprefdate : input.cashierdate,
              polid: input.polid,
              type: input.suspenseType,
              subType: 1,
              insurerCode: input.insurerCode,
              agentCode: input.agentCode,
              policyNo: input.policyNo,
              endorseNo: input.endorseNo,
              dftxno: input.dftxno,
              invoiceNo: '-',
              ovamt: null,
              ovtaxamt: null,
              totalamt: Math.abs(input.totalamt),
              //  duedate: policy.duedateinsurer,
              duedate: input.cashierdate,
              netgrossprem: input.netgrossprem,
              duty: input.duty,
              tax: input.tax,
              totalprem: input.totalprem,
              txtype2: input.txtype2,
              // seqno:i,
              seqno: input.seqNo,
              mainaccountcode: receivefrom,
              withheld: input.withheld,
              dfrpreferno : dfrpreferno,
              rprefdate : rprefdate, 
              receiptno : cashierreceiveno,
      
            },
            transaction: t,
            type: QueryTypes.INSERT
          }
        );
let keymid_jaraps = input.keymid
 if (dfrpreferno !== null) {
   
    const b_jaraps = await sequelize.query(
      `insert into static_data.b_jaaraps (billadvisorno, cashierreceiveno, cashieramt, insurerno,"insurerCode", advisorno,"agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, dfrpreferno, rprefdate,
             netprem, commout, ovout, whtcommout, whtovout, withheld , specdiscamt)
          values( :billadvisorno, :cashierreceiveno, :cashieramt, (select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion ='Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode , :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :dfrpreferno, :rprefdate,
            :netprem, :commout, :ovout, :whtcommout, :whtovout, :withheld, :specdiscamt ) Returning id`,
      {
        replacements: {
          billadvisorno: "-",
          cashierreceiveno: cashierreceiveno,
          cashieramt: Math.abs(input.totalamt),
          insurerCode: input.insurercode,
          agentCode: input.advisorcode,
          type: "AR",
          transactiontype: input.suspenseType,
          actualvalue:  Math.abs(input.totalamt),
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          dfrpreferno: dfrpreferno,
          rprefdate: rprefdate,
          billdate: rprefdate,
          netprem: input.totalprem,
          commout: 0,
          ovout: 0,
          whtcommout: 0,
          whtovout: 0,
          withheld: input.withheld,
          specdiscamt: 0,
        },

        transaction: t,
        type: QueryTypes.INSERT,
      }
    );
    console.log('>>Insert b_jaraps done: id ' + b_jaraps[0][0].id);
    keymid_jaraps =  b_jaraps[0][0].id

    
 }  
    //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
            values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
        {
          replacements: {
            keyidm: b_jaraps[0][0].id,
            netflag: "G",
            // polid: req.body.master.polid,
            // policyNo: req.body.master.policyNo,
            // endorseNo: req.body.master.endorseNo,
            // invoiceNo: req.body.master.invoiceNo,
            // seqNo: req.body.master.seqNo,
            // netamt: req.body.master.actualvalue,
            // withheld   :req.body.master.withheld,
            // specdiscamt   :req.body.master.specdiscamt,
            polid: input.polid,
            policyNo: input.policyNo,
            endorseNo: input.endorseNo,
            invoiceNo: '-',
            seqNo: input.seqNo,
            netamt: parseFloat(input.totalamt.toFixed(2)),
            withheld: null,
            specdiscamt: null,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );   
      console.log('>>Insert b_jarap detail done: keymid ' + keymid_jaraps);

       await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno =  :dfrpreferno,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno 
        where  "transType" in ( 'SUSPENSE' )
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N'  and "seqNo" = :seqNo `,
        {
          replacements: {
            rprefdate: dfrpreferno !== null ? dfrpreferno : input.dfrpreferno,
            dfrpreferno: dfrpreferno !== null ? rprefdate : input.cashierdate,
            agentCode: input.agentCode,
            insurerCode: input.insurerCode,
            policyNo: input.policyNo,
            cashierreceiveno: cashierreceiveno,
            // dftxno: req.body.master.dftxno,
            // seqNo: req.body.master.seqNo,
            dftxno: input.dftxno,
            seqNo: input.seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })
   



// const billdate = new Date().toISOString().split("T")[0];
//     const cuurentdate = getCurrentDate()
    

  } catch (error) {

    console.error(error.message)
    await res.status(500).json({ message: error.message });
  }
}

//Account payment prem out
const findAPPremOut = async (req, res) => {
  let cond = ''
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = cond + ` and t."agentCode" = '${req.body.agentCode}'`
  }
  if (req.body.reconcileno !== null && req.body.reconcileno !== '') {
    cond = cond + ` and r.reconcileno = '${req.body.reconcileno}'`
  }
  if (req.body.dueDate !== null && req.body.dueDate !== '') {
    cond = cond + ` and   t."dueDate" <= '${req.body.dueDate}' `
  }
  let cond1 = ''
  if (req.body.dfrprefernostart !== null && req.body.dfrprefernostart !== '') {
    cond1 = cond1 + ` and   t."premin-dfrpreferno" >= '${req.body.dfrprefernostart}' `
  }
  if (req.body.dfrprefernoend !== null && req.body.dfrprefernoend !== '') {
    cond1 = cond1 + ` and   t."premin-dfrpreferno" <= '${req.body.dfrprefernoend}' `
  }
  if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
    cond1 = cond1 + ` and   t."premin-rprefdate" >= '${req.body.rprefdatestart}' `
  }
  if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
    cond1 = cond1 + ` and   t."premin-rprefdate" <= '${req.body.rprefdateend}' `
  }


  //wait rewrite when clear reconcile process
  const trans = await sequelize.query(
    `select  'true' as select , t."insurerCode", t."agentCode", t."withheld" ,
    t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", j."taxInvoiceNo" , t."seqNo" ,t.dftxno , 
    -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid, 
    i.id as customerid, 
    (case when e."personType" ='P' then  t2."TITLETHAIBEGIN" || ' ' || e."t_firstName"||' '||e."t_lastName" else 
    t2."TITLETHAIBEGIN"|| ' '|| e."t_ogName"|| COALESCE(' สาขา '|| e."t_branchName",'' )  || ' '|| t2."TITLETHAIEND" end) as insureename ,
    t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , (select  "chassisNo" from static_data."Motors" where id = p."itemList"), 
    j.grossprem , j.specdiscamt , j.netgrossprem, j.withheld , j.duty, j.tax, j.totalprem,
    j.commin_rate, j.commin_amt ,j.commin_taxamt, j.ovin_rate, j.ovin_amt, j.ovin_taxamt ,
    -- (case when i2."stamentType" = 'Gross' then false else true end ) as netflag, 
    -- (case when i2."stamentType" = 'Gross' then j.totalprem - j.withheld  else j.totalprem - j.withheld - j.commin_amt -j.ovin_amt + j.commin_taxamt + j.ovin_taxamt end )  as "paymentamt",
    true as netflag , (j.totalprem - j.withheld - j.commin_amt -j.ovin_amt + j.commin_taxamt + j.ovin_taxamt) as "paymentamt",
    t."premin-dfrpreferno", t."premin-rprefdate"
    from static_data."Transactions" t 
    join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
    join static_data."Policies" p on p.id = j.polid
    left join static_data."Insurees" i on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
    -- left join static_data."Insurers" i2 on i2."insurerCode" = p."insurerCode" and i2.lastversion ='Y'
    left join static_data."Entities" e on e.id = i."entityID" 
    left join static_data."Titles" t2 on t2."TITLEID" = e."titleID" 
    where   
    --(( t."premin-dfrpreferno" is not null and t.txtype2 in ( 1, 2) ${cond1} )
    --or (    ))
    (case when  t.txtype2 in ( 1, 2) then t."premin-dfrpreferno" is not null ${cond1} else true end )
    and t.txtype2 in ( 1,2, 3,4,5 )
    and t."transType" = 'PREM-OUT'
    and t.status = 'N'
    and t.rprefdate is null
    and t.dfrpreferno is null
    -- and p."lastVersion" ='Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
    and j.installmenttype ='I' ${cond} 
    order by t."policyNo" , t."seqNo", t."endorseNo" `,
    {

      type: QueryTypes.SELECT,
    }
  );
  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found policy" });
  } else {
    await res.json(trans);
  }
};
const getARAPtransAll = async (req, res) => {

  let cond = ''
  if (req.body.billadvisorno !== null && req.body.billadvisorno !== '') {
    cond = cond + ` and t."billadvisorno" = '${req.body.billadvisorno}'`
  }
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = cond + ` and t."agentCode" = '${req.body.agentCode}'`
  }
  if (req.body.receiptno !== null && req.body.receiptno !== '') {
    cond = cond + ` and t.receiptno = '${req.body.receiptno}'`
  }
  if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
    cond = cond + ` and t.rprefdate >= '${req.body.rprefdatestart}'`
  }
  if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
    cond = cond + ` and t.rprefdate <= '${req.body.rprefdateend}'`
  }
  if (req.body.type === 'prem_in') {
    cond = cond + ` and t."transType" = 'PREM-IN'`
  } else if (req.body.type === 'prem_out') {
    cond = cond + ` and t."transType" = 'PREM-OUT'`
  } else if (req.body.type === 'comm/ov_out') {
    cond = cond + ` and t."transType" in ( 'COMM-OUT', 'OV-OUT' )`
  } else if (req.body.type === 'comm/ov_in') {
    cond = cond + ` and t."transType" in ( 'COMM-IN', 'OV-IN' )`
  }

  const trans = await sequelize.query(
    `select t."agentCode", t."insurerCode",  t."withheld" , t."billadvisorno", t."receiptno",
        t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", j."taxInvoiceNo", t."seqNo" ,
        -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" and lastversion = 'Y') as customerid, 
        i.id as customerid,
        (select "t_firstName"||' '||"t_lastName"  as insureeName from static_data."Entities" where id = i."entityID"  ) as insureeName , 
       
        t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , (select  "chassisNo" from static_data."Motors" where id = p."itemList"), j.netgrossprem, j.duty, j.tax, j.totalprem, j.commout_rate,
        j.commout_amt, j.ovout_rate, j.ovout_amt, t.netflag, t.remainamt, t."transType",
        t.rprefdate, t.dfrpreferno, t."premin-dfrpreferno", t."premout-dfrpreferno"
        from static_data."Transactions" t 
        join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo" 
        join static_data."Policies" p on p.id = j.polid
        join static_data."Insurees" i  on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
        where t.txtype2 in ( 1, 2, 3, 4, 5 )
        and t.status ='N'
        -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
        and t.dfrpreferno is not null
        and j.installmenttype = 'I' 
        ${cond} 
        order by t."policyNo", j."seqNo", t."transType"`,
    {
      replacements: {
        billadvisorno: req.body.billadvisorno,
      },
      type: QueryTypes.SELECT,
    }
  );
  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found transaction" });
  } else {
    await res.json({ trans: trans });
  }
};

const saveAPPremOut = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    const billdate = new Date().toISOString().split("T")[0];

    //insert to master jaarap
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno,"insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue,  status, 
            createusercode, netprem, commin, ovin, whtcommin, whtovin )
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), :insurerCode , 
          (select "id" from static_data."Agents" where "agentCode" = :agentCode), :agentCode ,:type, :transactiontype, :actualvalue,  :status, 
            :createusercode, :netprem, :commin , :ovin, :whtcommin, :whtovin) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AP",
          transactiontype: "PREM-OUT",
          actualvalue: req.body.master.actualvalue,

          status: "I",
          createusercode: usercode,
          billdate: billdate,
          netprem: req.body.master.netprem,
          commin: req.body.master.commin,
          ovin: req.body.master.ovin,
         
          whtcommin: req.body.master.whtcommin,
          whtovin: req.body.master.whtovin,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].paymentamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }
      );

    }//end for loop
    await t.commit();
    await res.json({
      msg: `created billadvisorNO : ${req.body.master.billadvisorno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const submitAPPremOut = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.apno =
      `APNO-${getCurrentYY()}` +
      (await getRunNo("apno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno, "insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, netprem, commin, ovin, whtcommin, whtovin, dfrpreferno, rprefdate, withheld )
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode, :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :netprem, :commin , :ovin, :whtcommin, :whtovin,  :dfrpreferno, :rprefdate, :withheld ) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AP",
          transactiontype: "PREM-OUT",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          billdate: billdate,
          netprem: req.body.master.netprem,
          commin: req.body.master.commin,
          ovin: req.body.master.ovin,
        
          whtcommin: req.body.master.whtcommin,
          whtovin: req.body.master.whtovin,
          withheld: req.body.master.withheld,
          dfrpreferno: req.body.master.apno,
          rprefdate: billdate,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );



    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arPremIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].paymentamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }

      )


      //update arno, refdate to transaction table
      // let cond = ' and txtype2 in ( 1, 2, 3, 4, 5 ) and status = \'N\''
      // if (req.body.trans[i].endorseNo  !== null && req.body.endorseNo !== '') {
      //   cond =cond + ` and "endorseNo"= '${req.body.trans[i].endorseNo}' `
      // }
      // if (req.body.trans[i].seqNo  !== null && req.body.seqNo !== '') {
      //   cond = cond +' and "seqNo" = ' + req.body.trans[i].seqNo
      // }
      await sequelize.query(
        `update static_data."Transactions" 
      set 
        dfrpreferno = CASE WHEN  "transType" = 'PREM-OUT' THEN :dfrpreferno ELSE dfrpreferno  END,
        rprefdate = CASE WHEN  "transType" = 'PREM-OUT' THEN :rprefdate ELSE rprefdate END,
        netflag = CASE WHEN  "transType" IN ('PREM-OUT', 'COMM-IN', 'OV-IN') THEN :netflag ELSE netflag END,
        "premout-dfrpreferno" = :dfrpreferno ,
        "premout-rprefdate" = :rprefdate
      -- dfrpreferno = CASE
        -- WHEN txtype2 IN (1, 2) AND "transType" = 'PREM-OUT' THEN :dfrpreferno
        -- WHEN txtype2 IN (3, 4, 5) AND "transType" IN ('PREM-IN', 'COMM-OUT', 'OV-OUT') THEN :dfrpreferno
        -- ELSE dfrpreferno
        -- END,
      -- rprefdate = CASE
        -- WHEN txtype2 IN (1, 2) AND "transType" = 'PREM-OUT' THEN :rprefdate
        -- WHEN txtype2 IN (3, 4, 5) AND "transType" IN ('PREM-IN', 'COMM-OUT', 'OV-OUT') THEN :rprefdate
        -- ELSE rprefdate
        -- END,
      -- netflag = CASE
        -- WHEN txtype2 IN (1, 2) AND "transType" IN ('PREM-OUT', 'COMM-IN', 'OV-IN') THEN :netflag
        -- WHEN txtype2 IN (3, 4, 5) AND "transType" IN ('PREM-IN', 'COMM-OUT', 'OV-OUT') THEN :netflag
        -- ELSE netflag
        -- END,
      --"premout-dfrpreferno" = CASE
        -- WHEN txtype2 IN (1, 2) THEN :dfrpreferno
        -- ELSE "premout-dfrpreferno"
        -- END,
      -- "premout-rprefdate" = CASE
        -- WHEN txtype2 IN (1, 2) THEN :rprefdate
        -- ELSE "premout-rprefdate"
        -- END,
      -- "premin-dfrpreferno" = CASE
        -- WHEN txtype2 IN (3, 4, 5) THEN :dfrpreferno
        -- ELSE "premin-dfrpreferno"
        -- END,
      -- "premin-rprefdate" = CASE
        -- WHEN txtype2 IN (3, 4, 5) THEN :rprefdate
        -- ELSE "premin-rprefdate"
        -- END
      where  "transType" in ( 'PREM-IN', 'DISC-IN', 'COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN', 'DISC-OUT')
        and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno 
        and "seqNo" = :seqNo
        and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N' `,
        {
          replacements: {
            dfrpreferno: req.body.master.apno,
            rprefdate: billdate,
            agentCode: req.body.trans[i].agentCode,
            insurerCode: req.body.trans[i].insurerCode,
            // polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            dftxno: req.body.trans[i].dftxno,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,

          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })

      //insert to deteil of transaction when netflag = N
      if (req.body.trans[i].netflag === "N") {

        //update arno, refdate to transaction table
        await sequelize.query(
          `update static_data."Transactions" 
        set dfrpreferno = :dfrpreferno ,
          rprefdate = :rprefdate 
        where "transType" in ('COMM-IN','OV-IN')
          and status = 'N'
          and "insurerCode" = :insurerCode
          and "agentCode" = :agentCode
          and "policyNo" = :policyNo 
          and "dftxno" = :dftxno
          and "seqNo" = :seqNo
          and txtype2 in ( 1, 2, 3, 4, 5 ) and status = 'N' `,
          {
            replacements: {
              dfrpreferno: req.body.master.apno,
              rprefdate: billdate,
              agentCode: req.body.trans[i].agentCode,
              insurerCode: req.body.trans[i].insurerCode,
              policyNo: req.body.trans[i].policyNo,
              dftxno: req.body.trans[i].dftxno,
              seqNo: req.body.trans[i].seqNo,
              // endorseNo: req.body.trans[i].endorseNo,
            },
            transaction: t,
            type: QueryTypes.UPDATE,
          })
      }

    }// end for loop
    await t.commit();
    await res.json({
      msg: `created APNO : ${req.body.master.apno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

//Account recieve comm/ov in
const findARCommIn = async (req, res) => {

  let cond = ''
  if (req.body.artype === 'N') {
    cond = cond + ` and a.transactiontype = 'PREM-OUT'`
  } else if (req.body.artype === 'D') {
    cond = cond + ` and a.transactiontype = 'PREM-INS'`
  }


  // if (req.body.insurerCode  !== null && req.body.insurerCode !== '') {
  //   cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  // }
  // if (req.body.agentCode  !== null && req.body.agentCode !== '') {
  //   cond = cond + ` and t."agentCode" = '${req.body.agentCode}'`
  // }
  if (req.body.dfrpreferno !== null && req.body.dfrpreferno !== '') {
    cond = cond + ` and a.dfrpreferno = '${req.body.dfrpreferno}'`
  }

  //wait rewrite when clear reconcile process
  const trans = await sequelize.query(
    `select  true as select, t."insurerCode", t."agentCode", t."withheld" ,t."premout-dfrpreferno",
    t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", j."taxInvoiceNo",  t."seqNo" , t.dftxno,
    -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid,
    insuree.id as customerid,
    (case when ent."personType" = 'O' then tt."TITLETHAIBEGIN" ||' ' || ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  || ' ' || tt."TITLETHAIEND"  else tt."TITLETHAIBEGIN" || ' ' || ent."t_firstName"||' '||ent."t_lastName"  end) as insureename,
    t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , (select  "chassisNo" from static_data."Motors" where id = p."itemList"),
    j.grossprem , j.specdiscamt ,j.netgrossprem, j.duty, j.tax, j.totalprem,
    j.commin_rate, j.commin_amt, j.commin_taxamt ,
    j.ovin_rate, j.ovin_amt, j.ovin_taxamt ,t.netflag
    from static_data."Transactions" t
    join static_data.b_jupgrs j on  t."policyNo" = j."policyNo" and t.dftxno = j.dftxno  and t."seqNo" = j."seqNo"
    join static_data."Policies" p on p.id = j.polid
    left join static_data."Insurees" insuree on insuree."insureeCode" = p."insureeCode" and insuree.lastversion = 'Y'
  left join static_data."Entities" ent on ent.id = insuree."entityID"
  left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    join static_data.b_jaarapds ad on ad.polid = t.polid and ad."seqNo" = j."seqNo"
    join static_data.b_jaaraps a on ad.keyidm =a.id
    where t."transType" = 'COMM-IN'
    -- and t.txtype2 in ( 1, 2, 3, 4, 5 )
    and t.txtype2 in ( 1, 2 )
    and t.status = 'N'
    -- and p."lastVersion" ='Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
    and t.rprefdate is null
    and t.dfrpreferno is null
    and t."premout-rprefdate" is not null
    and t."premout-dfrpreferno" is not null
    and j.installmenttype ='I'
        ${cond} `,
    {

      type: QueryTypes.SELECT,
    }
  );

  const bill = await sequelize.query(
    `select bj."insurerCode", bj."agentCode",
    -- (select "insurerCode" from static_data."Insurers" where id = bj.insurerno ), 
    -- (select "agentCode" from static_data."Agents" where id = bj.advisorno ), 
    (select SUM(t.commamt)  from static_data."Transactions" t where t."premout-dfrpreferno" = bj.dfrpreferno and "transType" in ('OV-IN','COMM-IN') and t.dfrpreferno is null) as commamt,
    (select SUM(t.ovamt) from static_data."Transactions" t where t."premout-dfrpreferno" = bj.dfrpreferno and "transType" in ('OV-IN','COMM-IN') and t.dfrpreferno is null) as ovamt,
    (select SUM(t.commtaxamt)  from static_data."Transactions" t where t."premout-dfrpreferno" = bj.dfrpreferno and "transType" in ('OV-IN','COMM-IN') and t.dfrpreferno is null) as commtaxamt,
    (select SUM(t.ovtaxamt) from static_data."Transactions" t where t."premout-dfrpreferno" = bj.dfrpreferno and "transType" in ('OV-IN','COMM-IN') and t.dfrpreferno is null) as ovtaxamt,
    bj2.cashierreceiveno , bj2.amt as receiptamt
    from static_data.b_jaaraps bj
    left join static_data.b_jacashiers bj2 on bj2.refdfrpreferno  = bj.dfrpreferno 
    where bj.status ='A' and bj.dfrpreferno = :dfrpreferno `,
    {
      replacements: {
        dfrpreferno: req.body.dfrpreferno,
      },
      type: QueryTypes.SELECT,
    }
  );

  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found policy" });
  } else {
    // let whtcomm = parseFloat((bill[0].commamt * wht).toFixed(2))
    // let whtov = parseFloat((bill[0].ovamt * wht).toFixed(2))
    // bill[0].whtcomm = whtcomm
    // bill[0].whtov = whtov
    // bill[0].actualvalue = bill[0].commamt + bill[0].ovamt - whtcomm - whtov 
    bill[0].actualvalue = bill[0].commamt + bill[0].ovamt - bill[0].commtaxamt - bill[0].ovtaxamt
    await res.json({ billdata: bill, trans: trans });
  }
};

const saveARCommIn = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    const billdate = new Date().toISOString().split("T")[0];

    //insert to master jaarap COMM-IN
    const arCommIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno, "insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue,  status, 
            createusercode,  commin,  whtcommin,  ovin,  whtovin)
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode), :agentCode , :type, :transactiontype, :actualvalue,  :status, 
            :createusercode, :commin ,  :whtcommin, :ovin ,  :whtovin) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "COMM-IN",
          actualvalue: req.body.master.actualvalue,
          status: "I",
          createusercode: usercode,
          billdate: billdate,
          // netprem : req.body.master.netprem,
          commin: req.body.master.commin,
          ovin: req.body.master.ovin,
       
          whtcommin: req.body.master.whtcommin,
          whtovin: req.body.master.whtovin,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //insert to master jaarap OV-IN
    //  const arOvIn = await sequelize.query(
    //   `insert into static_data.b_jaaraps (insurerno, advisorno, type, transactiontype, actualvalue,  status, 
    //         createusercode,   ovin,   whtovin )
    //       values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), 
    //       (select "id" from static_data."Agents" where "agentCode" = :agentCode), :type, :transactiontype, :actualvalue,  :status, 
    //         :createusercode, :ovin,  :whtovin) Returning id`,
    //   {
    //     replacements: {
    //       insurerCode: req.body.master.insurerCode,
    //       agentCode: req.body.master.agentCode,
    //       type: "AR",
    //       transactiontype: "OV-IN",
    //       actualvalue: req.body.master.actualvalue,
    //       status: "I",
    //       createusercode: "kkk",
    //       billdate: billdate,
    //       createusercode: "kewn",
    //       // netprem : req.body.master.netprem,
    //       // commin :  req.body.master.commin,
    //       ovin :  req.body.master.ovin,
    //       // vatcommin :  req.body.master.vatcommin,
    //       // vatovin :  req.body.master.vatovin,
    //       // whtcommin :  req.body.master.whtcommin,
    //       whtovin :  req.body.master.whtovin,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT,
    //   }
    // );

    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arCommIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].paymentamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }


      );
      // ovin
      // await sequelize.query(
      //   `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
      //         values( :keyidm , (select id from static_data."Policies" where "policyNo" = :policyNo ), :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
      //   {
      //     replacements: {
      //       keyidm: arOvIn[0][0].id,
      //       policyNo: req.body.trans[i].policyNo,
      //       endorseNo: req.body.trans[i].endorseNo,
      //       invoiceNo: req.body.trans[i].invoiceNo,
      //       seqNo: req.body.trans[i].seqNo,
      //       netflag: req.body.trans[i].netflag,
      //       netamt: req.body.trans[i].ovin_amt,
      //     },
      //     transaction: t,
      //     type: QueryTypes.INSERT,
      //   }


      // );

    }//end for loop
    await t.commit();
    await res.json({
      msg: `created billadvisorNO : ${req.body.master.billadvisorno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const submitARCommIn = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.arno =
      `ARNO-${getCurrentYY()}/` +
      (await getRunNo("arno", null, null, "kw", cuurentdate, t));

    //insert to master jaarap COMM-IN
    const arCommIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno, "insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue,  status, 
            createusercode,  commin,  whtcommin, ovin,  whtovin, dfrpreferno, rprefdate, cashierreceiveno, cashieramt, diffamt)
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y'), :agentCode ,:type, :transactiontype, :actualvalue,  :status, 
            :createusercode, :commin ,  :whtcommin,  :ovin ,  :whtovin, :dfrpreferno, :rprefdate, :cashierreceiveno, :cashieramt, :diffamt) Returning id`,
      {
        replacements: {
          cashierreceiveno: req.body.master.cashierreceiveno,
          cashieramt: req.body.master.cashieramt,
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AR",
          transactiontype: "COMM-IN",
          actualvalue: req.body.master.actualvalue,
          diffamt: req.body.master.diffamt,
          status: "A",
          createusercode: usercode,
          billdate: billdate,
          // netprem : req.body.master.netprem,
          commin: req.body.master.commin,
          ovin: req.body.master.ovin,
        
          whtcommin: req.body.master.whtcommin,
          whtovin: req.body.master.whtovin,
          dfrpreferno: req.body.master.arno,
          rprefdate: billdate,

        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //insert to master jaarap OV-IN
    //  const arOvIn = await sequelize.query(
    //   `insert into static_data.b_jaaraps (insurerno, advisorno, type, transactiontype, actualvalue,  status, 
    //         createusercode,   ovin,   whtovin,  dfrpreferno, rprefdate )
    //       values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), 
    //       (select "id" from static_data."Agents" where "agentCode" = :agentCode), :type, :transactiontype, :actualvalue,  :status, 
    //         :createusercode, :ovin,  :whtovin,  :dfrpreferno, :rprefdate) Returning id`,
    //   {
    //     replacements: {
    //       insurerCode: req.body.master.insurerCode,
    //       agentCode: req.body.master.agentCode,
    //       type: "AR",
    //       transactiontype: "OV-IN",
    //       actualvalue: req.body.master.actualvalue,
    //       status: "A",
    //       createusercode: "kkk",
    //       billdate: billdate,
    //       createusercode: "kewn",
    //       // netprem : req.body.master.netprem,
    //       // commin :  req.body.master.commin,
    //       ovin :  req.body.master.ovin,
    //       // vatcommin :  req.body.master.vatcommin,
    //       // vatovin :  req.body.master.vatovin,
    //       // whtcommin :  req.body.master.whtcommin,
    //       whtovin :  req.body.master.whtovin,

    //       dfrpreferno: req.body.master.arno,
    //       rprefdate: billdate,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT,
    //   }
    // );

    //update arno to b_jacashier
    await sequelize.query(
      `update static_data.b_jacashiers set "dfrpreferno" = :arno , status = 'A' where cashierreceiveno = :cashierreceiveno `,
      {
        replacements: {
          arno: req.body.master.arno,
          cashierreceiveno: req.body.master.cashierreceiveno,
        },
        transaction: t,
        type: QueryTypes.UPDATE,
      }
    );

    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arCommIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].totalprem,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }

      )
      // ovin
      // await sequelize.query(
      //   `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
      //         values( :keyidm , (select id from static_data."Policies" where "policyNo" = :policyNo ), :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
      //   {
      //     replacements: {
      //       keyidm: arOvIn[0][0].id,
      //       policyNo: req.body.trans[i].policyNo,
      //       endorseNo: req.body.trans[i].endorseNo,
      //       invoiceNo: req.body.trans[i].invoiceNo,
      //       seqNo: req.body.trans[i].seqNo,
      //       netflag: req.body.trans[i].netflag,
      //       netamt: req.body.trans[i].ovin_amt,
      //     },
      //     transaction: t,
      //     type: QueryTypes.INSERT,
      //   }

      // )


      //update arno, refdate to transaction table
      // let cond = ' and txtype2 in ( 1, 2, 3, 4, 5 ) and status = \'N\''
      // if (req.body.trans[i].endorseNo  !== null && req.body.endorseNo !== '') {
      //   cond =cond + ` and "endorseNo" = '${req.body.trans[i].endorseNo}' `
      // }
      // if (req.body.trans[i].seqNo  !== null && req.body.seqNo !== '') {
      //   cond = cond +' and "seqNo" = ' +req.body.trans[i].seqNo
      // }
      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno = :dfrpreferno ,
      rprefdate = :rprefdate ,
      receiptno = :cashierreceiveno
        where  "transType" in ( 'COMM-IN', 'OV-IN')
          and "insurerCode" = :insurerCode
          and status ='N'
          and "agentCode" = :agentCode
          and "policyNo" = :policyNo 
          and dftxno = :dftxno
          and "seqNo" = :seqNo
          and txtype2 in ( 1, 2 )
          --and txtype2 in ( 1, 2, 3, 4, 5 ) `,
        {
          replacements: {
            dfrpreferno: req.body.master.arno,
            rprefdate: billdate,
            cashierreceiveno: req.body.master.cashierreceiveno,
            insurerCode: req.body.trans[i].insurerCode,
            agentCode: req.body.trans[i].agentCode,
            policyNo: req.body.trans[i].policyNo,
            dftxno: req.body.trans[i].dftxno,
            seqNo: req.body.trans[i].seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })


    }// end for loop
    await t.commit();
    await res.json({
      msg: `created ARNO : ${req.body.master.arno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

//account payment comm/ov out 
const findAPCommOut = async (req, res) => {

  // let cond = ` and (p."actDate" between '${req.body.effDatestart}' and '${req.body.effDateend}'   or p."expDate" between '${req.body.effDatestart}' and '${req.body.effDateend}')`
  let cond = ''
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = cond + ` and t."mainaccountcode" = '${req.body.agentCode}'`
  }
  if (req.body.AR_PREM_IN !== null && req.body.AR_PREM_IN !== '') {
    cond = cond + ` and t."premin-dfrpreferno" = '${req.body.AR_PREM_IN}'`
  }
  if (req.body.AR_PREM_OUT !== null && req.body.AR_PREM_OUT !== '') {
    cond = cond + ` and t."premout-dfrpreferno" = '${req.body.AR_PREM_OUT}'`
  }
  if (req.body.AR_COMM_IN !== null && req.body.AR_COMM_IN !== '') {
    cond = cond + ` and (t.polid,t."seqNo") = (select bj.polid ,bj."seqNo" from static_data.b_jaarapds bj where bj.keyidm = 
    (select id from static_data.b_jaaraps bj2 where bj2.dfrpreferno = '${req.body.AR_COMM_IN}' and bj2.status = 'A' and bj2.transactiontype = 'COMM-IN'))`
  }
  if (req.body.policyNostart !== null && req.body.policyNostart !== '') {
    cond = cond + ` and p."policyNo" >= '${req.body.policyNostart}'`
  }
  if (req.body.policyNoend !== null && req.body.policyNoend !== '') {
    cond = cond + ` and p."policyNo" <= '${req.body.policyNoend}'`
  }
  if (req.body.dueDate !== null && req.body.dueDate !== '') {
    cond = cond + ` and  t."dueDate" <= '${req.body.dueDate}'`
  }

  if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
    cond = cond + ` and   t."premin-rprefdate" >= '${req.body.rprefdatestart}' `
  }
  if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
    cond = cond + ` and   t."premin-rprefdate" <= '${req.body.rprefdateend}' `
  }

  //wait rewrite when clear reconcile process
  const trans = await sequelize.query(
    ` select  t.id as transid , true as select , t."insurerCode", t."mainaccountcode" as "agentCode" , t."withheld" ,
    t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" , t.dftxno, 
    -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid,
    i.id as customerid,
    (case when ent."personType" = 'O' then tt."TITLETHAIBEGIN" ||' ' || ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  || ' ' || tt."TITLETHAIEND"  else tt."TITLETHAIBEGIN" || ' ' || ent."t_firstName"||' '||ent."t_lastName"  end) as insureename,
    t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , (select  "chassisNo" from static_data."Motors" where id = p."itemList"), j.netgrossprem, j.duty, j.tax, j.totalprem,
    (case when t."agentCode2" is null then j.commout1_rate else j.commout2_rate end) as commout_rate,
    (case when t."agentCode2" is null then j.commout1_amt else j.commout2_amt end) as commout_amt,
    (case when t."agentCode2" is null then j.ovout1_amt else j.ovout2_amt end) as ovout_amt,
    (case when t."agentCode2" is null then j.ovout1_rate else j.ovout2_rate end) as ovout_rate,
    (case when t."agentCode2" is null then 
    (select totalamt  from static_data."Transactions" t2 
where t2."policyNo" = t."policyNo" and t2.dftxno = t.dftxno 
and t."seqNo" = t2."seqNo" and t2.status='N' and t2."transType"='DISC-OUT')
 else 0 end) as specdiscamt,
     t."premin-rprefdate" , t."premin-dfrpreferno"
    from static_data."Transactions" t
    join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo"
    join static_data."Policies" p on p.id = j.polid 
    left join static_data."Insurees" i on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
    left join static_data."Entities" ent on ent.id = i."entityID"  -- and ent.lastversion ='Y'
    left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    where t."transType" = 'COMM-OUT'
    and t.txtype2 in ( 1, 2 )
    and t.status = 'N'
    -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
    and t.rprefdate is null
    and t.dfrpreferno is null
    and t."premin-rprefdate" is not null
    and t."premin-dfrpreferno" is not null
    and j.installmenttype ='A'   ${cond} `,
    {

      type: QueryTypes.SELECT,
    }
  );

  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found policy" });
  } else {
    await res.json(trans);
  }
};

const saveAPCommOut = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    const billdate = new Date().toISOString().split("T")[0];

    //insert to master jaarap COMM-OUT
    const arCommOut = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno, "insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue,  status, 
            createusercode,  commout,  whtcommout,  ovout,  whtovout)
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode), :agentCode ,:type, :transactiontype, :actualvalue,  :status, 
            :createusercode, :commout ,  :whtcommout, :ovout ,  :whtovout) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AP",
          transactiontype: "COMM-OUT",
          actualvalue: req.body.master.actualvalue,
          status: "I",
          createusercode: usercode,
          billdate: billdate,
          // netprem : req.body.master.netprem,
          commout: req.body.master.commout,
          ovout: req.body.master.ovout,
        
          whtcommout: req.body.master.whtcommout,
          whtovout: req.body.master.whtovout,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );



    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt)`,
        {
          replacements: {
            keyidm: arCommIn[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].paymentamt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }


      );


    }//end for loop
    await t.commit();
    await res.json({
      msg: `created billadvisorNO : ${req.body.master.billadvisorno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const submitAPCommOut = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.apno =
      `APNO-${getCurrentYY()}` +
      (await getRunNo("apno", null, null, "kw", cuurentdate, t));

    //insert to master jaarap COMM-OUT
    const arCommOut = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno, "insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue,  status, 
            createusercode,  commout,  whtcommout, ovout,  whtovout, dfrpreferno, rprefdate, specdiscamt)
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion = 'Y'), :agentCode , :type, :transactiontype, :actualvalue,  :status, 
            :createusercode, :commout ,  :whtcommout,  :ovout ,  :whtovout, :dfrpreferno, :rprefdate, :specdiscamt) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AP",
          transactiontype: "COMM-OUT",
          actualvalue: req.body.master.actualvalue,
          status: "A",
          createusercode: usercode,
          billdate: billdate,
          // netprem : req.body.master.netprem,
          commout: req.body.master.commout,
          ovout: req.body.master.ovout,
       
          whtcommout: req.body.master.whtcommout,
          whtovout: req.body.master.whtovout,
          specdiscamt: req.body.master.specdiscamt,
          dfrpreferno: req.body.master.apno,
          rprefdate: billdate,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );

    //insert to deteil of jatw 

    // const agent = await sequelize.query(
    //   '(select taxno, "deductTaxRate" from static_data."Agents" where "agentCode" = :agentCode )',
    //   {
    //     replacements: {
    //       agentCode: req.body.master.agentCode,
    //     },
    //     transaction: t,
    //     type: QueryTypes.SELECT,
    //   }

    // ); 
    // await sequelize.query(
    //   `insert into static_data.b_jatws (keyidm, advisorcode, commout_amt, ovout_amt, whtrate, whtcommout_amt,  whtovout_amt, taxid) 
    //             values(:keyidm, :advisorcode, :commout_amt, :ovout_amt, :deducttaxrate,
    //              :whtcommout_amt, :whtovout_amt, :taxno)`,
    //   {
    //     replacements: {
    //       keyidm: arCommOut[0][0].id,
    //       advisorcode: req.body.master.agentCode,
    //       taxno: agent[0].taxno,
    //       deducttaxrate: agent[0].deductTaxRate,
    //       commout_amt: req.body.master.commout,
    //       ovout_amt: req.body.master.ovout,
    //       whtcommout_amt: req.body.master.whtcommout,
    //       whtovout_amt: req.body.master.whtovout,
    //     },
    //     transaction: t,
    //     type: QueryTypes.INSERT,
    //   }
    // );


    for (let i = 0; i < req.body.trans.length; i++) {
      //insert to deteil of jaarapds
      await sequelize.query(
        `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netamt, specdiscamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netamt, :specdiscamt)`,
        {
          replacements: {
            keyidm: arCommOut[0][0].id,
            polid: req.body.trans[i].polid,
            policyNo: req.body.trans[i].policyNo,
            endorseNo: req.body.trans[i].endorseNo,
            invoiceNo: req.body.trans[i].invoiceNo,
            seqNo: req.body.trans[i].seqNo,
            specdiscamt: req.body.trans[i].specdiscamt,
            // netflag: req.body.trans[i].netflag,
            netamt: req.body.trans[i].commout_amt + req.body.trans[i].ovout_amt,
          },
          transaction: t,
          type: QueryTypes.INSERT,
        }

      )

      //update arno, refdate to transaction table
      // let cond = ' and txtype2 in ( 1, 2, 3, 4, 5 ) and status = \'N\''
      // if (req.body.trans[i].endorseNo  !== null && req.body.endorseNo !== '') {
      //   cond =cond + ` and "endorseNo"=  '${req.body.trans[i].endorseNo}' `
      // }
      // if (req.body.trans[i].seqNo !== null && req.body.seqNo !== '') {
      //   cond = cond + ' and "seqNo" = ' + req.body.trans[i].seqNo
      // }
      await sequelize.query(
        `update static_data."Transactions" 
      set 
      dfrpreferno = :dfrpreferno ,
      rprefdate = :rprefdate 
        where  "transType" in ( 'COMM-OUT', 'OV-OUT', 'DISC-OUT')
          and "insurerCode" = :insurerCode
          and "mainaccountcode" = :agentCode
          and status ='N'
          and "policyNo" = :policyNo 
          and dftxno = :dftxno
          -- and txtype2 in ( 1, 2, 3, 4, 5 ) 
          and txtype2 in ( 1, 2 ) 
          and status = 'N'
          and "seqNo" = :seqNo
       `,
        {
          replacements: {
            dfrpreferno: req.body.master.apno,
            rprefdate: billdate,
            agentCode: req.body.trans[i].agentCode,
            insurerCode: req.body.trans[i].insurerCode,
            policyNo: req.body.trans[i].policyNo,
            seqNo: req.body.trans[i].seqNo,
            dftxno: req.body.trans[i].dftxno,
            seqNo : req.body.trans[i].seqNo,
          },
          transaction: t,
          type: QueryTypes.UPDATE,
        })


    }// end for loop
    await t.commit();
    await res.json({
      msg: `created APNO : ${req.body.master.apno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

const findPremOutReturn = async (req, res) => {


  let cond = ''
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = cond + ` and t."mainaccountcode" = '${req.body.agentCode}'`
  }
  if (req.body.AR_PREM_IN !== null && req.body.AR_PREM_IN !== '') {
    cond = cond + ` and t."premin-dfrpreferno" = '${req.body.AR_PREM_IN}'`
  }

  if (req.body.policyNostart !== null && req.body.policyNostart !== '') {
    cond = cond + ` and p."policyNo" >= '${req.body.policyNostart}'`
  }
  if (req.body.policyNoend !== null && req.body.policyNoend !== '') {
    cond = cond + ` and p."policyNo" <= '${req.body.policyNoend}'`
  }
  if (req.body.dueDate !== null && req.body.dueDate !== '') {
    cond = cond + ` and  t."dueDate" <= '${req.body.dueDate}'`
  }

  if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
    cond = cond + ` and   t."premin-rprefdate" >= '${req.body.rprefdatestart}' `
  }
  if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
    cond = cond + ` and   t."premin-rprefdate" <= '${req.body.rprefdateend}' `
  }

  //wait rewrite when clear reconcile process
  const trans = await sequelize.query(
    ` select  true as select , t."insurerCode", t."mainaccountcode" as "agentCode" , t."withheld" ,
    t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" , t.dftxno, 
    -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid,
    i.id as customerid,
    (case when ent."personType" = 'O' then tt."TITLETHAIBEGIN" ||' ' || ent."t_ogName" || COALESCE(' สาขา '|| ent."t_branchName",'' )  || ' ' || tt."TITLETHAIEND"  else tt."TITLETHAIBEGIN" || ' ' || ent."t_firstName"||' '||ent."t_lastName"  end) as insureename,
    t.polid, m."licenseNo" , m."chassisNo", (select t_provincename from static_data."provinces" where provinceid = m."motorprovinceID" ) as "motorprovince",
    -- (case when t."agentCode2" is null then j.commout1_rate else j.commout2_rate end) as commout_rate,
    -- (case when t."agentCode2" is null then j.commout1_amt else j.commout2_amt end) as commout_amt,
    -- (case when t."agentCode2" is null then j.ovout1_amt else j.ovout2_amt end) as ovout_amt,
    -- (case when t."agentCode2" is null then j.ovout1_rate else j.ovout2_rate end) as ovout_rate,
    -- (case when t."agentCode2" is null then j.specdiscamt else 0 end) as specdiscamt,
    j.netgrossprem, j.duty, j.tax, j.totalprem, j.withheld, 
    j.commout1_rate  as commout_rate,
    j.commout1_amt as commout_amt,
    j.ovout1_amt as ovout_amt,
    j.ovout1_rate  as ovout_rate,
    j.specdiscamt as specdiscamt,
     t."premin-rprefdate" , t."premin-dfrpreferno"
    from static_data."Transactions" t
    join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo"
    join static_data."Policies" p on p.id = j.polid 
    left join static_data."Insurees" i on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
    left join static_data."Entities" ent on ent.id = i."entityID" -- and ent.lastversion ='Y'
    left join static_data."Titles" tt on tt."TITLEID" = ent."titleID"
    left join static_data."Motors" m on m.id = p."itemList"
    where t."transType" = 'PREM-IN'
    and t.txtype2 in ( 3, 4, 5)
    and t.status = 'N'
    -- and p."lastVersion" = 'Y'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
    and t.rprefdate is null
    and t.dfrpreferno is null
    and t."premout-rprefdate" is not null
    and t."premout-dfrpreferno" is not null
    and j.installmenttype ='A'   ${cond} `,
    {

      type: QueryTypes.SELECT,
    }
  );

  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found policy" });
  } else {
    await res.json(trans);
  }
};

// ตัดหนี้ premout คืนเบี้ย (ใช้เลขกรมธรรม์ตัดจ้าาาา)
const submitAPPremOutReturn = async (req, res) => {
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  try {
    // let data = {
    //   transactiontype: 'PREM-OUT',
    //   insurercode: req.body.master.insurerCode,
    //   advisorcode: req.body.master.agentCode,
    //   customerid: req.body.master.insureeCode,
    //   receivefrom: "Advisor",
    //   receivename: "-",
    //   usercode: usercode,
    //   Amt: req.body.master.actualvalue,
    // }

    //insert to master jaarap
    const billdate = new Date().toISOString().split("T")[0];
    const cuurentdate = getCurrentDate()
    req.body.master.apno =
      `APNO-${getCurrentYY()}` +
      (await getRunNo("apno", null, null, "kw", cuurentdate, t));

    //insert into b_jaaraps
    const arPremIn = await sequelize.query(
      `insert into static_data.b_jaaraps (insurerno, "insurerCode", advisorno, "agentCode", type, transactiontype, actualvalue, diffamt, status, 
            createusercode, netprem, commin, ovin,  whtcommin, whtovin, dfrpreferno, rprefdate, withheld )
          values((select "id" from static_data."Insurers" where "insurerCode" = :insurerCode and lastversion = 'Y'), :insurerCode,
          (select "id" from static_data."Agents" where "agentCode" = :agentCode and lastversion ='Y'), :agentCode, :type, :transactiontype, :actualvalue, :diffamt, :status, 
            :createusercode, :netprem, :commin , :ovin,  :whtcommin, :whtovin,  :dfrpreferno, :rprefdate, :withheld ) Returning id`,
      {
        replacements: {
          insurerCode: req.body.master.insurerCode,
          agentCode: req.body.master.agentCode,
          type: "AP",
          transactiontype: "PREM-OUT",
          actualvalue: req.body.master.actualvalue,
          diffamt: 0,
          status: "A",
          createusercode: usercode,
          billdate: billdate,
          netprem: req.body.master.totalprem,
          commin: req.body.master.commin,
          ovin: req.body.master.ovin,
        
          // whtcommin :  req.body.master.whtcommin,
          // whtovin :  req.body.master.whtovin,

          whtcommin: req.body.master.whtcommin,
          whtovin: req.body.master.whtovin,
          withheld: req.body.master.withheld,
          dfrpreferno: req.body.master.apno,
          rprefdate: billdate,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }
    );




    //insert to deteil of jaarapds
    await sequelize.query(
      `insert into static_data.b_jaarapds (keyidm, polid, "policyNo", "endorseNo", "invoiceNo", "seqNo", netflag, netamt, withheld, specdiscamt) 
              values( :keyidm , :polid, :policyNo, :endorseNo, :invoiceNo, :seqNo, :netflag, :netamt, :withheld, :specdiscamt)`,
      {
        replacements: {
          keyidm: arPremIn[0][0].id,
          polid: req.body.master.polid,
          policyNo: req.body.master.policyNo,
          endorseNo: req.body.master.endorseNo,
          invoiceNo: req.body.master.invoiceNo,
          seqNo: req.body.master.seqNo,
          netflag: 'N',
          netamt: req.body.master.actualvalue,
          withheld: req.body.master.withheld,
          specdiscamt: req.body.master.specdiscamt,
        },
        transaction: t,
        type: QueryTypes.INSERT,
      }

    )

    console.log(`---------------  UPDATE TRANSACTION ---------
   {
    dfrpreferno: ${req.body.master.apno},
    rprefdate: ${billdate},
    agentCode: ${req.body.master.agentCode},
    insurerCode: ${req.body.master.insurerCode},
    polid: ${req.body.master.polid},
    policyNo: ${req.body.master.policyNo},
    dftxno: ${req.body.master.dftxno},
    seqNo: ${req.body.master.seqNo},            
    netflag: 'N',
  },`);
    //update arno, refdate to transaction table
    await sequelize.query(
      `update static_data."Transactions" 
      set 
      dfrpreferno = CASE
        WHEN mainaccountcode = :agentCode AND "transType" in ('PREM-IN', 'COMM-OUT', 'OV-OUT', 'DISC-IN', 'DISC-OUT' ) THEN :dfrpreferno
        ELSE dfrpreferno
        END,
      rprefdate = CASE
        WHEN mainaccountcode = :agentCode AND "transType" in ('PREM-IN', 'COMM-OUT', 'OV-OUT', 'DISC-IN', 'DISC-OUT' ) THEN :rprefdate
        ELSE rprefdate
        END,
      netflag = :netflag,
      "premin-dfrpreferno" = :dfrpreferno,
      "premin-rprefdate" = :rprefdate
      
      where  "transType" in ( 'PREM-IN', 'DISC-IN', 'COMM-OUT', 'OV-OUT', 'PREM-OUT', 'COMM-IN', 'OV-IN', 'DISC-OUT')
        and "insurerCode" = :insurerCode
        and "agentCode" = :agentCode
        and "policyNo" = :policyNo 
        and "dftxno" = :dftxno 
        and "seqNo" = :seqNo
        and txtype2 in ( 3, 4, 5 ) and status = 'N' `,
      {
        replacements: {
          dfrpreferno: req.body.master.apno,
          rprefdate: billdate,
          agentCode: req.body.master.agentCode,
          insurerCode: req.body.master.insurerCode,
          // polid: req.body.master.polid,
          policyNo: req.body.master.policyNo,
          dftxno: req.body.master.dftxno,
          seqNo: req.body.master.seqNo,
          netflag: 'N',

        },
        transaction: t,
        type: QueryTypes.UPDATE,
      })

    await t.commit();
    await res.json({
      msg: `created APNO : ${req.body.master.apno} success!!`,
    });
  } catch (error) {
    console.error(error)
    await t.rollback();
    await res.status(500).json({ msg: "internal server error" });
  }


};

//ค้นหาบัญชีคงค้าง
const findSuspense = async (req,res) =>{
   const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  try {
  // let cond = ` and (p."actDate" between '${req.body.effDatestart}' and '${req.body.effDateend}'   or p."expDate" between '${req.body.effDatestart}' and '${req.body.effDateend}')`
  let cond = ''
  if (req.body.insurerCode !== null && req.body.insurerCode !== '') {
    cond = cond + ` and t."insurerCode" = '${req.body.insurerCode}'`
  }
  if (req.body.agentCode !== null && req.body.agentCode !== '') {
    cond = cond + ` and t."mainaccountcode" = '${req.body.agentCode}'`
  }
  if (req.body.AR_PREM_IN !== null && req.body.AR_PREM_IN !== '') {
    cond = cond + ` and t."premin-dfrpreferno" = '${req.body.AR_PREM_IN}'`
  }
  if (req.body.AR_PREM_OUT !== null && req.body.AR_PREM_OUT !== '') {
    cond = cond + ` and t."premout-dfrpreferno" = '${req.body.AR_PREM_OUT}'`
  }
  if (req.body.AR_COMM_IN !== null && req.body.AR_COMM_IN !== '') {
    cond = cond + ` and (t.polid,t."seqNo") = (select bj.polid ,bj."seqNo" from static_data.b_jaarapds bj where bj.keyidm = 
    (select id from static_data.b_jaaraps bj2 where bj2.dfrpreferno = '${req.body.AR_COMM_IN}' and bj2.status = 'A' and bj2.transactiontype = 'COMM-IN'))`
  }
  if (req.body.policyNostart !== null && req.body.policyNostart !== '') {
    cond = cond + ` and p."policyNo" >= '${req.body.policyNostart}'`
  }
  if (req.body.policyNoend !== null && req.body.policyNoend !== '') {
    cond = cond + ` and p."policyNo" <= '${req.body.policyNoend}'`
  }
  if (req.body.dueDate !== null && req.body.dueDate !== '') {
    cond = cond + ` and  t."dueDate" <= '${req.body.dueDate}'`
  }

  if (req.body.rprefdatestart !== null && req.body.rprefdatestart !== '') {
    cond = cond + ` and   t."premin-rprefdate" >= '${req.body.rprefdatestart}' `
  }
  if (req.body.rprefdateend !== null && req.body.rprefdateend !== '') {
    cond = cond + ` and   t."premin-rprefdate" <= '${req.body.rprefdateend}' `
  }

  //wait rewrite when clear reconcile process
  const trans = await sequelize.query(
    ` select  t.id as transid , true as select , t."insurerCode", t."mainaccountcode" as "agentCode" , t."withheld" ,
    t."dueDate", t."policyNo", t."endorseNo", j."invoiceNo", t."seqNo" , t.dftxno, 
    -- (select "id" from static_data."Insurees" where "insureeCode" = p."insureeCode" ) as customerid,
    i.id as customerid,
    getname(i."entityID") as insureename,
    t.polid, (select "licenseNo" from static_data."Motors" where id = p."itemList") , (select  "chassisNo" from static_data."Motors" where id = p."itemList")
    , j.netgrossprem, j.duty, j.tax, j.totalprem,
    (case when t."agentCode2" is null then j.commout1_rate else j.commout2_rate end) as commout_rate,
    (case when t."agentCode2" is null then j.commout1_amt else j.commout2_amt end) as commout_amt,
    (case when t."agentCode2" is null then j.ovout1_amt else j.ovout2_amt end) as ovout_amt,
    (case when t."agentCode2" is null then j.ovout1_rate else j.ovout2_rate end) as ovout_rate,
    (case when t."agentCode2" is null then 
    (select totalamt  from static_data."Transactions" t2 
where t2."policyNo" = t."policyNo" and t2.dftxno = t.dftxno 
and t."seqNo" = t2."seqNo" and t2.status='N' and t2."transType"='DISC-OUT')
 else 0 end) as specdiscamt,
     t."premin-rprefdate" , t."premin-dfrpreferno"
    from static_data."Transactions" t
    join static_data.b_jupgrs j on t."policyNo" = j."policyNo" and t.dftxno = j.dftxno and t."seqNo" = j."seqNo"
    join static_data."Policies" p on p.id = j.polid 
    join static_data."in
    left join static_data."Insurees" i on i."insureeCode" = p."insureeCode" and i.lastversion = 'Y'
    left join static_data."Motors" mt on mt.id = p."itemList" and 
    where t."transType" = 'SUSPENSE'
    and t.txtype2 in ( 1, 2 )
    and t.status = 'N'
      and p.endorseseries = (select max(endorseseries) from static_data."Policies" p2 where "policyNo"= p."policyNo")
    and t.rprefdate is null
    and t.dfrpreferno is null
    and t."premin-rprefdate" is not null
    and t."premin-dfrpreferno" is not null
    and j.installmenttype ='A'   ${cond} `,
    {
      type: QueryTypes.SELECT,
    }
  );

  if (trans.length === 0) {
    await res.status(201).json({ msg: "not found policy" });
  } else {
    await res.json(trans);
  }


  } catch (error) {
    
  }
}

//เคลียบัญชีคงค้าง
const claerSuspense = async (req, res) =>{
  const jwt = req.headers.authorization.split(' ')[1];
  const usercode = decode(jwt).USERNAME;
  const t = await sequelize.transaction();
  
}


module.exports = {
  getbilldata,
  findARPremInDirect,
  getcashierdata,
  getARPremindata,
  submitARPremin,
  saveARPremin,
  getARtrans,
  saveARPreminDirect,
  submitARPreminDirect,
  findAPPremOut,
  saveAPPremOut,
  submitAPPremOut,
  findARCommIn,
  saveARCommIn,
  submitARCommIn,
  findAPCommOut,
  saveAPCommOut,
  submitAPCommOut,
  getARAPtransAll,
  submitARPreminMinor, // for arpremin-trans
  submitARPreminMinorPol, // for arpremin-pollist
  findPremOutReturn,
  submitAPPremOutReturn,
  findARPremInMinor,
  submitARPreminMinor_V2, //ตัดหนี้ premin รายย่อย version ใหม่้
  getSuspenseList, // ดึงรายการบัญชีคงค้าง
  approveSuspense // เคลียบัญชีคงค้าง

};
