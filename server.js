// =======================================
// CleanRide Booking System – SERVER.JS
// Fully refactored for .env (dotenv)
// =======================================

require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// CONFIG DIN .ENV
// =============================
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const SESSION_SECRET = process.env.SESSION_SECRET || "local_secret";

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const SERVICE_EMAIL = process.env.SERVICE_EMAIL;
const SERVICE_NAME = "CleanRide Detailing";

// =============================
// EMAIL TRANSPORTER
// =============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

// =============================
// DATABASE SETUP
// =============================
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dbPath = path.join(dataDir, "booking.db");

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serviceType TEXT NOT NULL,
      date TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      reason TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      reason TEXT
    )
  `);
});

// Helpers pentru promisificare
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// =============================
// MIDDLEWARE
// =============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

// =============================
// VALIDĂRI / UTILITARE
// =============================
function isValidDateStr(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return !isNaN(new Date(str).getTime());
}

// Generate weekend slots
async function generateAvailableSlots(dateStr) {
  if (!isValidDateStr(dateStr)) return [];

  const d = new Date(dateStr);
  const day = d.getDay();
  if (!(day === 0 || day === 6)) return []; // doar weekend

  const blockedDay = await dbGet("SELECT id FROM blocked_days WHERE date = ?", [dateStr]);
  if (blockedDay) return [];

  const baseSlots = ["09:00–11:00", "12:00–14:00", "15:00–17:00"];

  const booked = await dbAll("SELECT timeSlot FROM bookings WHERE date = ?", [dateStr]);
  const blockedSlots = await dbAll("SELECT timeSlot FROM blocked_slots WHERE date = ?", [dateStr]);

  const used = new Set([
    ...booked.map(b => b.timeSlot),
    ...blockedSlots.map(b => b.timeSlot)
  ]);

  return baseSlots.filter(slot => !used.has(slot));
}

// =============================
// EMAIL TEMPLATES
// =============================
function createBookingHtml(booking) {
  return `
    <div style="font-family:sans-serif; padding:16px;">
      <h2>${SERVICE_NAME} – Confirmare rezervare</h2>
      <p>Bună, <strong>${booking.name}</strong>!</p>
      <p>Rezervarea ta a fost înregistrată.</p>
      <ul>
        <li><strong>Serviciu:</strong> ${booking.serviceType}</li>
        <li><strong>Data:</strong> ${booking.date}</li>
        <li><strong>Interval:</strong> ${booking.timeSlot}</li>
        <li><strong>Adresă:</strong> ${booking.address}</li>
      </ul>
      <p>Îți mulțumim,<br>${SERVICE_NAME}</p>
    </div>
  `;
}

function createBookingICS(booking) {
  const [from] = booking.timeSlot.split("–");
  const [h, m] = from.split(":");
  const dt = new Date(`${booking.date}T${h}:${m}:00`);

  const start = new Date(dt);
  const end = new Date(dt);
  end.setHours(end.getHours() + 2);

  const fmt = (d) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CleanRide//Booking//RO",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@cleanride`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${SERVICE_NAME} - ${booking.serviceType}`,
    `LOCATION:${booking.address}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

// =============================
// AUTH MIDDLEWARE
// =============================
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ message: "Necesită autentificare." });
}

// =============================
// ROUTES – FRONTEND FILES
// =============================
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public/login.html"))
);

