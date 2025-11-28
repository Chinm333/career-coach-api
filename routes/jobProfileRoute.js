const express = require("express");
const router = express.Router();
const { createJob, matchingJob, getCompanyJobs, getAllJobs, assignJobsToCompany } = require("../controllers/jobProfileController");
const auth = require("../middleware/auth");

router.post('/create', auth("company"), createJob);
router.post('/company/assign-legacy', auth("company"), assignJobsToCompany); // Assign existing jobs without companyId
router.get('/company/jobs', auth("company"), getCompanyJobs);
router.get('/all', getAllJobs); // Public endpoint for candidates to browse
router.get('/:jobId/match', auth("company"), matchingJob);
module.exports = router;