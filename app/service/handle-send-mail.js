const fs = require("fs");
const { join } = require("path");
const hogan = require("hogan.js");
const striptags = require("striptags");
const { isEmpty } = require("lodash");
const { createTransport } = require("nodemailer");
const callApi = require('../api');
const MessageModel = require("../model/Message");

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
  { template, subject, email, data, sender, cc, attachment, messageId },
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
      ? `${sender} <trongnv.work@gmail.com>`
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

  if (messageId) {
    dataPost.messageId = messageId;
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
    console.log('handleData', data);
    await MessageModel.create({
      date: new Date(),
      attachments: data.attachment,
      messageId: data.messageId,
      content: data.template,
      fromUser: data.sender,
      updated: "pending",
      type: "send"
    });
    const res = await callApi({
      baseURL: '',
      body: {
        emailId: data.emailId,
        sendStatus: "success",
        messageId: data.messageId,
      },
      method: 'post',
      url: data.hookAPI
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
    console.log('handleDataSuccess-error', error.response);
  }
}

const handleDataFail = async (data) => {
  try {
    const res = await callApi({
      baseURL: 'http://fpt.works/api/v1/customer',
      body: {
        emailId: data.emailId,
        sendStatus: "fail",
      },
      method: 'post',
      url: data.hookAPI
    });
  } catch (error) {
    
  }
}

module.exports = {
  sendEmail,
  handleDataSuccess,
  handleDataFail
};
