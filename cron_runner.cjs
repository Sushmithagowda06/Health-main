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
 * ⏰ Scheduled attempts
 */
cron.schedule("5 12 * * *", () => runJob("12:05"));
cron.schedule("15 12 * * *", () => runJob("12:15"));
cron.schedule("25 12 * * *", () => runJob("12:25"));
cron.schedule("0 0 * * *", jobStatus.reset); // midnight reset
