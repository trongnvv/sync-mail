require('dotenv').config();
require('./db');
require('./service/jobs-send')();
const { searchAllByRootID } = require('./service/jobs-receive');