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

cron.schedule("59 17 * * *", () => runJob("59:17"));
cron.schedule("05 18 * * *", () => runJob("05:18"));
cron.schedule("10 18 * * *", () => runJob("10:18"));

cron.schedule("0 0 * * *", () => {
  console.log("🌙 Midnight reset");
  jobStatus.reset();
});
