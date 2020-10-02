const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Message = new Schema(
  {
    uid: {
      type: Number,
    },
    attachments: {
      type: Array,
    },
    emailId: {
      type: String
    },
    references: {
      type: Schema.Types.Mixed,
    },
    date: {
      type: Date
    },
    rootMessageId: {
      type: String
    },
    messageId: {
      type: String
    },
    currentCompanyId: {
      type: String
    },
    parentId: {
      type: String
    },
    content: {
      type: String
    },
    from: {
      type: String
    },
    fromUser: {
      type: String
    },
    updated: { // pending, success, fail 
      type: String,
    },
    type: { // send - receive
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", Message);