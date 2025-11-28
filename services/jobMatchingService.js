const Candidate = require("../models/candidateSchema");
const Job = require("../models/jobProfileSchema");
const { cosine } = require("../utils/math");

const skillOverlapScope = (candidateSkills, jobSkills) => {
    if (!jobSkills.length) return 0;
    const lowercaseOfSkills = arr => new Set(arr.map(item => (item || "").toLowerCase()));
    const candidateSkillsLower = lowercaseOfSkills(candidateSkills);
    const jobSkillsLower = lowercaseOfSkills(jobSkills);
    let matchingSkillCount = 0;
    jobSkillsLower.forEach(item => { if (candidateSkillsLower.has(item)) matchingSkillCount++; });
    return matchingSkillCount / jobSkills.length;
}

function combineEmbeddings(vectors) {
    if (!vectors || vectors.length === 0) return [];

    const dim = vectors[0].length;
    const sum = new Array(dim).fill(0);

    vectors.forEach(vec => {
        if (Array.isArray(vec) && vec.length === dim) {
            for (let i = 0; i < dim; i++) {
                sum[i] += vec[i];
            }
        }
    });

    return sum.map(v => v / vectors.length);
}


const scoreCandidateForJob = (candidate, job) => {
    candidate.embedding = combineEmbeddings([
        ...candidate.embedding.profile,
        ...candidate.embedding.chat,
        ...candidate.embedding.ikigai
    ]);
    const sim = cosine(candidate?.embedding || [], job?.embedding || []);
    const overlap = skillOverlapScope(candidate?.skills || [], job?.skillsNeeded || []);
    const ikigaiMission = (candidate.ikigai?.mission || 0) / 10;

    const score = (sim * 0.6) + (overlap * 0.3) + (ikigaiMission * 0.1);
    return Math.round(score * 100);
};

const findMatchingCandidate = async (jobId, page = 1, limit = 20) => {
    const job = await Job.findById(jobId);
    if (!job) throw new Error("No job found");

    const candidates = await Candidate.find().lean();
    const scored = candidates.map(item => ({
        candidate: item,
        score: scoreCandidateForJob(item, job)
    }));
    scored.sort((a, b) => b.score - a.score);
    const total = scored.length;
    const totalPage = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
        page,
        limit,
        totalPage,
        total,
        res: scored.slice(start, end)
    };
}

const scoreJobForCandidate = (job, candidate) => {
    // Combine candidate embeddings
    const candidateEmbedding = combineEmbeddings([
        ...(candidate.embedding?.profile || []),
        ...(candidate.embedding?.chat || []),
        ...(candidate.embedding?.ikigai || [])
    ]);
    
    // Use job embedding
    const jobEmbedding = job.embedding || [];
    
    const sim = cosine(candidateEmbedding, jobEmbedding);
    const overlap = skillOverlapScope(candidate?.skills || [], job?.skillsNeeded || []);
    const ikigaiMission = (candidate.ikigai?.mission || 0) / 10;

    const score = (sim * 0.6) + (overlap * 0.3) + (ikigaiMission * 0.1);
    return Math.round(score * 100);
};

const findMatchingJobs = async (candidateId, page = 1, limit = 20) => {
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) throw new Error("Candidate not found");

    const jobs = await Job.find().lean();
    const scored = jobs.map(item => ({
        job: item,
        score: scoreJobForCandidate(item, candidate)
    }));
    scored.sort((a, b) => b.score - a.score);
    const total = scored.length;
    const totalPage = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
        page,
        limit,
        totalPage,
        total,
        res: scored.slice(start, end)
    };
};

module.exports = { scoreCandidateForJob, findMatchingCandidate, findMatchingJobs, skillOverlapScope };