import axios from 'axios';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim?.() ?? '';
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim?.() ?? '';

export const API_BASE_URL = configuredApiBaseUrl;
export const SOCKET_URL = configuredSocketUrl;

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 15000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

function withAuthToken(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function loginDashboard(payload) {
  const response = await api.post('/api/auth/login', payload);
  return response.data.data ?? null;
}

export async function getDashboardContext(token) {
  const response = await api.get('/api/auth/me', withAuthToken(token));
  return response.data.data ?? null;
}

export async function getCurrentSession(token) {
  const response = await api.get('/api/session/current', withAuthToken(token));
  return response.data.data ?? null;
}

export async function getSessionHistory(limit = 12, token) {
  const response = await api.get('/api/session/history', {
    ...withAuthToken(token),
    params: { limit },
  });
  return response.data.data ?? [];
}

export async function getCourses(token) {
  const response = await api.get('/api/course', withAuthToken(token));
  return response.data.data ?? [];
}

export async function getCourseRoster(courseCode, token) {
  const response = await api.get(`/api/course/${encodeURIComponent(courseCode)}`, withAuthToken(token));
  return response.data.data ?? null;
}

export async function saveCourseRoster(courseCode, payload, token) {
  const response = await api.put(
    `/api/course/${encodeURIComponent(courseCode)}/roster`,
    payload,
    withAuthToken(token),
  );
  return response.data.data ?? null;
}

export async function startSession(payload, token) {
  const response = await api.post('/api/session/start', payload, withAuthToken(token));
  return response.data;
}

export async function endSession(sessionId, token) {
  const response = await api.post(
    '/api/session/end',
    { sessionId },
    withAuthToken(token),
  );

  return response.data;
}

export async function getSessionReport(sessionId, token) {
  const response = await api.get(`/api/session/${sessionId}/report`, withAuthToken(token));
  return response.data.data ?? null;
}

export async function downloadSessionCsv(sessionId, token) {
  const response = await api.get(`/api/session/${sessionId}/export.csv`, {
    ...withAuthToken(token),
    responseType: 'blob',
  });

  return response.data;
}

export async function getAttendanceSession(token) {
  const response = await api.get(`/api/attendance/${token}`);
  return response.data.data ?? null;
}

export async function lookupAttendanceStudent(token, matricNumber) {
  const response = await api.get(`/api/attendance/${token}/student/${encodeURIComponent(matricNumber)}`);
  return response.data.data ?? null;
}

export async function requestAttendanceOtp(token, payload) {
  const response = await api.post(`/api/attendance/${token}/request-otp`, payload);
  return response.data;
}

export async function verifyAttendanceOtp(token, payload) {
  const response = await api.post(`/api/attendance/${token}/verify-otp`, payload);
  return response.data;
}
