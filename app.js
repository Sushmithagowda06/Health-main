/* ===============================
   DOCTORS (STATIC FOR NOW)
================================ */
const doctors = [
  {
    id: 1,
    name: "Dr. Rohit Raj",
    specialization: "General Physician",
    phone: "7760330138" // replace with real doctor number later
  },
  {
    id: 2,
    name: "Dr. Shreyas Nayak",
    specialization: "General Physician",
    phone: "9606276017"
  }
];
console.log("🔥 BOT VERSION: ADDRESS + LOCATION BUTTON FLOW v2");
let doctorIndex = 0;

function assignDoctor() {
  const doctor = doctors[doctorIndex];
  doctorIndex = (doctorIndex + 1) % doctors.length; // round-robin
  return doctor;
}



require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { google } = require("googleapis");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json()); // Cloud API sends JSON
app.use(
  cors({
    origin: "http://localhost:3039",
  })
);
// Serve static admin UI from /public
app.use(express.static(path.join(__dirname, "public")));

// Admin UI route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
/* ===============================
   ENV / WHATSAPP CLOUD API
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

async function createCalendarEvent({ date, timeValue, from, name }) {
  const calendar = getCalendar();

  const [hStr, mStr] = timeValue.split(":");
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  const startDateTime = `${date}T${timeValue}:00+05:30`;

  m += 30;
  if (m >= 60) {
    m -= 60;
    h += 1;
  }
  const endTimeStr =
    String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  const endDateTime = `${date}T${endTimeStr}:00+05:30`;

  await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: "Cuure.health – Doctor Appointment",
      description: `Patient WhatsApp: ${from}\nName: ${name || "N/A"}`,
      start: { dateTime: startDateTime, timeZone: "Asia/Kolkata" },
      end: { dateTime: endDateTime, timeZone: "Asia/Kolkata" },
    },
  });
}

/* ===============================
   SQLITE DB
================================ */
const db = new sqlite3.Database("./cuure.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      age INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    patient_name TEXT,
    date TEXT,
    time_label TEXT,
    time_value TEXT,
    address TEXT,
    location_link TEXT,
    doctor_name TEXT,
    doctor_specialization TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )
`);

  db.run(`
  CREATE TABLE IF NOT EXISTS payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER,
    doctor_name TEXT,
    patient_phone TEXT,
    patient_name TEXT,
    amount INTEGER,
    payment_link TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY(appointment_id) REFERENCES appointments(id)
  )
`);

  // Load appointments cache after tables are created
  db.all(
    `SELECT phone, patient_name, date, time_label, time_value FROM appointments`,
    (err, rows) => {
      if (err) {
        console.error("Error loading appointments cache:", err);
      } else if (rows) {
        appointmentsCache.push(...rows);
        console.log(`✅ Loaded ${rows.length} appointments into cache`);
      }
    }
  );
});

// simple in-memory cache for slot availability
const appointmentsCache = [];

/* ===============================
   IN-MEMORY STATE
================================ */
const users = {}; // { phone: { name, age } }
const sessions = {}; // { phone: { step, temp } }

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: "START", temp: {} };
  }
  return sessions[phone];
}

/* ===============================
   CONSTANTS & HELPERS
================================ */
const IGNORE_WORDS = [
  "ok", "okay", "k", "kk", "hmm", "hm",
  "thanks", "thank you", "thx",
  "👍", "👌", "🙂", "✅"
];

const DAYS_TO_SHOW = 7;

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

function mainMenu() {
  return (
    "Please choose one of the options below:\n\n" +
    "1️⃣ Book a doctor appointment\n" +
    "2️⃣ View my appointments\n" +
    "3️⃣ Contact support"
  );
}

function getUpcomingDayRows() {
  const rows = [];
  const today = new Date();
  for (let i = 0; i < DAYS_TO_SHOW; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });

    rows.push({
      id: `date_${dateStr}`,
      title: `${dayName}, ${dd}-${mm}`,
      description: "",
    });
  }
  return rows;
}

function getAvailableSlots(date) {
  return TIME_SLOTS.filter(
    (slot) =>
      !appointmentsCache.find(
        (a) => a.date === date && a.time_value === slot.value
      )
  );
}

function getTimeRowsForDate(date) {
  const available = getAvailableSlots(date);
  return available.map((slot) => ({
    id: `time_${slot.value}`,
    title: slot.label,
    description: "",
  }));
}

/* ===============================
   HELPER: GENERATE PAYMENT LINK
================================ */
function generatePaymentLink(patientPhone, amount, appointmentId) {
  // Read and sanitize UPI env vars (handle accidental prefixes/quotes)
  let upiId = (process.env.UPI_ID || "cuure@upi").trim();
  // remove accidental prefix like "UPI_ID=..."
  if (upiId.toUpperCase().startsWith("UPI_ID=")) {
    upiId = upiId.substring(7);
  }
  // strip surrounding quotes if present
  upiId = upiId.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();

  let payeeName = (process.env.UPI_NAME || "Cuure Health").trim();
  payeeName = payeeName.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();

  // Ensure amount is numeric and formatted with 2 decimal places
  const amountStr = Number(amount || 0).toFixed(2);

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${encodeURIComponent(amountStr)}&cu=INR&tn=${encodeURIComponent(
    `Appointment ${appointmentId}`
  )}`;

  // Also build an HTTPS UPI link (works well in WhatsApp as a clickable URL)
  const httpsUpiUrl = `https://pay.google.com/gp/p/ui/pay?pa=${encodeURIComponent(
    upiId
  )}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(
    amountStr
  )}&cu=INR&tn=${encodeURIComponent(`Appointment ${appointmentId}`)}`;

  return { upiId, upiUri, httpsUpiUrl, payeeName, amount: amountStr };
}

