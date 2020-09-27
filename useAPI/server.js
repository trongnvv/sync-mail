const HOST = 'https://gmail.googleapis.com/gmail/v1/users';
const TOKEN_PATH = 'token.json';
const fs = require('fs');
const api = require('./api');
function boot() {
    fs.readFile(TOKEN_PATH, async (err, token) => {
        try {
            const { access_token } = JSON.parse(token);
            const res = await getMessages(access_token);
        } catch (error) {
            console.log(error.data);
        }
    });
}

async function getProfile(token) {
    const res = await api(HOST, '/me/profile', 'GET', token);
    console.log(res.data);
    return res.data;
}

async function labels(token) {
    const res = await api(HOST, '/me/labels', 'GET', token);
    console.log(res.data);
    return res.data;
}

async function listMessages(token) {
    const params = { 
        maxResults: 5,
        format: 2
    }
    const res = await api(HOST, '/me/messages', 'GET', token, params);
    console.log(res.data);
    return res.data;
}

async function sendMail(token) {
    const subject = '🤘 Hello 🤘';
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
        'From: Justin Beckwith <trongnv@google.com>',
        'To: trongnv 138 <trongnv138@gmail.com>',
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        'This is a message just to say hello.',
        'So... <b>Hello!</b>  🤘❤️😎',
    ];
    const message = messageParts.join('\n');

    // The body needs to be base64url encoded.
    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    console.log('encodedMessage',typeof encodedMessage);
    const params = { raw: encodedMessage }
    const res = await api(HOST, '/me/messages/send', 'POST', token, params);
    console.log(res.data);
    return res.data;
}

async function getMessages(token) {
    const params = {
        // format: 'METADATA'
        // format: 'MINIMAL'
    }
    const res = await api(HOST, '/me/messages/174a0ca3609cd768', 'GET', token, params);
    console.log(res.data);
    fs.writeFile('message.json', JSON.stringify(res.data), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', 'message.json');
    });
    return res.data;
}

boot();
