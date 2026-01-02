const XLSX = require("xlsx");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "cuure.db");
const db = new sqlite3.Database(dbPath);

function exportAppointments() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        id,
        phone,
        patient_name,
        date,
        time_label,
        created_at
      FROM appointments
      ORDER BY date, time_label
    `;

    db.all(query, (err, rows) => {
      if (err) {
        console.error("DB error:", err.message);
        return reject(err);
      }

      const data = rows.map(r => ({
        ID: r.id,
        Phone: r.phone,
        Name: r.patient_name,
        Date: r.date,
        Time: r.time_label,
        BookedAt: r.created_at
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

      const filePath = path.join(__dirname, "appointments.xlsx");
      XLSX.writeFile(workbook, filePath);

      console.log("📄 Appointments exported:", filePath);
      resolve(filePath);
    });
  });
}

module.exports = exportAppointments;
