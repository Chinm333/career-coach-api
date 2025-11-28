const mongoose = require("mongoose");

const InteractionSchema = new mongoose.Schema({
  candidate_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Candidate' 
  },
  typeOfInteraction: { 
        type: String, 
        enum: ["chat", "ikigai", "upload"], 
        default: "chat" 
    },
    content: mongoose.Schema.Types.Mixed,
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Interaction",InteractionSchema);
