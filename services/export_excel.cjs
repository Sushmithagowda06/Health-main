const XLSX = require("xlsx");
const pool = require("../db/pg.cjs");

module.exports = async function exportAppointments() {
  demonstrate.log("📤 Fetching appointments from Postgres...");

  const res = await pool.query(`
    SELECT
      id,
      phone,
      name,
      date,
      time,
      created_at AS "BookedAt"
    FROM appointments
    ORDER BY created_at DESC
  `);

  console.log(`Rows fetched from Postgres: ${res.rows.length}`);

  const worksheet = XLSX.utils.json_to_sheet(res.rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return buffer;
};
