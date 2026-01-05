const pool = require("./db_pg.cjs");
const XLSX = require("xlsx");

module.exports = async () => {
  const result = await pool.query(`
    SELECT
      id,
      patient_name,
      phone,
      email,
      date,
      time
    FROM appointments
    ORDER BY id ASC
  `);

  const workbook = XLSX.utils.book_new();

  // STEP 3A: Add headers
  const rows = [
    ["ID", "Patient Name", "Phone", "Email", "Date", "Time"]
  ];

  // STEP 3B: Add DB rows
  result.rows.forEach(r => {
    rows.push([
      r.id,
      r.patient_name,
      r.phone,
      r.email,
      r.date,
      r.time
    ]);
  });

  // STEP 3C: Convert to worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer"
  });
};