/* ===============================
   SEND MESSAGE HELPERS
================================ */
async function sendWhatsAppText(to, body) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );
}

async function sendEntryButtons(to) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: "Welcome to Cuure.health 🩺\nHow would you like to proceed?",
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "CALL_NOW", title: "📞 Call Now" } },
              {
                type: "reply",
                reply: { id: "CHAT_CONTINUE", title: "💬 Continue in Chat" },
              },
            ],
          },
        },
      }),
    }
  );
}

async function sendChatAgainButton(to) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Would you like to continue via chat?" },
          action: {
            buttons: [
              {
                type: "reply",
                reply: { id: "CHAT_CONTINUE", title: "💬 Continue in Chat" },
              },
            ],
          },
        },
      }),
    }
  );
}




/* ===============================
   NOTIFY DOCTOR
================================ */
async function notifyDoctor({ doctor, record }) {
  const message =
    "🩺 New Appointment Assigned\n\n" +
    `👤 Patient: ${record.patient_name}\n` +
    `📞 Phone: ${record.phone}\n\n` +
    `📅 Date: ${record.date}\n` +
    `⏰ Time: ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    "Please be available as scheduled.";

  await sendWhatsAppText(doctor.phone, message);
}

async function sendWhatsAppList(to, { header, body, button, rows }) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: header },
          body: { text: body },
          footer: { text: "Cuure.health" },
          action: {
            button,
            sections: [
              {
                title: "Options",
                rows,
              },
            ],
          },
        },
      }),
    }
  );
}

/* ===============================
   REGISTERED USER FLOW
================================ */
async function handleRegisteredUser(from, text, interactiveId) {
  const session = getSession(from);
  const lower = (text || "").toLowerCase();

  if (interactiveId) {
    // handle date/time selections by ID
    if (interactiveId.startsWith("date_")) {
      const dateStr = interactiveId.replace("date_", "");
      session.temp.date = dateStr;

      const timeRows = getTimeRowsForDate(dateStr);
      if (!timeRows.length) {
        await sendWhatsAppText(
          from,
          "All time slots for this day are currently booked.\n\nPlease select another date from the list."
        );
        session.step = "DAY_SELECT";
        await sendWhatsAppList(from, {
          header: "Select Appointment Date",
          body: "Please choose a preferred date for your appointment:",
          button: "Select date",
          rows: getUpcomingDayRows(),
        });
        return;
      }

      session.step = "TIME_SELECT";
      await sendWhatsAppList(from, {
        header: `Date: ${dateStr}`,
        body: "Please select a suitable time slot for your appointment:",
        button: "Select time",
        rows: timeRows,
      });
      return;
    }

    if (interactiveId.startsWith("time_") && session.temp.date) {
      const timeValue = interactiveId.replace("time_", "");
      const slot = TIME_SLOTS.find((s) => s.value === timeValue);
      if (!slot) {
        await sendWhatsAppText(
          from,
          "The selected time slot is not available. Please try again."
        );
        session.step = "TIME_SELECT";
        await sendWhatsAppList(from, {
          header: `Date: ${session.temp.date}`,
          body: "Please select a suitable time slot for your appointment:",
          button: "Select time",
          rows: getTimeRowsForDate(session.temp.date),
        });
        return;
      }

      session.temp.slot = slot;
      session.step = "CONFIRM";

      await sendWhatsAppText(
        from,
        "Please review your appointment details:\n\n" +
          `📅 Date: ${session.temp.date}\n` +
          `⏰ Time: ${slot.label}\n\n` +
          "Reply *YES* to confirm the appointment or *NO* to cancel."
      );
      return;
    }
  }

  if (lower === "menu") {
    session.step = "MENU";
    await sendWhatsAppText(from, mainMenu());
    return;
  }

  // MAIN MENU
  if (session.step === "START" || session.step === "MENU") {
    session.step = "MENU";

    if (text === "1") {
      session.step = "DAY_SELECT";
      await sendWhatsAppList(from, {
        header: "Select Appointment Date",
        body: "Please choose a preferred date for your appointment:",
        button: "Select date",
        rows: getUpcomingDayRows(),
      });
      return;
    }

    if (text === "2") {
      db.all(
        `SELECT date, time_label, patient_name
         FROM appointments
         WHERE phone = ?
         ORDER BY date, time_value`,
        [from],
        async (err, rows) => {
          if (err || !rows.length) {
            await sendWhatsAppText(
              from,
              "You do not have any appointments scheduled at the moment.\n\n" +
                "You may book a new appointment using the *Book a doctor appointment* option.\n\n" +
                mainMenu()
            );
          } else {
            const list = rows
              .map(
                (a, i) =>
                  `${i + 1}. ${a.date} at ${a.time_label} (${a.patient_name ||
                    "Not specified"})`
              )
              .join("\n");
            await sendWhatsAppText(
              from,
              "Here are your appointments:\n\n" +
                list +
                "\n\n" +
                mainMenu()
            );
          }
        }
      );
      return;
    }

    if (text === "3") {
      await sendWhatsAppText(
        from,
        "Cuure.health Support 🩺\n\n" +
          "For any help with appointments or other queries, you may contact us at:\n\n" +
          "📞 Helpline: 08213156014 \ 7483068353 \n" + // update to your real number
          "🕒 Support hours: 9:00 AM – 8:00 PM\n\n" +
          "You can also continue to manage appointments here.\n" +
          "Type *MENU* at any time to view the options again."
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Sorry, I did not understand that.\n\n" +
        "Please choose one of the available options:\n\n" +
        mainMenu()
    );
    return;
  }

// ADDRESS CHOICE
if (session.step === "ADDRESS_CHOICE" && interactiveId) {

  if (interactiveId === "ADDR_TYPE") {
    session.step = "ASK_TYPED_ADDRESS";

    await sendWhatsAppText(
      from,
      "✍️ Please type the complete address:\n\n" +
      "• House / Flat No\n• Area / Street\n• City\n• Landmark (optional)"
    );
    return;
  }

  if (interactiveId === "ADDR_LOCATION") {
    session.step = "ASK_LOCATION";

    await sendWhatsAppText(
      from,
      "📍 Please share your current location using WhatsApp Location.\n\n" +
      "If location sharing is not possible, please type the address instead."
    );
    return;
  }
}

// ✅ TYPE ADDRESS → DIRECT CONFIRM
if (session.step === "ASK_TYPED_ADDRESS") {
  session.temp.address = text;
  session.temp.location_link = null;
  session.step = "FINAL_CONFIRM";
  // ❌ REMOVE return
}

  // CONFIRMATION STEP
if (session.step === "CONFIRM") {
  if (lower === "yes") {
    session.step = "ADDRESS_CHOICE";

    await fetch(
      `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "📍 How would you like to share the visit address?",
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: { id: "ADDR_TYPE", title: "✍️ Type Address" },
                },
                {
                  type: "reply",
                  reply: { id: "ADDR_LOCATION", title: "📍 Send Location" },
                },
              ],
            },
          },
        }),
      }
    );

    return;
  }


  if (lower === "no") {
    session.step = "MENU";
    await sendWhatsAppText(
      from,
      "Your appointment request has been cancelled.\n\n" + mainMenu()
    );
    return;
  }

  await sendWhatsAppText(
    from,
    "Please reply *YES* to confirm or *NO* to cancel."
  );
  return;
}

