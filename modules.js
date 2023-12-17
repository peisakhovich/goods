const {sayHi:Hi,userName:user } = require( "./test");
const os= require('os');

console.log(Hi( user,'Peisakhovich'));


console.log(os.platform(),os.release());