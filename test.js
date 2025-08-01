// const excelToJson = require('convert-excel-to-json');


// const result = excelToJson({
// 	sourceFile: './rawdata/Title.csv'
// });
// console.log(result);
// const arr = []
// result.distict.forEach(ele => { 
//     arr.push({  tambonid:ele.A,
//         t_tambonname: ele.B,
//         e_tambonname: ele.C,
//         amphurid:ele.D,
//         postcodeall:ele.E})

  
// });
// // arr.shift()
// console.log(arr)

const CSVToJSON = require('csvtojson');

// convert users.csv file to JSON array
CSVToJSON().fromFile('./rawdata/Title.csv')
    .then(users => {
        // users is a JSON array
        // log the JSON array
        let arr =users
        // console.log(users);
    }).catch(err => {
        // log error if any
        console.log(err);
    });
    console.log(users);