// LOCATION / SKIP → FINAL CONFIRM
if (session.step === "ASK_LOCATION") {

  // ✅ Live location shared
  if (text === "__LOCATION__" && session.temp.location) {
    const { lat, lng, address } = session.temp.location;

    session.temp.address =
      session.temp.address || address || "Shared via current location";

    session.temp.location_link =
      `https://maps.google.com/?q=${lat},${lng}`;
  }
  // ✅ User typed instead of sending location
  else if (text && text.toLowerCase() !== "skip") {
    session.temp.address = text;
    session.temp.location_link = null;
  }
  // ✅ Skip option
  else {
    session.temp.address =
      session.temp.address || "Address not provided";
    session.temp.location_link = null;
  }

  session.step = "FINAL_CONFIRM";
}
/* ===============================
   STEP 4 — FINAL CONFIRM
================================ */
if (session.step === "FINAL_CONFIRM" && session.temp.slot) {

  const slot = session.temp.slot;
  const user = users[from] || {};

  const record = {
    phone: from,
    patient_name: user.name || null,
    date: session.temp.date,
    time_label: slot.label,
    time_value: slot.value,
    address: session.temp.address,
    location_link: session.temp.location_link || null
  };

  appointmentsCache.push(record);
  const doctor = assignDoctor();

  // Save to database - using async wrapper
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO appointments (
        phone, patient_name, date, time_label, time_value,
        address, location_link,
        doctor_name, doctor_specialization
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.phone,
        record.patient_name,
        record.date,
        record.time_label,
        record.time_value,
        record.address,
        record.location_link,
        doctor.phone,
        doctor.specialization
      ],
      function(err) {
        if (err) {
          console.error("❌ Error inserting appointment:", err);
          reject(err);
        } else {
          console.log("✅ Appointment saved to DB - ID:", this.lastID);
          resolve(this.lastID);
        }
      }
    );
  });

  notifyDoctor({ doctor, record }).catch(console.error);

  session.step = "MENU";

  await sendWhatsAppText(
    from,
    "Health is true wealth!"+
    "✅ Appointment Confirmed\n\n" +
    `📅 ${record.date}\n` +
    `⏰ ${record.time_label}\n\n` +
    `📍 Address:\n${record.address}\n\n` +
    (record.location_link ? `🗺️ ${record.location_link}\n\n` : "") +
    `👨‍⚕️ ${doctor.name}\n${doctor.specialization}\n\n` +
    mainMenu()
  );

  return;
}

