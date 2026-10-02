import { useEffect, useState } from 'react';
import { Activity, Clock3, PlayCircle, RefreshCw, ShieldCheck, Square, TimerReset, Users, Wifi, WifiOff } from 'lucide-react';
import AttendanceTable from '../components/AttendanceTable.jsx';
import Header from '../components/Header.jsx';
import QRCard from '../components/QRCard.jsx';
import SessionCard from '../components/SessionCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import StudentCard from '../components/StudentCard.jsx';
import { useAttendance } from '../hooks/useAttendance.js';
import { formatDateTime, formatRelativeTime, getSessionStatus } from '../utils/format.js';

export default function Dashboard({ auth, onLogout }) {
  const [sessionForm, setSessionForm] = useState({
    courseCode: '',
    courseTitle: '',
    lecturerId: auth.operatorName || '',
    durationMinutes: '30',
  });
  const {
    session,
    attendanceRecords,
    attendanceStats,
    currentSessionQuery,
    deviceStatusQuery,
    socketConnected,
    startSession,
    startSessionPending,
    endSession,
    endSessionPending,
  } = useAttendance({ token: auth.token });

  const device = deviceStatusQuery.data?.device ?? session?.device ?? null;
  const sessionStatus = getSessionStatus(session);
  const latestRecord = attendanceRecords[0] ?? null;
  const todayAttendance = deviceStatusQuery.data?.stats?.todayAttendance ?? 0;
  const deviceOnline = Boolean(device?.isOnline);
  const recentActivityLabel = latestRecord?.checkInTime
    ? formatRelativeTime(latestRecord.checkInTime)
    : 'No live activity yet';

  useEffect(() => {
    setSessionForm((currentForm) => (
      currentForm.lecturerId
        ? currentForm
        : {
          ...currentForm,
          lecturerId: auth.operatorName || '',
        }
    ));
  }, [auth.operatorName]);

  function updateSessionForm(fieldName, value) {
    setSessionForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }));
  }

  async function handleStartSession(event) {
    event.preventDefault();

    await startSession({
      courseCode: sessionForm.courseCode.trim(),
      courseTitle: sessionForm.courseTitle.trim(),
      lecturerId: sessionForm.lecturerId.trim(),
      durationMinutes: Number(sessionForm.durationMinutes),
    });
  }

  async function handleEndSession() {
    if (!session?.id) {
      return;
    }

    await endSession(session.id);
  }

  return (
    <main className="app-shell">
      <Header
        auth={auth}
        session={session}
        device={device}
        socketConnected={socketConnected}
        onLogout={onLogout}
      />

      <section className="page-section">
        <div className="page-section__heading">
          <div>
            <span className="eyebrow">Live control room</span>
            <h2>Monitor attendance in real time</h2>
            <p>
              Start the session from the dashboard, then watch the QR code, timer, and
              student check-ins update without refreshing the page.
            </p>
          </div>

          <button
            type="button"
            className="button button--ghost"
            onClick={() => currentSessionQuery.refetch()}
            disabled={currentSessionQuery.isFetching}
          >
            <RefreshCw size={16} />
            <span>{currentSessionQuery.isFetching ? 'Refreshing...' : 'Refresh snapshot'}</span>
          </button>
        </div>

        <div className="stats-grid">
          <StudentCard
            label="Present"
            value={attendanceStats.present}
            helper="Students seen in the live roster"
            icon={Users}
          />
          <StudentCard
            label="Pending"
            value={attendanceStats.pending}
            helper="Waiting for OTP verification"
            icon={ShieldCheck}
            tone="warning"
          />
          <StudentCard
            label="Verified"
            value={attendanceStats.verified}
            helper="Students fully verified"
            icon={ShieldCheck}
            tone="success"
          />
          <StudentCard
            label="Time Left"
            value={`${attendanceStats.timeLeftMinutes} min`}
            helper={session ? `${sessionStatus.toLowerCase()} session window` : 'No active session yet'}
            icon={Clock3}
            tone="neutral"
          />
        </div>

        <section className="dashboard-callouts">
          <article className={`panel pulse-panel ${deviceOnline ? 'pulse-panel--online' : 'pulse-panel--offline'}`}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Terminal pulse</span>
                <h2>{device?.name || device?.deviceId || 'Attendance terminal'}</h2>
              </div>
              <StatusBadge status={deviceOnline ? 'ACTIVE' : 'OFFLINE'}>
                {deviceOnline ? 'Online' : 'Offline'}
              </StatusBadge>
            </div>

            <div className="pulse-panel__metrics">
              <div className="pulse-metric">
                {deviceOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                <div>
                  <span>Heartbeat</span>
                  <strong>{deviceOnline ? 'Receiving live polls' : 'Waiting for terminal'}</strong>
                </div>
              </div>
              <div className="pulse-metric">
                <TimerReset size={18} />
                <div>
                  <span>Last seen</span>
                  <strong>{device?.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : 'Not available'}</strong>
                </div>
              </div>
              <div className="pulse-metric">
                <Users size={18} />
                <div>
                  <span>Today total</span>
                  <strong>{todayAttendance} verified</strong>
                </div>
              </div>
            </div>

            <p className="pulse-panel__note">
              {device
                ? `Device ID: ${device.deviceId}. ${device.location ? `Location: ${device.location}. ` : ''}${device?.lastSeenAt ? `Last heartbeat recorded ${formatDateTime(device.lastSeenAt)}.` : 'No heartbeat recorded yet.'}`
                : 'The dashboard will show terminal identity and heartbeat as soon as the backend returns device metadata.'}
            </p>
          </article>

          <article className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Live activity</span>
                <h2>What just happened</h2>
              </div>
              <div className="activity-panel__pill">
                <Activity size={16} />
                <span>{recentActivityLabel}</span>
              </div>
            </div>

            {latestRecord ? (
              <div className="activity-panel__body">
                <div className="activity-panel__hero">
                  <strong>{latestRecord.name}</strong>
                  <span>{latestRecord.matricNumber}</span>
                </div>
                <div className="activity-panel__details">
                  <div>
                    <span>Department</span>
                    <strong>{latestRecord.department}</strong>
                  </div>
                  <div>
                    <span>Check-in</span>
                    <strong>{formatDateTime(latestRecord.checkInTime)}</strong>
                  </div>
                  <div>
                    <span>OTP</span>
                    <StatusBadge status={latestRecord.otpStatus} />
                  </div>
                  <div>
                    <span>Attendance</span>
                    <StatusBadge status={latestRecord.attendanceStatus} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="activity-panel__empty">
                The first student activity for this session will appear here so the lecturer can confirm the system is flowing.
              </div>
            )}
          </article>
        </section>

        <section className="panel session-launch">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Session setup</span>
              <h2>Configure the active attendance window</h2>
            </div>
          </div>

          <form className="session-launch__form" onSubmit={handleStartSession}>
            <div className="session-launch__grid">
              <label className="field">
                <span>Course code</span>
                <div className="field__input">
                  <input
                    type="text"
                    value={sessionForm.courseCode}
                    onChange={(event) => updateSessionForm('courseCode', event.target.value)}
                    placeholder="CSC401"
                    required
                    disabled={Boolean(session)}
                  />
                </div>
              </label>

              <label className="field">
                <span>Course title</span>
                <div className="field__input">
                  <input
                    type="text"
                    value={sessionForm.courseTitle}
                    onChange={(event) => updateSessionForm('courseTitle', event.target.value)}
                    placeholder="Computer Networks"
                    disabled={Boolean(session)}
                  />
                </div>
              </label>

              <label className="field">
                <span>Lecturer</span>
                <div className="field__input">
                  <input
                    type="text"
                    value={sessionForm.lecturerId}
                    onChange={(event) => updateSessionForm('lecturerId', event.target.value)}
                    placeholder="Dr John"
                    required
                    disabled={Boolean(session)}
                  />
                </div>
              </label>

              <label className="field">
                <span>Duration (minutes)</span>
                <div className="field__input">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={sessionForm.durationMinutes}
                    onChange={(event) => updateSessionForm('durationMinutes', event.target.value)}
                    required
                    disabled={Boolean(session)}
                  />
                </div>
              </label>
            </div>

            <div className="session-launch__footer">
              <p>
                The ESP32 terminal stays generic. It only reacts to session state and
                attendance counters from the backend.
              </p>

              <button
                type="submit"
                className="button button--primary"
                disabled={Boolean(session) || startSessionPending}
              >
                <PlayCircle size={16} />
                <span>{startSessionPending ? 'Starting session...' : 'Start session'}</span>
              </button>
            </div>
          </form>
        </section>
      </section>

      {session ? (
        <section className="content-grid">
          <QRCard session={session} />
          <SessionCard session={session} />
        </section>
      ) : (
        <section className="panel empty-state">
          <div>
            <span className="eyebrow">Standby</span>
            <h2>Waiting for the next attendance session</h2>
            <p>
              Start a session from the dashboard to activate the terminal. As soon as the
              backend opens the window, the QR code, course details, and countdown timer
              appear here instantly.
            </p>
          </div>

          <StatusBadge status="IDLE">Dashboard start required</StatusBadge>
        </section>
      )}

      <section className="summary-strip panel">
        <div>
          <span className="eyebrow">Students present</span>
          <strong>{attendanceRecords.length}</strong>
        </div>
        <p>
          {device
            ? `${deviceOnline ? 'Terminal online' : 'Terminal offline'}: ${device.name || device.deviceId} / ${device.location || 'Location pending'}`
            : 'No device metadata loaded yet.'}
        </p>
      </section>

      <AttendanceTable attendanceRecords={attendanceRecords} />

      <section className="action-bar">
        {session ? (
          <button
            type="button"
            className="button button--danger"
            onClick={handleEndSession}
            disabled={endSessionPending}
          >
            <Square size={16} />
            <span>{endSessionPending ? 'Ending session...' : 'End session'}</span>
          </button>
        ) : null}
      </section>
    </main>
  );
}
