const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendReport = async (buffer) => {
  const msg = {
    to: process.env.REPORT_EMAIL,
    from: process.env.FROM_EMAIL,
    subject: "Appointments Report",
    text: "Attached is today's appointments report.",
    attachments: [
      {
        content: buffer.toString("base64"),
        filename: "appointments.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: "attachment"
      }
    ]
  };

  await sgMail.send(msg);
};