// Ignore casual words (only when no active step)
if (
  IGNORE_WORDS.includes(lower) &&
  session.step === "MENU"
) {
  return;
}
  
console.log("STEP =", session.step);

  // fallback
  session.step = "MENU";
  await sendWhatsAppText(
    from,
    "Sorry, I did not understand that.\n\n" + mainMenu()
  );
}

async function sendEntryChoice(from) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text:
              "Welcome to Cuure.health 🩺\n\n" +
              "🌐 Website: https://cuure.health\n\n" +
              "Book verified doctors, healthcare services and manage appointments from the comfort of your home.\n\n" +
              "How would you like to proceed?",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "CALL_NOW",
                  title: "📞 Call Now",
                },
              },
              {
                type: "reply",
                reply: {
                  id: "CHAT_CONTINUE",
                  title: "💬 Continue in Chat",
                },
              },
            ],
          },
        },
      }),
    }
  );
}

async function sendContinueChatButton(from) {
  await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: "Would you like to continue booking via chat?",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "CHAT_CONTINUE",
                  title: "💬 Continue in Chat",
                },
              },
            ],
          },
        },
      }),
    }
  );
}
/* ===============================
   WEBHOOK VERIFY (GET)
================================ */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verification failed");
  return res.sendStatus(403);
});


