/* ===============================
   DOCTORS (STATIC FOR NOW)
================================ */
const doctors = [
  {
    id: 1,
    name: "Dr. Rohit Raj",
    specialization: "General Physician",
    phone: "7483667619" // replace with real doctor number later
  },
  {
    id: 2,
    name: "Dr. Shreyas Nayak",
    specialization: "Physiotherapist",
    phone: "917483667619"
  }
];

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
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
});

// simple in-memory cache for slot availability
const appointmentsCache = [];
db.all(
  `SELECT phone, patient_name, date, time_label, time_value FROM appointments`,
  (err, rows) => {
    if (!err && rows) {
      appointmentsCache.push(...rows);
    }
  }
);

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
  { label: "4:00 PM – 4:30 PM", value: "16:00" },
  { label: "4:30 PM – 5:00 PM", value: "16:30" },
  { label: "5:00 PM – 5:30 PM", value: "17:00" },
  { label: "5:30 PM – 6:00 PM", value: "17:30" },
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

  // Ignore casual words
  if (lower && IGNORE_WORDS.includes(lower)) return;

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
              "Here are your upcoming appointments:\n\n" +
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
          "📞 Helpline: 08213156014\n" + // update to your real number
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

  // CONFIRMATION STEP
  if (session.step === "CONFIRM") {
    if (lower === "yes") {
      const slot = session.temp.slot;
      const user = users[from] || {};
      const record = {
        phone: from,
        patient_name: user.name || null,
        date: session.temp.date,
        time_label: slot.label,
        time_value: slot.value,
      };
       
      
      appointmentsCache.push(record);
      
      const doctor = assignDoctor();

      db.run(
        `INSERT INTO appointments (
          phone,
          patient_name,
          date,
          time_label,
          time_value,
          doctor_name,
          doctor_specialization
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.phone,
          record.patient_name,
          record.date,
          record.time_label,
          record.time_value,
          doctor.name,
          doctor.specialization,
        ],
        (err) => {
          if (err) console.error("DB appointment insert error:", err.message);
        }
      );

      createCalendarEvent({
      date: record.date,
      timeValue: record.time_value,
      from,
      name: record.patient_name,
    }).catch((e) => console.error("Calendar error:", e.message));

      /* 🔔 NOTIFY DOCTOR */
      notifyDoctor({ doctor, record }).catch((e) =>
        console.error("Doctor notify error:", e.message)
      );

      session.step = "MENU";

      await sendWhatsAppText(
        from,
        "✅ Appointment Confirmed\n\n" +
          `📅 Date: ${record.date}\n` +
          `⏰ Time: ${record.time_label}\n\n` +
          "👨‍⚕️ Doctor Assigned:\n" +
          `${doctor.name}\n` +
          `Specialization: ${doctor.specialization}\n\n` +
          mainMenu()
      );

    return;

    }

    if (lower === "no") {
      session.step = "MENU";
      await sendWhatsAppText(
        from,
        "Your appointment request has been cancelled.\n\n" +
          "You may book a new appointment whenever you are ready.\n\n" +
          mainMenu()
      );
      return;
    }

    await sendWhatsAppText(
      from,
      "Please reply with YES to confirm the appointment or *NO* to cancel."
    );
    return;
  }

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

      let text = "";
      let interactiveId = null;

      if (message.type === "text") {
        text = message.text.body.trim();
      } else if (message.type === "interactive") {
        const inter = message.interactive;
        if (inter.type === "list_reply") {
          interactiveId = inter.list_reply.id;
        } else if (inter.type === "button_reply") {
          interactiveId = inter.button_reply.id;
        }
      }

      const session = getSession(from);

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
              "📞 Call Cuure.health\n\n 0821-3156014\n\n🕘 9 AM – 8 PM"
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

          if (isNaN(age) || age <= 0) {
            await sendWhatsAppText(
              from,
              "Please enter a valid age using numbers only."
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

      res.json({
        success: true,
        data: rows,
      });
    }
  );
});

app.get("/", (req, res) => {
  res.send("Cuure Healthcare Bot is live ✅");
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Cuure Meta bot running on port", PORT);
});