app.get("/admin", (req, res) => {
  if (!req.session?.isAdmin) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// =============================
// API PUBLIC
// =============================
app.get("/api/slots", async (req, res) => {
  try {
    const date = req.query.date;
    const slots = await generateAvailableSlots(date);
    res.json({ date, slots });
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

app.post("/api/book", async (req, res) => {
  try {
    const { serviceType, date, timeSlot, name, phone, email, address, notes } =
      req.body;

    if (!serviceType || !date || !timeSlot || !name || !phone || !email || !address)
      return res.status(400).json({ message: "Lipsește informație obligatorie." });

    const available = await generateAvailableSlots(date);
    if (!available.includes(timeSlot))
      return res.status(409).json({ message: "Slot indisponibil." });

    const result = await dbRun(
      `INSERT INTO bookings (serviceType,date,timeSlot,name,phone,email,address,notes,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        serviceType,
        date,
        timeSlot,
        name,
        phone,
        email,
        address,
        notes || "",
        new Date().toISOString()
      ]
    );

    const booking = {
      id: result.lastID,
      serviceType,
      date,
      timeSlot,
      name,
      phone,
      email,
      address,
      notes
    };

    // Email client
    transporter.sendMail({
      from: `"${SERVICE_NAME}" <${SERVICE_EMAIL}>`,
      to: email,
      subject: "Confirmare rezervare",
      html: createBookingHtml(booking),
      attachments: [
        {
          filename: "booking.ics",
          content: createBookingICS(booking),
          contentType: "text/calendar"
        }
      ]
    });

    // Email admin
    transporter.sendMail({
      from: `"${SERVICE_NAME}" <${SERVICE_EMAIL}>`,
      to: SERVICE_EMAIL,
      subject: `Nouă rezervare - ${serviceType}`,
      text: `
Nume: ${name}
Telefon: ${phone}
Email: ${email}
Data: ${date}
Interval: ${timeSlot}
Serviciu: ${serviceType}
Adresă: ${address}
Notes: ${notes || "-"}
`
    });

    res.json({ success: true, bookingId: booking.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Eroare server." });
  }
});

// =============================
// API ADMIN AUTH
// =============================
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ message: "Date invalide." });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/api/admin/me", (req, res) =>
  res.json({ isAdmin: !!req.session?.isAdmin })
);

// =============================
// API ADMIN DATA
// =============================
app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await dbAll(
      `SELECT * FROM bookings WHERE date >= ? ORDER BY date ASC, timeSlot ASC`,
      [today]
    );
    res.json({ bookings: rows });
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const perService = await dbAll(
      `SELECT serviceType, COUNT(*) as count FROM bookings GROUP BY serviceType`
    );
    const perDay = await dbAll(
      `SELECT date, COUNT(*) as count FROM bookings GROUP BY date ORDER BY date ASC`
    );

    const prices = { Basic: 150, Standard: 250, Premium: 350 };
    const allBookings = await dbAll(`SELECT serviceType FROM bookings`);

    let revenue = 0;
    allBookings.forEach((b) => (revenue += prices[b.serviceType] || 0));

    res.json({ perService, perDay, revenue });
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

app.get("/api/admin/blocks", requireAdmin, async (req, res) => {
  try {
    const days = await dbAll(`SELECT * FROM blocked_days ORDER BY date ASC`);
    const slots = await dbAll(
      `SELECT * FROM blocked_slots ORDER BY date ASC, timeSlot ASC`
    );
    res.json({ blockedDays: days, blockedSlots: slots });
  } catch {
    res.status(500).json({ message: "Eroare." });
  }
});

// block day
app.post("/api/admin/block-day", requireAdmin, async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ message: "Dată invalidă." });

    await dbRun(
      `INSERT OR IGNORE INTO blocked_days (date, reason) VALUES (?,?)`,
      [date, reason || ""]
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

// block slot
app.post("/api/admin/block-slot", requireAdmin, async (req, res) => {
  try {
    const { date, timeSlot, reason } = req.body;
    if (!date || !timeSlot)
      return res.status(400).json({ message: "Date invalide." });

    await dbRun(
      `INSERT INTO blocked_slots (date, timeSlot, reason) VALUES (?,?,?)`,
      [date, timeSlot, reason || ""]
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

// unblock
app.post("/api/admin/unblock", requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.body;

    if (type === "day")
      await dbRun(`DELETE FROM blocked_days WHERE id = ?`, [id]);
    else if (type === "slot")
      await dbRun(`DELETE FROM blocked_slots WHERE id = ?`, [id]);
    else return res.status(400).json({ message: "Tip invalid." });

    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

// export CSV
app.get("/api/admin/export", requireAdmin, async (req, res) => {
  try {
    const rows = await dbAll(`SELECT * FROM bookings ORDER BY date ASC`);
    let csv = "id,date,timeSlot,serviceType,name,phone,email,address,notes,createdAt\n";

    rows.forEach((b) => {
      const row = [
        b.id,
        b.date,
        b.timeSlot,
        b.serviceType,
        b.name,
        b.phone,
        b.email,
        b.address,
        b.notes || "",
        b.createdAt
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

      csv += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=bookings.csv");
    res.send(csv);
  } catch {
    res.status(500).json({ message: "Eroare server." });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server pornit → http://localhost:${PORT}`);
});
