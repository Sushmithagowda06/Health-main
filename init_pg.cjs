const pool = require("./db_pg.cjs");

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.appointments (
      id SERIAL PRIMARY KEY,
      patient_name TEXT,
      email TEXT,
      date DATE,
      time TEXT
    )
  `);

  console.log("✅ appointments table created");
})();
