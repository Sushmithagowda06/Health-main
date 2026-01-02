// check_db.js
// const sqlite3 = require("sqlite3").verbose();
// const db = new sqlite3.Database("./cuure.db");
const Database = require("better-sqlite3");
const db = new Database("./cuure.db");

db.serialize(() => {
  console.log("=== USERS TABLE ===");
  db.all("SELECT * FROM users", (err, rows) => {
    if (err) {
      console.error("Error on users:", err.message);
    } else {
      console.table(rows);
    }

    console.log("\n=== APPOINTMENTS TABLE ===");
    db.all("SELECT * FROM appointments", (err2, rows2) => {
      if (err2) {
        console.error("Error on appointments:", err2.message);
    } else {
      console.table(rows2);
    }
      db.close();
    });
  });
});