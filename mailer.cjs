const sgMail = require("@sendgrid/mail");

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is missing");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendReport = async (buffer) => {
  if (!process.env.FROM_EMAIL) {
    throw new Error("FROM_EMAIL is missing");
  }

  if (!process.env.REPORT_EMAIL) {
    throw new Error("REPORT_EMAIL is missing");
  }

  const msg = {
    to: process.env.REPORT_EMAIL.split(","), // ✅ FIXED
    from: process.env.FROM_EMAIL,
    subject: "Appointments Report",
    text: "Attached is today's appointments report.",
    attachments: [
      {
        content: buffer.toString("base64"),
        filename: "appointments.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: "attachment",
      },
    ],
  };

  await sgMail.send(msg);
};