/* ===============================
   WEBHOOK VERIFY (GET)
================================ */
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (
      body.object === "whatsapp_business_account" &&
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const value = body.entry[0].changes[0].value;
      const message = value.messages[0];
      const from = message.from;
      const session = getSession(from);

      let text = "";
      let interactiveId = null;

      if (message.type === "text") {
        text = message.text.body.trim();
      }
      if (message.type === "location") {
        text = "__LOCATION__";
        session.temp.location = {
          lat: message.location.latitude,
          lng: message.location.longitude,
          address: message.location.address || null,
        };
      }
       else if (message.type === "interactive") {
        const inter = message.interactive;
        if (inter.type === "list_reply") {
          interactiveId = inter.list_reply.id;
        } else if (inter.type === "button_reply") {
          interactiveId = inter.button_reply.id;
        }
      }


      /* =========================
         DOCTOR FEE REQUEST FLOW
      ========================== */
      if (text && text.toLowerCase() === "fees" && !interactiveId) {
        session.step = "DOCTOR_NAME";
        await sendWhatsAppText(
          from,
          "🏥 Doctor Fee Request\n\n" +
          "Please enter your mobile number to verify your identity:"
        );
        return res.sendStatus(200);
      }

      if (session.step === "DOCTOR_NAME") {
        // Verify doctor by mobile number (treat mobile as doctor code)
        const phoneInput = (text || "").replace(/\D/g, "");
        const doctorFound = doctors.find(
          (d) => (d.phone || "").replace(/\D/g, "") === phoneInput
        );

        if (!doctorFound) {
          await sendWhatsAppText(
            from,
            "Doctor mobile number not found in our system.\n\n" +
              "Please enter the mobile number you were given."
          );
          return res.sendStatus(200);
        }

        session.temp.doctor = doctorFound;
        session.step = "SELECT_PATIENT";

        // Get list of patients assigned to this doctor (doctor stored by phone)
        db.all(
          `SELECT DISTINCT phone, patient_name, date, time_label, id 
           FROM appointments 
           WHERE doctor_name = ? 
           ORDER BY date DESC`,
          [doctorFound.phone],
          async (err, rows) => {
            if (err || !rows || rows.length === 0) {
              session.step = "MENU";
              await sendWhatsAppText(
                from,
                "No patients assigned to you at the moment."
              );
              return;
            }

            // Create patient list for dropdown
            const patientRows = rows.map((row, idx) => ({
              id: `patient_${row.id}`,
              title: `${row.patient_name || "Patient"} - ${row.date}`,
              description: `${row.time_label}`,
            }));

            await sendWhatsAppList(from, {
              header: "Select Patient",
              body: "Choose a patient to request payment:",
              button: "Select patient",
              rows: patientRows,
            });
          }
        );

        return res.sendStatus(200);
      }

      if (session.step === "SELECT_PATIENT" && interactiveId && interactiveId.startsWith("patient_")) {
        const appointmentId = interactiveId.replace("patient_", "");

        db.get(
          `SELECT phone, patient_name, date, time_label 
           FROM appointments 
           WHERE id = ?`,
          [appointmentId],
          async (err, row) => {
            if (err || !row) {
              await sendWhatsAppText(from, "Patient record not found.");
              return;
            }

            session.temp.selectedPatient = row;
            session.temp.selectedPatientId = appointmentId;
            session.step = "ENTER_AMOUNT";

            await sendWhatsAppText(
              from,
              `Patient: ${row.patient_name}\n` +
              `Appointment: ${row.date} at ${row.time_label}\n\n` +
              "Please enter the consultation fee amount (in rupees):"
            );
          }
        );

        return res.sendStatus(200);
      }

      if (session.step === "ENTER_AMOUNT") {
        const amount = parseInt(text, 10);

        if (isNaN(amount) || amount <= 0) {
          await sendWhatsAppText(
            from,
            "Please enter a valid amount in rupees (e.g., 500)."
          );
          return res.sendStatus(200);
        }

        const patient = session.temp.selectedPatient;
        const appointmentId = session.temp.selectedPatientId;
        const paymentInfo = generatePaymentLink(
          patient.phone,
          amount,
          appointmentId
        );

        // Save payment request to database (store UPI URI in payment_link)
        // prefer HTTPS UPI URL so WhatsApp renders it clickable
        const paymentLink = paymentInfo.httpsUpiUrl || paymentInfo.upiUri;

        db.run(
          `INSERT INTO payment_requests (
            appointment_id, doctor_name, patient_phone, patient_name, 
            amount, payment_link, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now','localtime'))`,
          [
            appointmentId,
            session.temp.doctor.phone,
            patient.phone,
            patient.patient_name,
            amount,
            paymentLink
          ],
          async (err) => {
            if (err) console.error("Payment request save error:", err);

            // Send UPI payment details to patient
            await sendWhatsAppText(
              patient.phone,
              `💳 Payment Request\n\n` +
                `👨‍⚕️ Doctor: ${session.temp.doctor.name}\n` +
                `📅 Appointment: ${patient.date} at ${patient.time_label}\n\n` +
                `💰 Fee: ₹${amount}\n\n` +
                `Please pay using UPI:\nUPI ID: ${paymentInfo.upiId} (${paymentInfo.payeeName})\n` +
                `Payment Link: ${paymentLink}\n\n` +
                `(Tap the link to open your UPI app and pay)\n\n` +
                `Thank you for choosing Cuure.health! - where care meets convenience`
            );

            session.step = "MENU";
            await sendWhatsAppText(
              from,
              `✅ Payment request sent to patient (${patient.phone})\n\n` +
                `Amount: ₹${amount}\n\n` +
                `Patient will receive UPI payment details shortly.`
            );
          }
        );

        return res.sendStatus(200);
      }

      /* =========================
         NEW USER FLOW
      ========================== */
      if (!users[from]) {

        // 🔰 ENTRY CHOICE
        if (session.step === "START") {
          session.step = "ENTRY_CHOICE";
          await sendEntryChoice(from);
          return res.sendStatus(200);
        }

        // ❌ Ignore text while waiting for CALL / CHAT
        if (
          (session.step === "ENTRY_CHOICE" || session.step === "AFTER_CALL") &&
          !interactiveId
        ) {
          return res.sendStatus(200);
        }

        // 📞 / 💬 BUTTON HANDLING
        if (session.step === "ENTRY_CHOICE" && interactiveId) {

          // 📞 CALL
          if (interactiveId === "CALL_NOW") {
            await sendWhatsAppText(
              from,
              "📞 Call Cuure.health\n\n 0821-3156014\n 7483068353\n🕘 9 AM – 8 PM"
            );

            await sendContinueChatButton(from);
            session.step = "AFTER_CALL";
            return res.sendStatus(200);
          }

          // 💬 CHAT
          if (interactiveId === "CHAT_CONTINUE") {
            session.step = "ASK_NAME";
            await sendWhatsAppText(
              from,
              "Great 👍\n\nTo begin, may I know your full name?"
            );
            return res.sendStatus(200);
          }
        }

        // 🔁 AFTER CALL → CHAT
        if (session.step === "AFTER_CALL" && interactiveId === "CHAT_CONTINUE") {
          session.step = "ASK_NAME";
          await sendWhatsAppText(
            from,
            "No problem 😊\n\nMay I know your full name?"
          );
          return res.sendStatus(200);
        }

        // 👤 NAME
        if (session.step === "ASK_NAME") {
          // Validate: only alphabets and spaces
          if (!/^[a-zA-Z\s]+$/.test(text)) {
            await sendWhatsAppText(
              from,
              "Please enter a valid name using only alphabets and spaces."
            );
            return res.sendStatus(200);
          }

          session.temp.name = text;
          session.step = "ASK_AGE";
          await sendWhatsAppText(
            from,
            `Thank you, ${text}.\n\nPlease enter your age (numbers only).`
          );
          return res.sendStatus(200);
        }

        // 🎂 AGE
        if (session.step === "ASK_AGE") {
          const age = parseInt(text, 10);

          if (isNaN(age) || age <= 0 || age > 110) {
            await sendWhatsAppText(
              from,
              "Please enter a valid age using numbers only (1-110)."
            );
            return res.sendStatus(200);
          }

          users[from] = { name: session.temp.name, age };

          db.run(
            `INSERT INTO users (phone, name, age)
             VALUES (?, ?, ?)
             ON CONFLICT(phone) DO UPDATE SET
               name = excluded.name,
               age = excluded.age`,
            [from, session.temp.name, age]
          );

          session.step = "MENU";
          await sendWhatsAppText(
            from,
            `Thank you, ${session.temp.name}.\n\n` +
              "You have been successfully registered.\n\n" +
              mainMenu()
          );
          return res.sendStatus(200);
        }

      } else {
        /* =========================
           REGISTERED USER FLOW
        ========================== */
        await handleRegisteredUser(from, text, interactiveId);
        return res.sendStatus(200);
      }
    }

    return res.sendStatus(200);

  } catch (e) {
    console.error("Webhook error:", e);
    return res.sendStatus(500);
  }
});

