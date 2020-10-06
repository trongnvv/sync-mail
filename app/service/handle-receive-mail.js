
const fs = require('fs');
const { MailParser } = require("mailparser");

const MainData = require("../model/MainData");
const MessageModel = require("../model/Message");
const FormData = require('form-data');

const { CUSTOMER_BACKEND } = require('../config');

const callApi = require('../utils/api');
const uploadFile = require('../utils/uploadFile');

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
    // console.log('Done fetching all messages!');
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
      // console.log('stream-end');
    });

    parser.on('data', async data => {
      if (data.type === 'text') {
        params.content = data.html;
      } else if (data.type === 'attachment') {
        let dir = './download/' + new Date().getTime() + '_' + data.filename;

        const writeStream = fs.createWriteStream(dir);
        data.content.pipe(writeStream);
        data.content.on('end', async () => {

          params.attachments.push({
            file: data.filename,
            name: data.filename,
            filename: data.filename,
            path: dir
          });

          // fs.unlinkSync(dir);
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

const searchArr = (from, to) => {
  const arr = [];
  for (let index = from; index <= to; index++) {
    arr.push(index);
  }
  return arr;
}

const findUpdatedTo = async (uid) => {
  const mess = await MessageModel.findOne({ uid });
  if (mess) {
    return await findUpdatedTo(uid + 1);
  }
  return uid;
}

const checkAndSetUidUpdated = async (uid = 0) => {
  const numUidUpdated = await getUidUpdated();
  // const updatedTo = await findUpdatedTo(numUidUpdated);
  await MainData.updateOne({}, { numUidUpdated: numUidUpdated > uid ? numUidUpdated : uid }, { upsert: true, new: true });
  return numUidUpdated;
};

const getUidUpdated = async () => {
  const { numUidUpdated } = await MainData.findOne({});
  return numUidUpdated || 0;
};

const saveMessage = async (data) => {
  try {
    const mess = await MessageModel.findOne({ uid: data.uid });
    if (!mess) {
      if (data.parentId && data.references) {
        const rootMessageId = Array.isArray(data.references) && data.references.length > 0 ? data.references[0] : data.references;
        console.log('rootMessageId', rootMessageId);
        const rootMessage = await MessageModel.findOne({ messageId: rootMessageId, type: "send" });
        console.log('rootMessage', rootMessage);
        if (rootMessage) {
          // convert data attachment  
          data = await convertDataAttachments(data, rootMessage);
          console.log('convertDataAttachments', data);
          await MessageModel.create({
            ...data,
            type: "receive",
            updated: "pending",
            rootMessageId,
            currentCompanyId: rootMessage.currentCompanyId,
            organizationId: rootMessage.organizationId,
            userId: rootMessage.userId
          });
          // try-catch for request api
          try {
            console.log('receive-hook', data);
            const res = await callApi({
              baseURL: CUSTOMER_BACKEND,
              body: {
                ...data,
                rootMessageId,
                currentCompanyId: rootMessage.currentCompanyId
              },
              method: 'post',
              url: '/email/hook-receive',
            });
            if (res.data && res.data.success) {
              await MessageModel.updateOne({ messageId: data.messageId }, {
                updated: "success",
              });
            } else {
              await MessageModel.updateOne({ messageId: data.messageId }, {
                updated: "fail",
              });
            }
          } catch (error) {
            console.log('receive', error.response);
            await MessageModel.updateOne({ messageId: data.messageId }, {
              updated: "fail",
            });
          }
          // end try-catch for request api
        } else {
          await MessageModel.create({ ...data, type: "receive", updated: "success" });
        }
      } else {
        await MessageModel.create({ ...data, type: "receive", updated: "success" });
      }
      await checkAndSetUidUpdated(data.uid);
    } else if (mess.updated === "fail") {
      await callHookUpdateFail(mess);
    }
  } catch (error) {
    console.log('error', error);
  }
}

const convertDataAttachments = async (data, rootMessage) => {
  if (
    data &&
    data.attachments &&
    data.attachments.length > 0
  ) {

    try {
      if (
        rootMessage.userId &&
        rootMessage.currentCompanyId &&
        rootMessage.organizationId
      ) {
        const form = new FormData();
        for (let i = 0; i < data.attachments.length; i++) {
          let ele = data.attachments[i];
          form.append('uuId', rootMessage.userId);
          form.append('cpnId', rootMessage.currentCompanyId);
          form.append('orgId', rootMessage.organizationId);
          form.append('files', fs.readFileSync(ele.path), { filename: ele.filename });
        }
        const res = await uploadFile({ form });
        if (res.data && res.data.success) {
          data.attachments.map(ele => {
            const rs = res.data.results.find(f => f.originalFileName === ele.filename);
            if (rs) {
              console.log('delete', ele.path);
              fs.unlinkSync(ele.path);
              ele.id = rs._id;
              ele.path = rs.url;
              ele.url = rs.url;
            }
            ele.success = !!rs;
          })
        }
      } else {
        throw new Error(rootMessage);
      }
    } catch (error) {
      console.log('error', error);
      data.attachments.map(ele => {
        ele.success = false;
      })
    }
  }
  return data;
}

const handleRequestReceiveUpdateFail = async () => {
  try {
    const messages = await MessageModel.find({
      updated: "fail",
      type: "receive",
    }).lean();
    if (messages && messages.length > 0) {
      for (const message of messages) {
        console.log('handleRequestReceiveUpdateFail-message', message);
        await callHookUpdateFail(message);
      }
    }
  } catch (error) {
    console.log('handleRequestReceiveUpdateFail-error', error);
  }
}

const callHookUpdateFail = async (data) => {
  try {
    await MessageModel.updateOne({ messageId: data.messageId }, {
      updated: "pending",
    });
    const res = await callApi({
      baseURL: CUSTOMER_BACKEND,
      body: {
        ...data,
        currentCompanyId: data.currentCompanyId
      },
      method: 'post',
      url: '/email/hook-receive',
    });
    if (res.data && res.data.success) {
      await MessageModel.updateOne({ messageId: data.messageId }, {
        updated: "success",
      });
    } else {
      await MessageModel.updateOne({ messageId: data.messageId }, {
        updated: "fail",
      });
    }
  } catch (error) {
    await MessageModel.updateOne({ messageId: data.messageId }, {
      updated: "fail",
    });
    console.log('receive', error.response.data);
  }
}

module.exports = {
  openBox,
  closeBox,
  searchByParentId,
  fetchDetail,
  checkAndSetUidUpdated,
  searchArr,
  saveMessage,
  getUidUpdated,
  handleRequestReceiveUpdateFail,
}