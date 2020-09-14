const axios = require('axios');
module.exports = function (baseURL, url, method = 'POST', token, params = {}, data = null) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  let options = {
    url,
    method,
    baseURL,
    headers,
    params,
    data,
    timeout: 18000
  };

  return new Promise((resolve, reject) => {
    axios(options)
      .then(async response => {
        resolve(response);
      })
      .catch(function (error) {
        if (error.response) {
          reject(error.response);
        }
      });
  });
}
