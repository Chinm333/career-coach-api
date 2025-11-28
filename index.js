require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const candidateRoutes = require('./routes/candidateRoute');
const jobRoutes = require('./routes/jobProfileRoute');
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

connectDB().catch(err => {
  console.error('DB connection failed', err);
  process.exit(1);
});

app.use('/api/candidate', candidateRoutes);
app.use('/api/job', jobRoutes);
app.use("/api/auth", authRoutes);

app.get('/', (req, res) => res.send('Career Coach backend running'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));