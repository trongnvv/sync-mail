const axios = require('axios');
const { STORAGE_URL } = require('../config');
module.exports = async function uploadFiles({ form }) {
    return await axios.post(
        STORAGE_URL + '/multiple-upload/files',
        form,
        {
            headers: {
                'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
                // authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiIzODg4ZmZjZi1mODhlLTQyNmUtYTQ1NS04MmUyMDE4NDE1MjQiLCJleHBpcmVzSW4iOjYwNDgwMCwidXNlcklkIjoiNWY1MDlmZThhNjEzZDgwMDA3Zjc2ZTExIiwiY29tcGFueUlkIjoiNWY1MGExMjJhNjEzZDgwMDA3Zjc2ZTcxIiwiaWF0IjoxNjAxNjEzNDQyfQ.8ZKygR1fIYvdjN1JzFP9i_6YKwnqdLh4YMWKDi6MkPQ'
            },
        }
    );
}

