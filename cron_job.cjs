require("dotenv").config();
const cron = require("node-cron");

const exportAppointments = require("./export_appointments.cjs");
const sendMail = require("./mailer.js");

console.log(" Nightly appointment email scheduler started");

cron.schedule("40 16 * * *", async () => {
  console.log("🕚 Running nightly export + email job");

  try {
    const filePath = await exportAppointments();
    await sendMail(filePath);
    console.log("✅ Nightly report email sent successfully");
  } catch (err) {
    console.error("❌ Nightly job failed:", err.message);
  }
});
