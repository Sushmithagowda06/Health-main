const pool = require("./db_pg.cjs");

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      patient_name TEXT,
      phone_number TEXT,
      date DATE,
      time TEXT,
      time_value TEXT,
      address TEXT,
      location_link TEXT,
      doctor_name TEXT,
      doctor_specialization TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ appointments table ready");
})();
