const axios = require('axios');
module.exports = async function ({
  baseURL,
  url,
  params,
  body,
  method
}) {
  const token = '';
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
  const config = {
    baseURL,
    url,
    method,
    data: body,
    params,
    headers: headers
  };
  return await axios(config);
}
