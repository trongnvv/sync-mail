const axios = require('axios');
const { STORAGE_URL } = require('../config');
module.exports = async function uploadFiles({ form }) {
  return await axios.post(
    // STORAGE_URL + '/multiple-upload/files',
    STORAGE_URL + '/upload-files/basic',
    form,
    {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
      },
      auth: {
        username: 'fwork',
        password: 'Fwork@123'
      }
    }
  );
}

