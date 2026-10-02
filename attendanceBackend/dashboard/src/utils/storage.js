const AUTH_STORAGE_KEY = 'smart-attendance-dashboard-auth';

function normalizeAuth(auth) {
  if (!auth || typeof auth !== 'object') {
    return null;
  }

  const token = typeof auth.token === 'string' ? auth.token.trim() : '';
  if (!token) {
    return null;
  }

  return {
    token,
    operatorName: typeof auth.operatorName === 'string' ? auth.operatorName.trim() : '',
    email: typeof auth.email === 'string' ? auth.email.trim() : '',
    role: typeof auth.role === 'string' ? auth.role.trim() : '',
    deviceName: typeof auth.deviceName === 'string' ? auth.deviceName.trim() : '',
    deviceLocation: typeof auth.deviceLocation === 'string' ? auth.deviceLocation.trim() : '',
    deviceId: typeof auth.deviceId === 'string' ? auth.deviceId.trim() : '',
  };
}

export function getStoredAuth() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return normalizeAuth(JSON.parse(rawValue));
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function persistAuth(auth) {
  if (typeof window === 'undefined') {
    return null;
  }

  const normalizedAuth = normalizeAuth(auth);
  if (!normalizedAuth) {
    return null;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedAuth));
  return normalizedAuth;
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
