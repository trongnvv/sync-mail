var Imap = require('imap');
var MailParser = require("mailparser").MailParser;
// var Promise = require("bluebird");
// Promise.longStackTraces();
var moment = require('moment');

var fs = require('fs');
var imap = new Imap({
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { servername: 'imap.gmail.com' }
});
// Promise.promisifyAll(imap);
const messageId = '<a7f413b2-67c2-61d8-5eee-167aa81e49bb@gmail.com>'
let num = 0;
imap.on('mail', function (numNewMsgs) {
    // console.log('numNewMsgs', num);
    if (num === 0) {
        // num += numNewMsgs;
        // start
    } else {
        num += numNewMsgs;
        // console.log('update-new', num);
        // handleNew();
        openBox();
        // fetchDetail([num]);
    }
});

imap.once('ready', function () {
    openBox();
});

imap.on('update', function (s, info) {
    console.log('update', s, info);
});

imap.on('expunge', function (s) {
    console.log('expunge', s);
});

imap.once('error', function (err) {
    console.log(err);
});

imap.once('close', function () {
    console.log('Connection close');
});

imap.once('end', function () {
    console.log('Connection ended');
});

imap.connect();

const openBox = () => {
    imap.openBox('INBOX', true, function (err, box) {
        if (err) throw err;
        num = box.uidnext - 1;
        console.log('openBox', box.uidnext);
        // fetchDetail([box.uidnext - 1]);
        handleSearch();
    });
}

const closeBox = () => {
    imap.closeBox(false, function (err) {
        if (err) throw err;
        console.log('closeBox', err);
    });
}

const handleSearch = () => {
    return new Promise((resolve, reject) => {
        imap.search(
            [
                'ALL',
                ['HEADER', 'IN-REPLY-TO', messageId]
            ], function (err, results) {
                if (err) throw err;
                console.log('results', results); // uid
                if (results.length === 0) {
                    return;
                };
                const params = await fetchDetail(results);
                resolve(params);
            });
    })
}

const fetchDetail = (results) => {
    return new Promise((resolve, reject) => {
        const f = imap.fetch(results, { bodies: '' }); // fetch with uid
        f.on('message', async (msg, seqno) => {
            const params = await handleFetchDetail(msg, seqno); // seqno
            resolve(params);
        });
        f.once('error', (err) => {
            console.log('Fetch error: ' + err);
            reject();
        });
        f.once('end', () => {
            console.log('Done fetching all messages!');
            // closeBox();
        });
    })
}

const handleFetchDetail = (msg, seqno) => {
    return new Promise((resolve, reject) => {
        console.log('Message #%d', seqno);
        var prefix = '(#' + seqno + ') ';
        const params = {};
        const parser = new MailParser();
        msg.on('body', async (stream, info) => {
            // stream.pipe(fs.createWriteStream('download/msg-' + seqno + '-body.txt'));
            const headers = await handleStreamMessage(stream, parser, seqno);
            const content = await handleMailParser(parser, seqno);
            params.messageId = headers['message-id'][0];
            params.references = headers['references'][0];
            params.date = moment(headers['date'][0]).format('LLLL');
            params.parentId = headers['in-reply-to'][0];
            if (content.type === 'text') {
                params.content = content.html;
            } else if (content.type === 'attachment') {

            }
            resolve(params);
        });
        msg.once('attributes', (attrs) => {
            console.log(prefix + 'Attributes:', attrs);
        });
        msg.once('end', () => {
            console.log(prefix + 'Finished');
            parser.end();
            console.log('params', params);
        });
    });
}

const handleStreamMessage = (stream, parser, seqno) => {
    return new Promise((resolve, reject) => {
        let buffer = '';
        stream.on('data', function (chunk) {
            buffer += chunk.toString('utf8');
            parser.write(chunk.toString("utf8"));
        });
        stream.once('end', function () {
            resolve(Imap.parseHeader(buffer));
        });
    });
}

const handleMailParser = (parser) => {
    return new Promise((resolve, reject) => {
        parser.on('data', data => {
            // console.log('data-type-' + seqno, data.type);
            // if (data.type === 'text') {
            //     // console.log(seqno);
            //     // console.log(data.html);  /* data.html*/
            //     fs.writeFile('download/content-' + seqno + '.json', JSON.stringify(data), err => err && console.log('err', err))
            // }

            // if (data.type === 'attachment') {
            //     // console.log(data.filename);
            //     var writeStream = fs.createWriteStream('./download/' + data.filename);
            //     data.content.pipe(writeStream);
            //     data.content.on('end', () => data.release());
            // }
            resolve(data);
        });
    })

}

module.exports = {

}