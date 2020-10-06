
const Imap = require('imap');
const events = require('events');
const eventEmitter = new events.EventEmitter();
const Queue = require('bull');
const { delay } = require('../utils');

const queueReadMail = new Queue('read-mail', {
  redis: {
    port: 6379,
    host: '127.0.0.1',
    // password: 'foobared'
  }
});

const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { servername: 'imap.gmail.com' }
});

const {
  searchByParentId,
  closeBox,
  openBox,
  fetchDetail,
  checkAndSetUidUpdated,
  getUidUpdated,
  searchArr,
  saveMessage,
  handleRequestReceiveUpdateFail
} = require('../service/handle-receive-mail');

let isReady = false;
let numExist = 0;

imap.once('ready', async () => {
  numExist = await openBox(imap);
  handleRequestReceiveUpdateFail();
  isReady = true;
});

imap.on('mail', async (numNewMsgs) => {
  if (numExist !== 0) {
    // receive
    const arr = searchArr(numExist + 1, numExist + numNewMsgs);
    numExist += numNewMsgs;
    if (arr.length > 0) {
      console.log('fetchDetail-numExist', arr);
      fetchDetail(imap, eventEmitter, arr);
    }
  } else {
    // init - check unset
    await checkReady(); // numExist > 0
    const uidUpdated = await getUidUpdated();
    if(uidUpdated + 1 <= numExist){
      const arr = searchArr(uidUpdated + 1, numExist);
      if (arr.length > 0) {
        console.log('fetchDetail', arr);
        fetchDetail(imap, eventEmitter, arr);
      }
    }
  }
});

imap.on('expunge', async (seqno) => {
  console.log('expunge', seqno);
});

imap.once('error', function (err) {
  console.log(err);
});

imap.once('close', function () {
  console.log('Connection close');
});

imap.once('end', function () {
  closeBox(imap);
  console.log('Connection ended');
});

imap.connect();

const checkReady = async () => {
  if (isReady) return true;
  await delay(500);
  return checkReady();
};

const searchAllByRootID = async (messageId) => {
  await checkReady();
  searchByParentId(imap, eventEmitter, messageId);
};

const addToQueue = async (data) => {
  await queueReadMail.add(data);
}

(async () => {
  await checkReady();

  queueReadMail.process(async (job, done) => {
    await saveMessage(job.data);
    done();
  });

  queueReadMail.on('completed', job => {
    console.log('Job completed', job.data.uid, job.data.from);
  });

  eventEmitter.on('data-search', async (data) => {
    // console.log('data-search', data);
    await addToQueue(data);
    searchByParentId(imap, eventEmitter, data.messageId);
  });

  eventEmitter.on('data', async (data) => {
    // console.log('data', data);
    await addToQueue(data);
  });

})();

module.exports = {
  searchAllByRootID
}