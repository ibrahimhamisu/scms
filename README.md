# SCMS - Online Student Complaint Management System
Katsina State Institute of Technology and Management - by Ibrahim Hamisu

## Run (Termux or computer) - no npm install needed
1. Install Node.js 18+ (Termux: pkg install nodejs)
2. cd SCMS-online
3. node server.js
4. Open http://localhost:3000  (same WiFi: http://YOUR-PHONE-IP:3000)

## Structure
- server.js : backend (API, login tokens, password hashing, permissions)
- data/db.json : database file (created automatically on first run)
- public/ : the app UI (same design as before)

## Accounts (change passwords in Settings after first login)
Student: NID/CSE/25/0102 / 1234
Admin:   admin / admin123   (or set ADMIN_PASSWORD before first run)
Dept:    dept / dept123

## Put it online
Host the folder on a Node host (Render, Railway, VPS...). Start command: node server.js
Env: SECRET=<long random text>, ADMIN_PASSWORD=<strong password>, DATA_DIR=<persistent disk folder>
IMPORTANT: many free hosts erase files on restart. Use a persistent disk or move to a real database.

## Notes
- Passwords hashed (scrypt); signed login tokens; server checks permissions.
- Forgot password needs registration number AND account email (students only).
- Data refreshes automatically every 20 seconds.
