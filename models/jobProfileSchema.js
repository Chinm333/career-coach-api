const mongoose = require("mongoose");

const JobProfileSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false // Optional for backward compatibility with existing jobs
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    skillsNeeded:[String],
    seniority:{
        type: String,
        required: true
    },
    created_at: { 
        type: Date, 
        default: Date.now 
    },
    location:{
        type:String
    },
    workSetup: { 
        type: String, 
        enum: ["remote", "hybrid", "onsite"], 
        default: "onsite" 
    },
    embedding: { 
        type: [Number], 
        default: [] 
    },
});

module.exports = new mongoose.model("JobProfile",JobProfileSchema);