const express = require('express');
const router = express.Router();
const { importLinkedin, chatAnswer, submitIkigai, getIkigaiQuestions, getJobRecommendations } = require("../controllers/candidateController");
const auth = require("../middleware/auth");

router.post('/import', auth("candidate"), importLinkedin);
router.post('/chat', auth("candidate"), chatAnswer);
router.post('/ikigai', auth("candidate"), submitIkigai);
router.get('/ikigai/questions', getIkigaiQuestions);
router.get('/jobs/recommendations', auth("candidate"), getJobRecommendations);

module.exports = router;