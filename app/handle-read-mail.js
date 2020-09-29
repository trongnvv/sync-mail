
const MailParser = require("mailparser").MailParser;
const fs = require('fs');

const openBox = (imap) => {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', true, async (err, box) => {
      if (err) reject(err);
      resolve(box.uidnext - 1);
    });
  })
}

const closeBox = (imap) => {
  return new Promise((_, reject) => {
    imap.closeBox(false, function (err) {
      console.log('closeBox', err);
      if (err) reject(err);
    });
  })
}

const searchByParentId = (imap, events, messageId) => {
  imap.search(
    [
      'ALL',
      ['HEADER', 'IN-REPLY-TO', messageId]
    ], (err, results) => {
      if (err) throw err;
      console.log('results', results); // uid
      if (results.length === 0) {
        return;
      };
      fetchDetail(imap, events, results, true); // with list uid
    });
}

const fetchDetail = (imap, events, results, isSearching) => {
  const f = imap.fetch(results, { bodies: '' }); // fetch with uid
  f.on('message', (msg) => {
    handleFetchDetail(msg, events, isSearching); // seqno
  });
  f.once('error', (err) => {
    console.log('Fetch error: ' + err);
    reject();
  });
  f.once('end', () => {
    console.log('Done fetching all messages!');
  });
}

const handleFetchDetail = (msg, events, isSearching) => {
  const parser = new MailParser();
  const params = {
    attachments: []
  };
  msg.on('body', async (stream) => {

    stream.on('data', function (chunk) {
      parser.write(chunk.toString("utf8"));
    });

    stream.once('end', function () {
      console.log('stream-end');
    });

    parser.on('data', async data => {
      if (data.type === 'text') {
        params.content = data.html;
      } else if (data.type === 'attachment') {
        let dir = './download/' + new Date().getTime() + '_' + data.filename;
        const writeStream = fs.createWriteStream(dir);
        data.content.pipe(writeStream);
        data.content.on('end', async () => {
          // todo file
          params.attachments.push({
            filename: data.filename,
            path: dir
          });

          fs.unlinkSync(dir);
          data.release();
        });
      }
    });

    parser.on('headers', headers => {
      params.messageId = headers.get('message-id');
      params.references = headers.get('references');
      params.date = headers.get('date');
      params.from = headers.get('from').value[0].address;
      params.fromUser = headers.get('from').value[0].name;
      params.parentId = headers.get('in-reply-to');
    });

    parser.once('end', () => {
      events.emit(isSearching ? 'data-search' : 'data', params);
    });

  });

  msg.on('attributes', function (attrs) {
    params.uid = attrs.uid;
  });

  msg.once('end', () => {
    parser.end();
  });
}

module.exports = {
  openBox,
  closeBox,
  searchByParentId,
  fetchDetail,
}