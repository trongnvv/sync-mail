const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Message = new Schema(
  {
    uid: {
      type: Number,
      default: 0,
    },
    attachments: {
      type: Array,
    },
    references: {
      type: Schema.Types.Mixed,
    },
    date: {
      type: Date
    },
    messageId: {
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", Message);