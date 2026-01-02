const exportAppointments = require("./export_appointments.cjs");
const sendMail = require("./mailer.js");

(async () => {
  const filePath = await exportAppointments();
  await sendMail(filePath);
})();
