var Imap = require('imap'),
    inspect = require('util').inspect;
var MailParser = require("mailparser").MailParser;
var Promise = require("bluebird");
Promise.longStackTraces();

var fs = require('fs');
var imap = new Imap({
    user: '...',
    password: '...',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { servername: 'imap.gmail.com' }
});
Promise.promisifyAll(imap);
var num = 0;
const messageId = '<b42ef075-2599-ffcf-932a-7f1d27e047dc@gmail.com>'

imap.once('ready', function () {
    imap.openBox('INBOX', true, function (err, box) {
        if (err) throw err;

        // console.log('box', box);
        // handleSearch();
    });
});


imap.on('mail', function (numNewMsgs) {
    // num += numNewMsgs;
    // fetchDetail([num]);
    handleNew();
});

imap.on('update', function (s, info) {
    console.log('update', s, info);
});

imap.on('expunge', function (s) {
    console.log('s', s);
});

imap.once('error', function (err) {
    console.log(err);
});

imap.once('end', function () {
    console.log('Connection ended');
});

imap.connect();

function handleNew() {
    imap.search(
        [
            'RECENT',
        ], function (err, results) {
            if (err) throw err;
            console.log('RECENT-results', results);
            if (results.length === 0) {
                return;
            };
            fetchDetail(results);
        });
}

function handleSearch() {
    imap.search(
        [
            'ALL',
            ['HEADER', 'IN-REPLY-TO', messageId],
        ], function (err, results) {
            if (err) throw err;
            console.log('results', results);
            if (results.length === 0) {
                return;
            };
            fetchDetail(results);
        });
}

function fetchDetail(results) {
    var f = imap.fetch(results, { bodies: '' });
    f.on('message', function (msg, seqno) {
        handleFetchDetail(msg, seqno);
    });
    f.once('error', function (err) {
        console.log('Fetch error: ' + err);
    });
    f.once('end', function () {
        console.log('Done fetching all messages!');
        imap.end();
    });
}

function handleFetchDetail(msg, seqno) {
    console.log('Message #%d', seqno);
    var prefix = '(#' + seqno + ') ';
    var buffer = '', count = 0;
    var parser = new MailParser();
    parser.on('data', data => {
        if (data.type === 'text') {
            // console.log(seqno);
            // console.log(data.text);  /* data.html*/
            fs.writeFile('download/content-' + seqno + '.json', JSON.stringify(data), err => console.log('err', err))
        }

        // if (data.type === 'attachment') {
        //     console.log(data.filename);
        //     data.content.pipe(process.stdout);
        //     // data.content.on('end', () => data.release());
        // }
    });

    parser.on('headers', headers => {
        fs.writeFile('download/headers-' + seqno + '.json', JSON.stringify([...headers]), err => console.log('err', err))
    });
    msg.on('body', function (stream, info) {
        console.log(info);
        // stream.pipe(fs.createWriteStream('download/msg-' + seqno + '-body.txt'));
        stream.on('data', function (chunk) {
            count += chunk.length;
            buffer += chunk.toString('utf8');
            parser.write(chunk.toString("utf8"));
            // console.log(prefix + 'Body [%s] (%d/%d)', inspect(info.which), count, info.size);
        });
        stream.once('end', function () {
            fs.writeFile('download/' + seqno + '.json', JSON.stringify(Imap.parseHeader(buffer)), err => console.log('err', err))
            // console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
            console.log(prefix + 'Body [%s] Finished', inspect(info.which));
        });
    });
    msg.once('attributes', function (attrs) {
        // console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
    });
    msg.once('end', function () {
        console.log(prefix + 'Finished');
        parser.end();
    });
}