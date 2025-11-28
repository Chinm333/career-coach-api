const { ChatGroq } = require("@langchain/groq");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const groqModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || "llama3-70b-8192",
  temperature: 0,
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("❌ Missing GEMINI_API_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const embedModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001"
});

async function generateText(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  try {
    const res = await groqModel.invoke(prompt);
    return res?.content || "";
  } catch (err) {
    console.error("Groq generateText error:", err.response?.data || err.message);
    throw new Error("Groq text generation failed");
  }
}

async function createEmbedding(text) {
  try {
    const result = await embedModel.embedContent(text);
    const vector = result.embedding?.values;

    if (!vector) {
      console.error("Gemini embedding response:", result);
      throw new Error("Gemini returned no embedding vector");
    }

    return vector;
  } catch (err) {
    console.error("Gemini embedding error:", err);
    throw new Error("Gemini embedding failed");
  }
}

module.exports = {
  generateText,
  createEmbedding
};