# Smart Attendance Backend

Express + Prisma backend for the ESP32 attendance system, now paired with a React + Vite live dashboard in [`dashboard/`](./dashboard).

## Backend Setup

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npx prisma generate`.
4. Run `npx prisma migrate dev`.
5. Start the API with `npm run dev`.

## Dashboard Authentication

The dashboard no longer signs in with the device API key.

- device API keys remain for ESP32-to-backend communication
- dashboard users sign in with email and password
- JWT bearer tokens protect dashboard routes

For the first local login, set these in `.env`:

```env
JWT_SECRET=change-me-for-dashboard-auth
DASHBOARD_ADMIN_EMAIL=admin@example.com
DASHBOARD_ADMIN_PASSWORD=change-me-now
DASHBOARD_ADMIN_NAME=Dashboard Admin
DASHBOARD_ADMIN_DEVICE_ID=
```

Bootstrap behavior:

- if no users exist yet, the first successful login with the bootstrap admin credentials creates the initial dashboard user
- if `DASHBOARD_ADMIN_DEVICE_ID` is set, that user is assigned to the matching device
- if it is left empty and exactly one active device exists, the dashboard can still resolve that single device automatically

## Dashboard Setup

1. Go to [`dashboard/`](./dashboard).
2. Copy `dashboard/.env.example` to `dashboard/.env` if you need custom frontend URLs.
3. Run `npm install`.
4. Start the dashboard with `npm run dev`.

You can also launch the frontend from the backend root with:

- `npm run dashboard:dev`
- `npm run dashboard:build`

## Public Attendance Flow

- `PUBLIC_ATTENDANCE_URL` should point to the frontend origin that serves `/attendance/:token`.
- Local default: `http://localhost:5173`
- The QR code now opens the public student page directly.
- Student OTP requests can be delivered by SMTP when configured.

## Mailtrap OTP Setup

The backend already supports SMTP, so Mailtrap fits without more code changes.

For Mailtrap Email Sandbox testing, add these values to `.env`:

```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
SMTP_FROM=no-reply@example.com
```

Important:

- Mailtrap Email Sandbox is for safe testing and inspection
- Sandbox does not deliver to a student's real inbox
- to send real OTP emails to students, use Mailtrap Email Sending with a verified domain and replace the SMTP credentials with that sending account's values

If SMTP is not configured:

- development mode falls back to a dev OTP value for local testing
- production should be considered incomplete until a real mail provider is configured

## Dashboard Proxy Mode

The dashboard can run in same-origin proxy mode so browser traffic stays on one public host.

- leave `VITE_API_BASE_URL` empty
- leave `VITE_SOCKET_URL` empty
- set `VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:3000`
- restart the Vite dev server after env changes

## ESP32 Wi-Fi Provisioning

The terminal can now change Wi-Fi and backend settings without reflashing.

- on every boot, it opens a setup access point first
- connect to the setup SSID shown on Serial and open `http://192.168.4.1`
- save:
  - Wi-Fi SSID
  - Wi-Fi password
  - device ID
  - backend base URL
  - device API key
- after saving, the portal closes and the terminal connects immediately using the entered values

The backend now honors the terminal's `deviceId` header on device-authenticated requests, so changing the device ID from the setup portal updates the device identity the dashboard sees as long as that ID is not already claimed by another device.

Manual recovery:

- with no active attendance session running, hold the hardware button for about 8 seconds to reopen the setup portal

## Available API Routes

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /health`
- `GET /api/device/status`
- `POST /api/session/start`
- `POST /api/session/end`
- `GET /api/session/current`
- `GET /api/session/history`
- `GET /api/attendance/:token`
- `POST /api/attendance/:token/request-otp`
- `POST /api/attendance/:token/verify-otp`

## Live Dashboard Events

The backend currently emits:

- `socket:ready`
- `session:started`
- `session-created`
- `session:ended`
- `session-ended`
- `attendance-updated`
- `student-verified`
