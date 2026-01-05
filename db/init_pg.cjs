const pool = require("./pg.cjs");

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      phone TEXT,
      name TEXT,
      date DATE,
      time TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ appointments table ready");
  process.exit(0);
})();
