const axios = require('axios');

module.exports = function (config, cb) {
  if (typeof config === 'function') {
    config = {};
    cb = config;
  }
  let token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJiOWY3NmYwOS01M2I0LTRiYmUtOWE2Ni0xYTY0YzM1MWQ4ZGEiLCJleHBpcmVzSW4iOjYwNDgwMCwidXNlcklkIjoiNWY1MDlmZThhNjEzZDgwMDA3Zjc2ZTExIiwiY29tcGFueUlkIjoiNWY1MGExMjJhNjEzZDgwMDA3Zjc2ZTcxIiwiaWF0IjoxNjAxMjc3MTMzfQ.F3QvcKjdQqGlARpgjPKha9J0LlziSa0-yZ04WqBFfAk';
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
