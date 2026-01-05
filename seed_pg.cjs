const pool = require("./db_pg.cjs");

(async () => {
  await pool.query(`
    INSERT INTO public.appointments
      (phone, patient_name, email, date, time, created_at)
    VALUES
      ('9999999999', 'Test User', 'test@example.com', '2025-01-01', '4:00 PM - 4:30 PM', NOW()),
      ('917483667619', 'Trisha Reddy', 'trisha@example.com', '2025-12-10', '4:30 PM - 5:00 PM', NOW()),
      ('917483667619', 'Nikhil', 'nikhil@example.com', '2025-12-25', '4:00 PM - 4:30 PM', NOW()),
      ('919980717590', 'Test Two', 'two@example.com', '2025-12-27', '5:30 PM - 6:00 PM', NOW())
  `);

  console.log("✅ Dummy appointment data inserted");
  process.exit(0);
})();
