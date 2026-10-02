const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
});

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue;
}

export function formatDateTime(value) {
  const parsedValue = parseDate(value);
  return parsedValue ? dateTimeFormatter.format(parsedValue) : 'Not available';
}

export function formatDate(value) {
  const parsedValue = parseDate(value);
  return parsedValue ? dateFormatter.format(parsedValue) : 'Not available';
}

export function formatTime(value) {
  const parsedValue = parseDate(value);
  return parsedValue ? timeFormatter.format(parsedValue) : 'Not available';
}

export function formatRelativeTime(value) {
  const parsedValue = parseDate(value);
  if (!parsedValue) {
    return 'Not available';
  }

  const diffInSeconds = Math.round((parsedValue.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffInSeconds);

  if (absoluteSeconds < 60) {
    return relativeTimeFormatter.format(diffInSeconds, 'second');
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return relativeTimeFormatter.format(diffInMinutes, 'minute');
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return relativeTimeFormatter.format(diffInHours, 'hour');
  }

  const diffInDays = Math.round(diffInHours / 24);
  return relativeTimeFormatter.format(diffInDays, 'day');
}

export function getRemainingSeconds(session) {
  if (!session?.expiresAt) {
    return 0;
  }

  if (session.status && session.status !== 'ACTIVE') {
    return 0;
  }

  return Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
}

export function formatCountdown(totalSeconds) {
  const safeValue = Math.max(0, totalSeconds);
  const minutes = String(Math.floor(safeValue / 60)).padStart(2, '0');
  const seconds = String(safeValue % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
}

export function getSessionStatus(session) {
  if (!session) {
    return 'IDLE';
  }

  if (session.status === 'ACTIVE' && getRemainingSeconds(session) === 0) {
    return 'EXPIRED';
  }

  return session.status ?? 'IDLE';
}

export function humanizeStatus(status) {
  return String(status ?? 'UNKNOWN')
    .toLowerCase()
    .split(/[_:\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function getStatusTone(status) {
  switch (status) {
    case 'ACTIVE':
    case 'VERIFIED':
    case 'SUCCESS':
      return 'success';
    case 'EXPIRED':
    case 'WARNING':
    case 'PENDING':
      return 'warning';
    case 'ENDED':
    case 'ERROR':
    case 'OFFLINE':
      return 'error';
    case 'IDLE':
    default:
      return 'neutral';
  }
}

export function getQrValue(session) {
  const rawAttendanceUrl = typeof session?.attendanceUrl === 'string'
    ? session.attendanceUrl.trim()
    : '';

  return rawAttendanceUrl;
}

export function getSessionTitle(session) {
  if (!session) {
    return 'Course pending';
  }

  if (session.courseCode && session.courseTitle) {
    return `${session.courseCode} - ${session.courseTitle}`;
  }

  return session.courseTitle || session.courseCode || 'Course pending';
}

export function getLecturerName(session) {
  return session?.lecturerId || 'Lecturer pending';
}

export function formatDurationMinutes(session) {
  if (!session?.startedAt) {
    return 'Not set';
  }

  const startDate = parseDate(session.startedAt);
  const endDate = parseDate(session.endedAt) ?? parseDate(session.expiresAt);
  if (!startDate || !endDate) {
    return 'Not set';
  }

  const durationInMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  return `${durationInMinutes} min`;
}

export function computeAttendanceStats(attendanceRecords, session) {
  const present = attendanceRecords.length;
  const verified = attendanceRecords.filter((record) => {
    const otpStatus = String(record.otpStatus ?? '').toLowerCase();
    const attendanceStatus = String(record.attendanceStatus ?? '').toLowerCase();
    return otpStatus === 'verified' || attendanceStatus === 'verified';
  }).length;

  return {
    present,
    pending: Math.max(0, present - verified),
    verified,
    timeLeftMinutes: session ? Math.max(0, Math.ceil(getRemainingSeconds(session) / 60)) : 0,
  };
}

export function maskApiKey(apiKey) {
  if (!apiKey) {
    return 'Not configured';
  }

  if (apiKey.length <= 8) {
    return apiKey;
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
