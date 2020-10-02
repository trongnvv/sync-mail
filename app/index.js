require('dotenv').config();
require('./db');
require('./jobs/jobs-send')();
const { searchAllByRootID } = require('./jobs/jobs-receive');