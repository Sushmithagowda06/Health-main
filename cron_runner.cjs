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
    console.log(`📤 Exporting DB (${label})`);
    const buffer = await exportDb();

    console.log(`📧 Sending mail (${label})`);
    await mailer.sendReport(buffer);

    jobStatus.markSent();
    console.log(`✅ Mail sent successfully at ${label}`);
  } catch (err) {
    console.error(`❌ Failed at ${label}`, err);
  }
}

/**
 * ⏰ Scheduled attempts (IST)
 */
jobStatus.reset();

cron.schedule("31 11 * * *", () => runJob("11:31"));
cron.schedule("33 11 * * *", () => runJob("11:33"));
cron.schedule("35 11 * * *", () => runJob("11:35"));

cron.schedule("0 0 * * *", () => {
  console.log("🌙 Midnight reset");
  jobStatus.reset();
});
