const mongoose = require('mongoose');

const connectDB = async() =>{
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database has been connected successfully!");
} 

module.exports = connectDB;