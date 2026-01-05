const pool = require("./db_pg.cjs");
const XLSX = require("xlsx");

module.exports = async function exportAppointments() {
  const result = await pool.query(`
    SELECT
      id,
      patient_name,
      phone_number,
      date,
      time_label,
      doctor_name,
      doctor_specialization,
      address,
      location_link
    FROM appointments
    ORDER BY id ASC
  `);

  // Header row
  const rows = [
    [
      "ID",
      "Patient Name",
      "Phone Number",
      "Date",
      "Time",
      "Doctor",
      "Specialization",
      "Address",
      "Location"
    ]
  ];

  // Data rows
  result.rows.forEach(r => {
    rows.push([
      r.id,
      r.patient_name ?? "",
      r.phone_number ?? "",
      r.date ?? "",
      r.time_label ?? "",
      r.doctor_name ?? "",
      r.doctor_specialization ?? "",
      r.address ?? "",
      r.location_link ?? ""
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Appointments");

  return XLSX.write(wb, {
    bookType: "xlsx",
    type: "buffer"
  });
};
