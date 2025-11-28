const Candidate = require("../models/candidateSchema");
const Interaction = require("../models/InteractionSchema");
const ai = require("../services/llmService");
const { findMatchingJobs } = require("../services/jobMatchingService");
const fs = require('fs');
const path = require('path');

const safeEmbed = async (text) => {
    try {
        return await ai.createEmbedding(text);
    } catch (error) {
        console.error("Embedding failed!", error);
        return null;
    }
}

const importLinkedin = async (req, res) => {
    try {
        const { userId, text } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }

        const candidate = await Candidate.findOne({ userId });
        if (!candidate) return res.status(404).json({ success: false, error: "Candidate not found" });

        if (!text || text.trim().length < 30) {
            return res.status(400).json({
                success: false,
                error: "Paste your LinkedIn profile text or resume text."
            });
        }

        const prompt = `
        Extract a clean JSON candidate profile. 
        Strict JSON only.

        Fields:
        {
            "name": string,
            "workHistory": array of { company:string, title:string, from:date, to:date, current:boolean,description:string },
            "education": array of { school:string,degree:string, from:date, to:date, current:boolean },
            "skills": array of skills
        }

        Text:
        ${text}
        `;

        const out = await ai.generateText(prompt);

        let parsedText;
        try {
            parsedText = JSON.parse(out);
        } catch (e) {
            return res.status(500).json({
                success: false,
                error: "LLM failed to return JSON. Paste cleaner text."
            });
        }

        candidate.name = parsedText.name || candidate.name;
        candidate.skills = parsedText.skills || [];
        candidate.workHistory = parsedText.workHistory || [];
        candidate.education = parsedText.education || [];

        const profText = `
        Name: ${candidate.name}
        LinkedIn: ${candidate.linkedinUrl}
        Skills: ${candidate.skills.join(", ")}
        WorkHistory: ${JSON.stringify(candidate.workHistory)}
        Education: ${JSON.stringify(candidate.education)}
    `;

        if (!candidate.embedding) candidate.embedding = { profile: [], chat: [], ikigai: [] };
        candidate.embedding.profile = await safeEmbed(profText);

        await candidate.save();

        await Interaction.create({
            candidate_id: candidate._id,
            typeOfInteraction: "upload",
            content: parsedText
        });

        return res.json({ success: true, candidate });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
}

const chatAnswer = async (req, res) => {
    try {
        const { userId, question } = req.body;
        if (!userId || !question) {
            return res.status(400).send("Missing required fields!");
        }
        const candidate = await Candidate.findOne({ userId });
        if (!candidate) return res.status(400).send("Candidate not found!");

        // Gather candidate context for prompt
        const recentJobs = (candidate.workHistory || [])
            .slice(-2)
            .map(j => `${j.title} at ${j.company}`)
            .join(', ') || '[no jobs listed]';
        const candidateInfo = `
You are a career coach AI helping a real candidate. Here is their info:
- **Name**: ${candidate.name}
- **Skills**: ${candidate.skills?.join(', ') || '[none]'}
- **Ikigai**: Passion:${candidate.ikigai?.passion || '-'}, Mission:${candidate.ikigai?.mission || '-'}, Vocation:${candidate.ikigai?.vocation || '-'}, Mastery:${candidate.ikigai?.mastery || '-'}
- **Recent Work**: ${recentJobs}

Guidelines for your response:
- Be positive, clear, and actionable.
- Never be generic: ground your advice in their profile and previous answers.
- Use markdown formatting (headings, bold, lists, bullet points) for maximum readability.
- Keep responses under 200 words by default; use lists when possible.
- Always suggest next steps or follow-up questions if the user is vague or open-ended.
`;
        const prompt = `${candidateInfo}\nUser asked: "${question}"\nCoach, reply as markdown for an in-app chat."`;
        // Generate answer from AI, using the injected rich prompt
        const answer = await ai.generateText(prompt);

        // Save Q/A
        candidate.conversation.push({
            question,
            answer,
            timestamp: new Date()
        });
        const chatEmbedding = await safeEmbed(`${question}\n${answer}`);
        if (chatEmbedding) {
            let vector = chatEmbedding;
            if (typeof vector === 'string') {
                try {
                    vector = JSON.parse(vector);
                } catch (e) {
                    vector = [];
                }
            }
            if (Array.isArray(vector) && vector.every(x => typeof x === 'number')) {
                candidate.embedding.chat.push(vector);
            } else {
                console.error('Embedding is not a valid number array:', vector);
            }
        }
        candidate.updated_at = new Date();
        await candidate.save();
        await Interaction.create({
            candidate_id: candidate._id,
            typeOfInteraction: "chat",
            content: { question, answer }
        });
        return res.json({
            success: true,
            question,
            answer,
            candidate
        });
    } catch (error) {
        console.error("Chat answer failing!", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

const getIkigaiQuestions = (req, res) => {
    const file = path.join(__dirname, '../config/ikigaiQuestions.json');
    try {
        const questions = JSON.parse(fs.readFileSync(file));
        return res.json({ success: true, questions });
    } catch (e) {
        return res.status(500).json({ success: false, error: "Can't load Ikigai questions" });
    }
};

const submitIkigai = async (req, res) => {
    try {
        const { userId, answers } = req.body;
        if (!userId || !answers) {
            return res.status(400).send("Missing required fields!");
        }
        const candidate = await Candidate.findOne({ userId });
        if (!candidate) return res.status(404).send("Candidate not found");
        // Save full assessment (question, key, value array)
        candidate.ikigaiAssessment = answers;
        // Aggregate main categories if present
        let scores = { passion: 0, mission: 0, vocation: 0, mastery: 0 };
        let n = { passion: 0, mission: 0, vocation: 0, mastery: 0 };
        answers.forEach((a) => {
            if (scores.hasOwnProperty(a.key)) {
                scores[a.key] += Number(a.value) || 0;
                n[a.key] += 1;
            }
        });
        Object.keys(scores).forEach(k => {
            if (n[k]) scores[k] = Math.round(scores[k] / n[k]);
        });
        candidate.ikigai = scores;
        const ikigaiText = "Ikigai: " + Object.entries(scores).map(([k,v])=>`${k[0].toUpperCase()+k.slice(1)} ${v}`).join(", ");
        candidate.embedding.ikigai = await safeEmbed(ikigaiText);
        candidate.updated_at = new Date();
        await candidate.save();
        await Interaction.create({ candidate_id: candidate._id, typeOfInteraction: "ikigai", content: { answers, scores } });
        return res.json({
            success: true,
            scores,
            candidate
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

const getJobRecommendations = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({ success: false, error: "User not authenticated" });
        }
        const candidate = await Candidate.findOne({ userId });
        if (!candidate) return res.status(404).json({ success: false, error: "Candidate not found" });

        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);

        const result = await findMatchingJobs(candidate._id, page, limit);
        const data = result.res.map(item => ({
            job_id: item.job._id,
            title: item.job.title,
            description: item.job.description,
            skillsNeeded: item.job.skillsNeeded || [],
            seniority: item.job.seniority,
            location: item.job.location || '',
            workSetup: item.job.workSetup || 'onsite',
            score: item.score,
            created_at: item.job.created_at
        }));

        return res.json({
            success: true,
            page: result.page,
            totalPages: result.totalPage,
            limit: result.limit,
            total: result.total,
            data
        });
    } catch (error) {
        console.error("Job recommendations error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = { importLinkedin, chatAnswer, submitIkigai, getIkigaiQuestions, getJobRecommendations };