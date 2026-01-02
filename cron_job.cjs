require("dotenv").config();
const cron = require("node-cron");

const exportAppointments = require("./export_appointments.cjs");
const sendMail = require("./mailer.js");

console.log("⏰ Cron scheduler initialized");

// 16:35 IST every day
cron.schedule("00 17 * * *", async () => {
  console.log("📤 Running scheduled appointment export");

  try {
    const filePath = await exportAppointments();
    await sendMail(filePath);
    console.log("✅ Appointment email sent successfully");
  } catch (err) {
    console.error("❌ Cron job failed:", err.message);
  }
});
