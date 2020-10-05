import axios from 'axios';
const STORAGE_URL = process.env.STORAGE_URL;
export default function (config, cb) {
  if (typeof config === 'function') {
    config = {};
    cb = config;
  }
  const defaultConfig = {
    baseURL: STORAGE_URL,
    url: '/multiple-upload/files',
    // url: '/developer/upload-files',
    data: {},
    method: 'post',
    headers: {
      'content-type': 'multipart/form-data'
    },
    auth: {
      username: 'fwork',
      password: 'Fwork@123'
    }
  };
  config = Object.assign({}, defaultConfig, config);
  axios(config)
    .then(rs => cb(null, rs.data))
    .catch(err => cb(err, null));
}