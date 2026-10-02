# Smart Attendance ESP32

Smart Attendance ESP32 is a classroom attendance system built around:

- an `ESP32` hardware terminal with button, LEDs, and buzzer
- an `Express + Prisma + PostgreSQL` backend
- a `React + Vite` lecturer dashboard
- a public QR-based student attendance page with OTP verification

The current design treats the ESP32 as a generic attendance terminal. The dashboard owns session setup, the backend owns attendance logic, and the ESP32 only reacts to session state and attendance updates.

## Project Structure

```text
smartAttendanceEsp32/
|-- SmartAttendanceESP32/        # ESP32 firmware
`-- attendanceBackend/           # Express API + Prisma + dashboard
    |-- src/                     # Backend source
    |-- prisma/                  # Prisma schema + migrations
    `-- dashboard/               # React dashboard
```

## Features

- Dashboard-based session creation
- QR attendance links for students
- Dynamic ESP32 Wi-Fi and backend provisioning from a local setup portal
- Student lookup by matric number
- Automatic student registration for new students
- OTP attendance verification
- SMTP-backed OTP email delivery with development fallback
- Separate dashboard user authentication with device-only API keys for ESP32 traffic
- Real-time dashboard updates over Socket.IO
- ESP32 live status polling with beep/LED feedback
- Session history
- CSV export
- Printable session report
- Attendance analytics based on enrolled class rosters

## Database Strategy

Use PostgreSQL as the system of record.

- `devices` stores trusted attendance terminals and API keys
- `courses` stores reusable course metadata
- `students` stores the canonical student profile keyed by `matricNumber`
- `course_enrollments` stores the enrolled class list for analytics and absence calculation
- `sessions` stores each attendance window opened by a lecturer
- `attendance_records` stores one row per student per session

Recommended operating model:

- Keep `students` and `course_enrollments` as long-lived data
- Treat `sessions` and `attendance_records` as append-only academic records
- Never delete attendance rows casually; mark sessions `ENDED` or `EXPIRED`
- Back up PostgreSQL daily once you move beyond local testing
- Use Prisma migrations as the only schema change path
- Move to managed Postgres for staging or production

Suggested environment progression:

- Local development: PostgreSQL on your machine
- Staging: managed Postgres such as Supabase, Neon, or Railway Postgres
- Production: managed Postgres with automated backups and point-in-time recovery

## Requirements

- `Node.js 20+` recommended
- `npm`
- `PostgreSQL`
- `Arduino IDE` or `arduino-cli` for the ESP32 sketch
- An `ESP32` board with:
  - button
  - green LED
  - red LED
  - buzzer

## 1. Backend Setup

```powershell
cd C:\Users\ADMIN\Documents\smartAttendanceEsp32\attendanceBackend
copy .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

The backend starts on `http://localhost:3000` by default.

### Important backend env values

`attendanceBackend/.env`

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendance_backend?schema=public"
CORS_ORIGIN=http://localhost:5173
DEVICE_API_KEY=change-me-for-local-testing
SESSION_DURATION_MINUTES=30
MAX_SESSION_DURATION_MINUTES=180
OTP_EXPIRY_MINUTES=5
MAX_OTP_ATTEMPTS=5
OTP_SECRET=change-me-before-production
PUBLIC_ATTENDANCE_URL=http://localhost:5173
JWT_SECRET=change-me-for-dashboard-auth
DASHBOARD_ADMIN_EMAIL=admin@example.com
DASHBOARD_ADMIN_PASSWORD=change-me-now
DASHBOARD_ADMIN_NAME=Dashboard Admin
DASHBOARD_ADMIN_DEVICE_ID=
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
SMTP_FROM=no-reply@example.com
```

## 2. Dashboard Setup

```powershell
cd C:\Users\ADMIN\Documents\smartAttendanceEsp32\attendanceBackend\dashboard
copy .env.example .env
npm install
npm run dev
```

The dashboard runs on `http://localhost:5173` by default.

