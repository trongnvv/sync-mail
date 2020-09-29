const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const MainData = new Schema(
  {
    numUidUpdated: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MainData", MainData);