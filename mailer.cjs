const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendReport = async (buffer) => {
  const now = new Date();

  const msg = {
    to: process.env.REPORT_EMAIL, // your gmail
    from: {
      email: process.env.FROM_EMAIL, // MUST be verified in SendGrid
      name: "Clinic Appointments"
    },

    // ✅ Dynamic subject (prevents Gmail hiding)
    subject: `Appointments Report – ${now.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    })}`,

    // ✅ Plain text fallback
    text: "Attached is your appointments report.",

    // ✅ HTML body (VERY important)
    html: `
      <p>Hello,</p>
      <p>Your appointments report is attached.</p>
      <p><b>Generated on:</b> ${now.toLocaleString("en-IN")}</p>
      <br/>
      <p>Regards,<br/>Clinic System</p>
    `,

    // ✅ Proper attachment metadata
    attachments: [
      {
        content: buffer.toString("base64"),
        filename: `appointments_${Date.now()}.xlsx`,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: "attachment"
      }
    ]
  };

  await sgMail.send(msg);
};
