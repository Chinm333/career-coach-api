const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/register/candidate", authController.registerCandidate);
router.post("/register/company", authController.registerCompany);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);

router.get("/me", auth(), authController.me);

module.exports = router;