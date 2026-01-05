/* ===============================
   START CRON (RUNS ONCE)
================================ */
require("./cron_runner.cjs"); // ✅ keep at top

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { google } = require("googleapis");

/* ===============================
   POSTGRES DB
================================ */
const pool = require("./db_pg.cjs");

/* ===============================
   EXPRESS SETUP
================================ */
const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   CONSTANTS
================================ */
const PORT = process.env.PORT || 3000;
const TZ = "Asia/Kolkata";
process.env.TZ = TZ;

/* ===============================
   WHATSAPP CONFIG
================================ */
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "cuure_verify";

/* ===============================
   GOOGLE CALENDAR
================================ */
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "service-account.json");

function getCalendar() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: SCOPES,
  });
  return google.calendar({ version: "v3", auth });
}

/* ===============================
   DOCTORS (STATIC)
================================ */
const doctors = [
  {
    id: 1,
    name: "Dr. Rohit Raj",
    specialization: "General Physician",
    phone: "7760330138"
  },
  {
    id: 2,
    name: "Dr. Shreyas Nayak",
    specialization: "General Physician",
    phone: "9606276017"
  }
];

let doctorIndex = 0;
function assignDoctor() {
  const d = doctors[doctorIndex];
  doctorIndex = (doctorIndex + 1) % doctors.length;
  return d;
}

/* ===============================
   IN-MEMORY STATE
================================ */
const sessions = {};
const users = {};
const appointmentsCache = [];

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: "START", temp: {} };
  }
  return sessions[phone];
}

/* ===============================
   LOAD CACHE ON BOOT
================================ */
(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT phone, patient_name, date, time_label, time_value FROM appointments`
    );
    appointmentsCache.push(...rows);
    console.log(`✅ Loaded ${rows.length} appointments into cache`);
  } catch (e) {
    console.error("Cache load failed:", e.message);
  }
})();

/* ===============================
   HELPERS
================================ */
const TIME_SLOTS = [
  { label: "9:00 AM – 10:00 AM", value: "09:00" },
  { label: "10:00 AM – 11:00 AM", value: "10:00" },
  { label: "11:00 AM – 12:00 PM", value: "11:00" },
  { label: "12:00 PM – 1:00 PM", value: "12:00" },
  { label: "1:00 PM – 2:00 PM", value: "13:00" },
  { label: "2:00 PM – 3:00 PM", value: "14:00" },
  { label: "3:00 PM – 4:00 PM", value: "15:00" },
  { label: "4:00 PM – 5:00 PM", value: "16:00" },
  { label: "5:00 PM – 6:00 PM", value: "17:00" },
  { label: "6:00 PM – 7:00 PM", value: "18:00" }
];

function getAvailableSlots(date) {
  return TIME_SLOTS.filter(
    s => !appointmentsCache.find(a => a.date === date && a.time_value === s.value)
  );
}

/* ===============================
   SAVE APPOINTMENT (POSTGRES)
================================ */
async function saveAppointment(record, doctor) {
  const { rows } = await pool.query(
    `INSERT INTO appointments
     (phone, patient_name, date, time_label, time_value, address, location_link, doctor_name, doctor_specialization)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      record.phone,
      record.patient_name,
      record.date,
      record.time_label,
      record.time_value,
      record.address,
      record.location_link,
      doctor.name,                // ✅ FIXED
      doctor.specialization
    ]
  );

  appointmentsCache.push(record);
  return rows[0].id;
}

/* ===============================
   ADMIN APIs
================================ */
app.get("/api/admin/appointments", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, patient_name, phone, date, time_label,
              address, location_link, doctor_name, doctor_specialization,
              'Booked' AS status
       FROM appointments
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

/* ===============================
   WEBHOOK VERIFY
================================ */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/* ===============================
   ROOT
================================ */
app.get("/", (_, res) => {
  res.send("Cuure Healthcare Bot is live ✅");
});

/* ===============================
   START SERVER
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Cuure bot running on port ${PORT}`);
});