### Dashboard environment

`attendanceBackend/dashboard/.env`

```env
VITE_API_BASE_URL=
VITE_SOCKET_URL=
VITE_PUBLIC_ATTENDANCE_URL=http://localhost:5173
VITE_DEV_TUNNEL_HOST=
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:3000
```

Notes:

- leave `VITE_API_BASE_URL` and `VITE_SOCKET_URL` empty for same-origin proxy mode
- the Vite dev server will proxy `/api` and `/socket.io` to the backend
- restart the dashboard dev server whenever `.env` or `vite.config.js` changes

## 3. ESP32 Setup

Open [SmartAttendanceESP32.ino](<C:/Users/ADMIN/Documents/smartAttendanceEsp32/SmartAttendanceESP32/SmartAttendanceESP32.ino:1>) in the Arduino IDE and upload it once.

After that, the terminal can be configured locally without reflashing.

Copy `SmartAttendanceESP32/secrets.example.h` to `SmartAttendanceESP32/secrets.h` only if you want firmware defaults. Keep the values blank for Wi-Fi, backend URL, and API key when using provisioning-only setup. `secrets.h` is intentionally excluded from Git.

### Setup portal flow

- on every boot, the ESP32 opens the setup access point first
- connect to the setup SSID shown on Serial
- open `http://192.168.4.1`
- save:
  - Wi-Fi SSID
  - Wi-Fi password
  - device ID
  - backend base URL
  - device API key
- after saving, the terminal closes the portal and connects using the values entered for that boot
- saved values are prefilled the next time the portal opens, so the user can reuse or change them quickly

Manual recovery:

- with no session active, hold the button for about 8 seconds to reopen the setup portal

### Hardware self-test

You can now run a quick on-device hardware check without changing any pin mappings in code.

- power the ESP32 off
- press and hold the hardware button wired to `GPIO14`
- power the ESP32 on while still holding the button
- keep holding for about 1.5 seconds until self-test mode starts
- release the button when Serial says to

The test will then:

- blink the green LED on `GPIO26`
- blink the red LED on `GPIO27`
- chirp the buzzer on `GPIO25`
- ask you to press and release the hardware button 3 times

After the test passes:

- the green LED flashes as a success signal
- hold the same hardware button for about 2 seconds to reboot back into normal attendance mode
- or simply power-cycle the ESP32

### Firmware behavior

The ESP32 now:

- connects to Wi-Fi
- stores Wi-Fi and backend settings in flash preferences
- opens the configuration portal on every startup
- polls `GET /api/device/status`
- detects whether a session is active
- beeps and flashes for new verified attendance
- can end the current session with a long button press

It does not own course or lecturer configuration.

## 4. How To Run Everything

Start services in this order:

1. Start PostgreSQL
2. Start the backend
3. Start the dashboard
4. Power the ESP32

Then open:

