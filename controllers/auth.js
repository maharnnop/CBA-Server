const User = require("../models").User; //imported fruits array
// const Package = require("../models").Package;
// const User = require("../models").User;
const { Op, QueryTypes, Sequelize } = require("sequelize");
const crypto = require('crypto');
const serverenv = process.env.serverenv
const secretKey = process.env.secretkey
const tokenkey = process.env.tokenkey
const KCurl = process.env.KCurl
const KCrealm = process.env.KCrealm
const KCadus = process.env.KCadus
const KCadps = process.env.KCadps
const KCClientId = process.env.KCClientId
const KCClientSecret = process.env.KCClientSecret
const jwt = require('jsonwebtoken');
const axios = require("axios");
const { decode } = require('jsonwebtoken'); // jwt-decode

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


const showAll = (req, res) => {
  User.findAll({
    // where:{
    //     FLAGDELETE:'N'
    // }
  }).then((users) => {
    res.json(users);
  }).catch((err) =>
    res.send(err)
  )
}

const showByUsername = (req, res) => {
  User.findOne({

    where: {
      userName: req.body.userName
    }
  }).then((user) => {
    res.json(user);
  });
};

const signup = (req, res) => {

  const password = req.body.password
  // hash password
  const hash = crypto.pbkdf2Sync(password, secretKey,
    1000, 64, `sha512`).toString(`hex`);
  // req.body.password = hash

  User.create(req.body)
    .then((newUser) => {
      const token = jwt.sign(
        {
          USERID: newUser.id,
          USERNAME: newUser.userName,
          ROLE: newUser.role
        },
        tokenkey,
        {
          expiresIn: "4 hours",
          algorithm: 'HS256'
        }
      );
      res.json({ jwt: token });
    })
    .catch((err) => {
      res.sendStatus(401);
    });


}
const login = (req, res) => {
  console.log(req.body);
  User.findOne({
    where: {
      userName: req.body.userName
    }
  }).then(foundUser => {
    if (foundUser === null) {
      return res.status(201).json({ errors: [{ msg: "USER NOT FOUND" }] })
    } else {
      const hash = crypto.pbkdf2Sync(req.body.password, secretKey,
        1000, 64, `sha512`).toString(`hex`);
      //check status login failed
      if (foundUser.loginFailCount >= 4) {
        res.status(401).json({ errors: [{ msg: "USER HAS BEEN LOGGED PLEASE CONTACT KWAN!!" }] })
      } else {
        //check password
        // if(hash == foundUser.password && foundUser.lockStatus.trim() === 'N'){
        if (req.body.password === foundUser.password && foundUser.lockStatus.trim() === 'N') {
          console.log(foundUser);
          foundUser.loginFailCount = 0
          foundUser.save()
          const token = jwt.sign(
            {
              USERID: foundUser.id,
              USERNAME: foundUser.userName,
              ROLE: foundUser.role
            },
            tokenkey,
            {
              expiresIn: "10 hours",
              algorithm: 'HS256'
            }
          );
          res.status(200)
            //   .cookie('auth', token, {
            //     // sameSite: 'strict',
            //     // path:'/',
            //     httpOnly: true,
            //     // expires : Session,
            //   secure : true
            // })
            .json({ jwt: token })



        } else {
          foundUser.loginFailCount++
          foundUser.save()
          res.status(401).json({ errors: [{ msg: "WRONG PASSWORD" }] })

        }
      }

    }
  }).catch((err) => {
    res.status(501).send(err)
  })

}

// const unlockUser =(req,res) =>{
//     User.findOne({
//         where: {
//             USERNAME: req.body.USERNAME
//           }
//     }).then(foundUser =>{
//         //set default password
//         const password = '1212312121'
//         const hash = crypto.pbkdf2Sync(password, secretKey,  
//             1000, 64, `sha512`).toString(`hex`); 
//             foundUser.PASSWORD = hash
//             foundUser.LOGINFAIL_NO = 0
//             foundUser.save()
//             res.status(200).json({ msg: `unlock user : ${req.body.USERNAME} success new password is ${password}` });     

