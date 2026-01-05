const pool = require("./db_pg");

(async () => {
  try {
    console.log("=== USERS TABLE ===");
    const users = await pool.query("SELECT * FROM users");
    console.table(users.rows);

    console.log("\n=== APPOINTMENTS TABLE ===");
    const appts = await pool.query("SELECT * FROM appointments");
    console.table(appts.rows);
  } catch (err) {
    console.error("DB error:", err.message);
  } finally {
    await pool.end();
  }
})();
