require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

async function sendMail(filePath) {
  if (!process.env.REPORT_EMAILS) {
    throw new Error("REPORT_EMAILS not set in .env");
  }

  const recipients = process.env.REPORT_EMAILS.split(",");

  await transporter.sendMail({
    from: `"Cuure Health" <${process.env.MAIL_USER}>`,
    to: recipients,
    subject: "Daily Appointment Report",
    text: "Attached is the daily appointment report.",
    attachments: [
      {
        filename: "appointments.xlsx",
        path: filePath
      }
    ]
  });

  console.log("📧 Email sent to:", recipients.join(", "));
}

module.exports = sendMail;