//     }).catch(err =>{
//         res.status(501).send(err)
//     })
// }
const signupKC = async (req, rsponse) => {

  const t = await sequelize.transaction();
  try {


    console.log('--------insert new user to db')
    await User.create(req.body, { transaction: t })
      .then((newUser) => {


        //  res.json({ jwt: token });
      })
      .catch((err) => {
        console.log("username existing");
        throw ({
          error_msg: "username existing",
          status: 500,
        })
        //  res.sendStatus(401);
      });
    console.log('--------insert new user to KC')
    // ******************  KC Part *************************
    // Create an instance of URLSearchParams
    const formData0 = new URLSearchParams();
    // formData0.append('username', KCadus);
    // formData0.append('password', KCadps);
    formData0.append('client_id', KCClientId);
    formData0.append('client_secret', KCClientSecret);
    formData0.append('scope', 'openid profile email');
    // formData0.append('grant_type', 'password');
    formData0.append('grant_type', 'client_credentials');
    let adminToken = null
    let user_id = null

    // API 0 get admin token
    await axios.post(`${KCurl}/realms/${KCrealm}/protocol/openid-connect/token`, formData0, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }).then((res) => {
      
      adminToken = res.data.access_token
    }).catch((err) => {
      console.log("error_msg : " + err.response.data.error);
        throw ({
          error_msg: err.response.data.error,
          status: err.response.status,
        })
    });
    console.log('--------get admin token success')

    const headers = await {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
    }
    const formData1 = {
      "firstName": req.body.firstName,
      "lastName": req.body.lastName,
      "email": req.body.email,
      "enabled": true,
      "username": req.body.userName,
      //"password": req.body.password,
      "emailVerified": true,
      "attributes": {
        "phoneNumber": req.body.phoneNumber,
      }
    }
    // console.log('----- header : ' +`Bearer ${adminToken}`)
    // API 1 ADD new User
    await axios.post(`${KCurl}/admin/realms/${KCrealm}/users`, formData1, headers)
      .then((res1) => {

        console.log('--------add new user KC success')

       
      }).catch((err) => {
        console.log("error_msg : " + err.response.data.errorMessage);
        throw ({
          error_msg: err.response.data.errorMessage,
          status: err.response.status,
        })

      });

       // API 2 Get user_id
     await   axios.get(`${KCurl}/admin/realms/${KCrealm}/users?username=${req.body.userName}`, headers)
     .then((respon) => {
       console.log('--------get userid KC success')
       user_id = respon.data[0].id
       console.log("userid : " + user_id);

     
     })
     .catch((err) => { 
      console.log ('get new user KC id error'); 
      console.log("error_msg : " + err.response.data.error);
      throw ({
        error_msg: err.response.data.error,
        status: err.response.status,
      })
    });

      // API 3 send verify email
    await  axios.put(`${KCurl}/admin/realms/${KCrealm}/users/${user_id}/execute-actions-email?lifespan=10800`, ["UPDATE_PASSWORD"], headers)
      .then((res2) => {
        console.log('--------send verified email KC success')
      }).catch((err) => { 
        console.log ('add send verify email error');
        console.log("error_msg : " + err.response.data.error);
        throw ({
          error_msg: err.response.data.error,
          status: err.response.status,
        })
       });




    await t.commit();
    rsponse.status(200).json({ msg: "Register Success" })

  } catch (error) {
    console.error(error);
    await t.rollback();
    if (error.error_msg) {
      await rsponse.status(error.status).json(error.error_msg);
    }else{
      await rsponse.status(500).json(error);

    }

  }

}

