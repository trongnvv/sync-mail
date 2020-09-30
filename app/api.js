const axios = require('axios');

module.exports = function (config, cb) {
  if (typeof config === 'function') {
    config = {};
    cb = config;
  }
  let token = '';
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: token
  };
  const defaultConfig = {
    baseURL: 'https://dev.fpt.work/api/v1/storage',
    url: '/multiple-upload/files',
    data: {},
    method: 'post',
    headers: headers
  };
  config = Object.assign({}, defaultConfig, config);
  axios(config)
    .then(rs => cb(null, rs.data))
    .catch(err => cb(err, null));
}
