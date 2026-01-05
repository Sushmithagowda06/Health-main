const pool = require("./db_pg.cjs");
const XLSX = require("xlsx");

module.exports = async function exportDb() {
  // ✅ Correct columns based on your table
  const result = await pool.query(`
    SELECT
      id,
      patient_name,
      phone,
      date,
      time_label,
      address,
      doctor_name,
      doctor_specialization,
      created_at
    FROM appointments
    ORDER BY id ASC
  `);

  const workbook = XLSX.utils.book_new();

  // ✅ Excel headers
  const rows = [
    [
      "ID",
      "Patient Name",
      "Phone",
      "Date",
      "Time",
      "Address",
      "Doctor Name",
      "Doctor Specialization",
      "Created At"
    ]
  ];

  // ✅ Fill data
  result.rows.forEach(r => {
    rows.push([
      r.id,
      r.patient_name || "",
      r.phone || "",
      r.date || "",
      r.time_label || "",
      r.address || "",
      r.doctor_name || "",
      r.doctor_specialization || "",
      r.created_at || ""
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

  // ✅ Return buffer (for nodemailer)
  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });
};
