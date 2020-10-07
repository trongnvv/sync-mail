const fs = require("fs");
const { join } = require("path");
const hogan = require("hogan.js");
const striptags = require("striptags");
const { isEmpty } = require("lodash");
const { createTransport } = require("nodemailer");
const callApi = require('../utils/api');
const MessageModel = require("../model/Message");
const { CUSTOMER_BACKEND } = require('../config');
const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASSWORD,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.log(error);
  } else {
    console.log("Server is ready to take our messages");
  }
});

const sendEmail = (
  { template, subject, email, data, sender, from, cc, attachment, inReplyTo, references },
  extra
) => {
  let __path = join(__dirname, "templates");
  let footerName = "_footer.html",
    headerName = "_header.html";

  if (extra.templatePath) {
    __path = extra.templatePath;
  }
  if (extra.headerName) {
    headerName = extra.headerName;
  }
  if (extra.footerName) {
    footerName = extra.footerName;
  }

  console.log("Send email is running...");
  let message;
  try {
    const templateFile = fs.readFileSync(`${__path}/${template}`).toString();
    message = renderPartFromFile(
      templateFile,
      data,
      __path,
      headerName,
      footerName
    );
  } catch (e) {
    message = template;
  }

  const dataPost = {
    from: sender
      ? `${sender} <${from}>`
      : "TRONGNV <trongnv.work@gmail.com>",
    to: email,
    subject,
    // bcc: config.mailer.user,
    text: striptags(message),
    html: message,
  };

  if (cc) {
    dataPost.cc = cc;
  }

  if (attachment) {
    dataPost.attachments = attachment;
  }

  if (inReplyTo) {
    dataPost.inReplyTo = inReplyTo;
  }

  if (references) {
    dataPost.references = references;
  }

  return new Promise((resolve, reject) => {
    if (!email) {
      reject(new Error("User email is undefined"));
    }

    if (!subject) {
      reject(new Error("Email must have subject"));
    }

    if (isEmpty(message)) {
      reject(new Error("Email message is empty"));
    }
    return transporter.sendMail(dataPost, async (err, response) => {
      try {
        if (err) {
          return await Promise.reject(err);
        }
        console.log(`FWK ---->: ${subject} to ${email} successfully!`);
        return resolve(response);
      } catch (err) {
        console.error(err);
      }
    });
  });
};

const renderPartFromFile = (
  template,
  items,
  __path,
  headerName,
  footerName
) => {
  const partialParts = {
    footer: fs.readFileSync(`${__path}/${footerName}`).toString(),
    header: fs.readFileSync(`${__path}/${headerName}`).toString(),
  };
  const bodyTmp = hogan.compile(template);
  const out = bodyTmp.render(items, partialParts);
  return out;
};

const handleDataSuccess = async (data) => {
  try {
    console.log('send-handleDataSuccess', data);
    await MessageModel.create({
      date: new Date(),
      emailId: data.emailId,
      attachments: data.attachment,
      rootMessageId: !data.parentId ? data.messageId : undefined,
      parentId: data.parentId || undefined,
      messageId: data.messageId,
      content: data.template,
      fromUser: data.sender,
      updated: "pending",
      type: "send",
      currentCompanyId: data.currentCompanyId,
      organizationId: data.organizationId,
      userId: data.userId,
    });
    // try-catch request api update pending to fail
    try {
      const res = await callApi({
        baseURL: CUSTOMER_BACKEND,
        body: {
          emailId: data.emailId,
          sendStatus: "success",
          messageId: data.messageId,
          currentCompanyId: data.currentCompanyId
        },
        method: 'post',
        url: '/email/hook-update',
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
      console.log('send', error.response);
      await MessageModel.updateOne({ messageId: data.messageId }, {
        updated: "fail",
      });
    }
  } catch (error) {
    console.log('send-handleDataSuccess-error', error);
  }
}

const handleDataFail = async (data) => {
  console.log('send-handleDataFail', data);
  try {
    await callApi({
      baseURL: CUSTOMER_BACKEND,
      body: {
        emailId: data.emailId,
        sendStatus: "fail",
        currentCompanyId: data.currentCompanyId
      },
      method: 'post',
      url: '/email/hook-update',
    });
  } catch (error) {
    console.log('send-handleDataFail-ereor', error);
  }
}

const handleRequestSendUpdateFail = async () => {
  try {
    const messages = await MessageModel.find({
      updated: "fail",
      type: "send",
    });
    if (messages && messages.length > 0) {
      for (const message of messages) {
        console.log('handleRequestSendUpdateFail-message', message);
        callHookUpdateFail(message);
      }
    }
  } catch (error) {
    console.log('send-handleDataSuccess-error', error);
  }
}

const callHookUpdateFail = async (message) => {
  try {
    await MessageModel.updateOne({ messageId: message.messageId }, {
      updated: "pending",
    });
    const res = await callApi({
      baseURL: CUSTOMER_BACKEND,
      body: {
        emailId: message.emailId,
        sendStatus: "success",
        messageId: message.messageId,
        currentCompanyId: message.currentCompanyId
      },
      method: 'post',
      url: '/email/hook-update',
    });
    if (res.data && res.data.success) {
      await MessageModel.updateOne({ messageId: message.messageId }, {
        updated: "success",
      });
    } else {
      return await MessageModel.updateOne({ messageId: message.messageId }, {
        updated: "fail",
      });
    }
  } catch (error) {
    console.log('send', error.response);
    return await MessageModel.updateOne({ messageId: message.messageId }, {
      updated: "fail",
    });
  }
}

module.exports = {
  sendEmail,
  handleDataSuccess,
  handleDataFail,
  handleRequestSendUpdateFail
};
