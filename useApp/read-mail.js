
const moment = require('moment');
const Imap = require('imap');
const MailParser = require("mailparser").MailParser;

const delay = (ms = 1000) => {
  return new Promise(r => setTimeout(r, ms));
}

const searchArr = (from, to) => {
  const arr = [];
  for (let index = from + 1; index <= to; index++) {
    arr.push(index);
  }
  return arr;
}

const openBox = (imap, events, uidUpdated) => {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', true, async (err, box) => {
      if (err) reject(err);
      console.log(searchArr(uidUpdated, box.uidnext - 1));
      if (uidUpdated !== 0 && searchArr(uidUpdated, box.uidnext - 1).length > 0)
        fetchDetail(imap, events, searchArr(uidUpdated, box.uidnext - 1));
      resolve(box.uidnext - 1);
      // await searchByParentId(messageId);
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
  const params = {};
  msg.on('body', async (stream) => {
    const headers = await handleStreamMessage(stream, parser);
    const content = await handleMailParser(parser);
    params.messageId = headers['message-id'][0];
    params.references = headers['references'][0];
    params.date = moment(headers['date'][0]).format();
    params.parentId = headers['in-reply-to'][0];
    if (content.type === 'text') {
      params.content = content.html;
    } else if (content.type === 'attachment') {
      // console.log(data.filename);
      // var writeStream = fs.createWriteStream('./download/' + data.filename);
      // data.content.pipe(writeStream);
      // data.content.on('end', () => data.release());
    }
    events.emit(isSearching ? 'data-search' : 'data', params);
  });
  msg.once('end', () => {
    parser.end();
  });
}

const handleStreamMessage = (stream, parser) => {
  return new Promise((resolve) => {
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
  return new Promise((resolve) => {
    parser.on('data', data => {
      resolve(data);
    });
  })

}

module.exports = {
  openBox,
  closeBox,
  searchByParentId,
  fetchDetail,
  delay
}