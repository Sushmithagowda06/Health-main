const pool = require("./db_pg.cjs");
const XLSX = require("xlsx");

module.exports = async () => {
  const result = await pool.query(`
    SELECT
      id,
      patient_name,
      phone_number,
      date,
      COALESCE(time_label, time::text) AS time_label,
      COALESCE(doctor_name, '') AS doctor_name,
      COALESCE(doctor_specialization, '') AS doctor_specialization,
      COALESCE(address, '') AS address,
      COALESCE(location_link, '') AS location_link
    FROM appointments
    ORDER BY id ASC
  `);

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
      "Location Link"
    ]
  ];

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

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer"
  });
};
