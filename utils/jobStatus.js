const fs = require("fs");
const path = require("path");

const FLAG_FILE = path.join(__dirname, "../export_success.flag");

exports.isSent = () => fs.existsSync(FLAG_FILE);

exports.markSent = () => fs.writeFileSync(FLAG_FILE, "OK");

exports.reset = () => {
  if (fs.existsSync(FLAG_FILE)) fs.unlinkSync(FLAG_FILE);
};
