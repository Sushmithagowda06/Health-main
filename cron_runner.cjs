require("dotenv").config();
require("./init_pg.cjs");

const cron = require("node-cron");
const exportDb = require("./export_db.cjs");
const mailer = require("./mailer.cjs");
const jobStatus = require("./utils/jobStatus");

process.env.TZ = "Asia/Kolkata";

async function runJob(label) {
  if (jobStatus.isSent()) {
    console.log(`⏭️ Skipping ${label} — already sent`);
    return;
  }

  try {
    console.log(`📤 Exporting DB (${label})...`);
    const buffer = await exportDb();

    console.log(`📧 Sending mail (${label})...`);
    await mailer.sendReport(buffer);

    jobStatus.markSent();
    console.log(`✅ Mail sent successfully at ${label}`);
  } catch (err) {
    console.error(`❌ Failed at ${label}`, err.message);
  }
}

/**
 * ⏰ Scheduled attempts (IST)
 */
cron.schedule("31 13 * * *", () => runJob("14:03"));
cron.schedule("35 13 * * *", () => runJob("14:06"));
cron.schedule("45 13 * * *", () => runJob("14:09"));

/**
 * 🌙 Reset once per day at midnight IST
 */
cron.schedule("0 0 * * *", () => {
  console.log("🔄 Midnight reset");
  jobStatus.reset();
});

/**
 * 🚑 Startup safety net (Railway restarts)
 */
setTimeout(() => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  if (h === 13 && m >= 31 && m <= 50) {
    console.log("⚠️ Startup fallback trigger");
    runJob("startup-fallback");
  }
}, 30_000);
