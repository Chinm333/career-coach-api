const { verifyAccessToken } = require("../services/jwtTokenService");
const User = require("../models/userSchema");

const auth = (requiredRole = null) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers["authorization"];
            if(!authHeader || !authHeader.startsWith("Bearer ")){
                return res.status(401).json({
                    success:false,
                    error:"Missing token!"
                });
            }
            const token = authHeader.split(" ")[1];
            const payload = await verifyAccessToken(token);
            const user = await User.findById(payload.userId);
            if(!user){
                return res.status(401).json({
                    success:false,
                    error:"User not found!"
                });
            }
            if(requiredRole && user.role !== requiredRole){
                return res.status(403).json({
                    success:false,
                    error:"Forbidden"
                });
            }
            req.user = {id:user._id.toString(),role:user.role,email:user.email};
            next();
        } catch (error) {
            console.error("Auth error:",error.message);
            return res.status(401).json({
                success:false,
                error:error.message
            });
        }
    };
}

module.exports = auth;