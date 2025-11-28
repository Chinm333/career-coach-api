const bcrypt = require("bcrypt");
const User = require("../models/userSchema");
const Candidate = require("../models/candidateSchema");
const Company = require("../models/companySchema");
const { generateToken, verifyRefreshToken, verifyAccessToken } = require("../services/jwtTokenService");

const salt = 10;

const registerCandidate = async (req, res) => {
    try {
        const { email, password, name, linkedinUrl } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password required!"
            });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: "Email already in use!"
            });
        }
        const passwordHash = await bcrypt.hash(password, salt);
        const user = await User.create({
            email,
            passwordHash,
            role: "candidate"
        });
        await Candidate.create({
            userId: user._id,
            name: name || "",
            linkedinUrl: linkedinUrl || ""
        });
        const { accessToken, refreshToken } = await generateToken({
            userId: user._id.toString(),
            role: user.role
        });
        user.refreshToken = refreshToken;
        await user.save();

        return res.json({
            success: true,
            user: { id: user._id, email: user.email, role: user.role },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

const registerCompany = async (req, res) => {
    try {
        const { email, password, companyName, website, description } = req.body;
        if (!email || !password || !companyName) {
            return res.status(400).json({
                success: false,
                error: "Email, password, companyName required"
            });
        }
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({
                success: false,
                error: "Email already in use"
            });
        }
        const passwordHash = await bcrypt.hash(password, salt);
        const user = await User.create({
            email,
            passwordHash,
            role: "company"
        });
        await Company.create({
            userId: user._id,
            name: companyName,
            website: website || "",
            description: description || ""
        });
        const { accessToken, refreshToken } = await generateToken({
            userId: user._id.toString(),
            role: user.role
        });

        user.refreshToken = refreshToken;
        await user.save();

        return res.json({
            success: true,
            user: { id: user._id, email: user.email, role: user.role },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password required"
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid credentials"
            });
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({
                success: false,
                error: "Invalid credentials"
            });
        }
        const { accessToken, refreshToken } = await generateToken({
            userId: user._id.toString(),
            role: user.role
        });

        user.refreshToken = refreshToken;
        await user.save();

        return res.json({
            success: true,
            user: { id: user._id, email: user.email, role: user.role },
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
}

const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: "refreshToken required"
            });
        }
        let payload;
        try {
            payload = await verifyRefreshToken(refreshToken);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: "Invalid refresh token"
            });
        }
        const user = await User.findById(payload.userId);
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(401).json({
                success: false,
                error: "Invalid refresh token"
            });
        }
        const tokens = await generateToken({
            userId: user._id.toString(),
            role: user.role
        });

        user.refreshToken = tokens.refreshToken;
        await user.save();

        return res.json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
}

const me = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                error: "Missing token!"
            });
        }

        const token = authHeader.split(" ")[1];
        const payload = await verifyAccessToken(token);

        const user = await User.findById(payload.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "User not found!"
            });
        }

        return res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};


module.exports = {
    registerCandidate,
    registerCompany,
    login,
    refresh,
    me
};