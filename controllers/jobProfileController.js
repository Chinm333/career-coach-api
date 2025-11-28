const Job = require("../models/jobProfileSchema");
const Candidate = require("../models/candidateSchema");
const ai = require("../services/llmService");
const { findMatchingCandidate } = require("../services/jobMatchingService");

const fallBackWords = new Set([
    'and', 'or', 'the', 'a', 'an', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'as', 'by', 'is', 'are', 'be',
    'you', 'your', 'we', 'our', 'this', 'that', 'they', 'their', 'will', 'responsible', 'role', 'job',
    'requirements', 'skills', 'experience', 'years', 'year'
]);

const extractSkillsFallback = (description = "") => {
    if (!description) return [];
    const text = description.replace(/\n/g, ' ');
    const candidates = text.split(/[,;/]|and|or|\./i).map(item => item.trim()).filter(item => item.length > 1 && item.length < 40);
    const skills = new Set();
    for (const chunk of candidates) {
        const lower = chunk.toLowerCase();
        if (fallBackWords.has(lower)) continue; //ignore gneric phrase
        if (lower.split(' ').length > 5) continue; //ingore long sentence
        if (/[a-z]/i.test(chunk)) {
            skills.add(chunk);
        }
    }
    return Array.from(skills);
}

const normalizeSeniority = (raw) => {
    const level = (raw || '').toString().toLowerCase();
    if (!level) return 'mid';
    if (level.includes('junior') || level.includes('jr')) return 'junior';
    if (level.includes('senior') || level.includes('sr') || level.includes('lead') || level.includes('staff')) return 'senior';
    return 'mid';
}

const createJob = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title) return res.status(400).json({
            success: false,
            error: "Title not found!"
        });
        const prompt = `
        You are a strict JSON generator.

        From the following job description, extract:
        {
            "skillsNeeded": [string], 
            "seniority": "junior|mid|senior",
            "description": "1-3 sentence description of the role",
            "location": "If there is any location mentioned",
            "workSetup": "If there is no location mentioned then put as remote if it mentioned location then it can be hybrid or onsite so it would be mentioned. remote|onsite|hybrid" 
        }
        Return ONLY valid JSON. No commentary. No markdown.

        Job description:${description}
        `;
        let parsedText = {
            skillsNeeded: [],
            seniority: 'mid',
            description: '',
            location: '',
            workSetup: 'onsite'
        };
        try {
            const data = await ai.generateText(prompt);
            const json = JSON.parse(data);
            parsedText.skillsNeeded = Array.isArray(json.skillsNeeded) ? json.skillsNeeded : [];
            parsedText.seniority = normalizeSeniority(json.seniority);
            parsedText.description = json.description || '';
            parsedText.location = json.location || '';
            parsedText.workSetup = json.workSetup || 'onsite';
        } catch (error) {
            console.error("AI JSON parse failed!");
            parsedText.skillsNeeded = [];
            parsedText.seniority = 'mid';
            parsedText.description = description.slice(0, 300);
            parsedText.location = '';
            parsedText.workSetup = 'onsite';
        }

        if (!parsedText.skillsNeeded || parsedText.skillsNeeded.length === 0) {
            parsedText.skillsNeeded = extractSkillsFallback(description);
        }

        const job = new Job({
            companyId: req.user.id,
            title,
            description,
            skillsNeeded: parsedText.skillsNeeded,
            seniority: parsedText.seniority,
            location: parsedText.location,
            workSetup: parsedText.workSetup
        });

        const embedText = [
            `Title: ${title}`,
            `Summary: ${parsedText.description || description.slice(0, 300)}`,
            `Skills: ${(parsedText.skillsNeeded || []).join(', ')}`,
            `Location: ${parsedText.location || ''}`,
            `WorkSetup: ${parsedText.workSetup || 'onsite'}`
        ].join('\n');

        const emb = await ai.createEmbedding(embedText);
        job.embedding = emb;
        await job.save();
        return res.json({
            success: true,
            job,
            parsedText
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

const matchingJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        if (!jobId) return res.status(400).json({
            success: false,
            error: "Job not found!"
        });
        const result = await findMatchingCandidate(jobId, page, limit);
        const data = result.res.map(item => ({
            candidate_id: item.candidate._id,
            name: item.candidate.name,
            skills: item.candidate.skills || [],
            ikigai: item.candidate.ikigai || null,
            score: item.score,
            workHistory: item.candidate.workHistory?.slice(0, 2) || [], // Last 2 jobs
            education: item.candidate.education?.slice(0, 1) || [] // Latest education
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
        console.error(error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

const getCompanyJobs = async (req, res) => {
    try {
        const companyId = req.user.id;
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        
        // Find jobs that belong to this company
        const jobs = await Job.find({ companyId: companyId })
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        
        const total = await Job.countDocuments({ companyId: companyId });
        const totalPages = Math.ceil(total / limit);

        return res.json({
            success: true,
            page,
            totalPages,
            limit,
            total,
            data: jobs
        });
    } catch (error) {
        console.error("Get company jobs error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

const getAllJobs = async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        
        const jobs = await Job.find()
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        
        const total = await Job.countDocuments();
        const totalPages = Math.ceil(total / limit);

        return res.json({
            success: true,
            page,
            totalPages,
            limit,
            total,
            data: jobs
        });
    } catch (error) {
        console.error("Get all jobs error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

const assignJobsToCompany = async (req, res) => {
    try {
        const companyId = req.user.id;
        // Assign all jobs without companyId to this company
        const result = await Job.updateMany(
            { 
                $or: [
                    { companyId: { $exists: false } },
                    { companyId: null }
                ]
            },
            { $set: { companyId: companyId } }
        );
        
        return res.json({
            success: true,
            message: `Assigned ${result.modifiedCount} jobs to your company`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("Assign jobs error:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = { createJob, matchingJob, getCompanyJobs, getAllJobs, assignJobsToCompany };