const loginKC = async (req, rsponse, next) => {

  console.log('------loginKC --------');
  // res.status(200).json({msg : 'test'})
  // flow api KC login check user/ps (req user/ps)--> get userToken --> api KC get user_id && api KC get adminToken --> api KC send OTP (use adminToken) --> res {userToken , phoneNumber}
  try {
    const userName = req.body.userName


    const password = req.body.password
    let adminToken = null
    let userToken = null
    let user_id = null
    let otpPhoneNumber = null

    // admin user&pass  
    const formData0 = new URLSearchParams();
    // formData0.append('username', KCadus);
    // formData0.append('password', KCadps);
    formData0.append('client_id', KCClientId);
    formData0.append('client_secret', KCClientSecret);
    formData0.append('scope', 'openid profile email');
    // formData0.append('grant_type', 'password');
    formData0.append('grant_type', 'client_credentials');
console.log('before call KC');

    // API 0 get admin token
    // await axios.post(`${KCurl}/realms/${KCrealm}/protocol/openid-connect/token`, formData0, {
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    // }).then((res) => {
    //   adminToken = res.data.access_token
    // }).catch((err) => { console.log(err.data); 
    //   throw err;
    // });

    // API 0 get admin token
    await axios.post(`${KCurl}/realms/${KCrealm}/protocol/openid-connect/token`, formData0, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }).then(res1 => {
      adminToken = res1.data.access_token
    })
      .catch(error => {
        console.error("error_msg : " + error);
        console.error("error_msg : " + error.response.data.error_description);
        throw ({
          error_msg: error.response.data.error_description,
          status: error.response.status,
        })
      })

      console.log("---get admintoken success : ");



    // user_id = response1.data[0].user_id
    // adminToken = response2.data.access_token

    // client user&pass
    const formData5 = new URLSearchParams();
    formData5.append('username', userName);
    formData5.append('password', password);
    formData5.append('client_id', KCClientId);
    formData5.append('client_secret', KCClientSecret);
    formData5.append('scope', 'openid profile email');
    formData5.append('grant_type', 'password');

    //API 1 Get user_id
    console.log(`${KCurl}/admin/realms/${KCrealm}/users?username=${req.body.userName}`);
    
    await axios.get(`${KCurl}/admin/realms/${KCrealm}/users?username=${req.body.userName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
    }).then( (res3) => {
      console.log("success");
      console.log(JSON.stringify(res3.data));
      
      if (res3.data.length === 0) {
        console.log("case1");
        throw ({
          response:{
            data:{error: "User Not Found"} ,
          status: 404,
        }})
       
      }else if (res3.data[0].requiredActions.length !== 0) {
        console.log("case2");
        const required = `user : ${userName} requiredActions ${res3.data[0].requiredActions.join(" and ")}`
        throw ({
          response:{
            data:{error: required} ,
          status: 500,
        }})

      }else{
        console.log("case3");
        user_id = res3.data[0].id
      }
    }).catch((err) => {  
      console.log("error");
      console.log(JSON.stringify(err));
      console.log("error_msg : " + err.response.data.error);
      throw ({
        error_msg: err.response.data.error,
        status: err.response.status,
      })
      
    });
    console.log("------get user_id success : " + user_id);

// API 2 login get usertoken
    await axios.post(`${KCurl}/realms/${KCrealm}/protocol/openid-connect/token`, formData5, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }).then((res2) => {
      userToken = res2.data.access_token
      
    }).catch((err) => { 
      console.log("error_msg : " + err.response.data.error_description);
      throw ({
        error_msg: err.response.data.error_description,
        status: err.response.status,
      })
    });
    console.log("------get userToken success :" );



        // API 3 send OTP 
      // axios.post(`${KCurl}/realms/${KCrealm}/bestpolicy-rest-sms-authenticator/manage-2fa/${user_id}/generate-otp`, ['UPDATE_PASSWORD'], {
      await  axios.post(`${KCurl}/realms/${KCrealm}/bestpolicy-rest-sms-authenticator/manage-2fa/${user_id}/generate-otp`, null, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
        }).then((res3) => {
          console.log("OTP_msg : " + res3.data.otpCode);
          otpPhoneNumber = res3.data.otpPhoneNumber
          rsponse.status(200).json({
            KCToken: userToken,
            otpPhoneNumber: otpPhoneNumber
          })
          
        }).catch((err) => { 
          console.log("error_msg : " + err.response.data.error);
          throw ({
            error_msg: err.response.data.error,
            status: err.response.status,
          })
        });
        console.log("------get otpPhoneNumber : " + otpPhoneNumber);

    console.log("------get userToken success :");


  } catch (error) {
    
    console.error(JSON.stringify(error));
    console.error(error)
    if (error.error_msg) {
      
      await rsponse.status(error.status).json(error.error_msg);
    }else{
      await rsponse.status(500).json(error);
    }
  }

}

const checkOTPKCOLD = async (req, res) => {

  // flow api KC login check user/ps (req userToken, OTP)-->  api KC get user_id (verify userToken) && api KC get adminToken --> api KC verify OTP (use adminToken) -->gen APPToken res {userToken , phoneNumber}
  try {
    let adminToken = null
    let userToken = req.body.userToken
    let user_id = null
    let otpCode = req.body.otpCode
    const decodeToken = jwt.decode(req.body.userToken);

    const formData0 = new URLSearchParams();
    formData0.append('username', KCadus);
    formData0.append('password', KCadps);
    formData0.append('client_id', 'admin-cli');
    formData0.append('client_secret', 'woutH46yCZCAzSZfUd8khhwKXZ62T45Q');
    formData0.append('scope', 'openid profile email');
    formData0.append('grant_type', 'password');


    const [response1, response2] = await Promise.all([
      //API 2 Get user_id (validate userToken)
      axios.get(`${KCurl}/admin/realms/${KCrealm}/users?username=${decodeToken.preferred_username}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
      }),
      // API 0 get admin token
      axios.post(`${KCurl}/realms/${KCrealm}/protocol/openid-connect/token`, formData0, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    ]);
    user_id = response1.data[0].user_id
    adminToken = response2.data.access_token

    // API 7 verify OTP 
    await axios.post(`${KCurl}/realms/${KCrealm}/rest-sms-authenticator/manage-2fa/${user_id}/validate-otp`, {
      "otpCode": otpCode
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
    }).then((res) => {
      // gen APP Token
      const token = jwt.sign(
        {
          USERNAME: decodeToken.preferred_username,
          ROLE: decodeToken.role
        },
        tokenkey,
        {
          expiresIn: "8 hours",
        }
      );
      res.status(200).json({ jwt: token });
    })

  } catch (error) {
    
    console.error(error)
    await res.status(500).json(error);
  }

}

