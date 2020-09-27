require('dotenv').config();
const Imap = require('imap');
const events = require('events');
const eventEmitter = new events.EventEmitter();

// var Promise = require("bluebird");
// Promise.longStackTraces();
const imap = new Imap({
  user: process.env.IMAP_USER,
  password: process.env.IMAP_PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { servername: 'imap.gmail.com' }
});
// Promise.promisifyAll(imap);
const {
  searchByParentId,
  closeBox,
  openBox,
  fetchDetail,
  delay
} = require('./read-mail');


const messageId = '<c913eef6-0d4f-6fee-1ea4-83b1a7fbccfa@gmail.com>'
let uidExist = 0;
let isReady = false;
let uidUpdated = 0;

imap.once('ready', async () => {
  isReady = true;
  uidExist = await openBox(imap, eventSearch, uidUpdated);
  uidUpdated = uidExist;
});

imap.on('mail', async (numNewMsgs) => {
  if (uidExist !== 0) {
    uidExist = await openBox(imap, eventSearch, uidUpdated);
  }
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
}

const run = async () => {
  try {
    await checkReady();
    await searchByParentId(imap, eventEmitter, messageId);

    eventEmitter.on('data-search', async (data) => {
      console.log('datas-search', data);
      await searchByParentId(imap, eventEmitter, data.messageId);
    });

    eventEmitter.on('data', async (data) => {
      console.log('data', data);
    });
    
  } catch (error) {
    console.log('error', error);
  }
};

run();