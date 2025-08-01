
const process = require('process');
require('dotenv').config();
const { throws } = require("assert");

// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize } = require("sequelize");


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

const insertjugltx = async (ttype,policyno,t) => {

    //public static long GetRunNo(string BrCode, string RunType, string ParamClass, string SubClass, string OutletCode, string UpdateUserCode, DateTime EffectiveDate)
 
  

    try {
          await sequelize.query(
            `DO $$ 
            DECLARE
                column_name text;
                query text;
                result numeric; 
                d_ttype text;
                d_seqno int;
                d_account text;
                d_gltype text;
            BEGIN
               
            FOR column_name, d_ttype, d_seqno, d_account, d_gltype IN
                    SELECT t.command, t.ttype, t.seqno, t.accountno, t.gltype
                    FROM static_data.b_tugltxtypes t 
                    WHERE ttype = '${ttype}'
                LOOP
                query := 'SELECT ' || column_name || ' FROM static_data."Policies" WHERE "policyNo" = ''${policyno}'' LIMIT 1';
                EXECUTE query INTO result;
            
                insert into static_data.b_jugltxes 
                (ttype, seqno, accountno, gltype, policyno,  amt)
                values (d_ttype, d_seqno, d_account, d_gltype, '${policyno}', result);
              END LOOP;
            END $$;`
          , 
          { 
            transaction: t ,
            raw: true 
          });
    
} catch (error) {
  console.error(error)
    throw error;
}


}

module.exports = {
insertjugltx

};