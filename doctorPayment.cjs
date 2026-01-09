// flows/doctorPayment.js

async function handleDoctorPaymentFlow({
  from,
  text,
  interactiveId,
  db,
  sendWhatsAppText,
  sendWhatsAppList
}) {
  const lower = (text || "").toLowerCase();

  // STEP 1: Doctor types "pay"
  if (lower === "pay") {
    return new Promise((resolve) => {
      db.all(
        `SELECT id, patient_name, date, time 
         FROM appointments 
         ORDER BY created_at DESC 
         LIMIT 5`,
        async (err, rows) => {
          if (!rows || rows.length === 0) {
            await sendWhatsAppText(from, "No patients found.");
            resolve(true);
            return;
          }

          const listRows = rows.map((r) => ({
            id: `PAY_PATIENT_${r.id}`,
            title: r.patient_name || "Patient",
            description: `${r.date} • ${r.time}`,
          }));

          await sendWhatsAppList(from, {
            header: "Select Patient",
            body: "Choose patient to collect payment — or type the patient's 10-digit mobile (no country code)",
            button: "Select patient",
            rows: listRows,
          });

          resolve(true);
        }
      );
    });
  }

  // STEP 2: Doctor selects patient
  if (interactiveId && interactiveId.startsWith("PAY_PATIENT_")) {
    const appointmentId = interactiveId.replace("PAY_PATIENT_", "");

    await sendWhatsAppText(
      from,
      "Enter amount to collect (example: 500)"
    );

    // store temp state in DB-less way (simple demo)
    global.__PAYMENT_CTX__ = global.__PAYMENT_CTX__ || {};
    global.__PAYMENT_CTX__[from] = appointmentId;

    return true;
  }

  // Allow doctor to type a 10-digit mobile (no country code) to identify patient
  if (/^\d{10}$/.test(text && text.trim())) {
    const last10 = text.trim();
    return new Promise((resolve) => {
      // fetch recent appointments and match by last 10 digits of stored phone
      db.all(
        `SELECT id, patient_name, phone, date, time FROM appointments ORDER BY created_at DESC LIMIT 200`,
        async (err, rows) => {
          const candidates = (rows || []).filter((r) => {
            const digits = (r.phone || '').replace(/\D/g, '');
            return digits.slice(-10) === last10;
          });

          if (!candidates.length) {
            await sendWhatsAppText(from, "No patient found with that 10-digit mobile. Please try again or select from the list.");
            resolve(true);
            return;
          }

          if (candidates.length === 1) {
            const appointmentId = candidates[0].id;
            // set payment context and ask for amount
            global.__PAYMENT_CTX__ = global.__PAYMENT_CTX__ || {};
            global.__PAYMENT_CTX__[from] = appointmentId;
            await sendWhatsAppText(from, "Enter amount to collect (example: 500)");
            resolve(true);
            return;
          }

          // multiple matches — present them to choose
          const listRows = candidates.map((r) => ({
            id: `PAY_PATIENT_${r.id}`,
            title: r.patient_name || 'Patient',
            description: `${r.phone || ''} • ${r.date} • ${r.time}`,
          }));

          await sendWhatsAppList(from, {
            header: 'Multiple matches',
            body: 'Multiple appointments found for that mobile — select the correct patient',
            button: 'Select patient',
            rows: listRows,
          });

          resolve(true);
        }
      );
    });
  }

  // STEP 3: Doctor enters amount
  if (global.__PAYMENT_CTX__?.[from] && /^\d+$/.test(text)) {
    const amount = text;
    const appointmentId = global.__PAYMENT_CTX__[from];

    return new Promise((resolve) => {
      db.get(
        `SELECT phone, patient_name FROM appointments WHERE id = ?`,
        [appointmentId],
        async (err, row) => {
          if (row) {
            await sendWhatsAppText(
              row.phone,
              `💳 *Cuure.health Payment Request*\n\nAmount: ₹${amount}\n\n(UPI / payment link will be sent here)`
            );

            await sendWhatsAppText(
              from,
              `✅ Payment request of ₹${amount} sent to ${row.patient_name}`
            );
          }

          delete global.__PAYMENT_CTX__[from];
          resolve(true);
        }
      );
    });
  }

  return false; // not handled
}

module.exports = { handleDoctorPaymentFlow };