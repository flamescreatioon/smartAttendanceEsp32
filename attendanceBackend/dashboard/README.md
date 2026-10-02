# Smart Attendance Dashboard

React + Vite dashboard for the ESP32 attendance backend.

## Run Locally

1. Copy `.env.example` to `.env` if you need to override the default backend URLs.
2. Run `npm install`.
3. Run `npm run dev`.

The default local setup expects:

- API: `http://localhost:3000`
- Socket.IO: `http://localhost:3000`
- Attendance links: `http://localhost:5173`

## Dev Tunnel Setup

When forwarding the dashboard with a public tunnel, set the tunnel host without `https://`:

```env
VITE_DEV_TUNNEL_HOST=your-subdomain-5173.usw3.devtunnels.ms
VITE_PUBLIC_ATTENDANCE_URL=https://your-subdomain-5173.usw3.devtunnels.ms
```

If the backend is also exposed through a tunnel, point these to the backend tunnel:

```env
VITE_API_BASE_URL=https://your-backend-3000.usw3.devtunnels.ms
VITE_SOCKET_URL=https://your-backend-3000.usw3.devtunnels.ms
```

## Dashboard Features

- API-key based login using `GET /api/device/status`
- Live session snapshot from `GET /api/session/current`
- Session history from `GET /api/session/history`
- Socket.IO updates for `session:started` and `session:ended`
- Real-time QR code rendering and session countdown
- Public student attendance route at `/attendance/:token`
- OTP request and verification backed by `GET/POST /api/attendance/:token/*`

## Quality Checks

- `npm run lint`
- `npm run build`
