const pool = require("./db_pg.cjs");

(async () => {
  try {
    console.log("=== USERS TABLE ===");
    const users = await pool.query("SELECT * FROM users");
    console.table(users.rows);

    console.log("\n=== APPOINTMENTS TABLE ===");
    const appointments = await pool.query("SELECT * FROM appointments");
    console.table(appointments.rows);
  } catch (err) {
    console.error("DB error:", err.message);
  } finally {
    await pool.end();
  }
})();