/* ===============================
   ADMIN – READ APPOINTMENTS
================================ */
app.get("/api/admin/appointments", (req, res) => {
  db.all(
    `
    SELECT
      id,
      patient_name,
      phone,
      date,
      time_label,
      address,
      location_link,
      doctor_name,
      doctor_specialization,
      'Booked' AS status
    FROM appointments
    ORDER BY created_at DESC
    `,
    (err, rows) => {
      if (err) {
        console.error("Admin appointments error:", err.message);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch appointments",
        });
      }

      res.json({ success: true, data: rows });
    }
  );
});

/* ===============================
   ADMIN – CREATE APPOINTMENT (manual)
================================ */
app.post('/api/admin/appointments', (req, res) => {
  const {
    phone,
    patient_name,
    date,
    time_label,
    time_value,
    address,
    location_link,
    doctor_name,
    doctor_specialization
  } = req.body || {};

  // basic validation
  if (!phone || !patient_name || !date || !time_value || !doctor_name) {
    return res.status(400).json({ success: false, message: 'Missing required fields: phone, patient_name, date, time_value, doctor_name' });
  }

  const record = {
    phone,
    patient_name,
    date,
    time_label: time_label || time_value,
    time_value,
    address: address || null,
    location_link: location_link || null,
    doctor_name,
    doctor_specialization: doctor_specialization || null
  };

  db.run(
    `INSERT INTO appointments (
      phone, patient_name, date, time_label, time_value,
      address, location_link, doctor_name, doctor_specialization, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
    [
      record.phone,
      record.patient_name,
      record.date,
      record.time_label,
      record.time_value,
      record.address,
      record.location_link,
      record.doctor_name,
      record.doctor_specialization
    ],
    function(err) {
      if (err) {
        console.error('Failed to insert appointment:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to add appointment' });
      }

      // push to in-memory cache to keep slot tracking in sync
      appointmentsCache.push({ phone: record.phone, patient_name: record.patient_name, date: record.date, time_label: record.time_label, time_value: record.time_value });

      res.json({ success: true, id: this.lastID });
    }
  );
});

/* ===============================
   ADMIN – READ PAYMENT REQUESTS
================================ */
app.get("/api/admin/payments", (req, res) => {
  db.all(
    `
    SELECT
      id,
      appointment_id,
      doctor_name,
      patient_name,
      patient_phone,
      amount,
      status,
      payment_link,
      created_at
    FROM payment_requests
    ORDER BY created_at DESC
    `,
    (err, rows) => {
      if (err) {
        console.error("Admin payments error:", err.message);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch payment requests",
        });
      }

      res.json({ success: true, data: rows });
    }
  );
});

/* ===============================
   ADMIN – CREATE PAYMENT (manual)
================================ */
app.post("/api/admin/payments", (req, res) => {
  const {
    appointment_id,
    doctor_name,
    patient_name,
    patient_phone,
    amount,
    payment_link,
    status,
  } = req.body || {};

  if (!patient_phone || !amount) {
    return res.status(400).json({ success: false, message: "patient_phone and amount are required" });
  }

  db.run(
    `INSERT INTO payment_requests (
      appointment_id, doctor_name, patient_name, patient_phone, amount, payment_link, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [appointment_id || null, doctor_name || null, patient_name || null, patient_phone, amount, payment_link || null, status || 'PENDING'],
    function (err) {
      if (err) {
        console.error('Failed to create payment request:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to create payment' });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

/* ===============================
   ADMIN – UPDATE PAYMENT
================================ */
app.put('/api/admin/payments/:id', (req, res) => {
  const id = req.params.id;
  const allowed = ['appointment_id','doctor_name','patient_name','patient_phone','amount','payment_link','status'];
  const updates = [];
  const values = [];

  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, k)) {
      updates.push(`${k} = ?`);
      values.push(req.body[k]);
    }
  }

  if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });

  values.push(id);

  const sql = `UPDATE payment_requests SET ${updates.join(', ')} WHERE id = ?`;
  db.run(sql, values, function(err) {
    if (err) {
      console.error('Failed to update payment request:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to update payment' });
    }
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true });
  });
});

app.get("/", (req, res) => {
  res.send("Cuure Healthcare Bot is live ✅");
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Cuure Meta bot running on port ${PORT}`);
});