- Dashboard: [http://localhost:5173](http://localhost:5173)
- Backend health: [http://localhost:3000/health](http://localhost:3000/health)

## 5. How To Use The Application

### A. Log into the dashboard

Use dashboard user credentials, not the device API key.

For the first local admin login, set these in `attendanceBackend/.env`:

- `JWT_SECRET`
- `DASHBOARD_ADMIN_EMAIL`
- `DASHBOARD_ADMIN_PASSWORD`
- `DASHBOARD_ADMIN_NAME`
- optional `DASHBOARD_ADMIN_DEVICE_ID`

The first successful login with those credentials bootstraps the initial dashboard user if no users exist yet.

### B. Upload a class roster

Go to `Settings` and use the roster editor.

Each row should follow:

```csv
matricNumber,firstName,lastName,department,email,phoneNumber
CE/21/001,John,Doe,Computer Engineering,john@example.edu,+2348000000001
CE/21/002,Jane,Doe,Computer Engineering,jane@example.edu,+2348000000002
```

This roster powers:

- absent student detection
- enrolled totals
- attendance percentage analytics

### C. Start a session

Go to `Dashboard` and fill:

- course code
- course title
- lecturer
- duration

Click `Start session`.

### D. Student attendance flow

Students:

1. scan the QR code
2. enter their matric number
3. if found, continue with their saved record
4. if not found, complete registration
5. request an OTP
6. check their email for the OTP
7. enter the OTP
8. get marked present when verification succeeds

### E. End a session

End a session from either:

- the dashboard
- long press on the ESP32

### F. View reports and analytics

Go to `History`.

For each session you can:

- open the report view
- print the report
- download CSV

Session reports include:

- enrolled roster count
- present count
- verified count
- pending count
- absent count
- attendance percentage
- absent student list

## 6. OTP Email Delivery

The backend now supports SMTP delivery for student OTP emails.

### Mailtrap setup

For Mailtrap Email Sandbox testing, set these values in `attendanceBackend/.env`:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
SMTP_FROM=no-reply@example.com
```

Important:

- Mailtrap Email Sandbox is great for safe testing
- Sandbox does not send to students' real inboxes
- for real student email delivery, switch to Mailtrap Email Sending and use its verified sending domain credentials instead

Behavior:

- if SMTP is configured, the OTP is emailed to the student
- if SMTP is not configured and you are in development, the app exposes a development OTP fallback
- in production, SMTP should be configured before student use

## 7. API Summary

### Device

- `GET /api/device/status`

### Sessions

- `GET /api/session/current`
- `GET /api/session/history`
- `GET /api/session/:sessionId/report`
- `GET /api/session/:sessionId/export.csv`
- `POST /api/session/start`
- `POST /api/session/end`

### Attendance

- `GET /api/attendance/:token`
- `GET /api/attendance/:token/student/:matricNumber`
- `POST /api/attendance/:token/request-otp`
- `POST /api/attendance/:token/verify-otp`

### Courses / Rosters

- `GET /api/course`
- `GET /api/course/:courseCode`
- `PUT /api/course/:courseCode/roster`

### Dashboard auth

- `POST /api/auth/login`
- `GET /api/auth/me`

Auth split:

- `/api/device/status` remains device-authenticated with `X-API-Key`
- dashboard session and roster routes use bearer token auth
- public attendance routes still use session token plus OTP flow

## 8. Useful Commands

### Backend

```powershell
cd C:\Users\ADMIN\Documents\smartAttendanceEsp32\attendanceBackend
npm run dev
npx prisma generate
npx prisma migrate dev
```

### Dashboard

```powershell
cd C:\Users\ADMIN\Documents\smartAttendanceEsp32\attendanceBackend\dashboard
npm run dev
npm run build
npm run lint
```

## 9. Troubleshooting

### Backend cannot start

Check:

- PostgreSQL is running
- `DATABASE_URL` points to the right instance
- Prisma migrations have been applied

### Dashboard loads but cannot connect

Check:

- backend is running on port `3000`
- dashboard dev server was restarted after `.env` or `vite.config.js` changes
- `VITE_BACKEND_PROXY_TARGET` points to the local backend

### OTP is not arriving

Check:

- student email address is valid
- SMTP env values are present
- the sender account is allowed by your email provider
- spam folder

### ESP32 does not react

Check:

- the saved Wi-Fi settings in the setup portal
- the saved backend base URL
- the saved device API key
- the saved device ID if you changed it and expect the dashboard to reflect the new identity
- that the ESP32 and backend are on the same network

## Versioning and Releases

This project follows [Semantic Versioning](https://semver.org/): use `MAJOR.MINOR.PATCH` release numbers, such as `v1.0.0`.

- Increment `PATCH` for backward-compatible bug fixes.
- Increment `MINOR` for backward-compatible features.
- Increment `MAJOR` for breaking changes.

For every release, update `attendanceBackend/package.json`, add release notes to `CHANGELOG.md`, commit the changes, and create an annotated Git tag:

```powershell
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --follow-tags
```
