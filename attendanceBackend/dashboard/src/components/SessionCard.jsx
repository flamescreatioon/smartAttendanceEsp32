import { Cpu, Fingerprint, MapPin, Presentation, TimerReset } from 'lucide-react';
import { formatDateTime, formatDurationMinutes, getLecturerName, getSessionTitle } from '../utils/format.js';

const detailItems = [
  {
    label: 'Course',
    key: 'course',
    icon: Presentation,
  },
  {
    label: 'Lecturer',
    key: 'lecturer',
    icon: Fingerprint,
  },
  {
    label: 'Room',
    key: 'room',
    icon: MapPin,
  },
  {
    label: 'Device ID',
    key: 'deviceId',
    icon: Cpu,
  },
  {
    label: 'Started at',
    key: 'startedAt',
    icon: TimerReset,
  },
];

export default function SessionCard({ session }) {
  const values = {
    course: getSessionTitle(session),
    lecturer: getLecturerName(session),
    room: session?.device?.location || 'Room pending',
    deviceId: session?.device?.deviceId || 'Device pending',
    startedAt: formatDateTime(session?.startedAt),
  };

  return (
    <section className="panel session-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Session details</span>
          <h2>Operational snapshot</h2>
        </div>
      </div>

      <div className="session-card__summary">
        <div>
          <span className="session-card__summary-label">Session ID</span>
          <strong>{session?.id || 'Pending'}</strong>
        </div>
        <div>
          <span className="session-card__summary-label">Window</span>
          <strong>{session ? formatDurationMinutes(session) : '30 min default'}</strong>
        </div>
      </div>

      <dl className="session-card__details">
        {detailItems.map(({ label, key, icon: Icon }) => (
          <div key={key} className="session-card__detail">
            <dt>
              <Icon size={16} />
              <span>{label}</span>
            </dt>
            <dd>{values[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