const checkOTPKC = async (req, res) => {

  // flow api KC login check user/ps (req userToken, OTP)-->  api KC get user_id (verify userToken) && api KC get adminToken --> api KC verify OTP (use adminToken) -->gen APPToken res {userToken , phoneNumber}
  try {
    //decode for get usertoken
    const jwtKC = req.headers.authorization.split(' ')[1];
    const user_id = decode(jwtKC).sub;
    console.log(user_id);
    const otpCode = req.body.otpCode
    console.log('otpCode : ' + otpCode);

   if(otpCode === '000000' && (serverenv === 'UAT' || serverenv === 'DEV' )){  // bypass for uat otp cant send
    console.log('---- ok otp validate');
   }else{
// API 7 verify OTP 
await axios.post(`${KCurl}/realms/${KCrealm}/bestpolicy-rest-sms-authenticator/manage-2fa/${user_id}/validate-otp`, {
  "otpCode": otpCode
}, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtKC}`
  },
}).then((resp) => {
  // gen APP Token
  console.log('---- ok otp validate');
  
 
 
}).catch((err) => { 
  console.log("error_msg : " + err.response.data.error);
  throw ({
    error_msg: err.response.data.error,
    status: err.response.status,
  })
});
   }

    


    // const foundUser = await User.findOne({
    //   where: {
    //     userName:  decode(jwtKC).preferred_username
    //   }
    // })
    const foundUser = await sequelize.query(
      `select u."userName" ,u."role" , a."permission"  from static_data."Users" u
        join static_data.authorized a on a.role_name = u."role" 
        where u."userName" = :userName ;`,
          {
            replacements: {
              userName: decode(jwtKC).preferred_username
            },
            type: QueryTypes.SELECT
          }
        );
    const token = jwt.sign(
      {
        USERNAME: foundUser[0].userName,
        ROLE: foundUser[0].role,
        PERMISSION : foundUser[0].permission
      },
      tokenkey,
      {
        expiresIn: "8 hours",
      }
    );
    res.status(200).json({ jwt: token,
      
     });

  } catch (error) {
    
    console.error(error)
    if (error.error_msg) {
      
      await res.status(error.status).json(error.error_msg);
    }else{
      await res.status(500).json(error);
    }
  }

}

const resetpwKC = async (req,rsponse) =>{
  console.log('------resetpwKC --------');
  try {
    const userName = req.body.userName

    let adminToken = null
    let user_id = null
    let email = ""

    // admin user&pass  
    const formData0 = new URLSearchParams();
    formData0.append('client_id', KCClientId);
    formData0.append('client_secret', KCClientSecret);
    formData0.append('scope', 'openid profile email');
    formData0.append('grant_type', 'client_credentials');
    console.log('before call KC');

    // API 0 get admin token
    await axios.post(`${KCurl}/realms/${KCrealm}/protocol/openid-connect/token`, formData0, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }).then(res1 => {
      adminToken = res1.data.access_token
    })
      .catch(error => {
        console.error("error_msg : " + error);
        console.error("error_msg : " + error.response.data.error_description);
        throw ({
          error_msg: error.response.data.error_description,
          status: error.response.status,
        })
      })

      console.log("---get admintoken success : ");


    //API 1 Get user_id
    await axios.get(`${KCurl}/admin/realms/${KCrealm}/users?username=${userName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
    }).then( (res3) => {
      if (res3.data.length === 0) {
        
        throw ({
          response:{
            data:{error: "User Not Found"} ,
          status: 404,
        }})
      }else{

        user_id = res3.data[0].id
        email = res3.data[0].email
        
      }
    }).catch((err) => {  
      console.log("error_msg : " + err.response.data.error);
      throw ({
        error_msg: err.response.data.error,
        status: err.response.status,
      })
      
    });
    console.log("------get user_id success : " + user_id);

        // API 2 email reset password
      console.log(`${KCurl}/realms/${KCrealm}/users/${user_id}/execute-actions-email?lifespan=3600`);
      
      await  axios.put(`${KCurl}/admin/realms/${KCrealm}/users/${user_id}/execute-actions-email?lifespan=10800`, ["UPDATE_PASSWORD"], {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
        }).then((res3) => {
      
          console.log("------send email reset password success : " + email);
          rsponse.status(200).json({
            username: userName,
            email: email
          })
          
        }).catch((err) => { 
          console.log("error_msg : " + err.response.data.error);
          throw ({
            error_msg: err.response.data.error,
            status: err.response.status,
          })
        });




  } catch (error) {
    console.error(error)
    if (error.error_msg) {
      
      await rsponse.status(error.status).json(error.error_msg);
    }else{
      await rsponse.status(500).json(error);
    }
  }
}

const getSubordinateUser = async (req, res) =>{
  try {
    const jwt = req.headers.authorization.split(' ')[1];
    const usercode = decode(jwt).USERNAME;
   
    const records = await sequelize.query(
      `select "userName", "role" from static_data."Users" u 
where  u."role" IN (SELECT unnest(get_subordinates( :username )));`,
      {
        replacements:{
          username :usercode
        },
        type: QueryTypes.SELECT
      }
    )
    res.json(records)
  } catch (error) {

    console.error(error.message)
    await res.status(500).json({ message: error.message });
  }  
}

module.exports = {
  showAll,
  showByUsername,
  signup,
  login,
  //   unlockUser,

  signupKC,
  loginKC,
  checkOTPKC,
  resetpwKC,
  getSubordinateUser,


};