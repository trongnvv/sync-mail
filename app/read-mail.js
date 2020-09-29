require('dotenv').config();
require('./db');
const Imap = require('imap');
const events = require('events');
const eventEmitter = new events.EventEmitter();
const MainData = require("./model/MainData");
const MessageModel = require("./model/Message");

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
} = require('./handle-read-mail');

let isReady = false;
let numExist = 0;

imap.once('ready', async () => {
  numExist = await openBox(imap);
  isReady = true;
});

imap.on('mail', async (numNewMsgs) => {
  if (numExist !== 0) {
    const arr = searchArr(numExist + 1, numExist + numNewMsgs);
    numExist += numNewMsgs;
    if (arr.length > 0) {
      console.log('fetchDetail-numExist', arr);
      fetchDetail(imap, eventEmitter, arr);
    }
  } else {
    await checkReady();
    const uidUpdated = await checkAndSetUidUpdated();
    console.log('uidUpdated', uidUpdated);
    const arr = searchArr(uidUpdated, numExist);
    if (arr.length > 0) {
      console.log('fetchDetail', arr);
      fetchDetail(imap, eventEmitter, arr);
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

const delay = (ms = 1000) => {
  return new Promise(r => setTimeout(r, ms));
}

const searchArr = (from, to) => {
  const arr = [];
  for (let index = from; index <= to; index++) {
    arr.push(index);
  }
  return arr;
}

const checkReady = async () => {
  if (isReady) return true;
  await delay(500);
  return checkReady();
}

const findUpdatedTo = async (uid) => {
  const mess = await MessageModel.findOne({ uid });
  if (mess) {
    return await findUpdatedTo(uid + 1);
  }
  return uid;
}

const checkAndSetUidUpdated = async () => {
  const numUidUpdated = await getUidUpdated();
  const updatedTo = await findUpdatedTo(numUidUpdated);
  await MainData.updateOne({}, { numUidUpdated: updatedTo }, { upsert: true, new: true });
  return updatedTo;
};

const getUidUpdated = async () => {
  const { numUidUpdated } = await MainData.findOne({});
  return numUidUpdated || 0;
};

const saveMessage = async (data) => {
  try {
    const mess = await MessageModel.findOne({ uid: data.uid });
    if (!mess) {
      if (data.parentId) {
        // todo send sync
      }
      await MessageModel.create({ ...data });
      await checkAndSetUidUpdated();
    }
  } catch (error) {
    console.log('error', error);
  }
}

const run = async () => {
  await checkReady();
  // const messageId = '<c913eef6-0d4f-6fee-1ea4-83b1a7fbccfa@gmail.com>'
  // await searchByParentId(imap, eventEmitter, messageId);

  eventEmitter.on('data-search', async (data) => {
    // console.log('data-search', data);
    await saveMessage(data);
    searchByParentId(imap, eventEmitter, data.messageId);
  });

  eventEmitter.on('data', async (data) => {
    // console.log('data', data);
    await saveMessage(data);
  });

};

run();