require('dotenv').config();

module.exports = {
    // development: {
    //     username: "postgres",
    //     password: "1234",
    //     database: "pos_system_local",
    //     host: "127.0.0.1",
    //     dialect: "postgres",
    //     port: 5433,
    // },
    development: {
        username:  process.env.DB_USERNAME,
        password:  process.env.DB_PASSWORD,
        database:  process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        port: process.env.DB_PORT,
        dialectOptions: {
            ssl: {
                require: true,
                    rejectUnauthorized: false
            },
        },
    },
   
};