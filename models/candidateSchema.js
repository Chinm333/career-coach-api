const mongoose = require("mongoose");

const CandidateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: {
        type: String,
    },
    linkedinUrl: {
        type: String
    },
    workHistory: {
        type: [
            {
                company: { type: String, required: true },
                title: { type: String, required: true },
                from: { type: Date, required: true },
                to: { type: Date },
                current: { type: Boolean },
                description: { type: String }
            }
        ],
        default: [],
    },
    education: {
        type: [
            {
                school: { type: String, required: true },
                degree: { type: String, required: true },
                from: { type: Date, required: true },
                to: { type: Date },
                current: { type: Boolean }
            }
        ],
        default: [],
    },
    skills: [String],
    conversation: {
        type: [
            {
                question: String,
                answer: String,
                timestamp: Date
            }
        ],
        default: []
    },
    ikigai: {
        passion: { type: Number, default: 0 }, // What candidate loves to do
        mission: { type: Number, default: 0 }, // What they feel is meaningful
        vocation: { type: Number, default: 0 }, // Where they think they fit in the world of work
        mastery: { type: Number, default: 0 } // What they believe they’re good at
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    embedding: {
        profile: { type: [[Number]], default: [] },
        chat: { type: [[Number]], default: [] },
        ikigai: { type: [[Number]], default: [] },
    }
});

module.exports = mongoose.model("Candidate", CandidateSchema);